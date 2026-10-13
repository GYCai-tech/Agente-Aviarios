"""
Núcleo de cálculo + estudio técnico de nave.

Este módulo es la ÚNICA fuente de verdad para las constantes físicas de los
módulos, los límites normativos y el cálculo de capacidad del nidal A-Nida.
`intake.py`, `nidal_layout.py` y `plano_agent.py` importan de aquí: no deben
redefinir densidades, huellas ni reglas de yacija.

No importa nada de `agentes.*` — así la cadena de dependencias queda
estudio → nidal_layout → intake, sin ciclos.

Sobre el estudio en sí: a diferencia de /capacidad (que compara todos los
sistemas y alimenta la propuesta comercial), aquí el módulo ya está elegido de
antemano y el objetivo es estudiar la nave. Sin llamadas a Gemini.
"""
from __future__ import annotations

import math
from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict, model_validator
from agentes.aforo import EquipamientoMedido, AforoRequest, AforoResultado, LimiteAforo, calcular_aforo

Sistema = Literal["suelo", "campero", "ecologico", "jaulas"]

# ── Límites normativos ────────────────────────────────────────────────────────

# Densidad máxima (gallinas por m² de superficie utilizable)
DENSIDAD_MAX: dict[str, float] = {
    "suelo":     9.0,   # RD 3/2002 Anexo IV
    "campero":   9.0,   # Directiva 1999/74/CE — sistemas alternativos
    "ecologico": 6.0,   # Regl. UE 2018/848
    "jaulas":    9.0,
}

# Tope absoluto de gallinas por gallinero en producción ecológica
MAX_GALLINAS_ECOLOGICO = 3_000

# Fracción mínima de la superficie de nave que debe ser yacija (RD 3/2002 Anexo IV)
FRACCION_YACIJA = 1 / 3

# Ocupación máxima del nidal colectivo: 1 m² por cada 120 gallinas
GALLINAS_POR_M2_NIDAL = 120


def densidad_max_para(sistema: str) -> float:
    return DENSIDAD_MAX.get(sistema, 9.0)


# ── Constantes físicas — Nidal colectivo A-Nida (plano 26301001) ─────────────

NIDAL_LARGO  = 1.20                              # m — a lo largo de la nave
NIDAL_ANCHO  = 1.40                              # m — profundidad del cuerpo
NIDAL_CUERPO = round(NIDAL_LARGO * NIDAL_ANCHO, 4)   # 1.68 m²
NIDAL_CAP    = 144                               # gallinas por módulo
NIDAL_TENSOR = 3.00                              # m — módulo tensor, dentro de la nave
NIDAL_EQUIP  = 4.00                              # m — local técnico, anexo exterior a la nave
NIDAL_SLOT_DEFAULT = 3.00                        # m — slot por lado en la configuración estándar
# Paso libre entre el borde del slot y la pared de la nave. Una franja más
# estrecha computa como yacija pero no es aprovechable ni permite el manejo.
NIDAL_PASO_PARED = 1.00                          # m a cada lado

# Profundidades de slot seleccionables por lado
SLOTS_PERMITIDOS = (0.0, 1.0, 2.0, 3.0)


# ── Constantes físicas — Aviario Industrial (cód. 10007) ─────────────────────

AVI_MOD_A     = 1.20                             # m — paralela al largo de nave
AVI_MOD_B     = 3.30                             # m — paralela al ancho de nave
AVI_HUELLA_M2 = round(AVI_MOD_A * AVI_MOD_B, 4)  # 3.96 m²
AVI_CAP       = 144                              # gallinas por módulo
AVI_PASILLO   = 1.00                             # m — pasillo entre filas
AVI_CLEARANCE       = 4.00                       # m — zona de equipos en un extremo
AVI_CLEARANCE_FONDO = 3.00                       # m — zona de equipos en el otro extremo

# Superficie por módulo según niveles (datos del diseñador).
# "disponible" excluye la zona de puesta y es la que computa para densidad.
AVI_SUP_TOTAL = {2: 7.638,  3: 11.216}
AVI_SUP_DISP  = {2: 5.5452, 3: 9.1232}


# ── Reglas de superficie ──────────────────────────────────────────────────────

def base_densidad(sup_interior_util: float) -> float:
    """
    Superficie utilizable que computa para densidad: solo superficie interior.

    Ni el parque de invierno ni la zona de pasto suman aquí. Ambos son anexos
    exteriores a la nave y se verifican aparte, no amplían la capacidad interior.
    """
    return max(sup_interior_util, 0.0)


def yacija_disponible(sup_nave: float, huella_ocupada: float) -> float:
    """
    Yacija disponible = nave − huella ocupada (cuerpo + slots / módulos).

    Igual que en densidad: las superficies exteriores no compensan yacija.
    """
    return max(sup_nave - huella_ocupada, 0.0)


def yacija_minima(sup_referencia: float) -> float:
    """Mínimo exigido: 1/3 de la superficie de referencia (nave o superficie total)."""
    return round(sup_referencia * FRACCION_YACIJA, 2)


def cap_ecologico(gallinas: int, sistema: str) -> tuple[int, bool]:
    """Aplica el tope de 3.000 gallinas por gallinero ecológico."""
    if sistema == "ecologico" and gallinas > MAX_GALLINAS_ECOLOGICO:
        return MAX_GALLINAS_ECOLOGICO, True
    return gallinas, False


# ── Capacidad del nidal — cálculo canónico ────────────────────────────────────

def max_modulos_nidal(largo_nave: float, ancho_nave: float | None = None) -> int:
    """
    Módulos que caben físicamente en una fila.

    La cadena va por el lado largo. El módulo tensor (3 m) va DENTRO de la nave;
    el local técnico (4 m) es una habitación anexa exterior y no resta longitud.
    """
    largo = largo_nave  # No rotar el eje longitudinal sin rotar también el plano.
    disponible = largo - NIDAL_TENSOR
    if disponible < NIDAL_LARGO:
        return 0
    return math.floor(disponible / NIDAL_LARGO)


def perfil_nidal_m(slot_izq: float, slot_der: float) -> float:
    """Profundidad del conjunto cuerpo + slots (sin los pasos laterales)."""
    return NIDAL_ANCHO + slot_izq + slot_der


def ancho_nave_minimo(slot_izq: float, slot_der: float,
                      paso_izq: float = NIDAL_PASO_PARED,
                      paso_der: float = NIDAL_PASO_PARED) -> float:
    """Ancho de nave necesario: perfil del módulo + el paso exigido a cada lado.

    Un paso de 0 significa que ese lado va pegado a la pared.
    """
    return perfil_nidal_m(slot_izq, slot_der) + paso_izq + paso_der


def holgura_nidal(ancho_nave: float, slot_izq: float, slot_der: float,
                  paso_izq: float = NIDAL_PASO_PARED,
                  paso_der: float = NIDAL_PASO_PARED) -> float:
    """Ancho sobrante una vez colocados el módulo y los pasos exigidos."""
    return ancho_nave - ancho_nave_minimo(slot_izq, slot_der, paso_izq, paso_der)


def cabe_perfil_nidal(ancho_nave: float, slot_izq: float, slot_der: float,
                      paso_izq: float = NIDAL_PASO_PARED,
                      paso_der: float = NIDAL_PASO_PARED) -> bool:
    """¿Cabe el módulo en el ancho de la nave dejando el paso exigido a cada lado?"""
    return ancho_nave_minimo(slot_izq, slot_der, paso_izq, paso_der) <= ancho_nave + 1e-6


class GeometriaNidalCentrado(BaseModel):
    """Coordenadas en metros desde la esquina interior de la nave.

    X sigue la cadena; Y cruza la nave. Se centra el conjunto cuerpo + slats.
    Los pasos solicitados son mínimos; el espacio sobrante se reparte por igual.
    """
    paso_lateral_m: float
    slat_izq_y_m: float
    cuerpo_y_m: float
    slat_der_y_m: float
    conjunto_fin_y_m: float
    cadena_largo_m: float
    tensor_fin_x_m: float
    libre_fondo_m: float


def geometria_nidal_centrado(ancho: float, largo: float, num_modulos: int,
                             slot_izq: float, slot_der: float,
                             paso_izq: float = 1, paso_der: float = 1) -> GeometriaNidalCentrado:
    paso = (ancho - perfil_nidal_m(slot_izq, slot_der)) / 2
    if paso < max(paso_izq, paso_der) - 1e-6:
        raise ValueError("El nidal centrado no deja el paso mínimo exigido a ambos lados")
    cadena = num_modulos * NIDAL_LARGO
    fin_tensor = cadena + NIDAL_TENSOR
    if num_modulos < 1 or fin_tensor > largo + 1e-6:
        raise ValueError("La cadena de nidales y el tensor no caben en el largo de la nave")
    return GeometriaNidalCentrado(
        paso_lateral_m=paso, slat_izq_y_m=paso,
        cuerpo_y_m=paso + slot_izq,
        slat_der_y_m=paso + slot_izq + NIDAL_ANCHO,
        conjunto_fin_y_m=ancho - paso,
        cadena_largo_m=cadena, tensor_fin_x_m=fin_tensor,
        libre_fondo_m=max(0, largo - fin_tensor),
    )


class CapacidadNidal(BaseModel):
    """Resultado del nidal para un número concreto de módulos."""
    num_modulos: int
    gallinas: int
    sup_cuerpo_m2: float
    sup_slot_m2: float
    sup_disponible_m2: float      # base de densidad
    densidad: float
    yacija_m2: float
    yacija_min_m2: float
    cumple_yacija: bool
    limitante: str                # "capacidad_modulos" | "densidad" | "limite_ecologico"


def capacidad_nidal(
    sup_nave: float,
    num_modulos: int,
    sistema: str = "suelo",
    slot_izq: float = NIDAL_SLOT_DEFAULT,
    slot_der: float = NIDAL_SLOT_DEFAULT,
) -> CapacidadNidal:
    """
    Capacidad del nidal con `num_modulos` módulos instalados.

    - Densidad: solo se descuenta el cuerpo (el slot es superficie habitable).
    - Yacija:   se descuentan cuerpo + slots (el slot es slat, no yacija).
    - Las superficies exteriores (parque, pasto) no suman en ninguna de las dos.
    """
    densidad_max = densidad_max_para(sistema)
    sup_cuerpo = round(num_modulos * NIDAL_CUERPO, 4)
    sup_slot   = round(num_modulos * NIDAL_LARGO * (slot_izq + slot_der), 4)

    sup_disp = base_densidad(sup_nave - sup_cuerpo)
    yacija   = yacija_disponible(sup_nave, sup_cuerpo + sup_slot)
    yac_min  = yacija_minima(sup_nave)

    cap_nidal = (math.floor(sup_cuerpo / 0.012) if sistema == "ecologico"
                 else math.floor(sup_cuerpo * GALLINAS_POR_M2_NIDAL))
    cap_modulos  = min(num_modulos * NIDAL_CAP, cap_nidal)
    cap_densidad = math.floor(sup_disp * densidad_max)
    gallinas = min(cap_modulos, cap_densidad)
    limitante = "capacidad_modulos" if cap_modulos <= cap_densidad else "densidad"
    gallinas, capeado = cap_ecologico(gallinas, sistema)
    if capeado:
        limitante = "limite_ecologico"

    return CapacidadNidal(
        num_modulos=num_modulos,
        gallinas=gallinas,
        sup_cuerpo_m2=round(sup_cuerpo, 2),
        sup_slot_m2=round(sup_slot, 2),
        sup_disponible_m2=round(sup_disp, 2),
        densidad=round(gallinas / sup_disp, 2) if sup_disp > 0 else 0.0,
        yacija_m2=round(yacija, 2),
        yacija_min_m2=yac_min,
        cumple_yacija=yacija >= yac_min - 1e-6,
        limitante=limitante,
    )


def escenarios_nidal(
    sup_nave: float,
    largo_nave: float | None,
    ancho_nave: float | None,
    sistema: str = "suelo",
    slot_izq: float = NIDAL_SLOT_DEFAULT,
    slot_der: float = NIDAL_SLOT_DEFAULT,
) -> list[CapacidadNidal]:
    """Todos los conteos de módulos que caben físicamente, de 1 a N_max."""
    if largo_nave is not None:
        n_max = max_modulos_nidal(largo_nave, ancho_nave)
    else:
        # Sin dimensiones: acotar por la huella total del módulo estándar
        huella = NIDAL_CUERPO + NIDAL_LARGO * (slot_izq + slot_der)
        n_max = math.floor(sup_nave / huella) if huella > 0 else 0

    return [
        capacidad_nidal(sup_nave, n, sistema, slot_izq, slot_der)
        for n in range(1, n_max + 1)
    ]


def optimo_nidal(
    sup_nave: float,
    largo_nave: float | None,
    ancho_nave: float | None,
    sistema: str = "suelo",
    slot_izq: float = NIDAL_SLOT_DEFAULT,
    slot_der: float = NIDAL_SLOT_DEFAULT,
) -> tuple[Optional[CapacidadNidal], list[CapacidadNidal]]:
    """
    Devuelve (óptimo, escenarios).

    Óptimo = el que más gallinas aloja cumpliendo yacija; a igualdad de gallinas,
    el que usa menos módulos (menos inversión para la misma capacidad).
    """
    todos = escenarios_nidal(sup_nave, largo_nave, ancho_nave, sistema,
                             slot_izq, slot_der)
    validos = [e for e in todos if e.cumple_yacija]
    if not validos:
        return None, todos
    return max(validos, key=lambda e: (e.gallinas, -e.num_modulos)), todos


# ── Equipamiento mínimo ───────────────────────────────────────────────────────

class RequisitoEquipamiento(BaseModel):
    nombre: str
    valor_minimo: float
    unidad: str
    formula: str
    articulo: str


def requisitos_equipamiento(n: int, sistema: str) -> list[RequisitoEquipamiento]:
    """Requisitos mínimos de equipamiento según RD 3/2002 para n gallinas."""
    req = [
        RequisitoEquipamiento(
            nombre="Perchas", valor_minimo=round(n * (18.0 if sistema == "ecologico" else 15.0), 0), unidad="cm lineales",
            formula=f"{n} × {18 if sistema == 'ecologico' else 15} cm/gallina",
            articulo="Reglamento (UE) 2020/464 Anexo IV" if sistema == "ecologico" else "RD 3/2002 Anexo IV"),
        RequisitoEquipamiento(
            nombre="Comederos lineales", valor_minimo=round(n * 10.0, 0), unidad="cm lineales",
            formula=f"{n} × 10 cm/gallina", articulo="RD 3/2002 Anexo IV"),
        RequisitoEquipamiento(
            nombre="Comederos circulares (perímetro)", valor_minimo=round(n * 4.0, 0),
            unidad="cm de perímetro", formula=f"{n} × 4 cm/gallina",
            articulo="RD 3/2002 Anexo IV"),
        RequisitoEquipamiento(
            nombre="Bebederos pezón/copa", valor_minimo=float(math.ceil(n / 10)), unidad="unidades",
            formula=f"⌈{n} / 10⌉ = {math.ceil(n / 10)}", articulo="RD 3/2002 Anexo IV"),
        RequisitoEquipamiento(
            nombre="Bebedero de canal", valor_minimo=round(n * 2.5, 0), unidad="cm de canal",
            formula=f"{n} × 2,5 cm/gallina", articulo="RD 3/2002 Anexo IV"),
    ]
    if sistema == "ecologico":
        req.append(RequisitoEquipamiento(
            nombre="Nidal colectivo", valor_minimo=round(n * 0.012, 2), unidad="m² útiles",
            formula=f"{n} × 0,012 m²/gallina", articulo="Reglamento (UE) 2020/464 Anexo IV"))
    else:
        req.append(RequisitoEquipamiento(
            nombre="Nidal colectivo", valor_minimo=round(n / 120, 2), unidad="m² útiles",
            formula=f"{n} / 120 gallinas/m²", articulo="RD 3/2002 Anexo IV"))
    if sistema in ("campero", "ecologico"):
        req.append(RequisitoEquipamiento(
            nombre="Zona de pasto mínima", valor_minimo=round(n * 4.0, 2), unidad="m²",
            formula=f"{n} × 4 m²/gallina", articulo="Regl. CE 589/2008 Anexo II"))
    return req


# ── Modelos del estudio ───────────────────────────────────────────────────────

class EstudioRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    tipo_zona: Literal["nidal_colectivo", "aviario"]
    sistema: Sistema = "suelo"
    ancho_nave_m: float = Field(gt=0)
    largo_nave_m: float = Field(gt=0)
    altura_nave_cm: float = Field(gt=0)
    equipamiento: EquipamientoMedido = Field(default_factory=EquipamientoMedido)
    # Anexo exterior informativo: no computa sin validación técnica específica
    sup_parque_m2: float = Field(default=0.0, ge=0)
    # Zona de pasto (campero/ecológico): NO computa, solo se verifica (4 m²/gallina)
    sup_pasto_m2: float | None = Field(default=None, ge=0)
    # Nidal: profundidad de slot a cada lado del cuerpo (0, 1, 2 o 3 m)
    slot_izq_m: Literal[0.0, 1.0, 2.0, 3.0] = NIDAL_SLOT_DEFAULT
    slot_der_m: Literal[0.0, 1.0, 2.0, 3.0] = NIDAL_SLOT_DEFAULT
    # Nidal: paso libre exigido entre el borde del slat y cada pared.
    # En la distribución centrada son mínimos: el paso real es igual en ambos
    # lados. Un valor 0 elimina el mínimo, no desplaza el conjunto a la pared.
    paso_izq_m: float = Field(default=NIDAL_PASO_PARED, ge=0)
    paso_der_m: float = Field(default=NIDAL_PASO_PARED, ge=0)
    # Aviario: 2 o 3 niveles; None = el máximo que permita la altura
    niveles: Literal[2, 3] | None = None
    # Escenario forzado: nº de módulos (nidal) o nº de filas (aviario)
    num_modulos: Optional[int] = Field(default=None, gt=0)
    num_filas: Optional[int] = Field(default=None, gt=0)
    mods_por_fila: int | None = Field(default=None, gt=0)
    clearance_pared_m: float = Field(default=0, ge=0)
    pasillo_m: float = Field(default=AVI_PASILLO, ge=0)
    clearance_frontal_m: float = Field(default=AVI_CLEARANCE, ge=0)
    clearance_fondo_m: float = Field(default=AVI_CLEARANCE_FONDO, ge=0)

    @model_validator(mode="after")
    def validar_regimen(self):
        if self.sistema == "jaulas" and self.equipamiento.model_fields_set:
            raise ValueError("El aforo medido está definido para sistemas alternativos, no jaulas")
        return self


class Verificacion(BaseModel):
    parametro: str
    valor_real: float
    valor_limite: float
    unidad: str
    tipo_limite: Literal["minimo", "maximo"]
    cumple: bool
    articulo: str
    detalle: str = ""


class Escenario(BaseModel):
    num_modulos: int
    num_filas: int = 1
    gallinas: int
    densidad: float
    sup_yacija_m2: float
    yacija_pct: float
    cumple_yacija: bool
    cumple: bool
    limitante: str
    es_optimo: bool = False


class EstudioResponse(BaseModel):
    geometria_nidal: GeometriaNidalCentrado | None = None
    aforo: AforoResultado | None = None
    calculo_provisional: bool = True
    tipo_zona: str
    sistema: str
    ancho_nave_m: float
    largo_nave_m: float
    altura_nave_cm: float
    superficie_nave_m2: float
    sup_parque_m2: float = 0.0
    sup_pasto_m2: float = 0.0

    viable: bool
    motivo: str = ""

    num_modulos: int = 0
    num_filas: int = 1
    mods_por_fila: int = 0
    gallinas_max: int = 0
    densidad_real: float = 0.0
    densidad_max: float = 0.0
    limitante: str = ""

    sup_disponible_m2: float = 0.0     # base normativa de densidad
    sup_total_m2: float = 0.0          # base para el mínimo de yacija
    sup_yacija_m2: float = 0.0
    yacija_min_m2: float = 0.0
    yacija_pct: float = 0.0
    huella_modulos_m2: float = 0.0

    slot_izq_m: float = 0.0
    slot_der_m: float = 0.0
    prof_total_m: float = 0.0          # 1.40 + slots (nidal)
    paso_izq_m: float = 0.0            # paso exigido a la izquierda (0 = pegado a pared)
    paso_der_m: float = 0.0            # paso exigido a la derecha (0 = pegado a pared)
    holgura_m: float = 0.0             # ancho sobrante tras módulo + pasos (nidal)
    ancho_nave_minimo_m: float = 0.0   # perfil + ambos pasos (nidal)
    niveles: int = 0                   # aviario
    descripcion_layout: str = ""

    max_modulos_fisicos: int = 0
    verificaciones: list[Verificacion] = []
    requisitos: list[RequisitoEquipamiento] = []
    escenarios: list[Escenario] = []
    notas: list[str] = []


# ── Helpers del estudio ───────────────────────────────────────────────────────

def _v(parametro: str, real: float, limite: float, unidad: str,
       tipo: str, articulo: str, detalle: str = "") -> Verificacion:
    cumple = real <= limite + 1e-6 if tipo == "maximo" else real >= limite - 1e-6
    return Verificacion(
        parametro=parametro, valor_real=round(real, 2), valor_limite=round(limite, 2),
        unidad=unidad, tipo_limite=tipo, cumple=cumple, articulo=articulo, detalle=detalle,
    )


def _desc_pasos(paso_izq: float, paso_der: float) -> str:
    """Describe los pasos laterales, distinguiendo el lado pegado a la pared."""
    if abs(paso_izq - paso_der) < 1e-6:
        if paso_izq < 1e-6:
            return "pegado a ambas paredes"
        return f"{paso_izq:g} m de paso a cada lado"
    lados = []
    for etiqueta, paso in (("izquierda", paso_izq), ("derecha", paso_der)):
        lados.append(
            f"pegado a la pared {etiqueta}" if paso < 1e-6 else f"{paso:g} m de paso a la {etiqueta}"
        )
    return " y ".join(lados)


def _snap_slot(v: float) -> float:
    """Ajusta el slot al valor permitido más cercano (0, 1, 2 o 3 m)."""
    return min(SLOTS_PERMITIDOS, key=lambda s: abs(s - v))


def _escenario_desde_capacidad(c: CapacidadNidal, sup_ref: float) -> Escenario:
    return Escenario(
        num_modulos=c.num_modulos, gallinas=c.gallinas, densidad=c.densidad,
        sup_yacija_m2=c.yacija_m2,
        yacija_pct=round(c.yacija_m2 / sup_ref * 100, 1) if sup_ref > 0 else 0.0,
        cumple_yacija=c.cumple_yacija, cumple=c.cumple_yacija, limitante=c.limitante,
    )


# ── Estudio — Nidal colectivo ─────────────────────────────────────────────────

def _estudio_nidal(req: EstudioRequest) -> EstudioResponse:
    slot_izq = _snap_slot(req.slot_izq_m)
    slot_der = _snap_slot(req.slot_der_m)
    slot_total = slot_izq + slot_der
    prof_total = NIDAL_ANCHO + slot_total

    paso_izq = max(0.0, req.paso_izq_m)
    paso_der = max(0.0, req.paso_der_m)
    # El plano actual representa un único conjunto centrado. Cada mitad del
    # espacio libre debe satisfacer el mayor de los dos mínimos solicitados.
    ancho_min_centrado = prof_total + 2 * max(paso_izq, paso_der)
    # Mantener la superficie geométrica sin redondeo durante el cálculo:
    # 28,96 × 13,80 m del informe oficial son 399,648 m² (399,65 solo al mostrar).
    S = req.ancho_nave_m * req.largo_nave_m
    densidad_max = densidad_max_para(req.sistema)
    sup_parque = req.sup_parque_m2 or 0.0
    sup_pasto  = req.sup_pasto_m2 or 0.0

    base = EstudioResponse(
        tipo_zona="nidal_colectivo", sistema=req.sistema,
        ancho_nave_m=req.ancho_nave_m, largo_nave_m=req.largo_nave_m,
        altura_nave_cm=req.altura_nave_cm, superficie_nave_m2=S,
        sup_parque_m2=sup_parque, sup_pasto_m2=sup_pasto, viable=False,
        densidad_max=densidad_max, yacija_min_m2=yacija_minima(S), sup_total_m2=S,
        slot_izq_m=slot_izq, slot_der_m=slot_der, prof_total_m=round(prof_total, 2),
        paso_izq_m=round(paso_izq, 2), paso_der_m=round(paso_der, 2),
        holgura_m=round(req.ancho_nave_m - ancho_min_centrado, 2),
        ancho_nave_minimo_m=round(ancho_min_centrado, 2),
    )

    if slot_total == 0:
        base.motivo = (
            "El módulo A-Nida necesita al menos un slot lateral para el acceso de "
            "las gallinas al nidal. Selecciona 1, 2 o 3 m en al menos un lado."
        )
        return base

    largo_cadena = req.largo_nave_m
    base.max_modulos_fisicos = max_modulos_nidal(req.largo_nave_m, req.ancho_nave_m)

    if ancho_min_centrado > req.ancho_nave_m + 1e-6:
        ancho_min = ancho_min_centrado
        if prof_total > req.ancho_nave_m + 1e-6:
            detalle_motivo = (
                f"el conjunto ni siquiera cabe físicamente ({prof_total:.2f} m de profundidad)"
            )
        else:
            detalle_motivo = f"faltan {ancho_min - req.ancho_nave_m:.2f} m"
        base.motivo = (
            f"Con slots de {slot_izq:.0f} + {slot_der:.0f} m hace falta una nave de "
            f"{ancho_min:.2f} m de ancho ({prof_total:.2f} m de módulo + "
            f"{max(paso_izq, paso_der):g} m de paso mínimo a cada lado, centrado) y la nave tiene "
            f"{req.ancho_nave_m:.2f} m: {detalle_motivo}. Reduce el slot de algún lado "
            f"o revisa el paso mínimo necesario."
        )
        base.verificaciones = [_v(
            "Ancho de nave necesario", ancho_min, req.ancho_nave_m, "m", "maximo",
            "Dimensional — plano 26301001",
            f"Cuerpo {NIDAL_ANCHO:.2f} m + slots {slot_total:.0f} m + "
            f"{max(paso_izq, paso_der):g} m de paso mínimo a cada lado, centrado",
        )]
        return base

    if base.max_modulos_fisicos == 0:
        base.motivo = (
            f"Con {largo_cadena:.1f} m de largo no cabe ningún módulo: hacen falta "
            f"{NIDAL_LARGO + NIDAL_TENSOR:.2f} m como mínimo (1 módulo + módulo tensor)."
        )
        return base

    optimo, todos = optimo_nidal(S, req.largo_nave_m, req.ancho_nave_m, req.sistema,
                                 slot_izq, slot_der)
    escenarios = [_escenario_desde_capacidad(c, S) for c in todos]

    if optimo is None:
        base.escenarios = escenarios
        base.motivo = (
            f"Con slots de {slot_izq:.0f} + {slot_der:.0f} m no queda yacija suficiente: "
            f"la normativa exige {yacija_minima(S):.0f} m² (1/3 de la nave). Reduce la "
            f"profundidad de los slots o el número de módulos."
        )
        return base

    elegido = optimo
    if req.num_modulos:
        if req.num_modulos > base.max_modulos_fisicos:
            base.motivo = "El número de módulos solicitado no cabe en la nave."
            return base
        elegido = next((c for c in todos if c.num_modulos == req.num_modulos), optimo)
    for e in escenarios:
        e.es_optimo = e.num_modulos == optimo.num_modulos

    n = elegido.num_modulos

    geometria = geometria_nidal_centrado(req.ancho_nave_m, req.largo_nave_m, n,
                                        slot_izq, slot_der, paso_izq, paso_der)
    base.geometria_nidal = geometria
    verificaciones = [
        _v("Densidad de alojamiento", elegido.densidad, densidad_max, "gal/m²", "maximo",
           "RD 3/2002 Anexo IV",
           f"{elegido.gallinas} gallinas sobre {elegido.sup_disponible_m2:.0f} m² útiles "
           f"(nave − cuerpo de los módulos)"),
        _v("Superficie de yacija", elegido.yacija_m2, elegido.yacija_min_m2, "m²", "minimo",
           "RD 3/2002 Anexo IV",
           f"1/3 de los {S:.0f} m² de nave. Los slots ({elegido.sup_slot_m2:.0f} m²) no computan "
           f"como yacija."),
        _v("Ancho de nave necesario", ancho_min_centrado,
           req.ancho_nave_m, "m", "maximo", "Dimensional — plano 26301001",
           f"Cuerpo {NIDAL_ANCHO:.2f} m + slot izq {slot_izq:.0f} m + slot der {slot_der:.0f} m "
           f"+ 2 pasos mínimos de {max(paso_izq, paso_der):g} m"),
        _v("Holgura sobre el ancho mínimo",
           req.ancho_nave_m - ancho_min_centrado, 0.0,
           "m", "minimo", "Manejo — criterio de instalación",
           f"{req.ancho_nave_m:.2f} m de nave − {prof_total:.2f} m de módulo − "
           f"2 pasos mínimos de {max(paso_izq, paso_der):g} m."),
        _v("Pasos laterales del conjunto centrado", geometria.paso_lateral_m,
           max(paso_izq, paso_der), "m", "minimo", "Geometría de instalación",
           f"({req.ancho_nave_m:.2f} − {prof_total:.2f}) / 2 = "
           f"{geometria.paso_lateral_m:.2f} m libres a cada lado"),
        _v("Longitud ocupada por la cadena", n * NIDAL_LARGO + NIDAL_TENSOR, largo_cadena,
           "m", "maximo", "Dimensional — plano 26301001",
           f"{n} módulos × {NIDAL_LARGO:.2f} m + {NIDAL_TENSOR:.0f} m de módulo tensor "
           f"(el local técnico de {NIDAL_EQUIP:.0f} m es anexo exterior)"),

    ]
    verificaciones += _verificaciones_comunes(req, elegido.gallinas, sup_pasto)

    notas = [
        f"Configuración de slot: {slot_izq:.0f} m a la izquierda y {slot_der:.0f} m a la derecha "
        f"({'ambos lados' if slot_izq > 0 and slot_der > 0 else 'un solo lado'}). "
        f"El aforo del módulo es de {NIDAL_CAP} gallinas con cualquier slot.",
        "El cuerpo del módulo (1,20 × 1,40 m) es lo único que se descuenta para la densidad: "
        "el slot es superficie habitable, pero no computa como yacija.",
    ]
    if slot_izq == 0 or slot_der == 0:
        notas.append(
            "Con slot en un solo lado el acceso al nidal queda unilateral: gana yacija "
            "pero reduce la accesibilidad de las gallinas al nidal."
        )
    if sup_parque > 0:
        notas.append(
            f"El parque de invierno de {sup_parque:.0f} m² no computa para densidad ni yacija: "
            f"es superficie anexa exterior a la nave."
        )
    if sup_pasto > 0:
        notas.append(
            f"La zona de pasto ({sup_pasto:.0f} m²) no computa para densidad ni yacija: "
            f"es un requisito aparte de 4 m² por gallina."
        )
    if elegido.num_modulos != optimo.num_modulos:
        notas.append(
            f"Escenario forzado a {elegido.num_modulos} módulos. El óptimo de la nave es "
            f"{optimo.num_modulos} módulos ({optimo.gallinas} gallinas)."
        )

    base.viable = all(v.cumple for v in verificaciones)
    base.num_modulos = n
    base.num_filas = 1
    base.mods_por_fila = n
    base.gallinas_max = elegido.gallinas
    base.densidad_real = elegido.densidad
    base.limitante = elegido.limitante
    base.sup_disponible_m2 = elegido.sup_disponible_m2
    base.sup_yacija_m2 = elegido.yacija_m2
    base.yacija_min_m2 = elegido.yacija_min_m2
    base.yacija_pct = round(elegido.yacija_m2 / S * 100, 1) if S > 0 else 0.0
    base.huella_modulos_m2 = round(elegido.sup_cuerpo_m2 + elegido.sup_slot_m2, 2)
    base.descripcion_layout = f"1 fila centrada de {n} módulos + módulo tensor"
    base.verificaciones = verificaciones
    base.requisitos = requisitos_equipamiento(elegido.gallinas, req.sistema)
    base.escenarios = escenarios
    base.notas = notas + _nota_pasto(req.sistema, elegido.gallinas, sup_pasto)
    return base


# ── Estudio — Aviario ─────────────────────────────────────────────────────────

def _estudio_aviario(req: EstudioRequest) -> EstudioResponse:
    S = req.ancho_nave_m * req.largo_nave_m
    densidad_max = densidad_max_para(req.sistema)
    sup_parque = req.sup_parque_m2 or 0.0
    sup_pasto  = req.sup_pasto_m2 or 0.0

    niveles_max = 3 if req.altura_nave_cm >= 400 else (2 if req.altura_nave_cm >= 300 else 0)
    niveles = req.niveles or niveles_max

    base = EstudioResponse(
        tipo_zona="aviario", sistema=req.sistema,
        ancho_nave_m=req.ancho_nave_m, largo_nave_m=req.largo_nave_m,
        altura_nave_cm=req.altura_nave_cm, superficie_nave_m2=S,
        sup_parque_m2=sup_parque, sup_pasto_m2=sup_pasto, viable=False,
        densidad_max=densidad_max, niveles=niveles,
    )

    altura_min = 400 if niveles == 3 else 300
    if niveles not in (2, 3) or req.altura_nave_cm < altura_min:
        base.motivo = (
            f"Un aviario de {niveles if niveles in (2, 3) else 2} niveles necesita "
            f"{400 if niveles == 3 else 300} cm de altura libre y la nave tiene "
            f"{req.altura_nave_cm:.0f} cm."
        )
        base.verificaciones = [_v(
            "Altura libre de la nave", req.altura_nave_cm,
            400 if niveles == 3 else 300, "cm", "minimo",
            "Dimensional — aviario cód. 10007",
            f"Altura total del módulo de {niveles if niveles in (2, 3) else 2} niveles + espacio de manejo",
        )]
        return base

    largo_util = req.largo_nave_m - req.clearance_frontal_m - req.clearance_fondo_m
    mods_por_fila = math.floor(largo_util / AVI_MOD_A) if largo_util >= AVI_MOD_A else 0
    filas_max = (
        max(0, math.floor((req.ancho_nave_m - 2 * req.clearance_pared_m + req.pasillo_m) / (AVI_MOD_B + req.pasillo_m)))
    )

    if mods_por_fila == 0 or filas_max == 0:
        base.motivo = (
            f"La nave no admite ninguna fila de aviario: hacen falta {AVI_MOD_B:.2f} m de ancho "
            f"y {AVI_MOD_A + AVI_CLEARANCE + AVI_CLEARANCE_FONDO:.2f} m de largo como mínimo."
        )
        return base

    if req.mods_por_fila is not None:
        if req.mods_por_fila > mods_por_fila:
            base.motivo = "Los módulos solicitados por fila no caben en la nave."
            return base
        mods_por_fila = req.mods_por_fila
    suelo_util = round(largo_util * req.ancho_nave_m, 2)
    sup_disp_mod = AVI_SUP_DISP[niveles]
    sup_total_mod = AVI_SUP_TOTAL[niveles]
    base.max_modulos_fisicos = mods_por_fila * filas_max

    escenarios: list[Escenario] = []
    for f in range(1, filas_max + 1):
        n = f * mods_por_fila
        sup_disp  = round(base_densidad(n * sup_disp_mod + suelo_util), 2)
        sup_total = round(n * sup_total_mod + suelo_util, 2)
        yac_min   = yacija_minima(suelo_util)
        yacija    = round(suelo_util, 2)

        cap_modulos  = min(n * AVI_CAP, math.floor(suelo_util / 0.025))
        cap_densidad = math.floor(sup_disp * densidad_max)
        gallinas = min(cap_modulos, cap_densidad)
        limitante = "capacidad_modulos" if cap_modulos <= cap_densidad else "densidad"
        gallinas, capeado = cap_ecologico(gallinas, req.sistema)
        if capeado:
            limitante = "limite_ecologico"

        escenarios.append(Escenario(
            num_modulos=n, num_filas=f, gallinas=gallinas,
            densidad=round(gallinas / sup_disp, 2) if sup_disp > 0 else 0.0,
            sup_yacija_m2=yacija,
            yacija_pct=round(yacija / sup_total * 100, 1) if sup_total > 0 else 0.0,
            cumple_yacija=yacija >= yac_min - 1e-6,
            cumple=yacija >= yac_min - 1e-6,
            limitante=limitante,
        ))

    validos = [e for e in escenarios if e.cumple_yacija]
    if not validos:
        base.escenarios = escenarios
        base.motivo = (
            "Ni con una sola fila queda yacija suficiente: la normativa exige que 1/3 de la "
            "superficie total (suelo + módulos) sea yacija."
        )
        return base

    optimo = max(validos, key=lambda e: (e.gallinas, -e.num_modulos))
    elegido = optimo
    if req.num_filas:
        if req.num_filas > filas_max:
            base.motivo = "El número de filas solicitado no cabe en la nave."
            return base
        elegido = next((e for e in escenarios if e.num_filas == req.num_filas), optimo)
    for e in escenarios:
        e.es_optimo = e.num_filas == optimo.num_filas

    n = elegido.num_modulos
    sup_disp  = round(base_densidad(n * sup_disp_mod + suelo_util), 2)
    sup_total = round(n * sup_total_mod + suelo_util, 2)
    yac_min   = yacija_minima(suelo_util)
    perfil_filas = 2 * req.clearance_pared_m + elegido.num_filas * AVI_MOD_B + (elegido.num_filas - 1) * req.pasillo_m

    verificaciones = [
        _v("Altura libre de la nave", req.altura_nave_cm, altura_min, "cm", "minimo",
           "Dimensional — aviario cód. 10007",
           f"Mínimo para {niveles} niveles operativos"),
        _v("Densidad de alojamiento", elegido.densidad, densidad_max, "gal/m²", "maximo",
           "RD 3/2002 Anexo IV · Directiva 1999/74/CE",
           f"{elegido.gallinas} gallinas sobre {sup_disp:.0f} m² utilizables "
           f"({n} × {sup_disp_mod:.2f} m² de módulo sin zona de puesta + {suelo_util:.0f} m² de suelo"
           + ")"),
        _v("Superficie de yacija", elegido.sup_yacija_m2, yac_min, "m²", "minimo",
           "RD 3/2002 Anexo IV",
           f"1/3 de los {suelo_util:.0f} m² de suelo disponible; además 250 cm² por ave"),
        _v("Ancho ocupado por las filas", perfil_filas, req.ancho_nave_m, "m", "maximo",
           "Dimensional — aviario cód. 10007",
           f"{elegido.num_filas} filas × {AVI_MOD_B:.2f} m + {max(0, elegido.num_filas - 1)} "
           f"pasillos × {AVI_PASILLO:.2f} m"),
        _v("Largo ocupado por la fila", mods_por_fila * AVI_MOD_A + req.clearance_frontal_m + req.clearance_fondo_m,
           req.largo_nave_m, "m", "maximo", "Dimensional — aviario cód. 10007",
           f"{mods_por_fila} módulos × {AVI_MOD_A:.2f} m + {req.clearance_frontal_m:.2f} m y "
           f"{req.clearance_fondo_m:.2f} m de zona de equipos"),
        _v("Niveles del aviario", niveles, 4, "niveles", "maximo",
           "Directiva 1999/74/CE art. 4",
           "Máximo 4 niveles superpuestos en sistemas alternativos"),
    ]
    verificaciones += _verificaciones_comunes(req, elegido.gallinas, sup_pasto)

    notas = [
        f"Superficie por módulo de {niveles} niveles: {sup_total_mod:.3f} m² totales, "
        f"{sup_disp_mod:.4f} m² utilizables (la zona de puesta no computa para densidad).",
        f"Pasillos de {req.pasillo_m:.2f} m entre filas y zona de equipos de "
        f"{req.clearance_frontal_m:.2f} m + {req.clearance_fondo_m:.2f} m en los extremos.",
    ]
    if niveles_max > niveles:
        notas.append(
            f"La altura de la nave ({req.altura_nave_cm:.0f} cm) admitiría {niveles_max} niveles."
        )
    if elegido.num_filas != optimo.num_filas:
        notas.append(
            f"Escenario forzado a {elegido.num_filas} filas. El óptimo de la nave son "
            f"{optimo.num_filas} filas ({optimo.gallinas} gallinas)."
        )

    base.viable = all(v.cumple for v in verificaciones)
    base.num_modulos = n
    base.num_filas = elegido.num_filas
    base.mods_por_fila = mods_por_fila
    base.gallinas_max = elegido.gallinas
    base.densidad_real = elegido.densidad
    base.limitante = elegido.limitante
    base.sup_disponible_m2 = sup_disp
    base.sup_total_m2 = sup_total
    base.sup_yacija_m2 = elegido.sup_yacija_m2
    base.yacija_min_m2 = yac_min
    base.yacija_pct = elegido.yacija_pct
    base.huella_modulos_m2 = round(n * AVI_HUELLA_M2, 2)
    base.descripcion_layout = f"{elegido.num_filas} filas de {mods_por_fila} módulos"
    base.verificaciones = verificaciones
    base.requisitos = requisitos_equipamiento(elegido.gallinas, req.sistema)
    base.escenarios = escenarios
    base.notas = notas + _nota_pasto(req.sistema, elegido.gallinas, sup_pasto)
    return base


def _verificaciones_comunes(req: EstudioRequest, gallinas: int, sup_pasto: float) -> list[Verificacion]:
    out: list[Verificacion] = []
    if req.sistema == "ecologico":
        out.append(_v(
            "Gallinas por gallinero (ecológico)", gallinas, MAX_GALLINAS_ECOLOGICO,
            "gallinas", "maximo", "Regl. UE 2018/848 Anexo II",
            "Máximo 3.000 gallinas por unidad de producción ecológica",
        ))
    # Solo se verifica si el pasto se ha informado; si no, se avisa como nota
    if req.sistema in ("campero", "ecologico") and sup_pasto > 0:
        out.append(_v(
            "Zona de pasto", sup_pasto, round(gallinas * 4.0, 2), "m²", "minimo",
            "Regl. CE 589/2008 Anexo II",
            f"4 m² por gallina × {gallinas} gallinas. No computa para densidad ni yacija.",
        ))
    return out


def _nota_pasto(sistema: str, gallinas: int, sup_pasto: float) -> list[str]:
    if sistema not in ("campero", "ecologico") or sup_pasto > 0:
        return []
    return [
        f"Falta el dato de zona de pasto: para {gallinas} gallinas en producción "
        f"{'ecológica' if sistema == 'ecologico' else 'campera'} harían falta "
        f"{gallinas * 4:,.0f} m² (4 m²/gallina). No se ha verificado.".replace(",", ".")
    ]


# ── Entrada pública ───────────────────────────────────────────────────────────

def estudiar_nave(req: EstudioRequest) -> EstudioResponse:
    motor = _estudio_aviario if req.tipo_zona == "aviario" else _estudio_nidal
    resultado = motor(req)
    if resultado.num_modulos and req.sistema in ("suelo", "campero", "ecologico"):
        suelo = ((req.largo_nave_m - req.clearance_frontal_m - req.clearance_fondo_m) * req.ancho_nave_m
                 if req.tipo_zona == "aviario" else resultado.superficie_nave_m2)

        def evaluar(n, yacija):
            superficie = (n * AVI_SUP_DISP[resultado.niveles] + suelo if req.tipo_zona == "aviario"
                          else resultado.superficie_nave_m2 - n * NIDAL_CUERPO)
            equipamiento = req.equipamiento
            if req.tipo_zona == "nidal_colectivo" and equipamiento.nidal_util_m2 is None:
                # La superficie del cuerpo A-Nida es la superficie de nidal útil
                # definida por su ficha dimensional (1,20 × 1,40 m por módulo).
                # Se calcula por escenario para que la optimización y el aforo
                # final apliquen exactamente el mismo límite.
                equipamiento = equipamiento.model_copy(update={
                    "nidal_util_m2": n * NIDAL_CUERPO,
                })
            aforo = calcular_aforo(AforoRequest(sistema=req.sistema,
                superficie_util_m2=max(0, superficie), superficie_suelo_m2=suelo,
                yacija_m2=yacija, pasto_m2=req.sup_pasto_m2, equipamiento=equipamiento))
            return aforo, superficie

        escenarios = resultado.escenarios
        for e in escenarios:
            aforo, superficie = evaluar(e.num_modulos, e.sup_yacija_m2)
            if aforo.gallinas_max < e.gallinas:
                e.gallinas = aforo.gallinas_max
                e.limitante = ", ".join(aforo.limitantes)
            e.densidad = round(e.gallinas / superficie, 2) if superficie > 0 else 0
            e.cumple = e.cumple and e.gallinas > 0
        validos = [e for e in escenarios if e.cumple]
        if validos:
            optimo = max(validos, key=lambda e: (e.gallinas, -e.num_modulos))
            for e in escenarios:
                e.es_optimo = e.num_modulos == optimo.num_modulos
            if not req.num_filas and not req.num_modulos:
                actualizado = req.model_copy(update={"num_filas": optimo.num_filas} if req.tipo_zona == "aviario"
                                            else {"num_modulos": optimo.num_modulos})
                resultado = motor(actualizado)
        resultado.escenarios = escenarios
        aforo, superficie = evaluar(resultado.num_modulos, resultado.sup_yacija_m2)
        cap_geometrica = resultado.gallinas_max
        aforo.limites.append(LimiteAforo(criterio="modulos_instalados", gallinas=cap_geometrica,
            formula=f"{resultado.num_modulos} módulos × {NIDAL_CAP if req.tipo_zona == 'nidal_colectivo' else AVI_CAP} gallinas/módulo",
            fuente="Capacidad física de los módulos instalados"))
        aforo.gallinas_max = min(aforo.gallinas_max, cap_geometrica)
        aforo.limitantes = [l.criterio for l in aforo.limites if l.gallinas == aforo.gallinas_max]
        resultado.aforo = aforo
        resultado.gallinas_max = aforo.gallinas_max
        resultado.limitante = ", ".join(aforo.limitantes)
        resultado.densidad_real = round(resultado.gallinas_max / superficie, 2) if superficie > 0 else 0
        resultado.requisitos = requisitos_equipamiento(resultado.gallinas_max, req.sistema)
        resultado.verificaciones = [v for v in resultado.verificaciones
                                    if v.parametro not in ("Zona de pasto", "Densidad de alojamiento", "Ocupación del nidal")]
        resultado.verificaciones.append(_v("Densidad de alojamiento", resultado.densidad_real,
            resultado.densidad_max, "gal/m²", "maximo", "RD 3/2002 Anexo IV"))
        resultado.verificaciones += _verificaciones_comunes(req, resultado.gallinas_max, req.sup_pasto_m2 or 0)
        resultado.viable = resultado.gallinas_max > 0 and all(v.cumple for v in resultado.verificaciones)
        if not resultado.viable and not resultado.motivo:
            resultado.motivo = "El equipamiento o las superficies declaradas no permiten alojar aves."
        resultado.notas = [n for n in resultado.notas if not n.startswith("Falta el dato de zona de pasto")]
        if aforo.pendientes:
            resultado.notas.append("Pendiente de medir: " + ", ".join(aforo.pendientes) + ".")
    resultado.notas.append("Estimación con geometría de catálogo pendiente de confirmar; no es un aforo autorizado.")
    return resultado

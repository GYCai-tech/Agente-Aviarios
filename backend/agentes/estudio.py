"""
Núcleo de cálculo + estudio técnico de nave.

Este módulo es la ÚNICA fuente de verdad para las constantes físicas de los
módulos, los límites normativos y el cálculo de capacidad del nidal A-Nida.

Las constantes de producto (medidas, capacidades, superficies y equipamiento
por módulo) son los valores por defecto de la ficha técnica: `agentes.ficha`
las sobrescribe al arrancar y al guardar la ficha. Por eso se leen siempre
como globales del módulo en tiempo de llamada (nunca copiadas al importar).
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

from pydantic import BaseModel, Field, ConfigDict, PrivateAttr, model_validator
from agentes.aforo import EquipamientoMedido, AforoRequest, AforoResultado, LimiteAforo, calcular_aforo

Sistema = Literal["suelo", "campero", "ecologico", "jaulas"]

# ── Límites normativos ────────────────────────────────────────────────────────

# Densidad máxima (gallinas por m² de superficie utilizable)
DENSIDAD_MAX: dict[str, float] = {
    "suelo":     9.0,   # RD 3/2002 Anexo IV
    "campero":   9.0,   # Directiva 1999/74/CE — sistemas alternativos
    "ecologico": 6.0,   # Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3
    "jaulas":    9.0,
}

# Margen de incertidumbre (%) que se resta a la superficie de la nave para dar
# el extremo inferior del intervalo de capacidad del informe. Editable en la
# ficha técnica.
MARGEN_INCERTIDUMBRE_PCT = 5.0

# Tope de gallinas por compartimento del gallinero en producción ecológica
# (Regl. (UE) 2018/848, anexo II, parte II, 1.9.4.4.n)
MAX_GALLINAS_ECOLOGICO = 3_000

# Ecológico: niveles de zona utilizable de un sistema multinivel, incluido el
# suelo (Regl. de Ejecución (UE) 2020/464, art. 15.4.b). El aviario de 2 niveles
# más el suelo son 3; el de 3 niveles no es admisible.
ECO_NIVELES_MAX_CON_SUELO = 3

# Ecológico: trampillas al exterior, 4 m por cada 100 m² de la superficie
# cubierta mínima (2020/464, art. 15.1.d). A 6 gallinas/m² son 150 gallinas por
# metro de trampilla.
ECO_TRAMPILLA_M_POR_100M2 = 4

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
# Superficie de puesta por módulo: 2 alfombrillas de 1,19 × 0,495 m. Se verifica
# como el resto del equipamiento; no cambia la capacidad del módulo.
NIDAL_UTIL_M2 = round(2 * 1.19 * 0.495, 4)       # 1.1781 m²
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

# Altura libre mínima de nave para instalar cada configuración (cm)
AVI_ALTURA_MIN = {2: 300, 3: 400}

# Equipamiento integrado por módulo, según niveles. Fuente: acta de inspección
# de referencia (backend/referencias/inspeccion_galicia_ponedoras.json), una
# instalación de 3 filas × 24 módulos de 3 niveles = 72 módulos:
#   perchas    1303,2 m  → 18,1 m/módulo (6,0333 + 4,8267 + 7,24 por nivel)
#   nidales    84,8232 m² → 1,1781 m²/módulo (2 nidos de 1,19 × 0,495 m)
#   comedero   1038,24 m → 14,42 m/módulo
#   bebederos  1512 uds  → 21 uds/módulo
# Para 2 niveles no hay dato de referencia: queda pendiente de medir.
AVI_EQUIPO_POR_MODULO: dict[int, dict[str, float]] = {
    2: {},
    3: {
        "perchas_m": 18.1,
        "nidal_util_m2": 1.1781,
        "comedero_lineal_accesible_m": 14.42,
        "bebederos_pezon_copa": 21,
    },
}

# Criterio de aforo que limita cada campo de equipamiento
CRITERIO_EQUIPO = {"perchas_m": "perchas", "comedero_lineal_accesible_m": "comederos_lineales",
                   "bebederos_pezon_copa": "bebederos"}


def nidal_equipo_por_modulo(sistema: str) -> dict[str, float]:
    """
    Equipamiento integrado en cada módulo A-Nida: el mínimo normativo para su
    capacidad (RD 3/2002 anexo IV; perchas de ecológico, Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3).
    Con 144 gallinas: 21,6 m de percha (25,92 en ecológico), 14,4 m de
    comedero lineal y 15 bebederos.
    """
    return {
        "perchas_m": round(NIDAL_CAP * (0.18 if sistema == "ecologico" else 0.15), 4),
        "comedero_lineal_accesible_m": round(NIDAL_CAP * 0.10, 4),
        "bebederos_pezon_copa": math.ceil(NIDAL_CAP / 10),
    }


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

def tramos_nidal(largo_nave: float, local_dentro: bool = False,
                 libre_fondo: float | None = None) -> tuple[float, float, float]:
    """
    Reparto del largo de la nave: (inicio de la cadena, libre al fondo, largo para módulos).

    El local técnico (motor + mesa de recogida) va en cabeza: si está dentro de
    la nave ocupa su largo; si es un anexo exterior no resta. Al fondo queda el
    espacio libre pedido, que incluye el tensor (por defecto, el largo del módulo tensor).
    """
    inicio = NIDAL_EQUIP if local_dentro else 0.0
    fondo = NIDAL_TENSOR if libre_fondo is None else libre_fondo
    return inicio, fondo, largo_nave - inicio - fondo


def sup_local_interior(local_dentro: bool, ancho_nave: float) -> float:
    """Suelo que pierde la nave con el local dentro: se cierra de pared a pared."""
    return round(NIDAL_EQUIP * ancho_nave, 4) if local_dentro else 0.0


def max_modulos_nidal(largo_nave: float, ancho_nave: float | None = None,
                      local_dentro: bool = False, libre_fondo: float | None = None) -> int:
    """
    Módulos que caben físicamente en una fila.

    La cadena va por el lado largo, entre el local técnico (si está dentro) y
    el espacio libre del fondo, que incluye el tensor.
    """
    # No rotar el eje longitudinal sin rotar también el plano.
    _, _, disponible = tramos_nidal(largo_nave, local_dentro, libre_fondo)
    if disponible < NIDAL_LARGO - 1e-9:
        return 0
    return math.floor(disponible / NIDAL_LARGO + 1e-9)


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
    cadena_inicio_x_m: float = 0.0   # > 0 cuando el local técnico va dentro de la nave
    slat_izq_y_m: float
    cuerpo_y_m: float
    slat_der_y_m: float
    conjunto_fin_y_m: float
    cadena_largo_m: float
    tensor_fin_x_m: float
    libre_fondo_m: float


def geometria_nidal_centrado(ancho: float, largo: float, num_modulos: int,
                             slot_izq: float, slot_der: float,
                             paso_izq: float = 1, paso_der: float = 1,
                             local_dentro: bool = False,
                             libre_fondo: float | None = None) -> GeometriaNidalCentrado:
    paso = (ancho - perfil_nidal_m(slot_izq, slot_der)) / 2
    if paso < max(paso_izq, paso_der) - 1e-6:
        raise ValueError("El nidal centrado no deja el paso mínimo exigido a ambos lados")
    inicio, fondo, _ = tramos_nidal(largo, local_dentro, libre_fondo)
    cadena = num_modulos * NIDAL_LARGO
    fin_tensor = inicio + cadena + NIDAL_TENSOR
    if num_modulos < 1 or inicio + cadena + fondo > largo + 1e-6:
        raise ValueError("La cadena de nidales y el espacio libre del fondo no caben en el largo de la nave")
    return GeometriaNidalCentrado(
        paso_lateral_m=paso, cadena_inicio_x_m=inicio, slat_izq_y_m=paso,
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

    cap_modulos  = num_modulos * NIDAL_CAP
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
    n_max: int | None = None,
) -> list[CapacidadNidal]:
    """Todos los conteos de módulos que caben físicamente, de 1 a N_max."""
    if n_max is not None:
        pass
    elif largo_nave is not None:
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
    n_max: int | None = None,
) -> tuple[Optional[CapacidadNidal], list[CapacidadNidal]]:
    """
    Devuelve (óptimo, escenarios).

    Óptimo = el que más gallinas aloja cumpliendo yacija; a igualdad de gallinas,
    el que usa menos módulos (menos inversión para la misma capacidad).
    """
    todos = escenarios_nidal(sup_nave, largo_nave, ancho_nave, sistema,
                             slot_izq, slot_der, n_max)
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


def _fuente_pasto(sistema: str) -> str:
    """4 m²/gallina al aire libre: norma ecológica o norma de comercialización (campero)."""
    return ("Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if sistema == "ecologico"
            else "Regl. Delegado (UE) 2023/2465, anexo II, punto 1.c")


def _fuente_densidad(sistema: str) -> str:
    return ("Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if sistema == "ecologico"
            else "RD 3/2002 Anexo IV")


def _fuente_yacija(sistema: str) -> str:
    """1/3 del suelo con cama: RD 3/2002 y, en ecológico, además el suelo sólido de 2018/848."""
    return ("RD 3/2002 Anexo IV · Regl. (UE) 2018/848, anexo II, parte II, 1.9.4.4.a" if sistema == "ecologico"
            else "RD 3/2002 Anexo IV")


def trampillas_eco_min_m(gallinas: int) -> float:
    """Longitud combinada mínima de trampillas al exterior en ecológico (m)."""
    sup_cubierta_min = gallinas / DENSIDAD_MAX["ecologico"]
    return round(sup_cubierta_min * ECO_TRAMPILLA_M_POR_100M2 / 100, 2)


def requisitos_equipamiento(n: int, sistema: str) -> list[RequisitoEquipamiento]:
    """Requisitos mínimos de equipamiento según RD 3/2002 para n gallinas."""
    req = [
        RequisitoEquipamiento(
            nombre="Perchas", valor_minimo=round(n * (18.0 if sistema == "ecologico" else 15.0), 0), unidad="cm lineales",
            formula=f"{n} × {18 if sistema == 'ecologico' else 15} cm/gallina",
            articulo="Reglamento de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if sistema == "ecologico" else "RD 3/2002 Anexo IV"),
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
            formula=f"{n} × 120 cm²/gallina", articulo="Reglamento de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3"))
    else:
        req.append(RequisitoEquipamiento(
            nombre="Nidal colectivo", valor_minimo=round(n / 120, 2), unidad="m² útiles",
            formula=f"{n} / 120 gallinas/m²", articulo="RD 3/2002 Anexo IV"))
    if sistema in ("campero", "ecologico"):
        req.append(RequisitoEquipamiento(
            nombre="Zona de pasto mínima", valor_minimo=round(n * 4.0, 2), unidad="m²",
            formula=f"{n} × 4 m²/gallina", articulo=_fuente_pasto(sistema)))
    if sistema == "ecologico":
        req.append(RequisitoEquipamiento(
            nombre="Trampillas al exterior (longitud combinada)", valor_minimo=trampillas_eco_min_m(n),
            unidad="m", formula=f"{n} / 6 gallinas/m² × 4 m / 100 m²",
            articulo="Regl. de Ejecución (UE) 2020/464, art. 15.1.d"))
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
    # Nidal: local técnico (motor + mesa de recogida) dentro de la nave o como anexo exterior
    local_dentro: bool = False
    # Nidal: largo libre mínimo entre el final de la cadena y la pared del fondo,
    # tensor incluido. None = el largo del módulo tensor de la ficha.
    libre_fondo_m: float | None = Field(default=None, ge=0)
    # Aviario: 2 o 3 niveles; None = el máximo que permita la altura
    niveles: Literal[2, 3] | None = None
    # Escenario forzado: nº de módulos (nidal) o nº de filas (aviario)
    num_modulos: Optional[int] = Field(default=None, gt=0)
    num_filas: Optional[int] = Field(default=None, gt=0)
    mods_por_fila: int | None = Field(default=None, gt=0)
    clearance_pared_m: float = Field(default=0, ge=0)
    pasillo_m: float = Field(default_factory=lambda: AVI_PASILLO, ge=0)
    clearance_frontal_m: float = Field(default_factory=lambda: AVI_CLEARANCE, ge=0)
    clearance_fondo_m: float = Field(default_factory=lambda: AVI_CLEARANCE_FONDO, ge=0)
    # Fracción de la superficie de la nave que computa (uso interno: el extremo
    # inferior del intervalo de capacidad se calcula con la nave reducida).
    _factor_superficie: float = PrivateAttr(default=1.0)

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


class ParametroCalculo(BaseModel):
    """Un valor que ha intervenido en el cálculo y de dónde sale."""
    grupo: str
    nombre: str
    valor: str
    origen: str          # "Ficha técnica" | "Medido" | "Datos de la nave" | "Normativa" | "Pendiente de medir"


class EquipoPrevisto(BaseModel):
    """Equipamiento de la instalación frente al mínimo normativo (versión cliente)."""
    nombre: str
    unidad: str
    previsto: float
    minimo: float
    origen: str          # "Integrado en el módulo" | "Medido"
    cumple: bool


class Condicion(BaseModel):
    """Requisito del régimen de producción que no se deduce de las medidas de la nave."""
    nombre: str
    detalle: str
    fuente: str


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
    # Extremo inferior del intervalo: gallinas_max menos el margen de incertidumbre
    gallinas_min: int = 0
    margen_incertidumbre_pct: float = 0.0
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
    local_dentro: bool = False         # nidal: local técnico dentro de la nave
    sup_local_m2: float = 0.0          # nidal: suelo de la nave que ocupa el local técnico
    libre_fondo_m: float = 0.0         # nidal: largo libre mínimo al fondo (tensor incluido)
    niveles: int = 0                   # aviario
    descripcion_layout: str = ""

    max_modulos_fisicos: int = 0
    verificaciones: list[Verificacion] = []
    requisitos: list[RequisitoEquipamiento] = []
    escenarios: list[Escenario] = []
    notas: list[str] = []
    parametros: list[ParametroCalculo] = []
    equipamiento: list[EquipoPrevisto] = []
    condiciones: list[Condicion] = []


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
    if req._factor_superficie != 1:
        # Redondeo: 336 × 0,85 da 285,5999… y costaría una gallina al truncar
        S = round(S * req._factor_superficie, 4)
    # Con el local técnico dentro, su planta no es suelo para las aves: no
    # computa para densidad ni para yacija, y el 1/3 se mide sobre el resto.
    sup_local = sup_local_interior(req.local_dentro, req.ancho_nave_m)
    S_aves = S - sup_local
    inicio_cadena, libre_fondo, _ = tramos_nidal(req.largo_nave_m, req.local_dentro, req.libre_fondo_m)
    densidad_max = densidad_max_para(req.sistema)
    sup_parque = req.sup_parque_m2 or 0.0
    sup_pasto  = req.sup_pasto_m2 or 0.0

    base = EstudioResponse(
        tipo_zona="nidal_colectivo", sistema=req.sistema,
        ancho_nave_m=req.ancho_nave_m, largo_nave_m=req.largo_nave_m,
        altura_nave_cm=req.altura_nave_cm, superficie_nave_m2=S,
        sup_parque_m2=sup_parque, sup_pasto_m2=sup_pasto, viable=False,
        local_dentro=req.local_dentro, sup_local_m2=sup_local, libre_fondo_m=libre_fondo,
        densidad_max=densidad_max, yacija_min_m2=yacija_minima(S_aves), sup_total_m2=S_aves,
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
    if libre_fondo < NIDAL_TENSOR - 1e-6:
        base.motivo = (
            f"El espacio libre al fondo ({libre_fondo:g} m) no deja sitio al tensor: "
            f"hacen falta al menos {NIDAL_TENSOR:g} m tras el último módulo."
        )
        return base
    base.max_modulos_fisicos = max_modulos_nidal(req.largo_nave_m, req.ancho_nave_m,
                                                 req.local_dentro, req.libre_fondo_m)

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
            f"{inicio_cadena + NIDAL_LARGO + libre_fondo:.2f} m como mínimo ("
            + (f"{inicio_cadena:g} m de local técnico + " if inicio_cadena else "")
            + f"1 módulo + {libre_fondo:g} m libres al fondo)."
        )
        return base

    optimo, todos = optimo_nidal(S_aves, req.largo_nave_m, req.ancho_nave_m, req.sistema,
                                 slot_izq, slot_der, base.max_modulos_fisicos)
    escenarios = [_escenario_desde_capacidad(c, S_aves) for c in todos]

    if optimo is None:
        base.escenarios = escenarios
        base.motivo = (
            f"Con slots de {slot_izq:.0f} + {slot_der:.0f} m no queda yacija suficiente: "
            f"la normativa exige {yacija_minima(S_aves):.0f} m² (1/3 de la nave). Reduce la "
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
                                        slot_izq, slot_der, paso_izq, paso_der,
                                        req.local_dentro, req.libre_fondo_m)
    base.geometria_nidal = geometria
    verificaciones = [
        _v("Densidad de alojamiento", elegido.densidad, densidad_max, "gallinas/m²", "maximo",
           "RD 3/2002 Anexo IV",
           f"{elegido.gallinas} gallinas sobre {elegido.sup_disponible_m2:.0f} m² útiles "
           f"(nave − {'local técnico − ' if sup_local else ''}cuerpo de los módulos)"),
        _v("Superficie de yacija", elegido.yacija_m2, elegido.yacija_min_m2, "m²", "minimo",
           _fuente_yacija(req.sistema),
           f"1/3 de los {S_aves:.0f} m² de nave"
           + (f" sin el local técnico ({sup_local:.0f} m²)" if sup_local else "")
           + f". Los slots ({elegido.sup_slot_m2:.0f} m²) no computan como yacija."),
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
        _v("Longitud ocupada por la cadena", inicio_cadena + n * NIDAL_LARGO + libre_fondo, largo_cadena,
           "m", "maximo", "Dimensional — plano 26301001",
           (f"{inicio_cadena:g} m de local técnico + " if inicio_cadena else "")
           + f"{n} módulos × {NIDAL_LARGO:.2f} m + {libre_fondo:g} m libres al fondo con el tensor"
           + ("" if inicio_cadena else f" (el local técnico de {NIDAL_EQUIP:g} m es anexo exterior)")),

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
    base.yacija_pct = round(elegido.yacija_m2 / S_aves * 100, 1) if S_aves > 0 else 0.0
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

    niveles_max = (3 if req.altura_nave_cm >= AVI_ALTURA_MIN[3]
                   else (2 if req.altura_nave_cm >= AVI_ALTURA_MIN[2] else 0))
    niveles_altura = niveles_max
    if req.sistema == "ecologico":
        niveles_max = min(niveles_max, ECO_NIVELES_MAX_CON_SUELO - 1)
    niveles = req.niveles or niveles_max

    base = EstudioResponse(
        tipo_zona="aviario", sistema=req.sistema,
        ancho_nave_m=req.ancho_nave_m, largo_nave_m=req.largo_nave_m,
        altura_nave_cm=req.altura_nave_cm, superficie_nave_m2=S,
        sup_parque_m2=sup_parque, sup_pasto_m2=sup_pasto, viable=False,
        densidad_max=densidad_max, niveles=niveles,
    )

    altura_min = AVI_ALTURA_MIN.get(niveles, AVI_ALTURA_MIN[2])
    if niveles not in (2, 3) or req.altura_nave_cm < altura_min:
        base.motivo = (
            f"Un aviario de {niveles if niveles in (2, 3) else 2} niveles necesita "
            f"{altura_min:.0f} cm de altura libre y la nave tiene "
            f"{req.altura_nave_cm:.0f} cm."
        )
        base.verificaciones = [_v(
            "Altura libre de la nave", req.altura_nave_cm,
            altura_min, "cm", "minimo",
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
    suelo_util = round(largo_util * req.ancho_nave_m * req._factor_superficie, 2)
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
        _v("Densidad de alojamiento", elegido.densidad, densidad_max, "gallinas/m²", "maximo",
           "RD 3/2002 Anexo IV · Directiva 1999/74/CE",
           f"{elegido.gallinas} gallinas sobre {sup_disp:.0f} m² utilizables "
           f"({n} × {sup_disp_mod:.2f} m² de módulo sin zona de puesta + {suelo_util:.0f} m² de suelo"
           + ")"),
        _v("Superficie de yacija", elegido.sup_yacija_m2, yac_min, "m²", "minimo",
           _fuente_yacija(req.sistema),
           f"1/3 de los {suelo_util:.0f} m² de suelo disponible; además 250 cm² por ave"),
        _v("Ancho ocupado por las filas", perfil_filas, req.ancho_nave_m, "m", "maximo",
           "Dimensional — aviario cód. 10007",
           f"{elegido.num_filas} filas × {AVI_MOD_B:.2f} m + {max(0, elegido.num_filas - 1)} "
           f"pasillos × {AVI_PASILLO:.2f} m"),
        _v("Largo ocupado por la fila", mods_por_fila * AVI_MOD_A + req.clearance_frontal_m + req.clearance_fondo_m,
           req.largo_nave_m, "m", "maximo", "Dimensional — aviario cód. 10007",
           f"{mods_por_fila} módulos × {AVI_MOD_A:.2f} m + {req.clearance_frontal_m:.2f} m y "
           f"{req.clearance_fondo_m:.2f} m de zona de equipos"),
        _v("Niveles del aviario", niveles + 1, ECO_NIVELES_MAX_CON_SUELO, "niveles", "maximo",
           "Regl. de Ejecución (UE) 2020/464, art. 15.4.b",
           f"{niveles} niveles del aviario + el suelo. En ecológico, máximo "
           f"{ECO_NIVELES_MAX_CON_SUELO} niveles de zona utilizable incluido el suelo")
        if req.sistema == "ecologico" else
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
    elif niveles_altura > niveles_max and req.niveles is None:
        notas.append(
            f"La altura de la nave admitiría {niveles_altura} niveles, pero en ecológico el "
            f"máximo es {ECO_NIVELES_MAX_CON_SUELO} incluido el suelo: se estudian {niveles_max}."
        )
    if elegido.num_filas != optimo.num_filas:
        notas.append(
            f"Escenario forzado a {elegido.num_filas} filas. El óptimo de la nave son "
            f"{optimo.num_filas} filas ({optimo.gallinas} gallinas)."
        )

    base.viable = all(v.cumple for v in verificaciones)
    if req.sistema == "ecologico" and niveles + 1 > ECO_NIVELES_MAX_CON_SUELO:
        base.motivo = (f"En producción ecológica el aviario admite como máximo "
                       f"{ECO_NIVELES_MAX_CON_SUELO - 1} niveles: con el suelo son "
                       f"{ECO_NIVELES_MAX_CON_SUELO} niveles de zona utilizable.")
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


def _verificacion_puesta(req: EstudioRequest, sup_puesta: float, gallinas: int, n: int) -> Verificacion:
    """Superficie de puesta del nidal frente al mínimo de nidal colectivo para `gallinas`."""
    eco = req.sistema == "ecologico"
    medido = req.equipamiento.nidal_util_m2 is not None
    origen = ("Superficie medida" if medido else
              f"{_num(NIDAL_UTIL_M2, 'm²')} de alfombrilla por módulo × {n} módulos")
    regla = "120 cm² por gallina" if eco else "1 m² por cada 120 gallinas"
    return _v("Superficie de puesta (alfombrillas)", sup_puesta,
              gallinas * 0.012 if eco else gallinas / GALLINAS_POR_M2_NIDAL, "m²", "minimo",
              ("Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if eco else "RD 3/2002 Anexo IV"),
              f"{origen}; {regla} ({_num(math.floor(sup_puesta / 0.012 if eco else sup_puesta * GALLINAS_POR_M2_NIDAL), 'gallinas')} como máximo)")


def _verificaciones_comunes(req: EstudioRequest, gallinas: int, sup_pasto: float) -> list[Verificacion]:
    out: list[Verificacion] = []
    if req.sistema == "ecologico":
        out.append(_v(
            "Gallinas por compartimento (ecológico)", gallinas, MAX_GALLINAS_ECOLOGICO,
            "gallinas", "maximo", "Regl. (UE) 2018/848, anexo II, parte II, 1.9.4.4.n",
            "Máximo 3.000 gallinas ponedoras en un único compartimento del gallinero",
        ))
        # Las trampillas son de la nave, no del módulo: solo se verifican si se han medido
        trampillas = req.equipamiento.salidas_ancho_util_m
        if trampillas is not None:
            out.append(_v(
                "Trampillas al exterior", trampillas, trampillas_eco_min_m(gallinas), "m", "minimo",
                "Regl. de Ejecución (UE) 2020/464, art. 15.1.d",
                f"Longitud combinada: 4 m por cada 100 m² de superficie cubierta mínima "
                f"({gallinas} gallinas / 6 gallinas/m²)",
            ))
    # Solo se verifica si el pasto se ha informado; si no, se avisa como nota
    if req.sistema in ("campero", "ecologico") and sup_pasto > 0:
        out.append(_v(
            "Zona de pasto", sup_pasto, round(gallinas * 4.0, 2), "m²", "minimo",
            _fuente_pasto(req.sistema),
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
    resultado = _estudiar(req)
    # Intervalo de capacidad: el extremo inferior es la misma instalación con la
    # superficie de la nave reducida en el margen de incertidumbre. Las
    # verificaciones, el equipamiento y el plano van con la capacidad máxima.
    resultado.margen_incertidumbre_pct = MARGEN_INCERTIDUMBRE_PCT
    resultado.gallinas_min = resultado.gallinas_max
    if MARGEN_INCERTIDUMBRE_PCT > 0 and resultado.num_modulos:
        reducido = req.model_copy(update={"num_filas": resultado.num_filas} if req.tipo_zona == "aviario"
                                  else {"num_modulos": resultado.num_modulos})
        reducido._factor_superficie = 1 - MARGEN_INCERTIDUMBRE_PCT / 100
        resultado.gallinas_min = min(resultado.gallinas_max, _estudiar(reducido).gallinas_max)
    resultado.parametros = _parametros(req, resultado)
    return resultado


def _estudiar(req: EstudioRequest) -> EstudioResponse:
    motor = _estudio_aviario if req.tipo_zona == "aviario" else _estudio_nidal
    resultado = motor(req)
    if resultado.num_modulos and req.sistema in ("suelo", "campero", "ecologico"):
        # Mismo redondeo que suelo_util en _estudio_aviario: si no, la yacija
        # redondeada puede superar el suelo por milésimas y el aforo la rechaza.
        suelo = (round((req.largo_nave_m - req.clearance_frontal_m - req.clearance_fondo_m) * req.ancho_nave_m
                       * req._factor_superficie, 2)
                 if req.tipo_zona == "aviario" else resultado.superficie_nave_m2 - resultado.sup_local_m2)

        def evaluar(n, yacija):
            # Redondeo a 4 decimales: sin él, el ruido de coma flotante
            # (372.76800000000003) aparece en la fórmula impresa del aforo.
            superficie = round(n * AVI_SUP_DISP[resultado.niveles] + suelo if req.tipo_zona == "aviario"
                               else suelo - n * NIDAL_CUERPO, 4)
            equipamiento = req.equipamiento
            catalogo = (nidal_equipo_por_modulo(req.sistema) if req.tipo_zona == "nidal_colectivo"
                        else AVI_EQUIPO_POR_MODULO.get(resultado.niveles, {}))
            if req.tipo_zona == "nidal_colectivo" and equipamiento.nidal_util_m2 is None:
                # Superficie de puesta integrada: las alfombrillas de cada módulo.
                # Es un límite del aforo como el resto del equipamiento; se calcula
                # por escenario para que la optimización y el aforo final coincidan.
                equipamiento = equipamiento.model_copy(update={
                    "nidal_util_m2": round(n * NIDAL_UTIL_M2, 4),
                })
            # Lo no medido se toma del equipamiento integrado del módulo; lo
            # medido prevalece. Mismo valor en escenarios y aforo final.
            equipamiento = equipamiento.model_copy(update={
                campo: (n * int(v) if campo == "bebederos_pezon_copa" else round(n * v, 4))
                for campo, v in catalogo.items() if getattr(equipamiento, campo) is None
            })
            aforo = calcular_aforo(AforoRequest(sistema=req.sistema,
                superficie_util_m2=max(0, superficie), superficie_suelo_m2=suelo,
                yacija_m2=yacija, pasto_m2=req.sup_pasto_m2, equipamiento=equipamiento))
            return aforo, superficie, equipamiento

        escenarios = resultado.escenarios
        for e in escenarios:
            aforo, superficie, _ = evaluar(e.num_modulos, e.sup_yacija_m2)
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
            if resultado.num_modulos:
                # El motor compara con su óptimo geométrico; el real es el del aforo
                aviario = req.tipo_zona == "aviario"
                unidad = "filas" if aviario else "módulos"
                actual, mejor = ((resultado.num_filas, optimo.num_filas) if aviario
                                 else (resultado.num_modulos, optimo.num_modulos))
                resultado.notas = [n for n in resultado.notas if not n.startswith("Escenario forzado")]
                if actual != mejor:
                    resultado.notas.append(
                        f"Escenario forzado a {actual} {unidad[:-1] if actual == 1 else unidad}. El óptimo de la nave es "
                        f"{mejor} {unidad} ({optimo.gallinas} gallinas).")
        resultado.escenarios = escenarios
        aforo, superficie, equipamiento = evaluar(resultado.num_modulos, resultado.sup_yacija_m2)
        cap_geometrica = resultado.gallinas_max
        cap_modulo = NIDAL_CAP if req.tipo_zona == "nidal_colectivo" else AVI_CAP
        # La fila muestra el producto real; los recortes por densidad, yacija o
        # tope ecológico ya figuran como criterios propios del aforo.
        aforo.limites.append(LimiteAforo(criterio="modulos_instalados",
            gallinas=resultado.num_modulos * cap_modulo,
            formula=f"{resultado.num_modulos} módulos × {cap_modulo} gallinas/módulo",
            fuente="Capacidad física de los módulos instalados"))
        aforo.gallinas_max = min([l.gallinas for l in aforo.limites] + [cap_geometrica])
        aforo.limitantes = [l.criterio for l in aforo.limites if l.gallinas == aforo.gallinas_max]
        if not aforo.limitantes:
            # El motor geométrico redondea en coma flotante y puede quedar una
            # gallina por debajo del aforo exacto: manda el motor, que es lo
            # que dibuja el plano, y se conserva su limitante.
            aforo.limitantes = [c.strip() for c in resultado.limitante.split(",") if c.strip()]
        # El equipamiento integrado del nidal se dimensiona con la capacidad del
        # módulo: si empata con ella, el límite real son los módulos instalados.
        if req.tipo_zona == "nidal_colectivo" and "modulos_instalados" in aforo.limitantes:
            integrado = {CRITERIO_EQUIPO[c] for c in CRITERIO_EQUIPO if getattr(req.equipamiento, c) is None}
            aforo.limitantes = [c for c in aforo.limitantes if c not in integrado]
        # La capacidad geométrica ya incorpora densidad/yacija al elegir los
        # módulos: si empata con otro criterio, el limitante real es ese otro.
        if len(aforo.limitantes) > 1 and "modulos_instalados" in aforo.limitantes:
            aforo.limitantes.remove("modulos_instalados")
        resultado.aforo = aforo
        resultado.gallinas_max = aforo.gallinas_max
        resultado.limitante = ", ".join(aforo.limitantes)
        resultado.densidad_real = round(resultado.gallinas_max / superficie, 2) if superficie > 0 else 0
        resultado.requisitos = requisitos_equipamiento(resultado.gallinas_max, req.sistema)
        resultado.equipamiento = _equipo_previsto(req, equipamiento, resultado.gallinas_max)
        resultado.verificaciones = [v for v in resultado.verificaciones
                                    if v.parametro not in ("Zona de pasto", "Densidad de alojamiento", "Ocupación del nidal")]
        resultado.verificaciones = [v for v in resultado.verificaciones if v.parametro not in
                                    ("Gallinas por compartimento (ecológico)", "Trampillas al exterior")]
        resultado.verificaciones.append(_v("Densidad de alojamiento", resultado.densidad_real,
            resultado.densidad_max, "gallinas/m²", "maximo", _fuente_densidad(req.sistema)))
        if req.tipo_zona == "nidal_colectivo" and equipamiento.nidal_util_m2 is not None:
            resultado.verificaciones.append(_verificacion_puesta(
                req, equipamiento.nidal_util_m2, resultado.gallinas_max, resultado.num_modulos))
        resultado.verificaciones += _verificaciones_comunes(req, resultado.gallinas_max, req.sup_pasto_m2 or 0)
        resultado.viable = resultado.gallinas_max > 0 and all(v.cumple for v in resultado.verificaciones)
        if not resultado.viable and not resultado.motivo:
            fallan = [v.parametro for v in resultado.verificaciones if not v.cumple]
            resultado.motivo = ("No cumple: " + ", ".join(fallan) + "." if fallan and resultado.gallinas_max > 0
                                else "El equipamiento o las superficies declaradas no permiten alojar aves.")
        resultado.notas = [n for n in resultado.notas if not n.startswith("Falta el dato de zona de pasto")]
        if req.tipo_zona == "aviario":
            catalogo = AVI_EQUIPO_POR_MODULO.get(resultado.niveles, {})
            de_catalogo = [c for c in catalogo if getattr(req.equipamiento, c) is None]
            if de_catalogo:
                resultado.notas.append(
                    f"Equipamiento integrado del aviario de {resultado.niveles} niveles tomado del acta de referencia "
                    f"(por módulo: {catalogo['perchas_m']:g} m de percha, {catalogo['nidal_util_m2']:g} m² de nidal, "
                    f"{catalogo['comedero_lineal_accesible_m']:g} m de comedero, {catalogo['bebederos_pezon_copa']:g} bebederos). "
                    "Si la instalación difiere, introduce el valor medido.")
            elif not catalogo:
                resultado.notas.append(
                    f"Sin datos de equipamiento integrado para el aviario de {resultado.niveles} niveles: "
                    "perchas, nidales, comederos y bebederos quedan pendientes de medir.")
        elif any(getattr(req.equipamiento, c) is None for c in CRITERIO_EQUIPO):
            eq = nidal_equipo_por_modulo(req.sistema)
            resultado.notas.append(
                f"Equipamiento integrado del nidal A-Nida dimensionado para {NIDAL_CAP} gallinas/módulo "
                f"(por módulo: {_num(eq['perchas_m'], 'm')} de percha, {_num(eq['comedero_lineal_accesible_m'], 'm')} "
                f"de comedero lineal, {eq['bebederos_pezon_copa']} bebederos). "
                "Si la instalación difiere, introduce el valor medido.")
        if aforo.pendientes:
            resultado.notas.append("Pendiente de medir: " + ", ".join(aforo.pendientes) + ".")
    resultado.notas.append("Estimación con geometría de catálogo pendiente de confirmar; no es un aforo autorizado.")
    resultado.condiciones = _condiciones_ecologico(req, resultado) if req.sistema == "ecologico" else []
    return resultado


def _condiciones_ecologico(req: EstudioRequest, r: EstudioResponse) -> list[Condicion]:
    """Requisitos de la producción ecológica que dependen de la explotación, no del módulo."""
    C = Condicion
    g = r.gallinas_max
    R848, R464 = "Regl. (UE) 2018/848, anexo II, parte II", "Regl. de Ejecución (UE) 2020/464"
    trampillas = trampillas_eco_min_m(g)
    out = [
        C(nombre="Acceso al exterior",
          detalle="Acceso a zonas al aire libre durante al menos un tercio de su vida, de forma continua "
                  "durante las horas de luz desde la edad más temprana posible.",
          fuente=f"{R848}, 1.9.4.4.d y e"),
        C(nombre="Trampillas de salida",
          detalle=f"Longitud combinada mínima de {_num(trampillas, 'm')} en los límites exteriores del gallinero "
                  f"(4 m por cada 100 m² de superficie cubierta mínima), de tamaño adecuado, sin obstáculos "
                  f"y con rampa si están elevadas. Con porche: {_num(round(trampillas / 2, 2), 'm')} entre gallinero y "
                  f"porche y {_num(trampillas, 'm')} entre porche y exterior; el porche no computa para la densidad.",
          fuente=f"{R464}, art. 15.1 y 15.2"),
        C(nombre="Zona al aire libre",
          detalle=f"Mínimo {_num(g * 4.0, 'm²')} (4 m² por gallina), cubierta en su mayor parte de vegetación "
                  f"variada, con refugios, arbustos o árboles repartidos y bebederos accesibles. Radio máximo de "
                  f"150 m desde la trampilla más próxima, o 350 m con al menos 4 refugios por hectárea.",
          fuente=f"{R464}, art. 16 y anexo I, parte IV, punto 3 · {R848}, 1.9.4.4.g y h"),
        C(nombre="Suelo y yacija",
          detalle="Al menos un tercio del suelo de construcción sólida (sin listones ni rejilla) cubierto de cama "
                  "de paja, viruta, arena o turba, y una parte suficiente del suelo apta para recoger las deyecciones.",
          fuente=f"{R848}, 1.9.4.4.a y b"),
        C(nombre="Iluminación",
          detalle="Máximo 16 horas de luz al día, con un descanso nocturno continuo de al menos 8 horas sin luz artificial.",
          fuente=f"{R848}, 1.9.4.4.l"),
        C(nombre="Tamaño de manada",
          detalle=f"Máximo {MAX_GALLINAS_ECOLOGICO:,} gallinas por compartimento del gallinero".replace(",", ".")
                  + ". Los compartimentos se separan con tabiques, semitabiques o mallas, y cada manada tiene "
                    "su propia zona al aire libre.",
          fuente=f"{R848}, 1.9.4.4.n · {R464}, art. 15.3.d y 16.2"),
    ]
    if r.tipo_zona == "aviario":
        out.append(C(nombre="Sistema multinivel",
          detalle=f"Máximo {ECO_NIVELES_MAX_CON_SUELO} niveles de zona utilizable incluido el suelo; los niveles "
                  "elevados evitan que las deyecciones caigan sobre las aves de debajo y llevan recogida de "
                  "estiércol; inspección fácil en todos los niveles y el mismo acceso al exterior para todas las aves.",
          fuente=f"{R464}, art. 15.4"))
    out.append(C(nombre="Vacío sanitario",
          detalle="Vaciar, limpiar y desinfectar el gallinero entre lotes, y dejar vacíos los parques el tiempo "
                  "que fije la comunidad autónoma para que se recupere la vegetación.",
          fuente=f"{R848}, 1.9.4.4.c"))
    return out


def _equipo_previsto(req: EstudioRequest, eq: EquipamientoMedido, gallinas: int) -> list[EquipoPrevisto]:
    """Equipamiento con el que se ha calculado el aforo y el mínimo que exige la norma para `gallinas`."""
    eco = req.sistema == "ecologico"
    minimos = {
        "perchas_m":                   ("Perchas", "m", round(gallinas * (0.18 if eco else 0.15), 2)),
        "nidal_util_m2":               ("Superficie de puesta (alfombrillas)" if req.tipo_zona == "nidal_colectivo"
                                        else "Superficie de nidal", "m²",
                                        round(gallinas * 0.012 if eco else gallinas / 120, 2)),
        "comedero_lineal_accesible_m": ("Comedero lineal", "m", round(gallinas * 0.10, 2)),
        "bebederos_pezon_copa":        ("Bebederos de pezón o copa", "uds", float(math.ceil(gallinas / 10))),
    }
    out: list[EquipoPrevisto] = []
    for campo, (nombre, unidad, minimo) in minimos.items():
        previsto = getattr(eq, campo)
        if previsto is None:
            continue
        out.append(EquipoPrevisto(nombre=nombre, unidad=unidad, previsto=round(previsto, 2), minimo=minimo,
            origen="Medido" if getattr(req.equipamiento, campo) is not None else "Integrado en el módulo",
            cumple=previsto >= minimo - 1e-9))
    return out


def _num(v: float, unidad: str = "") -> str:
    """Número en formato español, sin ceros sobrantes."""
    texto = f"{v:,.4f}".rstrip("0").rstrip(".").replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{texto} {unidad}".strip()


def _parametros(req: EstudioRequest, r: EstudioResponse) -> list[ParametroCalculo]:
    """Todos los valores que intervienen en el cálculo, con su origen."""
    P = ParametroCalculo
    FT, MED, NAVE, NORMA, PEND = "Ficha técnica", "Medido", "Datos de la nave", "Normativa", "Pendiente de medir"
    eco = req.sistema == "ecologico"
    out: list[ParametroCalculo] = []

    def equipo_medido_o_pendiente(campo: str, nombre: str, unidad: str) -> ParametroCalculo:
        medido = getattr(req.equipamiento, campo)
        if medido is not None:
            return P(grupo="Equipamiento", nombre=f"{nombre} (total nave)", valor=_num(medido, unidad), origen=MED)
        return P(grupo="Equipamiento", nombre=nombre, valor="Sin dato", origen=PEND)

    if req.tipo_zona == "aviario":
        n = r.niveles if r.niveles in (2, 3) else 2
        g = f"Aviario · {n} niveles"
        out += [
            P(grupo=g, nombre="Largo del módulo", valor=_num(AVI_MOD_A, "m"), origen=FT),
            P(grupo=g, nombre="Fondo del módulo", valor=_num(AVI_MOD_B, "m"), origen=FT),
            P(grupo=g, nombre="Capacidad por módulo", valor=_num(AVI_CAP, "gallinas"), origen=FT),
            P(grupo=g, nombre="Superficie total por módulo", valor=_num(AVI_SUP_TOTAL[n], "m²"), origen=FT),
            P(grupo=g, nombre="Superficie disponible por módulo", valor=_num(AVI_SUP_DISP[n], "m²"), origen=FT),
            P(grupo=g, nombre="Altura libre mínima", valor=_num(AVI_ALTURA_MIN[n], "cm"), origen=FT),
            P(grupo=g, nombre="Pasillo entre filas", valor=_num(req.pasillo_m, "m"), origen=FT),
            P(grupo=g, nombre="Zona de equipos (frontal / fondo)",
              valor=_num(req.clearance_frontal_m) + " / " + _num(req.clearance_fondo_m, "m"), origen=FT),
        ]
        catalogo = AVI_EQUIPO_POR_MODULO.get(n, {})
        for campo, nombre, unidad in (("perchas_m", "Perchas", "m"), ("nidal_util_m2", "Nidal útil", "m²"),
                                      ("comedero_lineal_accesible_m", "Comedero lineal", "m"),
                                      ("bebederos_pezon_copa", "Bebederos", "uds")):
            if getattr(req.equipamiento, campo) is None and campo in catalogo:
                por_modulo = catalogo[campo]
                out.append(P(grupo="Equipamiento", nombre=f"{nombre} por módulo",
                             valor=f"{_num(por_modulo, unidad)} × {r.num_modulos} = {_num(por_modulo * r.num_modulos, unidad)}",
                             origen=FT))
            else:
                out.append(equipo_medido_o_pendiente(campo, nombre, unidad))
    else:
        g = "Nidal colectivo A-Nida"
        out += [
            P(grupo=g, nombre="Largo del módulo", valor=_num(NIDAL_LARGO, "m"), origen=FT),
            P(grupo=g, nombre="Fondo del cuerpo", valor=_num(NIDAL_ANCHO, "m"), origen=FT),
            P(grupo=g, nombre="Capacidad por módulo", valor=_num(NIDAL_CAP, "gallinas"), origen=FT),
            P(grupo=g, nombre="Módulo tensor (dentro de la nave)", valor=_num(NIDAL_TENSOR, "m"), origen=FT),
            P(grupo=g, nombre="Local técnico (largo)", valor=_num(NIDAL_EQUIP, "m"), origen=FT),
            P(grupo=g, nombre="Slots izquierdo / derecho",
              valor=_num(r.slot_izq_m) + " / " + _num(r.slot_der_m, "m"), origen=NAVE),
            P(grupo=g, nombre="Paso mínimo a pared",
              valor=_num(req.paso_izq_m) + " / " + _num(req.paso_der_m, "m"), origen=NAVE),
            P(grupo=g, nombre="Local técnico",
              valor=(f"Dentro de la nave ({_num(r.sup_local_m2, 'm²')} no computan)" if r.local_dentro
                     else "Anexo exterior"), origen=NAVE),
            P(grupo=g, nombre="Libre al fondo (tensor incluido)", valor=_num(r.libre_fondo_m, "m"),
              origen=NAVE if req.libre_fondo_m is not None else FT),
        ]
        if req.equipamiento.nidal_util_m2 is None:
            out.append(P(grupo="Equipamiento", nombre="Alfombrillas de puesta por módulo",
                         valor=f"{_num(NIDAL_UTIL_M2, 'm²')} × {r.num_modulos} = {_num(NIDAL_UTIL_M2 * r.num_modulos, 'm²')}",
                         origen=FT))
        else:
            out.append(equipo_medido_o_pendiente("nidal_util_m2", "Nidal útil", "m²"))
        for campo, nombre, unidad in (("perchas_m", "Perchas", "m"),
                                      ("comedero_lineal_accesible_m", "Comedero lineal", "m"),
                                      ("bebederos_pezon_copa", "Bebederos", "uds")):
            if getattr(req.equipamiento, campo) is None:
                por_modulo = nidal_equipo_por_modulo(req.sistema)[campo]
                out.append(P(grupo="Equipamiento", nombre=f"{nombre} por módulo",
                             valor=f"{_num(por_modulo, unidad)} × {r.num_modulos} = {_num(por_modulo * r.num_modulos, unidad)}",
                             origen=FT))
            else:
                out.append(equipo_medido_o_pendiente(campo, nombre, unidad))
    if req.sistema == "campero":
        out.append(equipo_medido_o_pendiente("salidas_ancho_util_m", "Ancho útil de salidas", "m"))
    if eco:
        out.append(equipo_medido_o_pendiente("salidas_ancho_util_m", "Trampillas al exterior", "m"))

    out += [
        P(grupo="Nave", nombre="Dimensiones", valor=_num(req.ancho_nave_m) + " × " + _num(req.largo_nave_m, "m"), origen=NAVE),
        P(grupo="Nave", nombre="Altura libre", valor=_num(req.altura_nave_cm, "cm"), origen=NAVE),
    ]
    if req.sistema in ("campero", "ecologico"):
        if req.sup_pasto_m2 is not None:
            out.append(P(grupo="Nave", nombre="Zona de pasto", valor=_num(req.sup_pasto_m2, "m²"), origen=NAVE))
        else:
            out.append(P(grupo="Nave", nombre="Zona de pasto", valor="Sin dato", origen=PEND))

    if MARGEN_INCERTIDUMBRE_PCT > 0:
        out.append(P(grupo="Capacidad", nombre="Margen de incertidumbre",
                     valor=f"−{_num(MARGEN_INCERTIDUMBRE_PCT, '%')} de superficie de nave → "
                           + (f"{_num(r.gallinas_min)} a {_num(r.gallinas_max, 'gallinas')}"
                              if r.gallinas_min < r.gallinas_max
                              else "sin efecto: la capacidad no la limita la superficie"), origen=FT))

    out += [
        P(grupo="Normativa", nombre="Densidad máxima", valor=_num(densidad_max_para(req.sistema), "gallinas/m²"), origen=NORMA),
        P(grupo="Normativa", nombre="Percha por gallina", valor=_num(18 if eco else 15, "cm"), origen=NORMA),
        P(grupo="Normativa", nombre="Nidal", valor="120 cm²/gallina" if eco else "1 m² / 120 gallinas", origen=NORMA),
        P(grupo="Normativa", nombre="Comedero lineal por gallina", valor="10 cm", origen=NORMA),
        P(grupo="Normativa", nombre="Bebederos", valor="1 / 10 gallinas", origen=NORMA),
        P(grupo="Normativa", nombre="Yacija", valor="≥ 1/3 del suelo · 250 cm²/gallina", origen=NORMA),
    ]
    if req.sistema in ("campero", "ecologico"):
        out.append(P(grupo="Normativa", nombre="Pasto por gallina", valor="4 m²", origen=NORMA))
    if req.sistema == "campero":
        out.append(P(grupo="Normativa", nombre="Salidas", valor="2 m / 1.000 gallinas", origen=NORMA))
    if eco:
        out += [
            P(grupo="Normativa", nombre="Tope por compartimento", valor="3.000 gallinas", origen=NORMA),
            P(grupo="Normativa", nombre="Trampillas", valor="4 m / 100 m² de superficie cubierta mínima", origen=NORMA),
            P(grupo="Normativa", nombre="Niveles (multinivel)", valor="3 incluido el suelo", origen=NORMA),
        ]
    return out

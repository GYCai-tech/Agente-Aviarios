from __future__ import annotations
import math
from typing import Literal, Optional
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds
from pydantic import BaseModel, Field


Sistema = Literal["suelo", "campero", "ecologico", "jaulas"]
TipoNidal = Literal["individual", "colectivo"]
TipoZona = Literal["nidal_colectivo", "aviario"]


class DatosBasicos(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    altura_nave_cm: float
    ancho_nave_m: Optional[float] = None
    largo_nave_m: Optional[float] = None


# Mantener alias para no romper código existente
DatosRecomendacion = DatosBasicos


class Recomendacion(BaseModel):
    tipo_zona: TipoZona
    niveles: int
    razon: str


# ── Factibilidad ──────────────────────────────────────────────────────────────

class ResultadoFactibilidad(BaseModel):
    factible: bool
    densidad_actual: float          # gal/m² con nidal (sin aviario)
    densidad_max: float             # límite legal según sistema
    densidad_min_aviario: float     # densidad si se instala aviario máximo posible (-1 = no aplica)
    niveles_posibles: int           # 0/1 = altura insuficiente, 2/3 = viable
    modulos_caben: int              # módulos de aviario que caben físicamente
    mensaje: str                    # resumen legible para el cliente
    # Ajustes cuando nidal excede límite
    sup_minima_nidal: Optional[float] = None
    gallinas_max_nidal: Optional[int] = None
    # Ajustes cuando aviario excede límite (o no cabe)
    sup_minima_avi: Optional[float] = None
    gallinas_max_avi: Optional[int] = None


def calcular_factibilidad(datos: DatosBasicos) -> ResultadoFactibilidad:
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0
    niveles = _niveles_aviario(datos.altura_nave_cm)

    # Densidad con nidal (descontando solo cuerpo del módulo)
    num_mod_nidal = math.ceil(datos.num_gallinas / 144)
    sup_cuerpo = round(num_mod_nidal * 1.20 * 1.40, 2)
    sup_nidal = max(datos.superficie_nave_m2 - sup_cuerpo, 0.01)
    densidad_nidal = round(datos.num_gallinas / sup_nidal, 2)

    # Densidad mínima alcanzable (aviario con todos los módulos que caben)
    if niveles >= 2:
        num_mod_avi, sup_disp, _ = _sup_util_aviario(datos.superficie_nave_m2, niveles)
        densidad_avi = round(datos.num_gallinas / sup_disp, 2) if sup_disp > 0 else float("inf")
    else:
        num_mod_avi = 0
        densidad_avi = -1.0  # altura insuficiente para aviario — no aplica

    # Factible = nidal cumple solo, o aviario viable cumple
    factible = (densidad_nidal <= densidad_max) or (niveles >= 2 and densidad_avi <= densidad_max)

    if not factible:
        mensaje = (
            f"Con {datos.num_gallinas} gallinas en {datos.superficie_nave_m2} m² "
            f"la densidad mínima alcanzable es {densidad_avi:.1f} gal/m², "
            f"por encima del límite de {densidad_max:.0f} gal/m² para sistema {datos.sistema}. "
            f"Necesitarías ampliar la nave o reducir el número de gallinas."
        )
    elif densidad_nidal <= densidad_max:
        mensaje = (
            f"La nave puede alojar {datos.num_gallinas} gallinas con nidal colectivo "
            f"(densidad {densidad_nidal:.1f} gal/m², límite {densidad_max:.0f}). "
            f"Un aviario bajaría la densidad a {densidad_avi:.1f} gal/m²."
        )
    else:
        mensaje = (
            f"La nave no puede alojar {datos.num_gallinas} gallinas solo con nidal colectivo "
            f"(densidad {densidad_nidal:.1f} gal/m², límite {densidad_max:.0f}). "
            f"Un aviario de {niveles} plantas reduce la densidad a {densidad_avi:.1f} gal/m²."
        )

    # Recomendaciones cuando el nidal no cumple normativa
    sup_minima_nidal: Optional[float] = None
    gallinas_max_nidal: Optional[int] = None
    if densidad_nidal > densidad_max:
        # ¿Cuántos m² necesitaría la nave? (mismas gallinas, mismos módulos)
        num_mod_nidal = math.ceil(datos.num_gallinas / 144)
        sup_cuerpo_nidal = round(num_mod_nidal * 1.68, 2)
        sup_minima_nidal = math.ceil((datos.num_gallinas / densidad_max + sup_cuerpo_nidal) * 10) / 10

        # ¿Cuántas gallinas como máximo en esta nave? (búsqueda binaria)
        S = datos.superficie_nave_m2
        lo, hi = 0, datos.num_gallinas
        while lo < hi:
            mid = (lo + hi + 1) // 2
            mods = math.ceil(mid / 144)
            sup_efec = S - mods * 1.68
            if sup_efec > 0 and mid / sup_efec <= densidad_max:
                lo = mid
            else:
                hi = mid - 1
        gallinas_max_nidal = lo if lo > 0 else None

    # Recomendaciones cuando el aviario no cumple normativa (o no cabe por altura)
    sup_minima_avi: Optional[float] = None
    gallinas_max_avi: Optional[int] = None
    if niveles >= 2 and densidad_avi > densidad_max:
        sup_util = _AVI_SUP_DISP[niveles]
        mods_needed = math.ceil(datos.num_gallinas / (densidad_max * sup_util))
        sup_minima_avi = math.ceil(mods_needed * _AVI_HUELLA_M2 * 10) / 10
        gallinas_max_avi = int(densidad_max * num_mod_avi * sup_util) if num_mod_avi > 0 else 0
    elif niveles < 2:
        # Aviario no viable por altura: calcular cuánto espacio se necesitaría si se pudiera
        sup_util = _AVI_SUP_DISP[2]  # referencia con 2 niveles
        mods_needed = math.ceil(datos.num_gallinas / (densidad_max * sup_util))
        sup_minima_avi = math.ceil(mods_needed * _AVI_HUELLA_M2 * 10) / 10
        gallinas_max_avi = None  # no aplica si no hay altura suficiente

    return ResultadoFactibilidad(
        factible=factible,
        densidad_actual=densidad_nidal,
        densidad_max=densidad_max,
        densidad_min_aviario=densidad_avi,
        niveles_posibles=niveles,
        modulos_caben=num_mod_avi,
        mensaje=mensaje,
        sup_minima_nidal=sup_minima_nidal,
        gallinas_max_nidal=gallinas_max_nidal,
        sup_minima_avi=sup_minima_avi,
        gallinas_max_avi=gallinas_max_avi,
    )


# ── Preguntas dinámicas ───────────────────────────────────────────────────────

class Opcion(BaseModel):
    id: str
    texto: str

class Pregunta(BaseModel):
    id: str
    texto: str
    tipo: Literal["opcion_unica", "booleano"]
    opciones: list[Opcion]

class RespuestasCliente(BaseModel):
    respuestas: dict[str, str]   # {pregunta_id: opcion_id}

class DatosRecomendacionConRespuestas(BaseModel):
    datos: DatosBasicos
    respuestas: dict[str, str]


def preguntas_dinamicas(factibilidad: ResultadoFactibilidad) -> list[Pregunta]:
    """
    Genera las preguntas al cliente solo cuando tanto nidal como aviario son viables.
    Si una sola opción es técnicamente posible, no se pregunta y se recomienda directamente.
    """
    preguntas: list[Pregunta] = []

    nidal_viable  = factibilidad.densidad_actual <= factibilidad.densidad_max
    aviario_viable = (
        factibilidad.niveles_posibles >= 2
        and factibilidad.densidad_min_aviario <= factibilidad.densidad_max
    )

    if not (nidal_viable and aviario_viable):
        return preguntas

    # P1 — Gestión de estiércol: bloqueo duro si no tienen capacidad
    preguntas.append(Pregunta(
        id="gestion_estiercol",
        texto=(
            "El aviario exige retirar los residuos cada 2-3 días. "
            "¿Dispone de sistema o personal para hacerlo con esa frecuencia?"
        ),
        tipo="booleano",
        opciones=[
            Opcion(id="si", texto="Sí, tenemos capacidad para gestionarlo"),
            Opcion(id="no", texto="No, preferimos una limpieza menos frecuente"),
        ],
    ))

    # P2 — Carga de mantenimiento
    preguntas.append(Pregunta(
        id="mantenimiento",
        texto="¿Cómo valora la carga de mantenimiento y limpieza de la instalación?",
        tipo="opcion_unica",
        opciones=[
            Opcion(id="minima",  texto="Priorizo un mantenimiento sencillo y poco frecuente"),
            Opcion(id="acepto",  texto="Acepto mayor dedicación si mejora la rentabilidad"),
        ],
    ))

    # P3 — Objetivo principal
    preguntas.append(Pregunta(
        id="objetivo",
        texto="¿Cuál es su prioridad principal para esta instalación?",
        tipo="opcion_unica",
        opciones=[
            Opcion(id="maximizar_produccion", texto="Maximizar el número de gallinas por m²"),
            Opcion(id="bienestar",            texto="Priorizar el bienestar animal y la calidad del huevo"),
            Opcion(id="minima_inversion",     texto="Minimizar la inversión inicial"),
        ],
    ))

    return preguntas


# ── Constantes físicas del módulo Aviario Industrial (cod 10007) ─────────────
_AVI_MOD_A     = 1.20                      # dimensión paralela al largo de nave (m)
_AVI_MOD_B     = 3.30                      # dimensión paralela al ancho de nave (m)
_AVI_HUELLA_M2 = round(_AVI_MOD_A * _AVI_MOD_B, 4)  # 3.96 m²
_AVI_CAP       = 144                       # gallinas/módulo (independiente de niveles)
_AVI_PASILLO   = 1.0                       # pasillo entre filas (m)
_AVI_CLEARANCE = 4.0                       # clearance al extremo de cada fila (dirección largo, m)

# Superficie por módulo según número de plantas (datos del diseñador)
# "disponible" = excluye zona de puesta, computa para densidad normativa
_AVI_SUP_TOTAL = {2: 15.270, 3: 19.328}   # m² superficie total por módulo
_AVI_SUP_DISP  = {2: 13.180, 3: 16.194}   # m² superficie disponible (sin puesta)


class LayoutAviario(BaseModel):
    orientacion: str      # "transversal" (1.20 cruza ancho) | "longitudinal" (3.73 cruza ancho)
    mods_por_fila: int
    num_filas: int
    descripcion: str      # texto legible para el frontend


def _optimizar_layout_aviario(W: float, L: float, H: float, densidad_max: float) -> dict | None:
    """
    Layout del aviario:
    - Módulo: 1.20 m paralelo al largo, 3.30 m paralelo al ancho.
    - Las filas van a lo largo del eje largo. Cada fila tiene 4 m de clearance
      en su extremo (dirección largo). Módulos por fila = floor((largo - 4) / 1.20).
    - Las filas se colocan a lo largo del ancho con pasillos de 1 m entre ellas.
      Número de filas = floor(ancho / (3.30 + pasillo)) ajustado al espacio real.
    """
    if H < 300:
        return None

    niveles = 2 if H < 400 else 3

    # Módulos por fila (dirección largo): clearance de 4 m en ambos extremos
    avail_largo = L - 2 * _AVI_CLEARANCE
    if avail_largo < _AVI_MOD_A:
        return None
    mods_per_row = math.floor(avail_largo / _AVI_MOD_A)

    # Filas (dirección ancho): cada fila ocupa 3.30 m + 1 m pasillo,
    # excepto la última que no necesita pasillo
    if W < _AVI_MOD_B:
        return None
    num_rows = math.floor((W + _AVI_PASILLO) / (_AVI_MOD_B + _AVI_PASILLO))

    if num_rows == 0 or mods_per_row == 0:
        return None

    total_mods = mods_per_row * num_rows
    sup_disp = round(total_mods * _AVI_SUP_DISP[niveles], 2)
    gallinas = min(_AVI_CAP * total_mods, int(densidad_max * sup_disp))

    return {
        "modulos": total_mods,
        "gallinas": gallinas,
        "niveles": niveles,
        "mods_por_fila": mods_per_row,
        "num_filas": num_rows,
        "orientacion": "longitudinal",
        "sup_disp": sup_disp,
        "densidad_real": round(gallinas / sup_disp, 2) if sup_disp > 0 else 0,
        "descripcion": f"{num_rows} filas de {mods_per_row} módulos",
    }


# ── Capacidad máxima ──────────────────────────────────────────────────────────

class RequisitoEquipamiento(BaseModel):
    nombre: str
    valor_minimo: float
    unidad: str
    formula: str
    articulo: str


def _requisitos_equipamiento(n: int, sistema: str) -> list[RequisitoEquipamiento]:
    """Requisitos mínimos de equipamiento según RD 3/2002 para n gallinas."""
    req: list[RequisitoEquipamiento] = []
    req.append(RequisitoEquipamiento(
        nombre="Perchas",
        valor_minimo=round(n * 15.0, 0),
        unidad="cm lineales",
        formula=f"{n} × 15 cm/gallina",
        articulo="RD 3/2002 Anexo II",
    ))
    req.append(RequisitoEquipamiento(
        nombre="Comederos lineales",
        valor_minimo=round(n * 10.0, 0),
        unidad="cm lineales",
        formula=f"{n} × 10 cm/gallina",
        articulo="RD 3/2002 Anexo II",
    ))
    req.append(RequisitoEquipamiento(
        nombre="Comederos circulares (perímetro)",
        valor_minimo=round(n * 4.0, 0),
        unidad="cm de perímetro",
        formula=f"{n} × 4 cm/gallina",
        articulo="RD 3/2002 Anexo II",
    ))
    req.append(RequisitoEquipamiento(
        nombre="Bebederos pezón/copa",
        valor_minimo=float(math.ceil(n / 10)),
        unidad="unidades",
        formula=f"⌈{n} / 10⌉ = {math.ceil(n / 10)}",
        articulo="RD 3/2002 Anexo II",
    ))
    req.append(RequisitoEquipamiento(
        nombre="Bebedero de canal",
        valor_minimo=round(n * 2.5, 0),
        unidad="cm de canal",
        formula=f"{n} × 2,5 cm/gallina",
        articulo="RD 3/2002 Anexo II",
    ))
    if sistema in ("campero", "ecologico"):
        req.append(RequisitoEquipamiento(
            nombre="Superficie exterior mínima",
            valor_minimo=round(n * 4.0, 2),
            unidad="m²",
            formula=f"{n} × 4 m²/gallina",
            articulo="Regl. CE 589/2008 Anexo II",
        ))
    return req


# ── Constantes módulo A-Nida ─────────────────────────────────────────────────
_NIDAL_LARGO  = 1.20    # m — va a lo largo de nave; encadenamiento; ancho de la cara de la que salen los slats
_NIDAL_ANCHO  = 1.40    # m — cruza el ancho de nave; profundidad del cuerpo
_NIDAL_CUERPO = round(_NIDAL_LARGO * _NIDAL_ANCHO, 4)  # 1.68 m²
_NIDAL_CAP    = 144     # gallinas/módulo

# Configuraciones de slot (izq, der) en metros, orden de preferencia
_NIDAL_SLOT_CONFIGS: list[tuple[int, int]] = [
    (3, 3), (3, 2), (2, 2), (3, 1), (2, 1), (1, 1),
    (3, 0), (2, 0), (1, 0),
]


class PuntoPareto(BaseModel):
    num_modulos: int
    max_gallinas: int
    sup_yacija_m2: float
    yacija_pct: float
    perdida_gallinas: int   # respecto al óptimo de gallinas


class OpcionCapacidad(BaseModel):
    sistema: str                  # "nidal_colectivo" | "aviario_2" | "aviario_3"
    label: str
    max_gallinas: int
    num_modulos: int
    densidad_real: float
    densidad_max: float
    viable: bool
    sup_disponible_m2: float = 0
    sup_yacija_m2: float = 0
    yacija_pct: float = 0
    yacija_min_m2: float = 0
    pareto: list[PuntoPareto] = []
    requisitos: list[RequisitoEquipamiento] = []
    layout: Optional[LayoutAviario] = None
    slot_izq: int = 0             # metros de slot lado izquierdo (nidal)
    slot_der: int = 0             # metros de slot lado derecho (nidal)
    parque_invierno_m2: float = 0
    modulos_opcion_a: Optional[int] = None
    gallinas_opcion_a: Optional[int] = None


class ResultadoCapacidad(BaseModel):
    opciones: list[OpcionCapacidad]
    densidad_max: float


def _optimo_nidal_lp(S: float, densidad_max: float, sup_slot_mod: float) -> tuple[int, int]:
    """
    ILP: maximizar n sujeto a capacidad, densidad y yacija.
    sup_slot_mod = 1.20 × (slot_izq + slot_der)
    """
    huella = _NIDAL_CUERPO + sup_slot_mod          # m² descontados de yacija
    yacija_div = huella * 1.5                       # de: S - m·huella ≥ S/3

    c = np.array([0.0, -1.0])
    A = np.array([
        [-float(_NIDAL_CAP),           1.0],
        [_NIDAL_CUERPO * densidad_max,  1.0],
        [1.0,                           0.0],
    ])
    b = np.array([0.0, densidad_max * S, S / yacija_div])

    result = milp(
        c,
        constraints=LinearConstraint(A, -np.inf, b),
        integrality=np.array([1, 0]),
        bounds=Bounds(lb=[0.0, 0.0], ub=[np.inf, np.inf]),
    )

    if not result.success:
        return 0, 0

    m_opt = int(round(result.x[0]))
    n_opt = math.floor(min(_NIDAL_CAP * m_opt, (S - _NIDAL_CUERPO * m_opt) * densidad_max))
    return m_opt, n_opt


def _pareto_nidal(S: float, densidad_max: float, m_opt: int, n_opt: int,
                  sup_slot_mod: float) -> list[PuntoPareto]:
    huella = _NIDAL_CUERPO + sup_slot_mod
    yacija_div = huella * 1.5
    m_max = math.floor(S / yacija_div)
    frontier: list[PuntoPareto] = []
    for m in range(m_opt, m_max + 1):
        n = math.floor(min(_NIDAL_CAP * m, (S - _NIDAL_CUERPO * m) * densidad_max))
        sup_yacija = round(S - huella * m, 2)
        frontier.append(PuntoPareto(
            num_modulos=m,
            max_gallinas=n,
            sup_yacija_m2=sup_yacija,
            yacija_pct=round(sup_yacija / S * 100, 1),
            perdida_gallinas=n_opt - n,
        ))
    return frontier


def _cascade_slot_nidal(S: float, densidad_max: float,
                        ancho_nave: float | None) -> tuple[int, int, int, int, float]:
    """
    Prueba configuraciones de slot en orden de preferencia.
    Restricciones: (1) dimensional: prof_total ≤ ancho_nave;
                   (2) yacija: implícita en el ILP (n_opt > 0).
    Devuelve (m_opt, n_opt, slot_izq, slot_der, sup_slot_mod).
    """
    for slot_izq, slot_der in _NIDAL_SLOT_CONFIGS:
        prof_total = _NIDAL_ANCHO + slot_izq + slot_der  # total que cruza el ancho de nave
        if ancho_nave is not None and prof_total > ancho_nave:
            continue
        sup_slot_mod = round(_NIDAL_LARGO * (slot_izq + slot_der), 4)  # 1.20 m × longitud slots
        m_opt, n_opt = _optimo_nidal_lp(S, densidad_max, sup_slot_mod)
        if n_opt > 0:
            return m_opt, n_opt, slot_izq, slot_der, sup_slot_mod
    return 0, 0, 1, 0, round(_NIDAL_LARGO * 1, 4)


_NIDAL_SLOT_LADO    = 3.0                                              # m por cada lado
_NIDAL_SUP_SLOT     = round(_NIDAL_LARGO * _NIDAL_SLOT_LADO * 2, 4)   # ambos lados: 7.20 m²
_NIDAL_HUELLA_TOTAL = round(_NIDAL_CUERPO + _NIDAL_SUP_SLOT, 4)        # 8.88 m²


def _optimo_nidal_iterativo(S: float, densidad_max: float,
                             largo_nave: float | None,
                             ancho_nave: float | None) -> tuple[int, int]:
    """
    Algoritmo iterativo geométrico:
      Paso 1 — N_max = floor(largo / 1.20)
      Paso 2 — gallinas = N × 144
      Paso 3 — sup_disponible = S − N × 1.68  (densidad: descuenta solo cuerpo)
      Paso 4 — sup_yacija = S − N × 8.88  (cuerpo + 3m slot cada lado)
               Requiere: sup_yacija ≥ S / 3
      Paso 5 — densidad = gallinas / sup_disponible ≤ densidad_max
    Si no cumple, N -= 1 y se repite.
    """
    if largo_nave is not None:
        largo = max(largo_nave, ancho_nave or 0.0)
        N_max = math.floor(largo / _NIDAL_LARGO)
    else:
        N_max = math.floor(S / _NIDAL_HUELLA_TOTAL)

    for N in range(N_max, 0, -1):
        sup_cuerpo = N * _NIDAL_CUERPO
        sup_efectiva = S - sup_cuerpo
        if sup_efectiva <= 0:
            continue
        gallinas = N * _NIDAL_CAP
        densidad = gallinas / sup_efectiva
        sup_yacija = S - N * _NIDAL_HUELLA_TOTAL
        if densidad <= densidad_max and sup_yacija >= S / 3:
            return N, gallinas

    return 0, 0


def calcular_capacidad(datos: DatosBasicos) -> ResultadoCapacidad:
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0
    S = datos.superficie_nave_m2
    opciones: list[OpcionCapacidad] = []

    # ── Nidal colectivo — iterativo geométrico (slot 3 m fijo, 1 fila) ──
    m_opt, n_opt = _optimo_nidal_iterativo(S, densidad_max, datos.largo_nave_m, datos.ancho_nave_m)

    if n_opt > 0:
        sup_disp   = round(S - m_opt * _NIDAL_CUERPO, 2)
        sup_yacija = round(S - m_opt * _NIDAL_HUELLA_TOTAL, 2)
        opciones.append(OpcionCapacidad(
            sistema="nidal_colectivo",
            label="Nidal colectivo A-Nida",
            max_gallinas=n_opt,
            num_modulos=m_opt,
            densidad_real=round(n_opt / sup_disp, 2),
            densidad_max=densidad_max,
            viable=True,
            sup_disponible_m2=sup_disp,
            sup_yacija_m2=sup_yacija,
            yacija_pct=round(sup_yacija / S * 100, 1),
            yacija_min_m2=round(S / 3, 1),
            pareto=[],
            requisitos=_requisitos_equipamiento(n_opt, datos.sistema),
            slot_izq=3,
            slot_der=3,
        ))

    # ── Aviario (por niveles disponibles) ──
    tiene_dimensiones = datos.ancho_nave_m is not None and datos.largo_nave_m is not None

    for niveles in [2, 3]:
        altura_min = 300 if niveles == 2 else 400
        if datos.altura_nave_cm < altura_min:
            opciones.append(OpcionCapacidad(
                sistema=f"aviario_{niveles}",
                label=f"Aviario {niveles} niveles",
                max_gallinas=0, num_modulos=0,
                densidad_real=0, densidad_max=densidad_max, viable=False,
            ))
            continue

        layout_obj = None
        if tiene_dimensiones:
            lay = _optimizar_layout_aviario(
                datos.ancho_nave_m, datos.largo_nave_m,  # type: ignore[arg-type]
                datos.altura_nave_cm, densidad_max,
            )
            if lay is not None:
                # Físicamente caben los mismos módulos independientemente del nivel.
                # Solo varía la superficie disponible por módulo según el nivel.
                num_mod_avi = lay["modulos"]
                sup_disp    = round(num_mod_avi * _AVI_SUP_DISP[niveles], 2)
                max_avi     = min(_AVI_CAP * num_mod_avi, int(densidad_max * sup_disp))
                dens_avi    = round(max_avi / sup_disp, 2) if sup_disp > 0 else 0
                if lay["niveles"] == niveles:
                    layout_obj = LayoutAviario(
                        orientacion=lay["orientacion"],
                        mods_por_fila=lay["mods_por_fila"],
                        num_filas=lay["num_filas"],
                        descripcion=lay["descripcion"],
                    )
            else:
                # Layout no encaja con clearances estrictos → fallback por superficie
                num_mod_avi = math.floor(S / _AVI_HUELLA_M2)
                if num_mod_avi == 0:
                    continue
                sup_disp   = round(num_mod_avi * _AVI_SUP_DISP[niveles], 2)
                max_avi    = min(_AVI_CAP * num_mod_avi, int(densidad_max * sup_disp))
                dens_avi   = round(max_avi / sup_disp, 2) if sup_disp > 0 else 0
        else:
            num_mod_avi = math.floor(S / _AVI_HUELLA_M2)
            if num_mod_avi == 0:
                continue
            sup_disp   = round(num_mod_avi * _AVI_SUP_DISP[niveles], 2)
            max_avi    = min(_AVI_CAP * num_mod_avi, int(densidad_max * sup_disp))
            dens_avi   = round(max_avi / sup_disp, 2) if sup_disp > 0 else 0

        sup_yacija_av = S
        yacija_min_av = round((S + sup_disp) / 3, 1)
        yacija_pct_av = round(S / (S + sup_disp) * 100, 1) if (S + sup_disp) > 0 else 0.0
        parque_m2 = max(0.0, round((sup_disp - 2 * S) / 2, 1))
        sup_disp_por_mod = _AVI_SUP_DISP[niveles]
        if parque_m2 > 0:
            N_max_a = min(math.floor(2 * S / sup_disp_por_mod), num_mod_avi)
            if N_max_a > 0:
                sup_disp_a = round(N_max_a * sup_disp_por_mod, 2)
                modulos_a: Optional[int] = N_max_a
                gallinas_a: Optional[int] = min(_AVI_CAP * N_max_a, int(densidad_max * sup_disp_a))
            else:
                modulos_a = None
                gallinas_a = None
        else:
            modulos_a = None
            gallinas_a = None
        opciones.append(OpcionCapacidad(
            sistema=f"aviario_{niveles}",
            label=f"Aviario {niveles} niveles",
            max_gallinas=max_avi,
            num_modulos=num_mod_avi,
            densidad_real=dens_avi,
            densidad_max=densidad_max,
            viable=True,
            sup_disponible_m2=sup_disp,
            sup_yacija_m2=sup_yacija_av,
            yacija_pct=yacija_pct_av,
            yacija_min_m2=yacija_min_av,
            requisitos=_requisitos_equipamiento(max_avi, datos.sistema),
            layout=layout_obj,
            parque_invierno_m2=parque_m2,
            modulos_opcion_a=modulos_a,
            gallinas_opcion_a=gallinas_a,
        ))

    return ResultadoCapacidad(opciones=opciones, densidad_max=densidad_max)


def _niveles_aviario(altura_cm: float) -> int:
    if altura_cm >= 400:
        return 3
    if altura_cm >= 300:
        return 2
    return 1


def _sup_util_aviario(nave_m2: float, niveles: int) -> tuple[int, float, float]:
    """Devuelve (num_modulos_caben, sup_disponible_total, sup_total_total)."""
    num_modulos = math.floor(nave_m2 / _AVI_HUELLA_M2)
    sup_disp  = round(num_modulos * _AVI_SUP_DISP[niveles], 2)
    sup_total = round(num_modulos * _AVI_SUP_TOTAL[niveles], 2)
    return num_modulos, sup_disp, sup_total


def recomendar_zona(datos: DatosRecomendacion, respuestas: dict[str, str] | None = None) -> Recomendacion:
    respuestas = respuestas or {}
    niveles_posibles = _niveles_aviario(datos.altura_nave_cm)
    densidad_bruta = datos.num_gallinas / datos.superficie_nave_m2
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0

    # Densidad efectiva con nidal colectivo: descontar huella real de módulos
    num_modulos = math.ceil(datos.num_gallinas / 144)
    sup_modulos = round(num_modulos * 1.20 * 1.40, 2)
    sup_efectiva_nidal = datos.superficie_nave_m2 - sup_modulos
    densidad_nidal = (
        datos.num_gallinas / sup_efectiva_nidal if sup_efectiva_nidal > 0 else float("inf")
    )

    if niveles_posibles < 2:
        return Recomendacion(
            tipo_zona="nidal_colectivo",
            niveles=1,
            razon=f"Con {datos.altura_nave_cm:.0f} cm de altura libre solo cabe 1 nivel. "
                  "Se necesitan ≥ 300 cm para instalar un aviario de 2 niveles.",
        )

    num_modulos_caben, sup_disp_aviario, _ = _sup_util_aviario(datos.superficie_nave_m2, niveles_posibles)
    densidad_con_aviario = (
        datos.num_gallinas / sup_disp_aviario if sup_disp_aviario > 0 else float("inf")
    )
    modulos_necesarios = math.ceil(
        datos.num_gallinas / (densidad_max * _AVI_SUP_DISP[niveles_posibles])
    )

    # Aviario necesario si la densidad bruta supera el límite O si la densidad
    # efectiva con nidal (descontando módulos) excede el límite legal.
    if densidad_bruta > densidad_max or densidad_nidal > densidad_max:
        return Recomendacion(
            tipo_zona="aviario",
            niveles=niveles_posibles,
            razon=(
                f"La densidad efectiva con nidal colectivo sería {densidad_nidal:.1f} gal/m² "
                f"(superficie real {sup_efectiva_nidal:.1f} m² tras descontar {sup_modulos:.1f} m² "
                f"de {num_modulos} módulo{'s' if num_modulos > 1 else ''}), "
                f"superando el límite de {densidad_max:.0f} gal/m² para sistema {datos.sistema}. "
                f"Necesitas {modulos_necesarios} módulo{'s' if modulos_necesarios > 1 else ''} "
                f"de aviario {niveles_posibles} plantas "
                f"({_AVI_SUP_DISP[niveles_posibles]} m² disponibles/módulo). "
                f"En tu nave caben {num_modulos_caben} módulos ({sup_disp_aviario:.1f} m² disponibles), "
                f"lo que da una densidad de {densidad_con_aviario:.1f} gal/m² "
                f"(límite {densidad_max:.0f} — Directiva 1999/74/CE Art. 4.3.a)."
            ),
        )

    # Ambas opciones son viables — decidir por las respuestas del cliente
    gestion  = respuestas.get("gestion_estiercol", "")
    mant     = respuestas.get("mantenimiento", "")
    objetivo = respuestas.get("objetivo", "")

    # Bloqueo duro: sin capacidad de gestión de estiércol → nidal siempre
    if gestion == "no":
        return Recomendacion(
            tipo_zona="nidal_colectivo",
            niveles=1,
            razon=(
                f"El aviario requiere retirar los residuos cada 2-3 días. "
                f"Sin esa capacidad operativa el nidal colectivo es la opción adecuada: "
                f"ciclos de limpieza mucho menos frecuentes y mantenimiento más sencillo. "
                f"Densidad con nidal: {densidad_nidal:.1f} gal/m², dentro del límite de {densidad_max:.0f} gal/m²."
            ),
        )

    # Puntuación: señales a favor del aviario (+) o del nidal (-)
    score = 0
    if objetivo == "maximizar_produccion": score += 2
    if objetivo in ("bienestar", "minima_inversion"): score -= 1
    if mant == "acepto": score += 1
    if mant == "minima": score -= 1

    if score > 0:
        return Recomendacion(
            tipo_zona="aviario",
            niveles=niveles_posibles,
            razon=(
                f"Aviario de {niveles_posibles} plantas: {modulos_necesarios} módulo{'s' if modulos_necesarios > 1 else ''} necesarios "
                f"(caben {num_modulos_caben}), densidad {densidad_con_aviario:.1f} gal/m² "
                f"sobre {sup_disp_aviario:.1f} m² disponibles. "
                f"El cliente dispone de sistema de gestión de estiércol y prioriza la rentabilidad."
            ),
        )

    return Recomendacion(
        tipo_zona="nidal_colectivo",
        niveles=1,
        razon=(
            f"La densidad con nidal colectivo es {densidad_nidal:.1f} gal/m² "
            f"({num_modulos} módulo{'s' if num_modulos > 1 else ''}, {sup_modulos:.1f} m² ocupados), "
            f"dentro del límite de {densidad_max:.0f} gal/m². "
            f"El perfil del cliente (mantenimiento sencillo / menor inversión / bienestar animal) "
            f"encaja mejor con el nidal colectivo A-Nida."
        ),
    )


class DatosIntake(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    altura_nave_cm: float
    tipo_zona: TipoZona


class RequisitoCalculado(BaseModel):
    nombre: str
    valor_minimo: float
    unidad: str
    formula: str
    articulo: str


class VerificacionNave(BaseModel):
    parametro: str
    cumple: bool
    valor_real: float
    valor_limite: float
    unidad: str
    tipo_limite: Literal["minimo", "maximo"]
    articulo: str


class InformeIntake(BaseModel):
    sistema: str
    num_gallinas: int
    verificaciones_nave: list[VerificacionNave]
    requisitos: list[RequisitoCalculado]
    cumple_nave: bool
    advertencias: list[str]
    consulta_rag: str


def generar_informe(datos: DatosIntake) -> InformeIntake:
    n = datos.num_gallinas
    verificaciones: list[VerificacionNave] = []
    requisitos: list[RequisitoCalculado] = []
    advertencias: list[str] = []

    if datos.sistema == "jaulas":
        _informe_jaulas(n, datos, verificaciones, requisitos, advertencias)
    else:
        _informe_alternativo(n, datos, datos.tipo_zona, verificaciones, requisitos, advertencias)

    fallos = [v for v in verificaciones if not v.cumple]

    return InformeIntake(
        sistema=datos.sistema,
        num_gallinas=n,
        verificaciones_nave=verificaciones,
        requisitos=requisitos,
        cumple_nave=len(fallos) == 0,
        advertencias=advertencias,
        consulta_rag=_consulta_rag(datos, fallos),
    )


def _informe_jaulas(n, datos, verificaciones, requisitos, advertencias):
    sup_util_cm2 = datos.superficie_nave_m2 * 10_000
    real_cm2_por_gallina = sup_util_cm2 / n

    verificaciones.append(VerificacionNave(
        parametro="Superficie útil por gallina (jaula enriquecida)",
        cumple=real_cm2_por_gallina >= 750,
        valor_real=round(real_cm2_por_gallina, 1),
        valor_limite=750,
        unidad="cm²/gallina",
        tipo_limite="minimo",
        articulo="RD 3/2002 Anexo III",
    ))

    requisitos.append(RequisitoCalculado(
        nombre="Superficie total mínima de jaulas",
        valor_minimo=round(n * 750 / 10_000, 2),
        unidad="m²",
        formula=f"{n} gallinas × 750 cm²/gallina ÷ 10.000",
        articulo="RD 3/2002 Anexo III",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Comederos lineales",
        valor_minimo=round(n * 12.0 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 12 cm/gallina",
        articulo="RD 3/2002 Anexo III",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Perchas",
        valor_minimo=round(n * 15.0 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 15 cm/gallina",
        articulo="RD 3/2002 Anexo III",
    ))

    advertencias.append(
        "Cada jaula debe incluir: nido individual, zona de yacija para picotear/escarbar "
        "y dispositivo de recorte de uñas (RD 3/2002 Anexo III)."
    )
    if n > 40_000:
        advertencias.append(
            f"Explotación de {n} gallinas supera las 40.000 ponedoras: "
            "obligación de aplicar Mejores Técnicas Disponibles (MTDs) para emisiones de amoniaco "
            "(RD 637/2021 Art. 12)."
        )


def _informe_alternativo(n, datos, tipo_zona, verificaciones, requisitos, advertencias):
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0

    if tipo_zona == "aviario":
        niveles = _niveles_aviario(datos.altura_nave_cm)
        densidad_max_avi = 6.0 if datos.sistema == "ecologico" else 9.0
        num_modulos_caben, _, sup_total = _sup_util_aviario(datos.superficie_nave_m2, niveles)
        modulos_necesarios = math.ceil(n / (densidad_max_avi * _AVI_SUP_DISP[niveles]))
        sup_disp = round(modulos_necesarios * _AVI_SUP_DISP[niveles], 2)
        densidad_real = n / sup_disp if sup_disp > 0 else float("inf")
        parametro_label = (
            f"Densidad interior aviario {niveles} plantas — "
            f"{modulos_necesarios} módulos necesarios · {_AVI_SUP_DISP[niveles]} m² disp./módulo"
            f" = {sup_disp:.1f} m² disponibles"
        )
        articulo_densidad = "Directiva 1999/74/CE Art. 4.3.a + RD 3/2002 Anexo IV"
    else:
        niveles = 1
        num_modulos = math.ceil(n / 144)
        sup_modulos = round(num_modulos * 1.20 * 1.40, 2)  # 1,68 m² por módulo (planta 1,2×1,4)
        sup_efectiva = round(datos.superficie_nave_m2 - sup_modulos, 2)
        densidad_real = n / sup_efectiva if sup_efectiva > 0 else float("inf")
        parametro_label = (
            f"Densidad interior (sup. real {sup_efectiva:.1f} m² — "
            f"descontados {sup_modulos:.1f} m² de {num_modulos} módulos)"
        )
        articulo_densidad = "RD 3/2002 Anexo IV" + (" + Regl. UE 2018/848" if datos.sistema == "ecologico" else "")

    verificaciones.append(VerificacionNave(
        parametro=parametro_label,
        cumple=densidad_real <= densidad_max,
        valor_real=round(densidad_real, 2),
        valor_limite=densidad_max,
        unidad="gallinas/m²",
        tipo_limite="maximo",
        articulo=articulo_densidad,
    ))

    # Módulos de nidal (solo nidal_colectivo)
    if tipo_zona == "nidal_colectivo":
        requisitos.append(RequisitoCalculado(
            nombre="Número de módulos de nidal",
            valor_minimo=float(num_modulos),
            unidad="módulos",
            formula=f"⌈{n} / 144⌉ = {num_modulos} módulo(s) × 1,20 m × 1,40 m = {sup_modulos} m² ocupados",
            articulo="Diseño A-Nida Plus (Gómez y Crespo)",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Superficie disponible (descontados módulos)",
            valor_minimo=sup_efectiva,
            unidad="m²",
            formula=f"{datos.superficie_nave_m2} m² nave − {num_modulos} × 1,68 m² = {sup_efectiva} m²",
            articulo="Cálculo interno",
        ))

    # Yacija
    yacija_min_m2 = round(n * 250 / 10_000, 2)
    yacija_minima_tercio = round(datos.superficie_nave_m2 / 3, 2)
    yacija_requerida = max(yacija_min_m2, yacija_minima_tercio)

    if tipo_zona == "nidal_colectivo":
        # Slot acoplado al módulo: 1,20 m × 3 m adicionales por módulo
        sup_slot = round(num_modulos * 1.20 * 3, 2)
        sup_yacija_disponible = round(datos.superficie_nave_m2 - sup_modulos - sup_slot, 2)
        verificaciones.append(VerificacionNave(
            parametro=(
                f"Superficie yacija real ({sup_yacija_disponible:.1f} m² — "
                f"descontados {sup_modulos} m² módulos + {sup_slot} m² slots)"
            ),
            cumple=sup_yacija_disponible >= yacija_requerida,
            valor_real=sup_yacija_disponible,
            valor_limite=yacija_requerida,
            unidad="m²",
            tipo_limite="minimo",
            articulo="RD 3/2002 Anexo IV",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Zona de yacija mínima requerida",
            valor_minimo=yacija_requerida,
            unidad="m²",
            formula=(
                f"máx({n} × 250 cm² = {yacija_min_m2} m²  |  "
                f"1/3 nave = {yacija_minima_tercio} m²)"
            ),
            articulo="RD 3/2002 Anexo IV",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Superficie yacija disponible",
            valor_minimo=sup_yacija_disponible,
            unidad="m²",
            formula=(
                f"{datos.superficie_nave_m2} m² nave "
                f"− {sup_modulos} m² módulos ({num_modulos} × 1,68 m²) "
                f"− {sup_slot} m² slots ({num_modulos} × 3,6 m²) "
                f"= {sup_yacija_disponible} m²"
            ),
            articulo="Cálculo interno",
        ))
    else:
        # Aviario: yacija = suelo nave completo; requerida = 1/3 de (nave + todas las plantas)
        yacija_minima_tercio_avi = round((datos.superficie_nave_m2 + sup_disp) / 3, 2)
        yacija_requerida_avi = max(yacija_min_m2, yacija_minima_tercio_avi)
        yacija_disponible_avi = datos.superficie_nave_m2
        parque_avi = max(0.0, round((sup_disp - 2 * datos.superficie_nave_m2) / 2, 1))
        verificaciones.append(VerificacionNave(
            parametro="Superficie yacija disponible (suelo nave completo)",
            cumple=yacija_disponible_avi >= yacija_requerida_avi,
            valor_real=yacija_disponible_avi,
            valor_limite=yacija_requerida_avi,
            unidad="m²",
            tipo_limite="minimo",
            articulo="RD 3/2002 Anexo IV",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Zona de yacija mínima requerida",
            valor_minimo=yacija_requerida_avi,
            unidad="m²",
            formula=(
                f"1/3 × ({datos.superficie_nave_m2} m² nave + {sup_disp} m² módulos) "
                f"= {yacija_minima_tercio_avi} m²"
            ),
            articulo="RD 3/2002 Anexo IV",
        ))
        if parque_avi > 0:
            requisitos.append(RequisitoCalculado(
                nombre="Parque de invierno necesario",
                valor_minimo=parque_avi,
                unidad="m²",
                formula=(
                    f"({sup_disp} m² módulos − 2 × {datos.superficie_nave_m2} m² nave) / 2 "
                    f"= {parque_avi} m²"
                ),
                articulo="RD 3/2002 Anexo IV",
            ))

    # Zona de puesta
    if tipo_zona == "aviario":
        sup_nidal_min = round(n / 120, 2)
        requisitos.append(RequisitoCalculado(
            nombre="Módulos de aviario necesarios",
            valor_minimo=float(modulos_necesarios),
            unidad="módulos",
            formula=(
                f"⌈{n} / ({densidad_max_avi:.0f} gal/m² × {_AVI_SUP_DISP[niveles]} m²)⌉ "
                f"= {modulos_necesarios} módulo{'s' if modulos_necesarios > 1 else ''} "
                f"({niveles} plantas · {_AVI_SUP_DISP[niveles]} m² disp./módulo)"
            ),
            articulo="Directiva 1999/74/CE Art. 4.3.a",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Módulos que caben en la nave",
            valor_minimo=float(num_modulos_caben),
            unidad="módulos",
            formula=(
                f"⌊{datos.superficie_nave_m2} m² / {_AVI_HUELLA_M2} m² huella⌋ "
                f"= {num_modulos_caben} módulos · {_AVI_SUP_TOTAL[niveles]} m² totales/módulo "
                f"= {sup_total:.1f} m² totales"
            ),
            articulo="Diseño Aviario Industrial (Gómez y Crespo)",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Superficie zona de puesta por nivel",
            valor_minimo=sup_nidal_min,
            unidad="m²",
            formula=f"{n} gallinas / 120 = {sup_nidal_min} m²",
            articulo="RD 3/2002 Anexo IV",
        ))
        advertencias.append(
            f"Aviario multinivel: altura libre entre niveles ≥ 45 cm, "
            "comederos y bebederos distribuidos en cada nivel, "
            "sistema que impida caída de excrementos sobre niveles inferiores "
            "(Directiva 1999/74/CE Art. 4.3.a)."
        )
    else:
        sup_nidal_min = round(n / 120, 2)
        requisitos.append(RequisitoCalculado(
            nombre="Superficie zona de puesta colectiva",
            valor_minimo=sup_nidal_min,
            unidad="m²",
            formula=f"{n} gallinas / 120 = {sup_nidal_min} m²",
            articulo="RD 3/2002 Anexo IV",
        ))

    # Perchas
    requisitos.append(RequisitoCalculado(
        nombre="Perchas",
        valor_minimo=round(n * 15 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 15 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))

    # Comederos
    requisitos.append(RequisitoCalculado(
        nombre="Comederos lineales",
        valor_minimo=round(n * 10 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 10 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Comederos circulares (alternativa)",
        valor_minimo=round(n * 4 / 100, 2),
        unidad="m de perímetro",
        formula=f"{n} gallinas × 4 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))

    # Bebederos
    requisitos.append(RequisitoCalculado(
        nombre="Bebedero de canal",
        valor_minimo=round(n * 2.5 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 2,5 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Bebederos pezón/copa (alternativa)",
        valor_minimo=float(math.ceil(n / 10)),
        unidad="unidades",
        formula=f"⌈{n} / 10⌉ = {math.ceil(n / 10)}",
        articulo="RD 3/2002 Anexo IV",
    ))

    # Extras campero / ecológico
    if datos.sistema in ("campero", "ecologico"):
        sup_exterior_min = round(n * 4, 2)
        requisitos.append(RequisitoCalculado(
            nombre="Superficie exterior",
            valor_minimo=sup_exterior_min,
            unidad="m²",
            formula=f"{n} gallinas × 4 m²/gallina",
            articulo="Regl. CE 589/2008 Anexo II",
        ))
        trampillas_min = round(n / 1000 * 200, 1)
        requisitos.append(RequisitoCalculado(
            nombre="Apertura total de trampillas al exterior",
            valor_minimo=trampillas_min,
            unidad="cm de ancho total",
            formula=f"{n} gallinas / 1.000 × 200 cm = {trampillas_min} cm",
            articulo="RD 3/2002 Anexo IV",
        ))

    if datos.sistema == "ecologico" and n > 3000:
        advertencias.append(
            f"El sistema ecológico tiene un máximo de 3.000 gallinas por unidad de producción. "
            f"Con {n} gallinas necesitarás {math.ceil(n / 3000)} unidades separadas "
            "(Regl. UE 2018/848)."
        )

    if n > 40_000:
        advertencias.append(
            f"Explotación de {n} gallinas supera las 40.000 ponedoras: "
            "obligación de aplicar Mejores Técnicas Disponibles (MTDs) para emisiones de amoniaco "
            "(RD 637/2021 Art. 12)."
        )

    advertencias.append(
        "Requisitos fijos independientemente del tamaño: registro en REGA, "
        "Sistema Integral de Gestión (SIGE), plan sanitario, veterinario de explotación "
        "y vallado perimetral (RD 637/2021)."
    )


def consulta_ventas(datos: DatosIntake, requisitos: list[RequisitoCalculado]) -> str:
    sistema_label = {
        "suelo": "en suelo", "campero": "campero",
        "ecologico": "ecológico", "jaulas": "en jaulas enriquecidas"
    }[datos.sistema]
    if datos.tipo_zona == "aviario":
        niveles = _niveles_aviario(datos.altura_nave_cm)
        zona_label = f"aviario multinivel de {niveles} niveles"
    else:
        zona_label = "nidal colectivo"
    reqs_txt = "; ".join(
        f"{r.nombre}: {r.valor_minimo} {r.unidad}" for r in requisitos
    )
    return (
        f"Eres asesor comercial senior de Gómez y Crespo, fabricante español de equipamiento avícola "
        f"con más de 50 años de experiencia. "
        f"Una granja de {datos.num_gallinas} gallinas ponedoras en sistema {sistema_label} "
        f"necesita instalar {zona_label}. "
        f"Redacta un argumentario comercial en 3 párrafos cortos para convencer al granjero de elegir "
        f"Gómez y Crespo. "
        f"IMPORTANTE: empieza el primer párrafo con una frase de beneficio directo para el granjero "
        f"(rentabilidad, tranquilidad, liderazgo de mercado...), NUNCA con densidades ni datos técnicos. "
        f"Destaca: experiencia de 50 años y respaldo técnico, materiales de alta durabilidad "
        f"(rejillas triple galvanizado tres veces más resistentes, tubos PosMAC®, chapa DX51D+Z275), "
        f"cumplimiento normativo garantizado y sistema modular escalable. "
        f"Tono profesional, directo y persuasivo. Sin listas, solo párrafos fluidos."
    )


def _consulta_rag(datos: DatosIntake, fallos: list[VerificacionNave]) -> str:
    sistema_label = {
        "suelo": "en suelo", "campero": "campero",
        "ecologico": "ecológico", "jaulas": "en jaulas enriquecidas"
    }[datos.sistema]

    partes = [
        f"Granja avícola de {datos.num_gallinas} gallinas ponedoras en sistema {sistema_label}, "
        f"nave de {datos.superficie_nave_m2} m²."
    ]
    if fallos:
        partes.append("La nave no cumple los siguientes parámetros:")
        for f in fallos:
            partes.append(
                f"- {f.parametro}: {f.valor_real} {f.unidad} "
                f"(límite {f.tipo_limite}: {f.valor_limite} {f.unidad})."
            )
        partes.append("¿Qué artículos se incumplen y qué debe corregirse?")
    else:
        partes.append(
            "La nave cumple los parámetros básicos. "
            "¿Qué requisitos adicionales y recomendaciones aplican a este tipo de explotación?"
        )
    return " ".join(partes)

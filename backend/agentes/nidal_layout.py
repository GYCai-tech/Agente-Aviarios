"""
Algoritmo de maximización y cálculo de layout para nidal A-Nida.

Flujo:
  1. Maximizar módulos que caben físicamente en la nave.
  2. Calcular densidad y yacija SOLO con superficie interior.
  3. Si hay zona exterior (suelo): compensar densidad y yacija con esos m².
  4. Devolver:
     - gallinas_max_interior: máximo cumpliendo normativa solo con nave
     - gallinas_max_con_exterior: máximo si se suma la zona exterior
     - cumple_xxx: si el objetivo de gallinas ya cumple en cada escenario
"""
import math
from typing import Optional
from pydantic import BaseModel

# ── Constantes físicas A-Nida ─────────────────────────────────────────────────
_MOD_ANCHO       = 1.20   # m — longitud de cada módulo (a lo largo de la nave)
_MOD_FONDO       = 1.40   # m — profundidad del cuerpo
_SLOT            = 3.00   # m — slot por cada lado del cuerpo
_CAP_MOD         = 144    # gallinas / módulo
_SUP_CUERPO_MOD  = round(_MOD_ANCHO * _MOD_FONDO, 4)    # 1.68 m²
_SUP_SLOT_MOD    = round(_MOD_ANCHO * _SLOT, 4)          # 3.60 m² (un solo lado)

# Perfil mínimo de ancho de nave (Y) para cada configuración de filas
_PERFIL_1F = _MOD_FONDO + 2 * _SLOT          # 7.40 m — 1 fila central
_PERFIL_2F = 2 * _MOD_FONDO + 2 * _SLOT      # 8.80 m — 2 filas back-to-back

# Zona de equipo en los extremos de la cadena (fijo por diseño)
_EQUIP_IZQ    = 4.00   # m — mesa de recogida + motoreductor
_TENSOR_DER   = 3.00   # m — módulo tensor

# Densidad máxima (gallinas/m²) según sistema de producción
# Para campero/ecológico la zona exterior suma a la base de cálculo
_DENSIDAD_MAX_SUELO = 9.0   # alias de compatibilidad
_DENSIDAD_POR_SISTEMA: dict[str, float] = {
    "suelo":     9.0,   # RD 3/2002 Anexo II
    "campero":   6.0,   # Regl. CE 589/2008
    "ecologico": 4.0,   # Regl. UE 2018/848
    "jaulas":    9.0,
}

# Fracción mínima de la nave que debe ser yacija
_FRACCION_YACIJA_MIN = 1 / 3


# ── Modelos de respuesta ──────────────────────────────────────────────────────

class EscenarioNidal(BaseModel):
    """Resultado para un escenario concreto (interior / con exterior)."""
    modulos: int
    sup_cuerpo_m2: float
    sup_slot_m2: float
    sup_efectiva_m2: float      # base del cálculo de densidad
    yacija_m2: float
    densidad: float             # con los gallinas objetivo
    gallinas_max: int           # máximo posible cumpliendo normativa
    cumple_densidad: bool
    cumple_yacija: bool
    cumple: bool                # ambas condiciones juntas


class ResultadoMaximizacion(BaseModel):
    viable: bool                # la nave tiene dimensiones suficientes
    max_modulos_fisicos: int    # máximo que cabe sin restricciones normativas
    sup_nave_m2: float
    densidad_max: float
    yacija_min_m2: float        # sup_nave / 3

    # Escenario sin zona exterior
    interior: Optional[EscenarioNidal] = None

    # Escenario con zona exterior (solo si sup_exterior_m2 > 0)
    con_exterior: Optional[EscenarioNidal] = None
    sup_exterior_m2: float = 0.0

    error: Optional[str] = None


# Alias de compatibilidad con código legacy
class FilaLayoutNidal(BaseModel):
    num_modulos: int
    num_filas: int
    gallinas: int
    densidad_real: float
    densidad_max: float
    sup_nave: float
    sup_cuerpo: float
    sup_slot: float
    sup_efectiva: float
    sup_yacija: float
    fraccion_yacija: float
    cumple_densidad: bool
    cumple_yacija: bool
    descripcion: str


class ResultadoLayoutNidal(BaseModel):
    viable: bool
    recomendado: Optional[FilaLayoutNidal] = None
    alternativa_2filas: Optional[FilaLayoutNidal] = None
    error: Optional[str] = None


# ── Lógica de maximización ────────────────────────────────────────────────────

def _max_modulos_fisicos(largo_nave: float, ancho_nave: float) -> int:
    """
    Cuántos módulos caben físicamente en la nave.
    El local técnico (4 m) es una habitación anexa exterior — no resta longitud de nave.
    Longitud disponible = largo - tensor_der = largo - 3 m.
    """
    largo  = max(largo_nave, ancho_nave)   # cadena va por el lado largo
    disponible = largo - _TENSOR_DER
    if disponible < _MOD_ANCHO:
        return 0
    return math.floor(disponible / _MOD_ANCHO)


def _gallinas_max_escenario(
    max_mods: int,
    sup_nave: float,
    sup_extra: float,       # 0 si solo interior; sup_exterior si se compensa
    densidad_max: float,
) -> tuple[int, int]:
    """
    Devuelve (gallinas_max, modulos_optimos):
    Itera todos los posibles conteos de módulos (1..max_mods) y para cada uno
    calcula el máximo de gallinas que cumple densidad ≤ límite y yacija ≥ 1/3 nave.
    """
    yacija_min = sup_nave * _FRACCION_YACIJA_MIN
    best_gallinas = 0
    best_mods = 0

    for mods in range(1, max_mods + 1):
        sup_cuerpo = mods * _SUP_CUERPO_MOD
        sup_slot   = mods * _SUP_SLOT_MOD * 2   # 1 fila → 2 slots
        yacija     = sup_nave - sup_cuerpo - sup_slot + sup_extra

        if yacija < yacija_min:
            # Más módulos = menos yacija → no mejora al seguir iterando
            break

        sup_ef = sup_nave - sup_cuerpo + sup_extra
        if sup_ef <= 0:
            break

        # Máximo gallinas para exactamente este número de módulos
        G_max_dens  = int(densidad_max * sup_ef)
        G_max_mods  = mods * _CAP_MOD
        G_max       = min(G_max_dens, G_max_mods)

        # Ese G_max debe necesitar exactamente `mods` módulos
        # (si necesita menos, ya se habrá contabilizado antes)
        if G_max > (mods - 1) * _CAP_MOD and G_max > best_gallinas:
            best_gallinas = G_max
            best_mods     = mods

    return best_gallinas, best_mods


def _construir_escenario(
    gallinas_objetivo: int,
    max_mods: int,
    sup_nave: float,
    sup_extra: float,
    densidad_max: float,
) -> EscenarioNidal:
    yacija_min = sup_nave * _FRACCION_YACIJA_MIN

    mods_necesarios = math.ceil(gallinas_objetivo / _CAP_MOD)
    mods_obj        = min(mods_necesarios, max_mods)

    sup_cuerpo = mods_obj * _SUP_CUERPO_MOD
    sup_slot   = mods_obj * _SUP_SLOT_MOD * 2
    sup_ef     = sup_nave - sup_cuerpo + sup_extra
    yacija     = sup_nave - sup_cuerpo - sup_slot + sup_extra

    densidad = round(gallinas_objetivo / sup_ef, 2) if sup_ef > 0 else 9999.0

    # Los tres checks que deben cumplirse simultáneamente:
    # 1. Capacidad física: los módulos instalados aguantan el número de gallinas
    # 2. Densidad normativa ≤ límite
    # 3. Yacija ≥ 1/3 de la nave
    cumple_capacidad = mods_necesarios <= max_mods          # caben los módulos necesarios
    cumple_dens      = densidad <= densidad_max
    cumple_yac       = yacija >= yacija_min

    gallinas_max, _ = _gallinas_max_escenario(max_mods, sup_nave, sup_extra, densidad_max)

    return EscenarioNidal(
        modulos=mods_obj,
        sup_cuerpo_m2=round(sup_cuerpo, 2),
        sup_slot_m2=round(sup_slot, 2),
        sup_efectiva_m2=round(sup_ef, 2),
        yacija_m2=round(yacija, 2),
        densidad=densidad,
        gallinas_max=gallinas_max,
        cumple_densidad=cumple_dens and cumple_capacidad,
        cumple_yacija=cumple_yac,
        cumple=cumple_capacidad and cumple_dens and cumple_yac,
    )


# ── API principal ─────────────────────────────────────────────────────────────

def maximizar_nidal(
    ancho_nave: float,
    largo_nave: float,
    gallinas: int,
    sistema: str = "suelo",
    sup_exterior_m2: float = 0.0,
) -> ResultadoMaximizacion:
    """
    Maximiza módulos en la nave y calcula ambos escenarios (interior / con exterior).

    Reglas para "suelo":
      - Densidad ≤ 9 gal/m²   (base: sup_nave - sup_cuerpo [+ sup_exterior])
      - Yacija ≥ 1/3 de sup_nave  (base: sup_nave - sup_cuerpo - sup_slot [+ sup_exterior])
    """
    # La cadena siempre va por el lado más largo
    largo = max(largo_nave, ancho_nave)
    ancho = min(largo_nave, ancho_nave)
    # El local técnico es habitación anexa exterior: no resta longitud de nave
    sup_nave = largo * ancho

    # Verificar que la nave es suficientemente ancha para 1 fila
    if ancho < _PERFIL_1F:
        return ResultadoMaximizacion(
            viable=False,
            max_modulos_fisicos=0,
            sup_nave_m2=round(sup_nave, 2),
            densidad_max=_DENSIDAD_MAX_SUELO,
            yacija_min_m2=round(sup_nave * _FRACCION_YACIJA_MIN, 2),
            error=(
                f"Ancho de nave insuficiente ({ancho:.2f} m). "
                f"Se necesitan ≥ {_PERFIL_1F:.1f} m para instalar 1 fila de nidales "
                f"(slot 3 m + cuerpo 1.4 m + slot 3 m)."
            ),
        )

    densidad_max = _DENSIDAD_POR_SISTEMA.get(sistema, _DENSIDAD_MAX_SUELO)
    max_mods = _max_modulos_fisicos(largo, ancho)

    if max_mods == 0:
        return ResultadoMaximizacion(
            viable=False,
            max_modulos_fisicos=0,
            sup_nave_m2=round(sup_nave, 2),
            densidad_max=densidad_max,
            yacija_min_m2=round(sup_nave * _FRACCION_YACIJA_MIN, 2),
            error=(
                f"Nave demasiado corta ({largo:.2f} m). "
                f"Se necesitan al menos {_EQUIP_IZQ + _MOD_ANCHO + _TENSOR_DER:.1f} m "
                f"para instalar 1 módulo."
            ),
        )

    yacija_min = round(sup_nave * _FRACCION_YACIJA_MIN, 2)

    # ── Escenario interior ─────────────────────────────────────────────────────
    escenario_int = _construir_escenario(
        gallinas, max_mods, sup_nave, 0.0, densidad_max
    )

    # ── Escenario con exterior ─────────────────────────────────────────────────
    escenario_ext = None
    if sup_exterior_m2 > 0:
        escenario_ext = _construir_escenario(
            gallinas, max_mods, sup_nave, sup_exterior_m2, densidad_max
        )

    return ResultadoMaximizacion(
        viable=True,
        max_modulos_fisicos=max_mods,
        sup_nave_m2=round(sup_nave, 2),
        densidad_max=densidad_max,
        yacija_min_m2=yacija_min,
        interior=escenario_int,
        con_exterior=escenario_ext,
        sup_exterior_m2=sup_exterior_m2,
    )


# ── Compatibilidad con código legacy (optimizar_nidal) ───────────────────────

def _calcular_legacy(N_por_fila: int, num_filas: int, sup_nave: float, densidad_max: float) -> FilaLayoutNidal:
    total        = N_por_fila * num_filas
    sup_cuerpo   = total * _SUP_CUERPO_MOD
    slots_por_modulo = 2 if num_filas == 1 else 1
    sup_slot     = total * _SUP_SLOT_MOD * slots_por_modulo
    sup_efectiva = sup_nave - sup_cuerpo
    sup_yacija   = sup_nave - sup_cuerpo - sup_slot
    gallinas     = total * _CAP_MOD
    densidad_real   = gallinas / sup_efectiva if sup_efectiva > 0 else 9999.0
    fraccion_yacija = sup_yacija / sup_nave if sup_nave > 0 else 0.0
    return FilaLayoutNidal(
        num_modulos=total,
        num_filas=num_filas,
        gallinas=gallinas,
        densidad_real=round(densidad_real, 2),
        densidad_max=densidad_max,
        sup_nave=round(sup_nave, 2),
        sup_cuerpo=round(sup_cuerpo, 2),
        sup_slot=round(sup_slot, 2),
        sup_efectiva=round(sup_efectiva, 2),
        sup_yacija=round(sup_yacija, 2),
        fraccion_yacija=round(fraccion_yacija, 3),
        cumple_densidad=densidad_real <= densidad_max,
        cumple_yacija=sup_yacija >= sup_nave / 3,
        descripcion=(
            f"{total} módulos · {num_filas} fila{'s' if num_filas > 1 else ''} "
            f"de {N_por_fila} · slot 3 m"
        ),
    )


def optimizar_nidal(ancho_nave: float, largo_nave: float, sistema: str) -> ResultadoLayoutNidal:
    """Legacy API — mantiene compatibilidad con código existente."""
    densidad_max = 9.0
    sup_nave = ancho_nave * largo_nave
    largo = max(ancho_nave, largo_nave)
    ancho = min(ancho_nave, largo_nave)

    res_1f: Optional[FilaLayoutNidal] = None
    if ancho >= _PERFIL_1F:
        N_max = math.floor(largo / _MOD_ANCHO)
        for N in range(N_max, 0, -1):
            r = _calcular_legacy(N, 1, sup_nave, densidad_max)
            if r.cumple_densidad and r.cumple_yacija:
                res_1f = r
                break

    res_2f: Optional[FilaLayoutNidal] = None
    if ancho >= _PERFIL_2F:
        N_max = math.floor(largo / _MOD_ANCHO)
        for N in range(N_max, 0, -1):
            r = _calcular_legacy(N, 2, sup_nave, densidad_max)
            if r.cumple_densidad and r.cumple_yacija:
                res_2f = r
                break

    if res_1f is None and res_2f is None:
        msg = (
            f"Ancho insuficiente ({ancho:.2f} m). Se necesitan ≥ {_PERFIL_1F} m para 1 fila."
            if ancho < _PERFIL_1F
            else "No es posible instalar módulos cumpliendo densidad y yacija ≥ 1/3 nave."
        )
        return ResultadoLayoutNidal(viable=False, error=msg)

    return ResultadoLayoutNidal(viable=True, recomendado=res_1f, alternativa_2filas=res_2f)

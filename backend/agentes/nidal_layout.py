import math
from typing import Optional, Literal
from pydantic import BaseModel

# ── Constantes A-Nida ─────────────────────────────────────────────────────────
_MOD_ANCHO = 1.20          # m — dimensión que se encadena
_MOD_FONDO = 1.40          # m — profundidad del cuerpo
_SLOT      = 3.00          # m — slot por cada lado (izq y der)
# 1 fila: ocupa _MOD_FONDO + 2×_SLOT = 7.40 m de ancho nave
# 2 filas: back-to-back, cada fila tiene 1 slot exterior → 3+1.40+1.40+3 = 8.80 m
_PERFIL_1F = _MOD_FONDO + 2 * _SLOT   # 7.40 m — ancho mínimo para 1 fila
_PERFIL_2F = 2 * _MOD_FONDO + 2 * _SLOT  # 8.80 m — ancho mínimo para 2 filas
_CAP_MOD   = 144           # gallinas / módulo
_SUP_CUERPO_MOD = round(_MOD_ANCHO * _MOD_FONDO, 4)   # 1.68 m²
_SUP_SLOT_MOD   = round(_MOD_ANCHO * _SLOT, 4)         # 3.60 m² (un solo lado)

# Densidad máxima interior por sistema (gallinas/m²)
_DENSIDAD_MAX: dict[str, float] = {
    "suelo":    9.0,
    "campero":  9.0,
    "ecologico": 6.0,
}


class FilaLayoutNidal(BaseModel):
    num_modulos: int
    num_filas: int
    gallinas: int
    densidad_real: float
    densidad_max: float
    sup_nave: float
    sup_cuerpo: float      # huella física del cuerpo (descuenta densidad y yacija)
    sup_slot: float        # huella del slot (descuenta yacija, NO densidad)
    sup_efectiva: float    # sup_nave - sup_cuerpo  → base del cálculo de densidad
    sup_yacija: float      # sup_nave - sup_cuerpo - sup_slot  (debe ser ≥ nave/3)
    fraccion_yacija: float # sup_yacija / sup_nave
    cumple_densidad: bool
    cumple_yacija: bool
    descripcion: str


class ResultadoLayoutNidal(BaseModel):
    viable: bool
    recomendado: Optional[FilaLayoutNidal] = None       # siempre 1 fila si es posible
    alternativa_2filas: Optional[FilaLayoutNidal] = None
    error: Optional[str] = None


# ── Funciones internas ────────────────────────────────────────────────────────

def _calcular(N_por_fila: int, num_filas: int, sup_nave: float, densidad_max: float) -> FilaLayoutNidal:
    total        = N_por_fila * num_filas
    sup_cuerpo   = total * _SUP_CUERPO_MOD
    # Slots: 1 fila → 3m a cada lado (×2); 2 filas → cada fila tiene 1 slot exterior (×1 por fila)
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


def _iterar(N_max: int, num_filas: int, sup_nave: float, densidad_max: float) -> Optional[FilaLayoutNidal]:
    """Reduce de N_max a 1 hasta que densidad y yacija ≥ 1/3 se cumplan."""
    for N in range(N_max, 0, -1):
        r = _calcular(N, num_filas, sup_nave, densidad_max)
        if r.cumple_densidad and r.cumple_yacija:
            return r
    return None


# ── API pública ───────────────────────────────────────────────────────────────

def optimizar_nidal(ancho_nave: float, largo_nave: float, sistema: str) -> ResultadoLayoutNidal:
    """
    Calcula el layout óptimo de nidales A-Nida para una nave de ancho × largo metros.

    Reglas:
    - Slot siempre 3 m.
    - La cadena va a lo largo del lado más largo.
    - Prefiere 1 fila (1 par de motores, menor avería).
    - Maximiza gallinas respetando: densidad ≤ máx  y  yacija ≥ 1/3 nave.
    - Calcula también 2 filas como alternativa informativa.
    """
    densidad_max = _DENSIDAD_MAX.get(sistema, 9.0)
    sup_nave = ancho_nave * largo_nave
    largo = max(ancho_nave, largo_nave)
    ancho = min(ancho_nave, largo_nave)

    # ── 1 FILA ────────────────────────────────────────────────────────────────
    res_1f: Optional[FilaLayoutNidal] = None
    if ancho >= _PERFIL_1F:
        res_1f = _iterar(math.floor(largo / _MOD_ANCHO), 1, sup_nave, densidad_max)

    # ── 2 FILAS (ancho ≥ 8.80 m) ─────────────────────────────────────────────
    res_2f: Optional[FilaLayoutNidal] = None
    if ancho >= _PERFIL_2F:
        res_2f = _iterar(math.floor(largo / _MOD_ANCHO), 2, sup_nave, densidad_max)

    if res_1f is None and res_2f is None:
        msg = (
            f"Ancho insuficiente ({ancho:.2f} m). Se necesitan ≥ {_PERFIL_1F} m para 1 fila."
            if ancho < _PERFIL_1F
            else "No es posible instalar módulos cumpliendo densidad y yacija ≥ 1/3 nave."
        )
        return ResultadoLayoutNidal(viable=False, error=msg)

    return ResultadoLayoutNidal(viable=True, recomendado=res_1f, alternativa_2filas=res_2f)

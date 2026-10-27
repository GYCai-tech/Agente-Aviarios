"""
Generador de planos SVG — distribución en planta.

Replica el estilo del plano real de Gómez y Crespo (ref. NELLY MARIBEL RUIZ VERA):
nave negra, módulos en rojo, módulo tensor amarillo, cotas, bloque de título.
"""
from __future__ import annotations

import logging
import math
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

# Constantes y reglas canónicas — ver agentes/estudio.py
from agentes.aforo import EquipamientoMedido, AforoResultado
import agentes.estudio as _E   # constantes de producto: leer en tiempo de llamada (ficha técnica)
from agentes.estudio import (
    GeometriaNidalCentrado, geometria_nidal_centrado,
    EstudioRequest, estudiar_nave,
    DENSIDAD_MAX as _DENSIDAD_MAX,
    MAX_GALLINAS_ECOLOGICO as _MAX_GALLINAS_ECOLOGICO,
    base_densidad,
    yacija_disponible,
    cap_ecologico,
    NIDAL_SLOT_DEFAULT as _NIDAL_SLOT_C,
)


# ── Constantes — Aviario ───────────────────────────────────────────────────────
# Medidas del módulo, pasillo y zonas de equipos: _E.AVI_MOD_A (eje X),
# _E.AVI_MOD_B (eje Y), _E.AVI_PASILLO, _E.AVI_CLEARANCE, _E.AVI_CLEARANCE_FONDO
_AVI_CLEAR_PARED = 0.0   # m margen superior/inferior
_FOSA_ANCHO      = 1.50   # m fosa purín

# ── Constantes — Nidal A-Nida ─────────────────────────────────────────────────
# Medidas del módulo, local técnico y tensor: _E.NIDAL_LARGO (X),
# _E.NIDAL_ANCHO (Y), _E.NIDAL_EQUIP, _E.NIDAL_TENSOR
_NIDAL_MOD_SLOT  = _NIDAL_SLOT_C        # m profundidad slot cada lado (Y)
_NIDAL_TENSOR_D  = 1.40                 # m diámetro del rodillo tensor
_NIDAL_SLAT_W    = 0.60   # m ancho slat (X)
_NIDAL_SLAT_D    = 1.00   # m profundidad slat (Y)

# ── Viewport SVG ──────────────────────────────────────────────────────────────
SVG_W  = 1100
SVG_H  = 720
PAD_L  = 90
PAD_T  = 60
PAD_R  = 70     # cotas de las filas a la derecha del dibujo
PAD_B  = 112

# ── Paleta del plano (limpio / profesional) ────────────────────────────────────
_FONT           = "'Work Sans','Segoe UI',Helvetica,Arial,sans-serif"
_COL_INK        = "#101a36"   # contorno de nave, título
_COL_GRID       = "#eaeef3"   # rejilla de fondo
_COL_DIM        = "#717c8e"   # líneas de cota
_COL_DIM_TXT    = "#39424f"   # texto de cota
_COL_MOD_FILL   = "#cfdff2"   # módulo aviario
_COL_MOD_STR    = "#26456f"
_COL_MOD_DIV    = "#88a3c4"
_COL_MOD_TXT    = "#152e54"
_COL_EQUIP_FILL = "#f3e7c8"   # zona equipos (noria / comida)
_COL_EQUIP_STR  = "#a8853f"
_COL_EQUIP_TXT  = "#5f4a12"
_COL_RASC_FILL  = "#dfe3eb"   # rascador
_COL_RASC_STR   = "#707f97"
_COL_RASC_TXT   = "#39455a"
_COL_FOSA_FILL  = "#e9d4b2"   # fosa de purín
_COL_FOSA_STR   = "#7c5a28"
_COL_FOSA_HATCH = "#b1905a"
_COL_FOSA_TXT   = "#4c360c"
_COL_PASILLO    = "#f6f8fa"   # pasillos
_COL_PASILLO_S  = "#bcc6d3"
_COL_PASILLO_T  = "#4e5a6e"
_COL_EXT_FILL   = "#e2efe0"   # zona exterior
_COL_EXT_STR    = "#3e7440"
_COL_EXT_TXT    = "#1f4a21"
_COL_PANEL      = "#f7f8fa"   # paneles (bloque de título)
_COL_OK         = "#2f6b46"


# ── Modelos Pydantic ──────────────────────────────────────────────────────────

class LayoutConfig(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    equipamiento: EquipamientoMedido = Field(default_factory=EquipamientoMedido)
    sup_pasto_m2: float | None = Field(default=None, ge=0)
    clearance_fondo_m: float = Field(default_factory=lambda: _E.AVI_CLEARANCE_FONDO, ge=0)
    paso_izq_m: float = Field(default=1, ge=0)
    paso_der_m: float = Field(default=1, ge=0)
    ancho_nave_m: float
    largo_nave_m: float
    tipo_zona: str = "aviario"
    sistema: str = "suelo"
    num_filas: int = 0
    mods_por_fila: int = 0
    # Aviario por módulos: total repartido en filas equilibradas (0 = num_filas × mods_por_fila)
    num_modulos: int = Field(default=0, ge=0)
    clearance_pared_m: float = _AVI_CLEAR_PARED
    pasillo_m: float = Field(default_factory=lambda: _E.AVI_PASILLO)
    clearance_lateral_m: float = Field(default_factory=lambda: _E.AVI_CLEARANCE)
    nombre_cliente: Optional[str] = None
    gallinas: int = 0
    niveles: int = 2
    ancho_alero_m: float = 0.0
    # Nidal: profundidad del slot a cada lado del cuerpo (0 = sin slot en ese lado)
    slot_izq_m: float = _NIDAL_MOD_SLOT
    slot_der_m: float = _NIDAL_MOD_SLOT
    # Nidal: local técnico dentro de la nave y largo libre mínimo al fondo (None = tensor)
    local_dentro: bool = False
    libre_fondo_m: float | None = Field(default=None, ge=0)


class MetricasPlano(BaseModel):
    geometria_nidal: GeometriaNidalCentrado | None = None
    aforo: AforoResultado | None = None
    calculo_provisional: bool = True
    clearance_fondo_m: float = Field(default_factory=lambda: _E.AVI_CLEARANCE_FONDO)
    num_filas: int
    mods_por_fila: int
    filas_modulos: list[int] = []
    total_modulos: int
    gallinas_max: int
    huella_m2: float
    yacija_m2: float
    densidad: float
    espacio_libre_y_m: float
    clearance_pared_m: float
    pasillo_m: float
    clearance_lateral_m: float
    densidad_max: float = 9.0


class LayoutConfigResponse(BaseModel):
    svg: str
    metricas: MetricasPlano
    error: Optional[str] = None


# ── Helpers SVG ────────────────────────────────────────────────────────────────

def _e(v: float, d: int = 1) -> str:
    return f"{v:.{d}f}"


def _rect(x, y, w, h, fill="none", stroke=_COL_INK, sw=1.5, rx=0, opacity=1.0, extra="") -> str:
    op = f' fill-opacity="{opacity}"' if opacity < 1 else ""
    return (
        f'<rect x="{_e(x)}" y="{_e(y)}" width="{_e(w)}" height="{_e(h)}" '
        f'fill="{fill}"{op} stroke="{stroke}" stroke-width="{sw}"'
        + (f' rx="{rx}"' if rx else "")
        + (f" {extra}" if extra else "")
        + "/>"
    )


def _line(x1, y1, x2, y2, stroke=_COL_DIM, sw=0.8, dash="") -> str:
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<line x1="{_e(x1)}" y1="{_e(y1)}" x2="{_e(x2)}" y2="{_e(y2)}" '
        f'stroke="{stroke}" stroke-width="{sw}"{d}/>'
    )


def _text(x, y, content, size=9, anchor="middle", fill=_COL_DIM_TXT, bold=False, extra="") -> str:
    fw = "600" if bold else "400"
    return (
        f'<text x="{_e(x)}" y="{_e(y)}" font-family="{_FONT}" font-size="{size}" '
        f'font-weight="{fw}" text-anchor="{anchor}" fill="{fill}"'
        + (f" {extra}" if extra else "")
        + f">{content}</text>"
    )


def _arrow_h(x1, x2, y, label) -> list[str]:
    arr = 5
    out = [_line(x1, y, x2, y, stroke=_COL_DIM, sw=0.7)]
    for xp, sign in ((x1, 1), (x2, -1)):
        out.append(_line(xp, y, xp + sign * arr, y - 3, stroke=_COL_DIM, sw=0.7))
        out.append(_line(xp, y, xp + sign * arr, y + 3, stroke=_COL_DIM, sw=0.7))
    out.append(_text((x1 + x2) / 2, y - 4, label, size=8, fill=_COL_DIM_TXT))
    return out


def _arrow_v(x, y1, y2, label, vertical_text=False, derecha=False) -> list[str]:
    arr = 5
    out = [_line(x, y1, x, y2, stroke=_COL_DIM, sw=0.7)]
    for yp, sign in ((y1, 1), (y2, -1)):
        out.append(_line(x, yp, x - 3, yp + sign * arr, stroke=_COL_DIM, sw=0.7))
        out.append(_line(x, yp, x + 3, yp + sign * arr, stroke=_COL_DIM, sw=0.7))
    if vertical_text:
        tx, ty = x - 7, (y1 + y2) / 2
        out.append(_text(tx, ty, label, size=8, fill=_COL_DIM_TXT,
                         extra=f'transform="rotate(-90 {_e(tx)} {_e(ty)})"'))
    elif derecha:
        out.append(_text(x + 7, (y1 + y2) / 2 + 3, label, size=8, anchor="start", fill=_COL_DIM_TXT))
    else:
        out.append(_text(x - 7, (y1 + y2) / 2 + 3, label, size=8, anchor="end", fill=_COL_DIM_TXT))
    return out


def _cabe(texto: str, size: float, ancho_px: float) -> bool:
    """Estimación de si un rótulo cabe en un hueco (ancho medio de glifo ≈ 0,6 em)."""
    return len(texto) * size * 0.6 <= ancho_px - 4


# ── Generador NIDAL — Hoja 1: distribución ───────────────────────────────────

def _build_nidal_distribucion_svg(
    ancho_nave: float,
    largo_nave: float,
    num_modulos: int,
    nombre_cliente: str,
    gallinas: int,
    dw: float,
    dh: float,
    ancho_alero_m: float = 0.0,
    slot_sup_m: float = _NIDAL_MOD_SLOT,
    slot_inf_m: float = _NIDAL_MOD_SLOT,
    geometria: GeometriaNidalCentrado | None = None,
    local_dentro: bool = False,
) -> list[str]:
    """
    Plano en planta del nidal A-Nida.
    Si ancho_alero_m > 0 dibuja la zona exterior (alero/parque) debajo de la nave.
    slot_sup_m / slot_inf_m: profundidad del slot a cada lado del cuerpo (0 = sin slot).
    """
    # Si hay alero, la escala Y abarca nave + alero juntos
    total_y_m   = ancho_nave + (ancho_alero_m if ancho_alero_m > 0 else 0.0)
    # Local técnico exterior: la escala X lo incluye aparte. Dentro de la nave
    # ocupa su cabecera y el dibujo es solo la nave.
    ext_m       = 0.0 if local_dentro else _E.NIDAL_EQUIP
    total_x_m   = ext_m + largo_nave
    # Escala UNIFORME: la misma en X e Y, o el dibujo sale deformado y un módulo
    # de 1,20 × 1,40 m no se parece a un módulo de 1,20 × 1,40 m.
    sx = sy = min(dw / total_x_m, dh / total_y_m)
    DW = total_x_m * sx          # ancho real del dibujo (px)
    DH = total_y_m * sy          # alto real del dibujo (px)
    X0 = PAD_L + (dw - DW) / 2   # origen X, centrado en el viewport
    Y0 = PAD_T + (dh - DH) / 2   # origen Y, centrado en el viewport
    nave_ph = ancho_nave * sy   # altura en píxeles de la nave
    els: list[str] = []

    # ── Y-axis geometry ───────────────────────────────────────────────
    geometria = geometria or geometria_nidal_centrado(
        ancho_nave, largo_nave, num_modulos, slot_sup_m, slot_inf_m)
    y_margin      = geometria.paso_lateral_m
    y_slot_top    = geometria.slat_izq_y_m
    y_cuerpo      = geometria.cuerpo_y_m
    y_slot_bot    = geometria.slat_der_y_m
    y_nidal_end   = geometria.conjunto_fin_y_m
    # Slots efectivamente dibujados: (y inicial, profundidad)
    slots = [(y, d) for y, d in ((y_slot_top, slot_sup_m), (y_slot_bot, slot_inf_m)) if d > 0]

    # ── X-axis geometry (coords en espacio total: 0 = inicio del dibujo) ─
    # Local exterior: 0-4 m es el local y la nave empieza en 4. Local dentro:
    # la nave empieza en 0 y la cadena tras el local.
    x_nidal_start = ext_m + geometria.cadena_inicio_x_m
    x_nidal_end   = x_nidal_start + geometria.cadena_largo_m

    def px(xm: float) -> float: return X0 + xm * sx
    def py(ym: float) -> float: return Y0 + ym * sy

    # ── Habitación anexa (local técnico: motorreductor + mesa) — 4×4 m ─
    room_px   = _E.NIDAL_EQUIP * sx        # largo del local en X (píxeles)
    room_dim  = _E.NIDAL_EQUIP                # local cuadrado
    room_ph   = room_dim * sy                 # mismo lado en Y (píxeles)
    nave_x0   = X0 + ext_m * sx
    nave_pw   = DW - ext_m * sx

    # Centrar el local en la altura del cuerpo del nidal
    cuerpo_cy_m = y_cuerpo + _E.NIDAL_ANCHO / 2
    room_top_m  = max(0.0, cuerpo_cy_m - room_dim / 2)
    room_y0     = Y0 + room_top_m * sy
    room_y1     = room_y0 + room_ph
    if local_dentro:
        # Dentro de la nave el local se cierra de pared a pared
        room_y0, room_y1, room_ph = Y0, Y0 + nave_ph, nave_ph
    # Zona de aves: toda la nave, o la nave tras el local si este va dentro
    aves_x0 = X0 + room_px if local_dentro else nave_x0
    aves_pw = X0 + DW - aves_x0

    if not local_dentro:
        # Local técnico exterior, adosado a la pared de cabecera
        els.append(_rect(X0, room_y0, room_px, room_ph,
                         fill="#f0f0f0", stroke="#000823", sw=2.5))

        # Pared izquierda de la nave en los segmentos donde NO hay local
        if room_y0 > Y0 + 2:
            els.append(_line(nave_x0, Y0, nave_x0, room_y0, stroke="#000823", sw=2.5))
        if room_y1 < Y0 + nave_ph - 2:
            els.append(_line(nave_x0, room_y1, nave_x0, Y0 + nave_ph, stroke="#000823", sw=2.5))

        # Doble línea separadora solo en la zona donde está el local
        els.append(_line(nave_x0,     room_y0, nave_x0,     room_y1, stroke="#000823", sw=3.0))
        els.append(_line(nave_x0 + 3, room_y0, nave_x0 + 3, room_y1, stroke="#000823", sw=1.2))

        # Apertura para el paso de la cinta (brecha en la pared doble)
        gap_y0 = py(y_cuerpo) + 4
        gap_y1 = py(y_slot_bot) - 4
        els.append(_rect(nave_x0 - 1, gap_y0, 7, gap_y1 - gap_y0,
                         fill="#fafafa", stroke="none"))

    # ── Nave ──────────────────────────────────────────────────────────
    els.append(_rect(nave_x0, Y0, nave_pw, nave_ph,
                     fill="#fafafa", stroke="#000823", sw=2.5, extra='data-element="nave"'))

    # ── Yacija bands (top and bottom) — solo dentro de la nave ────────
    if y_margin > 0.05:
        for y0 in (0.0, y_nidal_end):
            els.append(_rect(aves_x0, py(y0), aves_pw, y_margin * sy,
                             fill="#e8ede8", stroke="#4f764d", sw=0.8))
            els.append(_text(aves_x0 + aves_pw / 2, py(y0 + y_margin / 2) + 4,
                             f"YACIJA  {y_margin:.2f} m", size=9, fill="#234926"))

    if local_dentro:
        # Cabecera de la nave cerrada por el local técnico
        els.append(_rect(X0, room_y0, room_px, room_ph, fill="#f0f0f0", stroke="#000823",
                         sw=2.0, extra='data-element="local-tecnico"'))

    # ── Slot background (top and bottom of nidal body) ─────────────────
    slat_px0 = px(x_nidal_start)
    slat_pw  = (x_nidal_end - x_nidal_start) * sx
    for y0, depth in slots:
        els.append(_rect(slat_px0, py(y0), slat_pw, depth * sy,
                         fill="#fff8f8", stroke="#cc2200", sw=1.0))

    # ── Slat grid (0.6 m × 1.0 m cells) in slot areas ────────────────
    # Vertical module boundary lines
    for j in range(num_modulos + 1):
        lx = px(x_nidal_start + j * _E.NIDAL_LARGO)
        for y0, depth in slots:
            els.append(_line(lx, py(y0), lx, py(y0 + depth),
                             stroke="#cc2200", sw=1.5))
    # Vertical mid-module lines (slat sub-division at 0.6 m)
    for j in range(num_modulos):
        lx = px(x_nidal_start + (j + 0.5) * _E.NIDAL_LARGO)
        for y0, depth in slots:
            els.append(_line(lx, py(y0), lx, py(y0 + depth),
                             stroke="#cc2200", sw=0.5))
    # Horizontal slat row lines (every 1.0 m within each slot)
    for y0, depth in slots:
        for r in range(1, int(depth / _NIDAL_SLAT_D)):
            ly = py(y0 + r * _NIDAL_SLAT_D)
            els.append(_line(slat_px0, ly, slat_px0 + slat_pw, ly,
                             stroke="#cc2200", sw=0.5))

    # ── Cuerpo nidal (central 1.4 m strip) ────────────────────────────
    cx0 = slat_px0
    cy0 = py(y_cuerpo)
    cw  = slat_pw
    ch  = _E.NIDAL_ANCHO * sy
    els.append(_rect(cx0, cy0, cw, ch, fill="#ffecec", stroke="#cc2200", sw=1.8,
                     extra='data-element="cuerpo-nidal"'))

    # Sinfín belt (solid red bar along center)
    belt_h = max(4.0, ch * 0.30)
    els.append(_rect(cx0, cy0 + ch / 2 - belt_h / 2, cw, belt_h,
                     fill="#cc2200", stroke="none", sw=0))

    # Vertical module separations on cuerpo
    for j in range(1, num_modulos):
        lx = px(x_nidal_start + j * _E.NIDAL_LARGO)
        els.append(_line(lx, cy0, lx, cy0 + ch, stroke="#cc2200", sw=0.6))

    # ── Contenido habitación anexa ────────────────────────────────────
    room_cx    = X0 + room_px / 2
    # Motor y mesa a la altura de la cinta
    room_mid_y = py(cuerpo_cy_m) if local_dentro else room_y0 + room_ph / 2
    # Etiqueta del local
    els.append(_text(room_cx, room_y0 + 10,
                     f"LOCAL {_E.NIDAL_EQUIP:g} × {ancho_nave:.2f} m" if local_dentro
                     else f"LOCAL {_E.NIDAL_EQUIP:g} × {_E.NIDAL_EQUIP:g} m",
                     size=6, bold=True, fill="#444"))
    # Cinta saliendo del local hacia la nave (barra roja a través del hueco)
    els.append(_rect(X0, cy0 + ch / 2 - belt_h / 2,
                     max(room_px + 4, px(x_nidal_start) - X0), belt_h,
                     fill="#cc2200", stroke="none", sw=0))
    # Mesa de recogida (rectángulo con X) — en la mitad derecha del local
    sz  = min(room_px, room_ph) * 0.20
    mx  = X0 + room_px * 0.68
    my  = room_mid_y
    els.append(_rect(mx - sz, my - sz, sz * 2, sz * 2,
                     fill="white", stroke="#000823", sw=1.2))
    els.append(_line(mx - sz, my - sz, mx + sz, my + sz, stroke="#000823", sw=1.2))
    els.append(_line(mx + sz, my - sz, mx - sz, my + sz, stroke="#000823", sw=1.2))
    # Motoreductor (círculo) — en la mitad izquierda del local
    mr_x = X0 + room_px * 0.25
    mr_y = room_mid_y
    mr_r = min(room_px * 0.16, room_ph * 0.18)
    els.append(f'<circle cx="{_e(mr_x)}" cy="{_e(mr_y)}" r="{_e(mr_r)}" '
               f'fill="#ddd" stroke="#333" stroke-width="1.2"/>')
    # Etiquetas
    # Motor encima y mesa debajo: en un local estrecho, a la misma altura se pisaban
    els.append(_text(mr_x, mr_y - mr_r - 3, "Motor", size=6, fill="#444"))
    els.append(_text(mx, my + sz + 8, "Mesa", size=6, fill="#444"))

    # ── Módulo tensor ──────────────────────────────────────────────────
    # El tensor es un rodillo: se dibuja como círculo a escala real, no como
    # un bloque. Desde el final de la cadena hasta la pared del fondo todo es
    # suelo libre (yacija), sin separar la zona del tensor.
    els.append(_rect(px(x_nidal_end), py(y_slot_top), (X0 + DW) - px(x_nidal_end),
                     (y_nidal_end - y_slot_top) * sy, fill="#e8ede8", stroke="none", sw=0))

    # Rodillo tensor: círculo de diámetro igual a la profundidad del cuerpo
    t_cx = px(x_nidal_end + _NIDAL_TENSOR_D / 2)
    t_cy = cy0 + ch / 2
    t_r  = (_NIDAL_TENSOR_D / 2) * sx
    els.append(f'<circle cx="{_e(t_cx)}" cy="{_e(t_cy)}" r="{_e(t_r)}" '
               f'fill="#ffc000" stroke="#b08000" stroke-width="1.5"/>')
    # Eje del rodillo
    els.append(f'<circle cx="{_e(t_cx)}" cy="{_e(t_cy)}" r="{_e(max(1.5, t_r * 0.18))}" '
               f'fill="#b08000" stroke="none"/>')
    els.append(_text(t_cx, t_cy + t_r + 11, "Tensor", size=7.5, fill="#5a3000", bold=True))

    # ── Cotas ─────────────────────────────────────────────────────────
    nave_bot_px = Y0 + nave_ph
    # Local técnico: exterior (antes de la nave) o en la cabecera de la nave
    els += _arrow_h(X0, X0 + room_px, Y0 - 22,
                    f"{_E.NIDAL_EQUIP:g} m local" if local_dentro else f"{_E.NIDAL_EQUIP:g} m")
    # Nave (largo total real)
    els += _arrow_h(nave_x0, X0 + DW, Y0 - 38, f"{largo_nave:.2f} m")
    # Tramo módulos
    els += _arrow_h(px(x_nidal_start), px(x_nidal_end), Y0 - 22,
                    f"{geometria.cadena_largo_m:.2f} m")
    # Fin de la cadena → pared del fondo: tensor y suelo libre en una sola cota
    libre_m = largo_nave - geometria.cadena_inicio_x_m - geometria.cadena_largo_m
    if libre_m > 0.005:
        els += _arrow_h(px(x_nidal_end), X0 + DW, Y0 - 22, f"{libre_m:.2f} m libres")
    # Un módulo (etiqueta pequeña)
    if num_modulos >= 1:
        els += _arrow_h(px(x_nidal_start),
                        px(x_nidal_start + _E.NIDAL_LARGO),
                        cy0 - 6, f"{_E.NIDAL_LARGO:.1f}")

    # Ancho nave
    if ancho_alero_m > 0:
        els += _arrow_v(X0 - 42, Y0, nave_bot_px, f"{ancho_nave:.2f} m", vertical_text=True)
    else:
        els += _arrow_v(X0 - 42, Y0, Y0 + DH, f"{ancho_nave:.2f} m", vertical_text=True)
    if y_margin > 0.05:
        els += _arrow_v(X0 - 26, Y0, py(y_slot_top), f"{y_margin:.2f} m", vertical_text=True)
    if slot_sup_m > 0:
        els += _arrow_v(X0 - 26, py(y_slot_top), py(y_cuerpo), f"{slot_sup_m:.0f} m", vertical_text=True)
    els += _arrow_v(X0 - 26, py(y_cuerpo), py(y_slot_bot), f"{_E.NIDAL_ANCHO:.2f} m", vertical_text=True)
    if slot_inf_m > 0:
        els += _arrow_v(X0 - 26, py(y_slot_bot), py(y_nidal_end), f"{slot_inf_m:.0f} m", vertical_text=True)
    if y_margin > 0.05:
        els += _arrow_v(X0 - 26, py(y_nidal_end), nave_bot_px, f"{y_margin:.2f} m", vertical_text=True)

    rx_t = X0 + DW + 8
    els += _arrow_v(rx_t, py(y_cuerpo), py(y_slot_bot), f"{_E.NIDAL_ANCHO:.2f}", derecha=True)

    # Tick extensions
    for xp in sorted({X0, nave_x0, X0 + room_px, X0 + DW}):
        els.append(_line(xp, Y0 - 50, xp, Y0, stroke="#aaa", sw=0.5, dash="3,2"))
    for yp in (Y0, nave_bot_px):
        els.append(_line(X0 - 50, yp, X0, yp, stroke="#aaa", sw=0.5, dash="3,2"))

    # ── Zona exterior (alero / suelo anexo) ───────────────────────────
    if ancho_alero_m > 0:
        ext_ph = ancho_alero_m * sy
        ext_y0 = nave_bot_px
        ext_y1 = ext_y0 + ext_ph

        # Fondo zona exterior
        els.append(_rect(X0, ext_y0, DW, ext_ph,
                         fill=_COL_EXT_FILL, stroke=_COL_EXT_STR, sw=2.0))

        # Achurado diagonal (líneas cada 18 px)
        step = 18
        clip_x0, clip_y0, clip_x1, clip_y1 = X0, ext_y0, X0 + DW, ext_y1
        i = 0
        while True:
            ox = i * step
            x1 = clip_x0 + ox; y1 = clip_y0
            x2 = clip_x0;      y2 = clip_y0 + ox
            # clip to rect
            pts = []
            if x1 <= clip_x1:
                pts.append((x1, y1))
            if y2 <= clip_y1:
                pts.append((x2, y2))
            if not pts:
                break
            if len(pts) == 2:
                els.append(_line(pts[0][0], pts[0][1], pts[1][0], pts[1][1],
                                 stroke="#4a8a4a", sw=0.6))
            i += 1
        # also lines from right edge
        i = 1
        while True:
            ox = i * step
            x1 = clip_x1 - ox; y1 = clip_y0
            x2 = clip_x1;      y2 = clip_y0 + ox
            if x1 < clip_x0 and y2 > clip_y1:
                break
            xa = max(clip_x0, x1); ya = clip_y0 + max(0, clip_x0 - x1)
            xb = clip_x1;          yb = clip_y0 + ox
            if yb <= clip_y1:
                els.append(_line(xa, ya, xb, yb, stroke="#4a8a4a", sw=0.6))
            i += 1

        # Etiqueta
        els.append(_text(X0 + DW / 2, ext_y0 + ext_ph / 2 + 4,
                         f"ZONA EXTERIOR  {ancho_alero_m:.1f} m",
                         size=11, fill="#1a5a1a", bold=True))

        # Cota ancho alero
        els += _arrow_v(X0 - 42, ext_y0, ext_y1, f"{ancho_alero_m:.1f} m")
        els.append(_line(X0 - 50, ext_y1, X0, ext_y1,
                         stroke="#aaa", sw=0.5, dash="3,2"))

    return els


# ── Generador NIDAL — Hoja 2: posiciones de cableado ─────────────────────────

def _build_nidal_cableado_svg(
    ancho_nave: float,
    largo_nave: float,
    num_modulos: int,
    nombre_cliente: str,
    dw: float,
    dh: float,
) -> list[str]:
    """
    Plano de posicionamiento de cableado eléctrico (Hoja 2 de 2).
    Overlays on the same distribution plan adding:
      - Motor elevanidos position (5.40 m from left wall)
      - Control panel location (on wall near exit)
      - Sinfín motors (0.37 kW) — double row, each side
      - Egg belt motor (0.11 kW)
      - Elevanidos motor (0.44 kW)
      - Cable routing annotations
    """
    # Start with same base layout (ghost version — lighter colors)
    sx = dw / largo_nave
    sy = dh / ancho_nave

    total_nidal_y = _NIDAL_MOD_SLOT * 2 + _E.NIDAL_ANCHO
    y_margin      = max(0.0, (ancho_nave - total_nidal_y) / 2)
    y_cuerpo      = y_margin + _NIDAL_MOD_SLOT
    y_slot_bot    = y_cuerpo + _E.NIDAL_ANCHO

    x_nidal_start = _E.NIDAL_EQUIP
    x_nidal_end   = x_nidal_start + num_modulos * _E.NIDAL_LARGO

    def px(xm: float) -> float: return PAD_L + xm * sx
    def py(ym: float) -> float: return PAD_T + ym * sy

    ch   = _E.NIDAL_ANCHO * sy
    cy0  = py(y_cuerpo)
    belt_h = max(4.0, ch * 0.30)

    # ── Base plan (ghosted) ────────────────────────────────────────────
    els = _build_nidal_distribucion_svg(
        ancho_nave, largo_nave, num_modulos, nombre_cliente, 0, dw, dh
    )

    # ── Cuadro de control (left of exit, 1.2–1.5 m height) ────────────
    # Positioned on left wall, at cuerpo level
    ctrl_w = _E.NIDAL_EQUIP * sx * 0.30
    ctrl_h = ch * 0.55
    ctrl_x = PAD_L + 6
    ctrl_y = cy0 - ctrl_h - 4
    els.append(_rect(ctrl_x, ctrl_y, ctrl_w, ctrl_h,
                     fill="#e8f0ff", stroke="#0040b0", sw=1.5))
    els.append(_text(ctrl_x + ctrl_w / 2, ctrl_y + ctrl_h / 2 - 5,
                     "CUADRO", size=7, fill="#0040b0", bold=True))
    els.append(_text(ctrl_x + ctrl_w / 2, ctrl_y + ctrl_h / 2 + 6,
                     "1.2–1.5 m", size=6, fill="#0040b0"))

    # Entry cable annotation
    els.append(_line(ctrl_x + ctrl_w, ctrl_y + ctrl_h / 2,
                     ctrl_x + ctrl_w + 18, ctrl_y + ctrl_h / 2,
                     stroke="#0040b0", sw=1.0, dash="4,2"))
    els.append(_text(ctrl_x + ctrl_w + 22, ctrl_y + ctrl_h / 2 - 3,
                     "Entrada 4×2.5", size=7, anchor="start", fill="#0040b0"))

    # ── Motor elevanidos (5.40 m from left equipment start) ────────────
    x_elev = _E.NIDAL_EQUIP + 5.40
    elev_px = px(x_elev)
    elev_py = PAD_T - 14
    # Dimension line showing 5.40 m position
    els += _arrow_h(px(x_nidal_start), elev_px, cy0 + ch + 18, "5.40 m")
    els.append(_line(elev_px, elev_py, elev_px, cy0 + ch + 12,
                     stroke="#888", sw=0.5, dash="3,2"))
    # Motor symbol (circle)
    els.append(f'<circle cx="{_e(elev_px)}" cy="{_e(cy0 + ch / 2)}" r="8" '
               f'fill="#ffe0b0" stroke="#b06000" stroke-width="1.5"/>')
    els.append(_text(elev_px, cy0 + ch / 2 + 3, "M", size=7, fill="#b06000", bold=True))
    # Cable annotation
    els.append(_text(elev_px + 12, cy0 + ch / 2 - 10,
                     "0.44 kW", size=7, anchor="start", fill="#b06000"))
    els.append(_text(elev_px + 12, cy0 + ch / 2 + 2,
                     "4×2.5", size=7, anchor="start", fill="#b06000"))

    # ── Sinfín motors (0.37 kW) — one on each side of nidal ────────────
    # Positioned near egg exit side (left side of modules)
    x_sinfin = x_nidal_start + 1.0
    for y_motor, label in (
        (y_margin + _NIDAL_MOD_SLOT * 0.15, "SINFÍN\n0.37 kW"),
        (y_slot_bot + _NIDAL_MOD_SLOT * 0.85, "SINFÍN\n0.37 kW"),
    ):
        mpx = px(x_sinfin)
        mpy = py(y_motor)
        els.append(f'<circle cx="{_e(mpx)}" cy="{_e(mpy)}" r="7" '
                   f'fill="#ffe0e0" stroke="#cc2200" stroke-width="1.5"/>')
        els.append(_text(mpx, mpy + 3, "M", size=6, fill="#cc2200", bold=True))
        els.append(_text(mpx + 10, mpy - 5, "0.37 kW", size=7,
                         anchor="start", fill="#cc2200"))
        els.append(_text(mpx + 10, mpy + 6, "4×2.5", size=7,
                         anchor="start", fill="#cc2200"))
        # Dashed cable routing toward control panel
        els.append(_line(mpx - 7, mpy, ctrl_x + ctrl_w, ctrl_y + ctrl_h / 2,
                         stroke="#cc2200", sw=0.7, dash="5,3"))

    # ── Motor recogida huevo (0.11 kW) at mesa ────────────────────────
    mx_r = PAD_L + _E.NIDAL_EQUIP * sx * 0.70
    my_r = cy0 + ch / 2
    els.append(f'<circle cx="{_e(mx_r)}" cy="{_e(my_r)}" r="7" '
               f'fill="#e0ffe0" stroke="#005500" stroke-width="1.5"/>')
    els.append(_text(mx_r, my_r + 3, "M", size=6, fill="#005500", bold=True))
    els.append(_text(mx_r - 8, my_r - 15, "0.11 kW", size=7,
                     anchor="middle", fill="#005500"))
    els.append(_text(mx_r - 8, my_r - 5, "4×2.5", size=7,
                     anchor="middle", fill="#005500"))

    # ── Elevanidos cable annotation (bottom, 30 cm height) ─────────────
    elev_cable_y = PAD_T + dh + 8
    elev_note_x  = elev_px - 30
    els.append(_rect(elev_note_x, elev_cable_y + 2, 140, 28,
                     fill="#fffbe8", stroke="#b08000", sw=0.8, rx=2))
    els.append(_text(elev_note_x + 70, elev_cable_y + 13,
                     "Dejar manguera 4×2.5 a 30 cm suelo", size=7, fill="#806000"))
    els.append(_text(elev_note_x + 70, elev_cable_y + 23,
                     "longitud 1.5–2 m  ·  Motor 0.44 kW", size=7, fill="#806000"))

    # ── Legend panel for cable plan ─────────────────────────────────────
    lx = PAD_L
    ly = PAD_T + dh + 45
    for color, label in (("#0040b0", "Cuadro / entrada"),
                         ("#cc2200", "Motor sinfín 0.37 kW"),
                         ("#b06000", "Motor elevanidos 0.44 kW"),
                         ("#005500", "Motor recogida 0.11 kW")):
        els.append(f'<circle cx="{_e(lx + 6)}" cy="{_e(ly + 5)}" r="5" '
                   f'fill="{color}" stroke="{color}" stroke-width="1"/>')
        els.append(_text(lx + 14, ly + 9, label, size=8,
                         anchor="start", fill=color))
        lx += 175

    return els


# ── Generador de plano AVIARIO ─────────────────────────────────────────────────

def _build_aviario_svg(
    ancho_nave: float,
    largo_nave: float,
    num_filas: int,
    mods_por_fila: int,
    clearance_pared: float,
    pasillo: float,
    clearance_lat: float,
    nombre_cliente: str,
    gallinas: int,
    total_modulos: int,
    dw: float,
    dh: float,
    ancho_alero_m: float = 0.0,
    clearance_fondo: float | None = None,
    filas_modulos: list[int] | None = None,
) -> list[str]:
    """filas_modulos: módulos de cada fila; por defecto num_filas filas de mods_por_fila."""
    if clearance_fondo is None:
        clearance_fondo = _E.AVI_CLEARANCE_FONDO
    filas = filas_modulos or [mods_por_fila] * num_filas
    mods_por_fila = max(filas)
    total_y_m = ancho_nave + (ancho_alero_m if ancho_alero_m > 0 else 0.0)
    # Escala UNIFORME en X e Y: si no, el módulo de 1,20 × 3,30 m sale deformado.
    sx = sy = min(dw / largo_nave, dh / total_y_m)
    DW = largo_nave * sx         # ancho real del dibujo (px)
    DH = total_y_m * sy          # alto real del dibujo (px)
    X0 = PAD_L + (dw - DW) / 2   # origen X, centrado en el viewport
    Y0 = PAD_T + (dh - DH) / 2   # origen Y, centrado en el viewport
    nave_ph = ancho_nave * sy
    els: list[str] = []

    fosa_w  = max(0, min(_FOSA_ANCHO, clearance_fondo - 0.5)) * sx
    zw      = clearance_lat * sx
    zw_fondo = clearance_fondo * sx
    x_der   = X0 + DW - zw_fondo
    w_rasc  = zw_fondo - fosa_w
    x_fosa  = X0 + DW - fosa_w

    els.append(_rect(X0, Y0, DW, nave_ph, fill="#ffffff", stroke=_COL_INK, sw=2.5))
    els.append(_rect(X0, Y0, zw, nave_ph, fill=_COL_EQUIP_FILL, stroke=_COL_EQUIP_STR, sw=0.8, opacity=0.7))
    els.append(_rect(x_der, Y0, w_rasc, nave_ph, fill=_COL_RASC_FILL, stroke=_COL_RASC_STR, sw=0.8, opacity=0.7))

    els.append(_rect(x_fosa, Y0, fosa_w, nave_ph, fill=_COL_FOSA_FILL, stroke=_COL_FOSA_STR, sw=1.5))
    cx_fosa = x_fosa + fosa_w / 2
    cy_mid  = Y0 + nave_ph / 2
    fosa_m  = max(0, min(_FOSA_ANCHO, clearance_fondo - 0.5))
    # Achurado diagonal recortado al rectángulo de la fosa
    els.append(f'<defs><clipPath id="clip-fosa">'
               f'<rect x="{_e(x_fosa)}" y="{_e(Y0)}" width="{_e(fosa_w)}" height="{_e(nave_ph)}"/>'
               f'</clipPath></defs>')
    els.append('<g clip-path="url(#clip-fosa)">')
    step = 14
    for k in range(-int(nave_ph / step) - 1, int(fosa_w / step) + 2):
        ox = x_fosa + k * step
        els.append(_line(ox, Y0, ox + nave_ph, Y0 + nave_ph, stroke=_COL_FOSA_HATCH, sw=0.5))
    els.append('</g>')
    # Etiqueta centrada: usar translate+rotate para que ambas líneas queden centradas juntas
    els.append(f'<g transform="translate({_e(cx_fosa)},{_e(cy_mid)}) rotate(-90)">')
    els.append(f'<text x="0" y="-5" font-family="{_FONT}" font-size="8" '
               f'font-weight="600" text-anchor="middle" fill="{_COL_FOSA_TXT}">FOSA DE PURÍN</text>')
    els.append(f'<text x="0" y="9" font-family="{_FONT}" font-size="7" '
               f'font-weight="400" text-anchor="middle" fill="{_COL_FOSA_TXT}">{fosa_m:.1f} m</text>')
    els.append('</g>')

    for i in range(num_filas):
        y_m = clearance_pared + i * (_E.AVI_MOD_B + pasillo)
        ry  = Y0 + y_m * sy
        rh  = _E.AVI_MOD_B * sy
        els.append(_rect(X0, ry, zw, rh, fill=_COL_EQUIP_FILL, stroke=_COL_EQUIP_STR, sw=1.2))
        if _cabe("NORIA · COMIDA", 7, zw):
            els.append(_text(X0 + zw / 2, ry + rh / 2 + 4,
                             "NORIA · COMIDA", size=7, fill=_COL_EQUIP_TXT))
        els.append(_rect(x_der, ry, w_rasc, rh, fill=_COL_RASC_FILL, stroke=_COL_RASC_STR, sw=1.2))
        if _cabe("RASCADOR", 7, w_rasc):
            els.append(_text(x_der + w_rasc / 2, ry + rh / 2 + 4,
                             "RASCADOR", size=7, fill=_COL_RASC_TXT))

    for i, mods in enumerate(filas):
        y_m = clearance_pared + i * (_E.AVI_MOD_B + pasillo)
        rx  = X0 + clearance_lat * sx
        ry  = Y0 + y_m * sy
        rw  = mods * _E.AVI_MOD_A * sx
        rh  = _E.AVI_MOD_B * sy
        els.append(_rect(rx, ry, rw, rh, fill=_COL_MOD_FILL, stroke=_COL_MOD_STR, sw=1.8, opacity=0.95))
        for j in range(1, mods):
            lx = rx + j * _E.AVI_MOD_A * sx
            els.append(_line(lx, ry, lx, ry + rh, stroke=_COL_MOD_DIV, sw=0.6))
        els.append(_text(
            rx + rw / 2, ry + rh / 2 + 4,
            f"FILA {i+1}  ·  {mods} módulos  ·  {mods * _E.AVI_MOD_A:.2f} m",
            size=8, fill=_COL_MOD_TXT, bold=True,
        ))
        cx_cota = X0 + DW + 20
        els += _arrow_v(cx_cota, ry, ry + rh, f"{_E.AVI_MOD_B:.2f} m", derecha=True)

    for i in range(len(filas) - 1):
        y_top = clearance_pared + (i + 1) * _E.AVI_MOD_B + i * pasillo
        ry    = Y0 + y_top * sy
        rh_p  = pasillo * sy
        rx    = X0 + clearance_lat * sx
        rw    = max(filas[i], filas[i + 1]) * _E.AVI_MOD_A * sx
        els.append(_rect(rx, ry, rw, rh_p,
                         fill=_COL_PASILLO, stroke=_COL_PASILLO_S, sw=0.5, opacity=0.7))
        els.append(_text(rx + rw / 2, ry + rh_p / 2 + 3,
                         f"PASILLO  {pasillo:.2f} m", size=7, fill=_COL_PASILLO_T))

    rx0 = X0 + clearance_lat * sx
    rx1 = rx0 + mods_por_fila * _E.AVI_MOD_A * sx
    els += _arrow_h(rx0, rx1, Y0 - 22,
                    f"{mods_por_fila * _E.AVI_MOD_A:.2f} m  ({mods_por_fila} × {_E.AVI_MOD_A} m)")
    if clearance_lat > 0:
        els += _arrow_h(X0, rx0, Y0 - 22, f"{clearance_lat:.2f} m")
    if clearance_fondo > 0:
        els += _arrow_h(x_der, X0 + DW, Y0 - 22, f"{clearance_fondo:.2f} m")
    els += _arrow_h(X0, X0 + DW, Y0 - 38, f"{largo_nave:.0f} m")
    nave_bot_px = Y0 + nave_ph
    if ancho_alero_m > 0:
        els += _arrow_v(X0 - 42, Y0, nave_bot_px, f"{ancho_nave:.0f} m")
    else:
        els += _arrow_v(X0 - 42, Y0, Y0 + DH, f"{ancho_nave:.0f} m")
    if clearance_pared > 0:
        els += _arrow_v(X0 - 26, Y0, Y0 + clearance_pared * sy,
                        f"{clearance_pared:.2f} m")

    for xp in (X0, X0 + DW):
        els.append(_line(xp, Y0 - 55, xp, Y0, stroke="#aaa", sw=0.5, dash="3,2"))
    for yp in (Y0, nave_bot_px):
        els.append(_line(X0 - 50, yp, X0, yp, stroke="#aaa", sw=0.5, dash="3,2"))

    # ── Zona exterior (alero / suelo anexo) ───────────────────────────
    if ancho_alero_m > 0:
        ext_ph  = ancho_alero_m * sy
        ext_y0  = nave_bot_px
        ext_y1  = ext_y0 + ext_ph
        els.append(_rect(X0, ext_y0, DW, ext_ph,
                         fill=_COL_EXT_FILL, stroke=_COL_EXT_STR, sw=2.0))
        step_h = 18
        clip_x0, clip_y0 = X0, ext_y0
        clip_x1, clip_y1 = X0 + DW, ext_y1
        i = 0
        while True:
            ox = i * step_h
            x1 = clip_x0 + ox; y1 = clip_y0
            x2 = clip_x0;      y2 = clip_y0 + ox
            if x1 > clip_x1 and y2 > clip_y1:
                break
            if x1 <= clip_x1:
                xa, ya = x1, y1
            else:
                xa, ya = clip_x1, clip_y0 + (x1 - clip_x1)
            if y2 <= clip_y1:
                xb, yb = x2, y2
            else:
                xb, yb = clip_x0 + (y2 - clip_y1), clip_y1
            if ya <= clip_y1 and yb >= clip_y0:
                els.append(_line(xa, ya, xb, yb, stroke=_COL_EXT_STR, sw=0.6))
            i += 1
        els.append(_text(X0 + DW / 2, ext_y0 + ext_ph / 2 + 4,
                         f"ZONA EXTERIOR  {ancho_alero_m:.1f} m",
                         size=11, fill=_COL_EXT_TXT, bold=True))
        els += _arrow_v(X0 - 42, ext_y0, ext_y1, f"{ancho_alero_m:.1f} m")
        els.append(_line(X0 - 50, ext_y1, X0, ext_y1,
                         stroke="#aaa", sw=0.5, dash="3,2"))

    return els


# ── Leyenda + bloque de título ─────────────────────────────────────────────────

def _footer(
    req_tipo: str,
    nombre_cliente: str,
    total_modulos: int,
    gallinas: int,
    hoja: str = "1 DE 2",
    y0: float = SVG_H - PAD_B,
) -> list[str]:
    """y0: base del dibujo; la leyenda y el cajetín van justo debajo."""
    els: list[str] = []

    # Sin banda de cifras (módulos, aves, densidad): el informe ya las da
    band_y = y0 + 16

    # ── Leyenda ────────────────────────────────────────────────────────
    y_leg = band_y

    if req_tipo == "aviario":
        items = [
            (_COL_MOD_FILL, _COL_MOD_STR, "Módulo aviario"),
            (_COL_EQUIP_FILL, _COL_EQUIP_STR, "Noria / comida"),
            (_COL_RASC_FILL, _COL_RASC_STR, "Rascador"),
            (_COL_FOSA_FILL, _COL_FOSA_STR, "Fosa de purín"),
        ]
    else:
        items = [
            ("#cc2200", "#cc2200", "Cuerpo A-Nida + sinfín"),
            ("#fff8f8", "#cc2200", "Slot / slats 100×60"),
            ("#ffc000", "#b08000", "Módulo tensor"),
            ("#e8ede8", "#4f764d", "Yacija"),
        ]

    x = PAD_L
    for fill, stroke, label in items:
        els.append(_rect(x, y_leg, 14, 10, fill=fill, stroke=stroke, sw=1.0))
        els.append(_text(x + 18, y_leg + 9, label, size=8, anchor="start", fill="#484e62"))
        x += 155

    # ── Bloque de título ───────────────────────────────────────────────
    bx = SVG_W - PAD_R - 250
    by = band_y
    bw, bh = 250, 62
    els.append(_rect(bx, by, bw, bh, fill=_COL_PANEL, stroke=_COL_INK, sw=1.0, rx=3))
    els.append(_line(bx, by + 21, bx + bw, by + 21, sw=0.5, stroke=_COL_INK))
    els.append(_line(bx, by + 42, bx + bw, by + 42, sw=0.5, stroke=_COL_INK))
    producto = "Aviario Industrial" if req_tipo == "aviario" else "A-Nida Plus"
    gallinas_str = f"{gallinas:,}".replace(",", ".")
    els.append(_text(bx + bw / 2, by + 15, "GÓMEZ Y CRESPO", size=9, bold=True, fill=_COL_INK))
    els.append(_text(bx + bw / 2, by + 33, producto, size=8, fill=_COL_OK))
    els.append(_text(bx + bw / 2, by + 56,
                     f"{nombre_cliente}  ·  {total_modulos} mód.  ·  {gallinas_str} aves",
                     size=7, fill=_COL_DIM_TXT))
    # El SVG se adapta a la pantalla: no tiene una escala física de impresión
    els.append(_text(bx + bw - 4, by + 15, "COTAS EN m", size=7, anchor="end", fill=_COL_DIM_TXT))
    els.append(_text(bx + bw - 4, by + 28, f"HOJA {hoja}", size=7, anchor="end", fill=_COL_DIM_TXT))

    # Sin norte: no conocemos la orientación geográfica de la nave
    nota = ("Conjunto centrado · " if req_tipo == "nidal_colectivo" else "") + \
        "Distribución preliminar · Medidas del equipo por confirmar"
    els.append(_text(PAD_L, y_leg + 34, nota, size=8, anchor="start", fill=_COL_DIM_TXT))
    return els


def _wrap_svg(parts: list[str], alto: float = SVG_H) -> str:
    inner = "\n  ".join(parts)
    h = _e(alto, 0)
    bg = (
        f'<rect width="{SVG_W}" height="{h}" fill="#ffffff"/>'
        f'<rect x="8" y="8" width="{SVG_W - 16}" height="{_e(alto - 16, 0)}" fill="none" '
        f'stroke="{_COL_GRID}" stroke-width="1"/>'
    )
    return (
        f'<svg viewBox="0 0 {SVG_W} {h}" width="{SVG_W}" height="{h}" xmlns="http://www.w3.org/2000/svg" '
        f'style="font-family:{_FONT};background:#fff">\n  '
        f'{bg}\n  {inner}\n</svg>'
    )


def _alto_dibujo(total_x_m: float, total_y_m: float, dw: float, dh: float) -> float:
    """Alto en px del dibujo a escala uniforme: el SVG se recorta a él y no deja bandas vacías."""
    if total_x_m <= 0 or total_y_m <= 0:
        return dh
    return total_y_m * min(dw / total_x_m, dh / total_y_m)


# ── Cálculo layout óptimo aviario ─────────────────────────────────────────────

def _optimal_aviario(
    ancho: float, largo: float,
    clearance_pared: float, pasillo: float, clearance_lat: float,
    num_filas_override: int = 0, mods_override: int = 0,
    clearance_fondo: float | None = None,
) -> tuple[int, int]:
    if clearance_fondo is None:
        clearance_fondo = _E.AVI_CLEARANCE_FONDO
    r = estudiar_nave(EstudioRequest(tipo_zona="aviario", ancho_nave_m=ancho,
        largo_nave_m=largo, altura_nave_cm=_E.AVI_ALTURA_MIN[2],
        clearance_pared_m=clearance_pared, pasillo_m=pasillo,
        clearance_frontal_m=clearance_lat, clearance_fondo_m=clearance_fondo,
        num_filas=num_filas_override or None, mods_por_fila=mods_override or None))
    return (r.num_filas, r.mods_por_fila) if r.num_modulos else (0, 0)


def _metricas_aviario(
    ancho: float, largo: float,
    num_filas: int, mods_por_fila: int,
    clearance_pared: float, pasillo: float, clearance_lat: float,
    gallinas_override: int, sistema: str = "suelo", niveles: int = 2,
    ancho_alero_m: float = 0.0,
    clearance_fondo: float | None = None,
    equipamiento: EquipamientoMedido | None = None,
    sup_pasto_m2: float | None = None,
    num_modulos: int = 0,
) -> MetricasPlano:
    """num_modulos > 0: aviario por módulos (total repartido en filas); si no, num_filas × mods_por_fila."""
    if clearance_fondo is None:
        clearance_fondo = _E.AVI_CLEARANCE_FONDO
    if num_modulos <= 0 and (num_filas <= 0 or mods_por_fila <= 0):
        raise ValueError("No cabe ninguna fila de aviario con las separaciones indicadas")
    r = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema=sistema,
        ancho_nave_m=ancho, largo_nave_m=largo, altura_nave_cm=_E.AVI_ALTURA_MIN.get(niveles, _E.AVI_ALTURA_MIN[2]),
        niveles=niveles, **({"reparto": "modulos", "num_modulos": num_modulos} if num_modulos > 0
                            else {"num_filas": num_filas, "mods_por_fila": mods_por_fila}),
        clearance_pared_m=clearance_pared, pasillo_m=pasillo,
        clearance_frontal_m=clearance_lat, clearance_fondo_m=clearance_fondo,
        equipamiento=equipamiento or EquipamientoMedido(), sup_pasto_m2=sup_pasto_m2))
    if not r.viable:
        raise ValueError(r.motivo or "La distribución no cumple las verificaciones del estudio")
    if gallinas_override > r.gallinas_max:
        raise ValueError(f"El objetivo supera la capacidad calculada: {r.gallinas_max} gallinas")
    aves = gallinas_override if gallinas_override > 0 else r.gallinas_max
    return MetricasPlano(num_filas=r.num_filas, mods_por_fila=r.mods_por_fila,
        filas_modulos=r.filas_modulos, total_modulos=r.num_modulos, gallinas_max=r.gallinas_max,
        huella_m2=r.huella_modulos_m2, yacija_m2=r.sup_yacija_m2,
        densidad=round(aves / r.sup_disponible_m2, 2) if r.sup_disponible_m2 else 0,
        espacio_libre_y_m=round(ancho - 2 * clearance_pared - r.num_filas * _E.AVI_MOD_B - (r.num_filas-1) * pasillo, 4),
        clearance_pared_m=clearance_pared, pasillo_m=pasillo,
        clearance_lateral_m=clearance_lat, clearance_fondo_m=clearance_fondo,
        densidad_max=r.densidad_max, aforo=r.aforo)


def _metricas_nidal(
    ancho: float, largo: float, num_modulos: int, gallinas: int,
    sistema: str = "suelo", ancho_alero_m: float = 0.0,
    slot_sup_m: float = _NIDAL_MOD_SLOT, slot_inf_m: float = _NIDAL_MOD_SLOT,
    paso_izq_m: float = 1, paso_der_m: float = 1,
    equipamiento: EquipamientoMedido | None = None,
    sup_pasto_m2: float | None = None,
    local_dentro: bool = False,
    libre_fondo_m: float | None = None,
) -> MetricasPlano:
    r = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema=sistema,
        ancho_nave_m=ancho, largo_nave_m=largo, altura_nave_cm=300,
        num_modulos=num_modulos, slot_izq_m=slot_sup_m, slot_der_m=slot_inf_m,
        paso_izq_m=paso_izq_m, paso_der_m=paso_der_m,
        local_dentro=local_dentro, libre_fondo_m=libre_fondo_m,
        equipamiento=equipamiento or EquipamientoMedido(), sup_pasto_m2=sup_pasto_m2))
    if not r.viable:
        raise ValueError(r.motivo or "La distribución no cumple las verificaciones del estudio")
    if gallinas > r.gallinas_max:
        raise ValueError(f"El objetivo supera la capacidad calculada: {r.gallinas_max} gallinas")
    aves = gallinas if gallinas > 0 else r.gallinas_max
    return MetricasPlano(num_filas=1, mods_por_fila=r.num_modulos,
        total_modulos=r.num_modulos, gallinas_max=r.gallinas_max,
        huella_m2=r.huella_modulos_m2, yacija_m2=r.sup_yacija_m2,
        densidad=round(aves/r.sup_disponible_m2, 2), espacio_libre_y_m=r.holgura_m,
        clearance_pared_m=0, pasillo_m=0, clearance_lateral_m=0,
        densidad_max=r.densidad_max, aforo=r.aforo, geometria_nidal=r.geometria_nidal)


# ── API principal: desde LayoutConfig ─────────────────────────────────────────

def generar_desde_config(cfg: LayoutConfig) -> LayoutConfigResponse:
    try:
        dw = SVG_W - PAD_L - PAD_R
        dh = SVG_H - PAD_T - PAD_B

        # ── Nidal colectivo ────────────────────────────────────────────
        if cfg.tipo_zona == "nidal_colectivo":
            if cfg.num_filas not in (0, 1):
                raise ValueError("El plano de nidal centrado admite una única fila")
            if cfg.mods_por_fila > 0:
                num_mods = cfg.mods_por_fila
            else:
                r = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema=cfg.sistema,
                    ancho_nave_m=cfg.ancho_nave_m, largo_nave_m=cfg.largo_nave_m, altura_nave_cm=300,
                    slot_izq_m=cfg.slot_izq_m, slot_der_m=cfg.slot_der_m,
                    paso_izq_m=cfg.paso_izq_m, paso_der_m=cfg.paso_der_m,
                    local_dentro=cfg.local_dentro, libre_fondo_m=cfg.libre_fondo_m,
                    equipamiento=cfg.equipamiento, sup_pasto_m2=cfg.sup_pasto_m2))
                if not r.num_modulos:
                    raise ValueError(r.motivo)
                num_mods = r.num_modulos
            nombre = cfg.nombre_cliente or "Propuesta GyC"

            metricas = _metricas_nidal(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                num_mods, cfg.gallinas, cfg.sistema,
                ancho_alero_m=cfg.ancho_alero_m,
                slot_sup_m=cfg.slot_izq_m, slot_inf_m=cfg.slot_der_m,
                paso_izq_m=cfg.paso_izq_m, paso_der_m=cfg.paso_der_m,
                equipamiento=cfg.equipamiento, sup_pasto_m2=cfg.sup_pasto_m2,
                local_dentro=cfg.local_dentro, libre_fondo_m=cfg.libre_fondo_m,
            )
            ext_m = 0.0 if cfg.local_dentro else _E.NIDAL_EQUIP
            dh = _alto_dibujo(ext_m + cfg.largo_nave_m, cfg.ancho_nave_m + (cfg.ancho_alero_m or 0.0), dw, dh)
            parts = _build_nidal_distribucion_svg(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                num_mods, nombre, cfg.gallinas, dw, dh,
                ancho_alero_m=cfg.ancho_alero_m,
                slot_sup_m=cfg.slot_izq_m, slot_inf_m=cfg.slot_der_m,
                geometria=metricas.geometria_nidal, local_dentro=cfg.local_dentro,
            )
            parts += _footer("nidal_colectivo", nombre, num_mods, cfg.gallinas or metricas.gallinas_max,
                              hoja="1 DE 1", y0=PAD_T + dh)
            return LayoutConfigResponse(svg=_wrap_svg(parts, PAD_T + dh + PAD_B), metricas=metricas)

        # ── Aviario ────────────────────────────────────────────────────
        clearance_lat = cfg.clearance_lateral_m
        # Por módulos el estudio reparte el total en filas; por filas, el óptimo o lo pedido
        nf, mpf = (0, 0) if cfg.num_modulos else _optimal_aviario(
            cfg.ancho_nave_m, cfg.largo_nave_m,
            cfg.clearance_pared_m, cfg.pasillo_m, clearance_lat,
            cfg.num_filas, cfg.mods_por_fila, cfg.clearance_fondo_m,
        )
        # Las métricas salen del mismo estudio que el informe y fijan las filas que se dibujan
        metricas = _metricas_aviario(
            cfg.ancho_nave_m, cfg.largo_nave_m,
            nf, mpf,
            cfg.clearance_pared_m, cfg.pasillo_m, clearance_lat,
            cfg.gallinas, cfg.sistema, cfg.niveles,
            ancho_alero_m=cfg.ancho_alero_m, clearance_fondo=cfg.clearance_fondo_m,
            equipamiento=cfg.equipamiento, sup_pasto_m2=cfg.sup_pasto_m2,
            num_modulos=cfg.num_modulos,
        )
        dh = _alto_dibujo(cfg.largo_nave_m, cfg.ancho_nave_m + (cfg.ancho_alero_m or 0.0), dw, dh)
        parts = []
        parts += _build_aviario_svg(
            cfg.ancho_nave_m, cfg.largo_nave_m,
            metricas.num_filas, metricas.mods_por_fila,
            cfg.clearance_pared_m, cfg.pasillo_m, clearance_lat,
            cfg.nombre_cliente or "Propuesta GyC",
            cfg.gallinas, metricas.total_modulos,
            dw, dh,
            ancho_alero_m=cfg.ancho_alero_m, clearance_fondo=cfg.clearance_fondo_m,
            filas_modulos=metricas.filas_modulos,
        )
        parts += _footer("aviario", cfg.nombre_cliente or "Propuesta GyC",
                         metricas.total_modulos, cfg.gallinas, hoja="1 DE 1", y0=PAD_T + dh)
        return LayoutConfigResponse(svg=_wrap_svg(parts, PAD_T + dh + PAD_B), metricas=metricas)

    except Exception as exc:
        logging.error(f"[plano_agent] generar_desde_config: {exc}")
        return LayoutConfigResponse(
            svg="", error=str(exc),
            metricas=MetricasPlano(
                num_filas=0, mods_por_fila=0, total_modulos=0, gallinas_max=0,
                huella_m2=0, yacija_m2=0, densidad=0, espacio_libre_y_m=0,
                clearance_pared_m=0, pasillo_m=0, clearance_lateral_m=0,
            ),
        )

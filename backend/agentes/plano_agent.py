"""
Generador de planos SVG — distribución en planta.

Hoja 1: Layout de distribución (nave, módulos, zonas, cotas)
Hoja 2: Posicionamiento de cableado eléctrico

Replica el estilo del plano real de Gómez y Crespo (ref. NELLY MARIBEL RUIZ VERA):
nave negra, módulos en rojo, módulo tensor amarillo, cotas, bloque de título.
"""
from __future__ import annotations

import logging
import math
from typing import Optional

from pydantic import BaseModel


# ── Constantes — Aviario ───────────────────────────────────────────────────────
_AVI_ANCHO_MOD   = 1.20   # m eje largo nave (X)
_AVI_PROF_MOD    = 3.30   # m eje ancho nave (Y)
_AVI_CLEAR_PARED = 0.85   # m margen superior/inferior
_AVI_PASILLO     = 1.20   # m pasillo entre filas
_AVI_CLEAR_LAT   = 4.00   # m zona equipos lateral
_FOSA_ANCHO      = 1.50   # m fosa purín

# ── Constantes — Nidal A-Nida ─────────────────────────────────────────────────
_NIDAL_ANCHO_MOD = 1.20   # m ancho por módulo (X)
_NIDAL_PROF_MOD  = 1.40   # m profundidad cuerpo (Y)
_NIDAL_MOD_SLOT  = 3.00   # m profundidad slot cada lado (Y)
_NIDAL_EQUIP_IZQ = 4.00   # m zona equipo izquierda (mesa recogida + motoreductor)
_NIDAL_TENSOR_W  = 3.00   # m módulo tensor (X)
_NIDAL_SLAT_W    = 0.60   # m ancho slat (X)
_NIDAL_SLAT_D    = 1.00   # m profundidad slat (Y)

# ── Viewport SVG ──────────────────────────────────────────────────────────────
SVG_W  = 1100
SVG_H  = 720
PAD_L  = 90
PAD_T  = 60
PAD_R  = 40
PAD_B  = 130


# ── Modelos Pydantic ──────────────────────────────────────────────────────────

class FilaPlano(BaseModel):
    num_modulos: int
    slot_izq: float
    slot_der: float
    pegada_pared_izq: bool = False
    pegada_pared_der: bool = False


class PlanoRequest(BaseModel):
    ancho_nave_m: float
    largo_nave_m: float
    filas: list[FilaPlano]
    tipo_zona: str
    gallinas: int
    sistema: str
    nombre_cliente: Optional[str] = None
    total_modulos: int = 0
    yacija_interior_m2: float = 0.0
    ancho_alero_m: float = 0.0


class PlanoResponse(BaseModel):
    svg: str
    error: Optional[str] = None


class LayoutConfig(BaseModel):
    ancho_nave_m: float
    largo_nave_m: float
    tipo_zona: str = "aviario"
    sistema: str = "suelo"
    num_filas: int = 0
    mods_por_fila: int = 0
    clearance_pared_m: float = _AVI_CLEAR_PARED
    pasillo_m: float = _AVI_PASILLO
    clearance_lateral_m: float = _AVI_CLEAR_LAT
    nombre_cliente: Optional[str] = None
    gallinas: int = 0
    niveles: int = 2
    ancho_alero_m: float = 0.0


class MetricasPlano(BaseModel):
    num_filas: int
    mods_por_fila: int
    total_modulos: int
    gallinas_max: int
    huella_m2: float
    yacija_m2: float
    densidad: float
    espacio_libre_y_m: float
    clearance_pared_m: float
    pasillo_m: float
    clearance_lateral_m: float


class LayoutConfigResponse(BaseModel):
    svg: str
    svg_cableado: Optional[str] = None   # Hoja 2: posiciones de cableado
    metricas: MetricasPlano
    error: Optional[str] = None


# ── Helpers SVG ────────────────────────────────────────────────────────────────

def _e(v: float, d: int = 1) -> str:
    return f"{v:.{d}f}"


def _rect(x, y, w, h, fill="none", stroke="#000823", sw=1.5, rx=0, opacity=1.0, extra="") -> str:
    op = f' fill-opacity="{opacity}"' if opacity < 1 else ""
    return (
        f'<rect x="{_e(x)}" y="{_e(y)}" width="{_e(w)}" height="{_e(h)}" '
        f'fill="{fill}"{op} stroke="{stroke}" stroke-width="{sw}"'
        + (f' rx="{rx}"' if rx else "")
        + (f" {extra}" if extra else "")
        + "/>"
    )


def _line(x1, y1, x2, y2, stroke="#484e62", sw=0.8, dash="") -> str:
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<line x1="{_e(x1)}" y1="{_e(y1)}" x2="{_e(x2)}" y2="{_e(y2)}" '
        f'stroke="{stroke}" stroke-width="{sw}"{d}/>'
    )


def _text(x, y, content, size=9, anchor="middle", fill="#484e62", bold=False, extra="") -> str:
    fw = "bold" if bold else "normal"
    return (
        f'<text x="{_e(x)}" y="{_e(y)}" font-family="monospace" font-size="{size}" '
        f'font-weight="{fw}" text-anchor="{anchor}" fill="{fill}"'
        + (f" {extra}" if extra else "")
        + f">{content}</text>"
    )


def _arrow_h(x1, x2, y, label) -> list[str]:
    arr = 5
    out = [_line(x1, y, x2, y, stroke="#888", sw=0.7)]
    for xp, sign in ((x1, 1), (x2, -1)):
        out.append(_line(xp, y, xp + sign * arr, y - 3, stroke="#888", sw=0.7))
        out.append(_line(xp, y, xp + sign * arr, y + 3, stroke="#888", sw=0.7))
    out.append(_text((x1 + x2) / 2, y - 4, label, size=8, fill="#555"))
    return out


def _arrow_v(x, y1, y2, label) -> list[str]:
    arr = 5
    out = [_line(x, y1, x, y2, stroke="#888", sw=0.7)]
    for yp, sign in ((y1, 1), (y2, -1)):
        out.append(_line(x, yp, x - 3, yp + sign * arr, stroke="#888", sw=0.7))
        out.append(_line(x, yp, x + 3, yp + sign * arr, stroke="#888", sw=0.7))
    out.append(_text(x - 7, (y1 + y2) / 2 + 3, label, size=8, anchor="end", fill="#555"))
    return out


# ── Generador NIDAL — Hoja 1: distribución ───────────────────────────────────

def _build_nidal_distribucion_svg(
    ancho_nave: float,
    largo_nave: float,
    num_modulos: int,
    nombre_cliente: str,
    gallinas: int,
    dw: float,
    dh: float,
) -> list[str]:
    """
    Plano en planta del nidal A-Nida (Hoja 1 de 2).
    Replicates the Gómez y Crespo reference plan:
      - Left zone: mesa recogida huevo + motoreductor (4 m)
      - Main nidal: num_modulos × 1.2 m, with slat grid (0.6×1.0 m cells)
      - Cuerpo central: 1.4 m with sinfín belt bar
      - Tensor module: 3 m (yellow)
      - Yacija bands: remaining nave width above and below
    """
    sx = dw / largo_nave
    sy = dh / ancho_nave
    els: list[str] = []

    # ── Y-axis geometry ────────────────────────────────────────────────
    total_nidal_y = _NIDAL_MOD_SLOT * 2 + _NIDAL_PROF_MOD   # 7.4 m
    y_margin      = max(0.0, (ancho_nave - total_nidal_y) / 2)
    y_slot_top    = y_margin
    y_cuerpo      = y_margin + _NIDAL_MOD_SLOT
    y_slot_bot    = y_cuerpo + _NIDAL_PROF_MOD
    y_nidal_end   = y_slot_bot + _NIDAL_MOD_SLOT

    # ── X-axis geometry ────────────────────────────────────────────────
    x_nidal_start = _NIDAL_EQUIP_IZQ
    x_nidal_end   = x_nidal_start + num_modulos * _NIDAL_ANCHO_MOD
    x_tensor_end  = min(x_nidal_end + _NIDAL_TENSOR_W, largo_nave)

    def px(xm: float) -> float: return PAD_L + xm * sx
    def py(ym: float) -> float: return PAD_T + ym * sy

    # ── Nave ──────────────────────────────────────────────────────────
    els.append(_rect(PAD_L, PAD_T, dw, dh, fill="#fafafa", stroke="#000823", sw=2.5))

    # ── Yacija bands (top and bottom) ─────────────────────────────────
    if y_margin > 0.05:
        for y0 in (0.0, y_nidal_end):
            els.append(_rect(PAD_L, py(y0), dw, y_margin * sy,
                             fill="#e8ede8", stroke="#4f764d", sw=0.8))
            els.append(_text(PAD_L + dw / 2, py(y0 + y_margin / 2) + 4,
                             f"YACIJA  {y_margin:.2f} m", size=9, fill="#234926"))

    # ── Slot background (top and bottom of nidal body) ─────────────────
    slat_px0 = px(x_nidal_start)
    slat_pw  = (x_nidal_end - x_nidal_start) * sx
    for y0 in (y_slot_top, y_slot_bot):
        els.append(_rect(slat_px0, py(y0), slat_pw, _NIDAL_MOD_SLOT * sy,
                         fill="#fff8f8", stroke="#cc2200", sw=1.0))

    # ── Slat grid (0.6 m × 1.0 m cells) in slot areas ────────────────
    # Vertical module boundary lines
    for j in range(num_modulos + 1):
        lx = px(x_nidal_start + j * _NIDAL_ANCHO_MOD)
        for y0 in (y_slot_top, y_slot_bot):
            els.append(_line(lx, py(y0), lx, py(y0 + _NIDAL_MOD_SLOT),
                             stroke="#cc2200", sw=1.5))
    # Vertical mid-module lines (slat sub-division at 0.6 m)
    for j in range(num_modulos):
        lx = px(x_nidal_start + (j + 0.5) * _NIDAL_ANCHO_MOD)
        for y0 in (y_slot_top, y_slot_bot):
            els.append(_line(lx, py(y0), lx, py(y0 + _NIDAL_MOD_SLOT),
                             stroke="#cc2200", sw=0.5))
    # Horizontal slat row lines (every 1.0 m within each slot)
    n_rows = int(_NIDAL_MOD_SLOT / _NIDAL_SLAT_D)   # 3 rows per slot
    for r in range(1, n_rows):
        for y0 in (y_slot_top, y_slot_bot):
            ly = py(y0 + r * _NIDAL_SLAT_D)
            els.append(_line(slat_px0, ly, slat_px0 + slat_pw, ly,
                             stroke="#cc2200", sw=0.5))

    # ── Cuerpo nidal (central 1.4 m strip) ────────────────────────────
    cx0 = slat_px0
    cy0 = py(y_cuerpo)
    cw  = slat_pw
    ch  = _NIDAL_PROF_MOD * sy
    els.append(_rect(cx0, cy0, cw, ch, fill="#ffecec", stroke="#cc2200", sw=1.8))

    # Sinfín belt (solid red bar along center)
    belt_h = max(4.0, ch * 0.30)
    els.append(_rect(cx0, cy0 + ch / 2 - belt_h / 2, cw, belt_h,
                     fill="#cc2200", stroke="none", sw=0))

    # Vertical module separations on cuerpo
    for j in range(1, num_modulos):
        lx = px(x_nidal_start + j * _NIDAL_ANCHO_MOD)
        els.append(_line(lx, cy0, lx, cy0 + ch, stroke="#cc2200", sw=0.6))

    # ── Left equipment zone (mesa recogida huevo + motoreductor) ───────
    eq_x0 = PAD_L
    eq_y0 = cy0
    eq_w  = _NIDAL_EQUIP_IZQ * sx
    eq_h  = ch
    els.append(_rect(eq_x0, eq_y0, eq_w, eq_h, fill="white", stroke="#000823", sw=1.5))

    # Belt connection from mesa to cuerpo (red bar at same height as sinfín)
    els.append(_rect(eq_x0, cy0 + ch / 2 - belt_h / 2, eq_w * 0.58, belt_h,
                     fill="#cc2200", stroke="none", sw=0))

    # Mesa recogida huevo symbol (box with X cross)
    mx = eq_x0 + eq_w * 0.72
    my = cy0 + ch * 0.50
    sz = min(eq_w, ch) * 0.28
    els.append(_rect(mx - sz, my - sz, sz * 2, sz * 2,
                     fill="white", stroke="#000823", sw=1.2))
    els.append(_line(mx - sz, my - sz, mx + sz, my + sz, stroke="#000823", sw=1.2))
    els.append(_line(mx + sz, my - sz, mx - sz, my + sz, stroke="#000823", sw=1.2))

    # Equipment zone labels
    lx_lbl = eq_x0 + eq_w * 0.28
    els.append(_text(lx_lbl, cy0 + max(10, ch * 0.20), "Mesa", size=7, fill="#333"))
    els.append(_text(lx_lbl, cy0 + max(20, ch * 0.40), "recogida", size=7, fill="#333"))
    els.append(_text(lx_lbl, cy0 + max(30, ch * 0.60), "huevo", size=7, fill="#333"))
    els.append(_text(mx, cy0 + ch - 6, "Motoreductor", size=7, fill="#333"))

    # ── Módulo tensor (yellow) ─────────────────────────────────────────
    t_x0 = px(x_nidal_end)
    t_y0 = cy0
    t_w  = (x_tensor_end - x_nidal_end) * sx
    t_h  = ch
    els.append(_rect(t_x0, t_y0, t_w, t_h, fill="#ffc000", stroke="#b08000", sw=1.5))
    els.append(_text(t_x0 + t_w / 2, t_y0 + t_h / 2 - 4, "Módulo", size=8, fill="#5a3000"))
    els.append(_text(t_x0 + t_w / 2, t_y0 + t_h / 2 + 9, "tensor", size=8, fill="#5a3000"))

    # Tensor también en slot areas (extends to both slots)
    for y0 in (y_slot_top, y_slot_bot):
        els.append(_rect(t_x0, py(y0), t_w, _NIDAL_MOD_SLOT * sy,
                         fill="#fff0c0", stroke="#b08000", sw=0.8))

    # ── Cotas (dimensions) ────────────────────────────────────────────
    # Nave length
    els += _arrow_h(PAD_L, PAD_L + dw, PAD_T - 38, f"{largo_nave:.0f} m")
    # Equip zone
    els += _arrow_h(PAD_L, px(x_nidal_start), PAD_T - 22, f"{_NIDAL_EQUIP_IZQ:.0f} m")
    # Module span
    els += _arrow_h(px(x_nidal_start), px(x_nidal_end), PAD_T - 22,
                    f"{num_modulos * _NIDAL_ANCHO_MOD:.1f} m")
    # Tensor
    if x_tensor_end > x_nidal_end + 0.1:
        els += _arrow_h(px(x_nidal_end), px(x_tensor_end), PAD_T - 22,
                        f"{_NIDAL_TENSOR_W:.0f} m")
    # One module width (small label on cuerpo)
    if num_modulos >= 1:
        els += _arrow_h(px(x_nidal_start),
                        px(x_nidal_start + _NIDAL_ANCHO_MOD),
                        cy0 - 6, f"{_NIDAL_ANCHO_MOD:.1f}")

    # Nave width
    els += _arrow_v(PAD_L - 42, PAD_T, PAD_T + dh, f"{ancho_nave:.0f} m")
    # Yacija margin
    if y_margin > 0.05:
        els += _arrow_v(PAD_L - 26, PAD_T, py(y_slot_top), f"{y_margin:.2f} m")
    # Top slot
    els += _arrow_v(PAD_L - 26, py(y_slot_top), py(y_cuerpo), f"{_NIDAL_MOD_SLOT:.0f} m")
    # Cuerpo
    els += _arrow_v(PAD_L - 26, py(y_cuerpo), py(y_slot_bot),
                    f"{_NIDAL_PROF_MOD:.2f} m")
    # Bottom slot
    els += _arrow_v(PAD_L - 26, py(y_slot_bot), py(y_nidal_end), f"{_NIDAL_MOD_SLOT:.0f} m")

    # Right-side tensor height tick
    rx_t = px(x_tensor_end) + 8 if x_tensor_end < largo_nave else PAD_L + dw + 8
    els += _arrow_v(rx_t, py(y_cuerpo), py(y_slot_bot), f"{_NIDAL_PROF_MOD:.2f}")

    # Tick extensions
    for xp in (PAD_L, PAD_L + dw):
        els.append(_line(xp, PAD_T - 50, xp, PAD_T, stroke="#aaa", sw=0.5, dash="3,2"))
    for yp in (PAD_T, PAD_T + dh):
        els.append(_line(PAD_L - 50, yp, PAD_L, yp, stroke="#aaa", sw=0.5, dash="3,2"))

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

    total_nidal_y = _NIDAL_MOD_SLOT * 2 + _NIDAL_PROF_MOD
    y_margin      = max(0.0, (ancho_nave - total_nidal_y) / 2)
    y_cuerpo      = y_margin + _NIDAL_MOD_SLOT
    y_slot_bot    = y_cuerpo + _NIDAL_PROF_MOD

    x_nidal_start = _NIDAL_EQUIP_IZQ
    x_nidal_end   = x_nidal_start + num_modulos * _NIDAL_ANCHO_MOD

    def px(xm: float) -> float: return PAD_L + xm * sx
    def py(ym: float) -> float: return PAD_T + ym * sy

    ch   = _NIDAL_PROF_MOD * sy
    cy0  = py(y_cuerpo)
    belt_h = max(4.0, ch * 0.30)

    # ── Base plan (ghosted) ────────────────────────────────────────────
    els = _build_nidal_distribucion_svg(
        ancho_nave, largo_nave, num_modulos, nombre_cliente, 0, dw, dh
    )

    # ── Cuadro de control (left of exit, 1.2–1.5 m height) ────────────
    # Positioned on left wall, at cuerpo level
    ctrl_w = _NIDAL_EQUIP_IZQ * sx * 0.30
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
    x_elev = _NIDAL_EQUIP_IZQ + 5.40
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
    mx_r = PAD_L + _NIDAL_EQUIP_IZQ * sx * 0.70
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
) -> list[str]:
    sx = dw / largo_nave
    sy = dh / ancho_nave
    els: list[str] = []

    fosa_w  = min(_FOSA_ANCHO, clearance_lat - 0.5) * sx
    zw      = clearance_lat * sx
    x_der   = PAD_L + dw - zw
    w_rasc  = zw - fosa_w
    x_fosa  = PAD_L + dw - fosa_w

    els.append(_rect(PAD_L, PAD_T, dw, dh, fill="#fafafa", stroke="#000823", sw=2.5))
    els.append(_rect(PAD_L, PAD_T, zw, dh, fill="#fff8e0", stroke="#c8a000", sw=0.8, opacity=0.7))
    els.append(_rect(x_der, PAD_T, w_rasc, dh, fill="#f0e8ff", stroke="#7040c0", sw=0.8, opacity=0.7))

    els.append(_rect(x_fosa, PAD_T, fosa_w, dh, fill="#e8d8c0", stroke="#7a5020", sw=1.5))
    step = 14
    for k in range(-int(dh / step) - 1, int(fosa_w / step) + 2):
        ox = x_fosa + k * step
        els.append(_line(ox, PAD_T, ox + dh, PAD_T + dh, stroke="#b89060", sw=0.5))
    cx_fosa = x_fosa + fosa_w / 2
    cy_mid  = PAD_T + dh / 2
    fosa_m  = min(_FOSA_ANCHO, clearance_lat - 0.5)
    els.append(f'<text x="{_e(cx_fosa)}" y="{_e(cy_mid + 28)}" font-family="monospace" font-size="8" '
               f'font-weight="bold" text-anchor="middle" fill="#5a3010" '
               f'transform="rotate(-90,{_e(cx_fosa)},{_e(cy_mid)})">'
               f'FOSA DE PURÍN</text>')
    els.append(f'<text x="{_e(cx_fosa)}" y="{_e(cy_mid - 16)}" font-family="monospace" font-size="7" '
               f'font-weight="normal" text-anchor="middle" fill="#5a3010" '
               f'transform="rotate(-90,{_e(cx_fosa)},{_e(cy_mid)})">'
               f'{fosa_m:.1f} m</text>')

    for i in range(num_filas):
        y_m = clearance_pared + i * (_AVI_PROF_MOD + pasillo)
        ry  = PAD_T + y_m * sy
        rh  = _AVI_PROF_MOD * sy
        els.append(_rect(PAD_L, ry, zw, rh, fill="#ffecec", stroke="#cc2200", sw=1.2))
        els.append(_text(PAD_L + zw / 2, ry + rh / 2 + 4,
                         "NORIA · COMIDA", size=7, fill="#880000"))
        els.append(_rect(x_der, ry, w_rasc, rh, fill="#ffecec", stroke="#cc2200", sw=1.2))
        els.append(_text(x_der + w_rasc / 2, ry + rh / 2 + 4,
                         "RASCADOR", size=7, fill="#880000"))

    y_lbl = PAD_T + clearance_pared * sy / 2 + 3
    els.append(_text(PAD_L + zw / 2, y_lbl,
                     f"← {clearance_lat:.1f} m EQUIPO", size=7, fill="#806000", bold=True))
    els.append(_text(x_der + w_rasc / 2, y_lbl,
                     f"EQUIPO {clearance_lat:.1f} m →", size=7, fill="#4a1090", bold=True))

    for i in range(num_filas):
        y_m = clearance_pared + i * (_AVI_PROF_MOD + pasillo)
        rx  = PAD_L + clearance_lat * sx
        ry  = PAD_T + y_m * sy
        rw  = mods_por_fila * _AVI_ANCHO_MOD * sx
        rh  = _AVI_PROF_MOD * sy
        els.append(_rect(rx, ry, rw, rh, fill="#ffecec", stroke="#cc2200", sw=1.8, opacity=0.95))
        for j in range(1, mods_por_fila):
            lx = rx + j * _AVI_ANCHO_MOD * sx
            els.append(_line(lx, ry, lx, ry + rh, stroke="#cc2200", sw=0.6))
        els.append(_text(
            rx + rw / 2, ry + rh / 2 + 4,
            f"FILA {i+1}  ·  {mods_por_fila} módulos  ·  {mods_por_fila * _AVI_ANCHO_MOD:.2f} m",
            size=8, fill="#880000",
        ))
        cx_cota = PAD_L + dw + 20
        els += _arrow_v(cx_cota, ry, ry + rh, f"{_AVI_PROF_MOD:.2f} m")

    for i in range(num_filas - 1):
        y_top = clearance_pared + (i + 1) * _AVI_PROF_MOD + i * pasillo
        ry    = PAD_T + y_top * sy
        rh_p  = pasillo * sy
        rx    = PAD_L + clearance_lat * sx
        rw    = mods_por_fila * _AVI_ANCHO_MOD * sx
        els.append(_rect(rx, ry, rw, rh_p,
                         fill="#f0ece0", stroke="#bbb", sw=0.5, opacity=0.7))
        els.append(_text(rx + rw / 2, ry + rh_p / 2 + 3,
                         f"PASILLO  {pasillo:.2f} m", size=7, fill="#888"))

    rx0 = PAD_L + clearance_lat * sx
    rx1 = rx0 + mods_por_fila * _AVI_ANCHO_MOD * sx
    els += _arrow_h(rx0, rx1, PAD_T - 22,
                    f"{mods_por_fila * _AVI_ANCHO_MOD:.2f} m  ({mods_por_fila} × {_AVI_ANCHO_MOD} m)")
    if clearance_lat > 0:
        els += _arrow_h(PAD_L, rx0, PAD_T - 22, f"{clearance_lat:.2f} m")
    els += _arrow_h(PAD_L, PAD_L + dw, PAD_T - 38, f"{largo_nave:.0f} m")
    els += _arrow_v(PAD_L - 42, PAD_T, PAD_T + dh, f"{ancho_nave:.0f} m")
    if clearance_pared > 0:
        els += _arrow_v(PAD_L - 26, PAD_T, PAD_T + clearance_pared * sy,
                        f"{clearance_pared:.2f} m")

    for xp in (PAD_L, PAD_L + dw):
        els.append(_line(xp, PAD_T - 55, xp, PAD_T, stroke="#aaa", sw=0.5, dash="3,2"))
    for yp in (PAD_T, PAD_T + dh):
        els.append(_line(PAD_L - 50, yp, PAD_L, yp, stroke="#aaa", sw=0.5, dash="3,2"))

    return els


# ── Leyenda + bloque de título ─────────────────────────────────────────────────

def _footer(
    req_tipo: str,
    nombre_cliente: str,
    total_modulos: int,
    gallinas: int,
    hoja: str = "1 DE 2",
) -> list[str]:
    els: list[str] = []
    y_leg = PAD_T + (SVG_H - PAD_T - PAD_B) + 18

    if req_tipo == "aviario":
        items = [("#ffecec", "#cc2200", "Módulo aviario")]
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

    bx = SVG_W - PAD_R - 250
    by = y_leg - 8
    bw, bh = 250, 62
    els.append(_rect(bx, by, bw, bh, fill="#f5f5f5", stroke="#000823", sw=1.0))
    els.append(_line(bx, by + 21, bx + bw, by + 21, sw=0.6, stroke="#000823"))
    els.append(_line(bx, by + 42, bx + bw, by + 42, sw=0.6, stroke="#000823"))
    producto = "Aviario Industrial" if req_tipo == "aviario" else "A-Nida Plus"
    els.append(_text(bx + bw / 2, by + 15, "GÓMEZ Y CRESPO", size=9, bold=True, fill="#000823"))
    els.append(_text(bx + bw / 2, by + 33, producto, size=8, fill="#234926"))
    els.append(_text(bx + bw / 2, by + 56,
                     f"{nombre_cliente}  ·  {total_modulos} mód.  ·  {gallinas:,} aves",
                     size=7, fill="#484e62"))
    els.append(_text(bx + bw - 4, by + 15, "ESC 1:50", size=7, anchor="end", fill="#888"))
    els.append(_text(bx + bw - 4, by + 28, f"HOJA {hoja}", size=7, anchor="end", fill="#888"))

    nx, ny = PAD_L + 22, y_leg + 22
    els.append(_line(nx, ny + 14, nx, ny, stroke="#000823", sw=1.3))
    els.append(f'<polygon points="{_e(nx)},{_e(ny)} {_e(nx-4)},{_e(ny+8)} {_e(nx+4)},{_e(ny+8)}" fill="#000823"/>')
    els.append(_text(nx, ny - 5, "N", size=9, bold=True, fill="#000823"))

    return els


def _wrap_svg(parts: list[str]) -> str:
    inner = "\n  ".join(parts)
    return (
        f'<svg viewBox="0 0 {SVG_W} {SVG_H}" width="{SVG_W}" height="{SVG_H}" xmlns="http://www.w3.org/2000/svg" '
        f'style="font-family:monospace;background:#fff">\n  '
        f'{inner}\n</svg>'
    )


# ── Cálculo layout óptimo aviario ─────────────────────────────────────────────

def _optimal_aviario(
    ancho: float, largo: float,
    clearance_pared: float, pasillo: float, clearance_lat: float,
    num_filas_override: int = 0,
    mods_override: int = 0,
) -> tuple[int, int]:
    available_y = ancho - 2 * clearance_pared
    if available_y <= 0:
        available_y = ancho
    calc_filas = max(1, math.floor((available_y + pasillo) / (_AVI_PROF_MOD + pasillo)))
    while calc_filas > 1:
        if calc_filas * _AVI_PROF_MOD + (calc_filas - 1) * pasillo <= available_y:
            break
        calc_filas -= 1
    num_filas = num_filas_override if num_filas_override > 0 else calc_filas
    calc_mods = max(1, math.floor((largo - 2 * clearance_lat) / _AVI_ANCHO_MOD))
    mods_por_fila = mods_override if mods_override > 0 else calc_mods
    return num_filas, mods_por_fila


def _metricas_aviario(
    ancho: float, largo: float,
    num_filas: int, mods_por_fila: int,
    clearance_pared: float, pasillo: float, clearance_lat: float,
    gallinas_override: int,
    sistema: str = "suelo",
    niveles: int = 2,
) -> MetricasPlano:
    total   = num_filas * mods_por_fila
    huella  = total * _AVI_ANCHO_MOD * _AVI_PROF_MOD
    nave_m2 = ancho * largo
    yacija  = nave_m2 - huella

    densidad_max     = 6.0 if sistema == "ecologico" else 9.0
    sup_disp_por_mod = 16.194 if niveles == 3 else 13.180
    sup_disp         = total * sup_disp_por_mod
    gal_max          = min(144 * total, int(densidad_max * sup_disp)) if total > 0 else 0

    aves_proyecto = gallinas_override if gallinas_override > 0 else gal_max
    densidad      = aves_proyecto / sup_disp if sup_disp > 0 else 0.0

    used_y  = 2 * clearance_pared + num_filas * _AVI_PROF_MOD + (num_filas - 1) * pasillo
    libre_y = max(0.0, ancho - used_y)
    return MetricasPlano(
        num_filas=num_filas,
        mods_por_fila=mods_por_fila,
        total_modulos=total,
        gallinas_max=gal_max,
        huella_m2=round(huella, 2),
        yacija_m2=round(yacija, 2),
        densidad=round(densidad, 2),
        espacio_libre_y_m=round(libre_y, 2),
        clearance_pared_m=clearance_pared,
        pasillo_m=pasillo,
        clearance_lateral_m=clearance_lat,
    )


def _metricas_nidal(
    ancho: float, largo: float,
    num_modulos: int,
    gallinas: int,
    sistema: str = "suelo",
) -> MetricasPlano:
    huella     = num_modulos * _NIDAL_ANCHO_MOD * _NIDAL_PROF_MOD   # cuerpo only
    sup_slot   = num_modulos * _NIDAL_ANCHO_MOD * _NIDAL_MOD_SLOT * 2
    nave_m2    = ancho * largo
    yacija     = max(0.0, nave_m2 - huella - sup_slot)
    sup_efect  = nave_m2 - huella
    densidad   = gallinas / sup_efect if sup_efect > 0 and gallinas > 0 else 0.0
    gal_max    = num_modulos * 144
    return MetricasPlano(
        num_filas=1,
        mods_por_fila=num_modulos,
        total_modulos=num_modulos,
        gallinas_max=gal_max,
        huella_m2=round(huella, 2),
        yacija_m2=round(yacija, 2),
        densidad=round(densidad, 2),
        espacio_libre_y_m=0.0,
        clearance_pared_m=0.0,
        pasillo_m=0.0,
        clearance_lateral_m=0.0,
    )


# ── API principal: desde LayoutConfig ─────────────────────────────────────────

def generar_desde_config(cfg: LayoutConfig) -> LayoutConfigResponse:
    try:
        dw = SVG_W - PAD_L - PAD_R
        dh = SVG_H - PAD_T - PAD_B

        # ── Nidal colectivo ────────────────────────────────────────────
        if cfg.tipo_zona == "nidal_colectivo":
            num_mods = cfg.mods_por_fila if cfg.mods_por_fila > 0 else (
                math.ceil(cfg.gallinas / 144) if cfg.gallinas > 0 else 11
            )
            nombre = cfg.nombre_cliente or "Propuesta GyC"

            # Hoja 1: layout
            parts: list[str] = ['<rect width="1100" height="720" fill="#ffffff"/>']
            parts += _build_nidal_distribucion_svg(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                num_mods, nombre, cfg.gallinas, dw, dh,
            )
            parts += _footer("nidal_colectivo", nombre, num_mods, cfg.gallinas,
                              hoja="1 DE 2")

            # Hoja 2: cableado
            parts2: list[str] = ['<rect width="1100" height="720" fill="#ffffff"/>']
            parts2 += _build_nidal_cableado_svg(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                num_mods, nombre, dw, dh,
            )
            parts2 += _footer("nidal_colectivo", nombre, num_mods, cfg.gallinas,
                               hoja="2 DE 2")

            metricas = _metricas_nidal(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                num_mods, cfg.gallinas, cfg.sistema,
            )
            return LayoutConfigResponse(
                svg=_wrap_svg(parts),
                svg_cableado=_wrap_svg(parts2),
                metricas=metricas,
            )

        # ── Aviario ────────────────────────────────────────────────────
        clearance_lat = max(cfg.clearance_lateral_m, _AVI_CLEAR_LAT)
        nf, mpf = _optimal_aviario(
            cfg.ancho_nave_m, cfg.largo_nave_m,
            cfg.clearance_pared_m, cfg.pasillo_m, clearance_lat,
            cfg.num_filas, cfg.mods_por_fila,
        )
        parts = ['<rect width="1100" height="720" fill="#ffffff"/>']
        parts += _build_aviario_svg(
            cfg.ancho_nave_m, cfg.largo_nave_m,
            nf, mpf,
            cfg.clearance_pared_m, cfg.pasillo_m, clearance_lat,
            cfg.nombre_cliente or "Propuesta GyC",
            cfg.gallinas, nf * mpf,
            dw, dh,
        )
        parts += _footer("aviario", cfg.nombre_cliente or "Propuesta GyC",
                         nf * mpf, cfg.gallinas, hoja="1 DE 1")
        metricas = _metricas_aviario(
            cfg.ancho_nave_m, cfg.largo_nave_m,
            nf, mpf,
            cfg.clearance_pared_m, cfg.pasillo_m, clearance_lat,
            cfg.gallinas, cfg.sistema, cfg.niveles,
        )
        return LayoutConfigResponse(svg=_wrap_svg(parts), metricas=metricas)

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


# ── API legacy: desde PlanoRequest ────────────────────────────────────────────

def generar_plano_svg(req: PlanoRequest) -> PlanoResponse:
    try:
        dw = SVG_W - PAD_L - PAD_R
        dh = SVG_H - PAD_T - PAD_B
        parts: list[str] = ['<rect width="1100" height="720" fill="#ffffff"/>']

        if req.tipo_zona == "aviario":
            if req.filas:
                nf  = len(req.filas)
                mpf = req.filas[0].num_modulos
                clp = req.filas[0].slot_izq if req.filas[0].slot_izq > 0 else _AVI_CLEAR_PARED
                pas = req.filas[0].slot_der if req.filas[0].slot_der > 0 else _AVI_PASILLO
                cll = _AVI_CLEAR_LAT
            else:
                nf, mpf = _optimal_aviario(
                    req.ancho_nave_m, req.largo_nave_m,
                    _AVI_CLEAR_PARED, _AVI_PASILLO, _AVI_CLEAR_LAT,
                )
                clp, pas, cll = _AVI_CLEAR_PARED, _AVI_PASILLO, _AVI_CLEAR_LAT
            parts += _build_aviario_svg(
                req.ancho_nave_m, req.largo_nave_m,
                nf, mpf, clp, pas, cll,
                req.nombre_cliente or "Propuesta GyC",
                req.gallinas, req.total_modulos,
                dw, dh,
            )
        else:
            num_mods = req.total_modulos or (
                math.ceil(req.gallinas / 144) if req.gallinas > 0 else 11
            )
            parts += _build_nidal_distribucion_svg(
                req.ancho_nave_m, req.largo_nave_m,
                num_mods,
                req.nombre_cliente or "Propuesta GyC",
                req.gallinas,
                dw, dh,
            )

        parts += _footer(
            req.tipo_zona,
            req.nombre_cliente or "Propuesta GyC",
            req.total_modulos, req.gallinas,
        )
        return PlanoResponse(svg=_wrap_svg(parts))

    except Exception as exc:
        logging.error(f"[plano_agent] generar_plano_svg: {exc}")
        return PlanoResponse(svg="", error=str(exc))

"""
Generador de planos SVG — distribución en planta.

Genera el SVG directamente en Python (sin LLM), replicando el estilo del
plano real de Gómez y Crespo: nave negra, módulos en rojo, cotas, título.
"""
from __future__ import annotations

import logging
import math
from typing import Optional

from pydantic import BaseModel


# ── Constantes de módulo ───────────────────────────────────────────────────────
_NIDAL_ANCHO_MOD = 1.20   # m — eje largo nave (X)
_NIDAL_PROF_MOD  = 1.40   # m — eje ancho nave (Y)

_AVI_ANCHO_MOD   = 1.20   # m — eje largo nave (X), por módulo
_AVI_PROF_MOD    = 3.30   # m — eje ancho nave (Y), huella en planta (PDF ref.)

# Defaults de layout aviario
_AVI_CLEAR_PARED = 0.85   # m — pared superior e inferior
_AVI_PASILLO     = 1.20   # m — entre filas
_AVI_CLEAR_LAT   = 0.30   # m — clearance lateral (izq/der)

# ── Viewport SVG ──────────────────────────────────────────────────────────────
SVG_W  = 1100
SVG_H  = 720
PAD_L  = 90
PAD_T  = 60
PAD_R  = 40
PAD_B  = 130


# ── Modelos Pydantic (plano legacy / desde layout_agent) ──────────────────────

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


class PlanoResponse(BaseModel):
    svg: str
    error: Optional[str] = None


# ── Modelos para el editor interactivo ────────────────────────────────────────

class LayoutConfig(BaseModel):
    ancho_nave_m: float
    largo_nave_m: float
    tipo_zona: str = "aviario"
    sistema: str = "suelo"
    # Layout params (0 = auto-optimize)
    num_filas: int = 0
    mods_por_fila: int = 0
    clearance_pared_m: float = _AVI_CLEAR_PARED
    pasillo_m: float = _AVI_PASILLO
    clearance_lateral_m: float = _AVI_CLEAR_LAT
    nombre_cliente: Optional[str] = None
    gallinas: int = 0


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
    """Cota horizontal con ticks y texto."""
    arr = 5
    out = [_line(x1, y, x2, y, stroke="#888", sw=0.7)]
    for xp, sign in ((x1, 1), (x2, -1)):
        out.append(_line(xp, y, xp + sign * arr, y - 3, stroke="#888", sw=0.7))
        out.append(_line(xp, y, xp + sign * arr, y + 3, stroke="#888", sw=0.7))
    out.append(_text((x1 + x2) / 2, y - 4, label, size=8, fill="#555"))
    return out


def _arrow_v(x, y1, y2, label) -> list[str]:
    """Cota vertical con ticks y texto."""
    arr = 5
    out = [_line(x, y1, x, y2, stroke="#888", sw=0.7)]
    for yp, sign in ((y1, 1), (y2, -1)):
        out.append(_line(x, yp, x - 3, yp + sign * arr, stroke="#888", sw=0.7))
        out.append(_line(x, yp, x + 3, yp + sign * arr, stroke="#888", sw=0.7))
    out.append(_text(x - 7, (y1 + y2) / 2 + 3, label, size=8, anchor="end", fill="#555"))
    return out


# ── Generador de plano AVIARIO (desde config de alto nivel) ───────────────────

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

    # ── Nave ──────────────────────────────────────────────────────────────────
    els.append(_rect(PAD_L, PAD_T, dw, dh, fill="#fafafa", stroke="#000823", sw=2.5))

    # ── Filas de módulos ──────────────────────────────────────────────────────
    for i in range(num_filas):
        y_m = clearance_pared + i * (_AVI_PROF_MOD + pasillo)
        rx  = PAD_L + clearance_lat * sx
        ry  = PAD_T + y_m * sy
        rw  = mods_por_fila * _AVI_ANCHO_MOD * sx
        rh  = _AVI_PROF_MOD * sy

        # Relleno de la fila
        els.append(_rect(rx, ry, rw, rh, fill="#ffecec", stroke="#cc2200", sw=1.3, opacity=0.9))

        # Divisiones internas (cada módulo = 1.20 m en X)
        for j in range(1, mods_por_fila):
            lx = rx + j * _AVI_ANCHO_MOD * sx
            els.append(_line(lx, ry, lx, ry + rh, stroke="#cc2200", sw=0.5))

        # Etiqueta de fila
        els.append(_text(
            rx + rw / 2, ry + rh / 2 + 4,
            f"FILA {i+1}  ·  {mods_por_fila} módulos  ·  {mods_por_fila * _AVI_ANCHO_MOD:.2f} m",
            size=8, fill="#880000",
        ))

        # Cota profundidad fila (derecha)
        cx = PAD_L + dw + 20
        els += _arrow_v(cx, ry, ry + rh, f"{_AVI_PROF_MOD:.2f} m")

    # ── Zonas de clearance (fondo) ────────────────────────────────────────────
    # Pasillo entre filas
    for i in range(num_filas - 1):
        y_top = clearance_pared + (i + 1) * _AVI_PROF_MOD + i * pasillo
        ry = PAD_T + y_top * sy
        rh_p = pasillo * sy
        rx  = PAD_L + clearance_lat * sx
        rw  = mods_por_fila * _AVI_ANCHO_MOD * sx
        els.append(_rect(rx, ry, rw, rh_p,
                         fill="#f0ece0", stroke="#bbb", sw=0.5, opacity=0.7))
        els.append(_text(rx + rw / 2, ry + rh_p / 2 + 3,
                         f"PASILLO  {pasillo:.2f} m", size=7, fill="#888"))

    # ── Cota largo módulos (arriba) ───────────────────────────────────────────
    rx0 = PAD_L + clearance_lat * sx
    rx1 = rx0 + mods_por_fila * _AVI_ANCHO_MOD * sx
    els += _arrow_h(rx0, rx1, PAD_T - 22,
                    f"{mods_por_fila * _AVI_ANCHO_MOD:.2f} m  ({mods_por_fila} × {_AVI_ANCHO_MOD} m)")

    # ── Cota clearance lateral (arriba, izquierda) ────────────────────────────
    if clearance_lat > 0:
        els += _arrow_h(PAD_L, rx0, PAD_T - 22, f"{clearance_lat:.2f} m")

    # ── Cota largo nave total (arriba más lejos) ──────────────────────────────
    els += _arrow_h(PAD_L, PAD_L + dw, PAD_T - 38, f"{largo_nave:.0f} m")

    # ── Cota ancho nave (izquierda) ───────────────────────────────────────────
    els += _arrow_v(PAD_L - 42, PAD_T, PAD_T + dh, f"{ancho_nave:.0f} m")

    # ── Cota clearance superior (izquierda) ───────────────────────────────────
    if clearance_pared > 0:
        els += _arrow_v(PAD_L - 26, PAD_T, PAD_T + clearance_pared * sy,
                        f"{clearance_pared:.2f} m")

    # ── Ticks de extensión de cota ────────────────────────────────────────────
    for px in (PAD_L, PAD_L + dw):
        els.append(_line(px, PAD_T - 45, px, PAD_T, stroke="#aaa", sw=0.5, dash="3,2"))
    for py in (PAD_T, PAD_T + dh):
        els.append(_line(PAD_L - 50, py, PAD_L, py, stroke="#aaa", sw=0.5, dash="3,2"))

    return els


# ── Generador de plano NIDAL (desde FilaPlano legacy) ─────────────────────────

def _build_nidal_svg(req: PlanoRequest, dw: float, dh: float) -> list[str]:
    sx = dw / req.largo_nave_m
    sy = dh / req.ancho_nave_m
    els: list[str] = []

    els.append(_rect(PAD_L, PAD_T, dw, dh, fill="#fafafa", stroke="#000823", sw=2.5))

    y_cursor = 0.0
    for idx, fila in enumerate(req.filas):
        n  = fila.num_modulos
        x0 = PAD_L
        wf = n * _NIDAL_ANCHO_MOD * sx

        if fila.slot_izq > 0:
            els.append(_rect(x0, PAD_T + y_cursor * sy, wf, fila.slot_izq * sy,
                             fill="#dce8dc", stroke="#4f764d", sw=1.0))
            els.append(_text(x0 + wf / 2,
                             PAD_T + (y_cursor + fila.slot_izq / 2) * sy + 4,
                             f"SLOT  {fila.slot_izq:.2f} m", size=8, fill="#234926"))

        y_mod = PAD_T + (y_cursor + fila.slot_izq) * sy
        for j in range(n):
            mx = x0 + j * _NIDAL_ANCHO_MOD * sx
            els.append(_rect(mx, y_mod, _NIDAL_ANCHO_MOD * sx, _NIDAL_PROF_MOD * sy,
                             fill="#000823", stroke="#000823", sw=0.8))
            if n <= 30:
                els.append(_text(mx + _NIDAL_ANCHO_MOD * sx / 2,
                                 y_mod + _NIDAL_PROF_MOD * sy / 2 + 4,
                                 str(j + 1), size=7, fill="white"))

        if fila.slot_der > 0:
            y_sd = PAD_T + (y_cursor + fila.slot_izq + _NIDAL_PROF_MOD) * sy
            els.append(_rect(x0, y_sd, wf, fila.slot_der * sy,
                             fill="#dce8dc", stroke="#4f764d", sw=1.0))
            els.append(_text(x0 + wf / 2, y_sd + fila.slot_der * sy / 2 + 4,
                             f"SLOT  {fila.slot_der:.2f} m", size=8, fill="#234926"))

        h_fila = fila.slot_izq + _NIDAL_PROF_MOD + fila.slot_der
        els += _arrow_v(PAD_L - 26, PAD_T + y_cursor * sy,
                        PAD_T + (y_cursor + h_fila) * sy, f"{h_fila:.2f} m")
        y_cursor += h_fila

    if y_cursor < req.ancho_nave_m - 0.05:
        yac = req.ancho_nave_m - y_cursor
        els.append(_rect(PAD_L, PAD_T + y_cursor * sy, dw, yac * sy,
                         fill="#e8ede8", stroke="#4f764d", sw=0.8))
        els.append(_text(PAD_L + dw / 2,
                         PAD_T + (y_cursor + yac / 2) * sy + 4,
                         f"YACIJA  {yac:.2f} m", size=9, fill="#234926"))

    els += _arrow_h(PAD_L, PAD_L + dw, PAD_T - 22, f"{req.largo_nave_m:.0f} m")
    els += _arrow_v(PAD_L - 42, PAD_T, PAD_T + dh, f"{req.ancho_nave_m:.0f} m")
    for px in (PAD_L, PAD_L + dw):
        els.append(_line(px, PAD_T - 30, px, PAD_T, stroke="#aaa", sw=0.5, dash="3,2"))
    for py in (PAD_T, PAD_T + dh):
        els.append(_line(PAD_L - 50, py, PAD_L, py, stroke="#aaa", sw=0.5, dash="3,2"))

    return els


# ── Leyenda + bloque de título ─────────────────────────────────────────────────

def _footer(req_tipo: str, nombre_cliente: str, total_modulos: int, gallinas: int) -> list[str]:
    els: list[str] = []
    y_leg = PAD_T + (SVG_H - PAD_T - PAD_B) + 18

    # Leyenda
    items = (
        [("#ffecec", "#cc2200", "Módulo aviario")]
        if req_tipo == "aviario"
        else [
            ("#000823", "#000823", "Cuerpo nidal A-Nida"),
            ("#dce8dc", "#4f764d", "Slot / rampa"),
            ("#e8ede8", "#4f764d", "Yacija"),
        ]
    )
    x = PAD_L
    for fill, stroke, label in items:
        els.append(_rect(x, y_leg, 14, 10, fill=fill, stroke=stroke, sw=1.0))
        els.append(_text(x + 18, y_leg + 9, label, size=8, anchor="start", fill="#484e62"))
        x += 160

    # Bloque título
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
    els.append(_text(bx + bw - 4, by + 15, "ESC 1:100", size=7, anchor="end", fill="#888"))

    # Flecha Norte
    nx, ny = PAD_L + 22, y_leg + 22
    els.append(_line(nx, ny + 14, nx, ny, stroke="#000823", sw=1.3))
    els.append(f'<polygon points="{_e(nx)},{_e(ny)} {_e(nx-4)},{_e(ny+8)} {_e(nx+4)},{_e(ny+8)}" fill="#000823"/>')
    els.append(_text(nx, ny - 5, "N", size=9, bold=True, fill="#000823"))

    return els


def _wrap_svg(parts: list[str]) -> str:
    inner = "\n  ".join(parts)
    return (
        f'<svg viewBox="0 0 {SVG_W} {SVG_H}" xmlns="http://www.w3.org/2000/svg" '
        f'style="font-family:monospace;background:#fff;max-width:100%">\n  '
        f'{inner}\n</svg>'
    )


# ── Cálculo del layout óptimo para aviario ────────────────────────────────────

def _optimal_aviario(
    ancho: float, largo: float,
    clearance_pared: float, pasillo: float, clearance_lat: float,
    num_filas_override: int = 0,
    mods_override: int = 0,
) -> tuple[int, int]:
    """Devuelve (num_filas, mods_por_fila) que maximizan el espacio."""
    # Filas: cuántas caben en Y
    # ancho = 2*clear + num_filas*AVI_PROF + (num_filas-1)*pasillo
    available_y = ancho - 2 * clearance_pared
    if available_y <= 0:
        available_y = ancho
    calc_filas = max(1, math.floor((available_y + pasillo) / (_AVI_PROF_MOD + pasillo)))
    # Verificar que caben
    while calc_filas > 1:
        needed = calc_filas * _AVI_PROF_MOD + (calc_filas - 1) * pasillo
        if needed <= available_y:
            break
        calc_filas -= 1
    num_filas = num_filas_override if num_filas_override > 0 else calc_filas

    # Módulos: cuántos caben en X
    available_x = largo - 2 * clearance_lat
    calc_mods = max(1, math.floor(available_x / _AVI_ANCHO_MOD))
    mods_por_fila = mods_override if mods_override > 0 else calc_mods

    return num_filas, mods_por_fila


def _metricas_aviario(
    ancho: float, largo: float,
    num_filas: int, mods_por_fila: int,
    clearance_pared: float, pasillo: float, clearance_lat: float,
    gallinas_override: int,
) -> MetricasPlano:
    total = num_filas * mods_por_fila
    # Superficie ocupada por módulos (huella en planta)
    huella = total * _AVI_ANCHO_MOD * _AVI_PROF_MOD
    # Superficie de yacija = nave - huella módulos
    nave_m2 = ancho * largo
    yacija = nave_m2 - huella
    # Gallinas: ~60 aves/módulo (2 niveles), ~90 (3 niveles) — usamos 60 por defecto
    gal_max = gallinas_override if gallinas_override > 0 else total * 60
    densidad = gal_max / nave_m2 if nave_m2 > 0 else 0
    # Espacio libre en Y
    used_y = 2 * clearance_pared + num_filas * _AVI_PROF_MOD + (num_filas - 1) * pasillo
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


# ── API principal: desde LayoutConfig ─────────────────────────────────────────

def generar_desde_config(cfg: LayoutConfig) -> LayoutConfigResponse:
    try:
        dw = SVG_W - PAD_L - PAD_R
        dh = SVG_H - PAD_T - PAD_B

        if cfg.tipo_zona == "aviario":
            nf, mpf = _optimal_aviario(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                cfg.clearance_pared_m, cfg.pasillo_m, cfg.clearance_lateral_m,
                cfg.num_filas, cfg.mods_por_fila,
            )
            parts: list[str] = ['<rect width="1100" height="720" fill="#ffffff"/>']
            parts += _build_aviario_svg(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                nf, mpf,
                cfg.clearance_pared_m, cfg.pasillo_m, cfg.clearance_lateral_m,
                cfg.nombre_cliente or "Propuesta GyC",
                cfg.gallinas, nf * mpf,
                dw, dh,
            )
            parts += _footer(
                "aviario",
                cfg.nombre_cliente or "Propuesta GyC",
                nf * mpf, cfg.gallinas,
            )
            metricas = _metricas_aviario(
                cfg.ancho_nave_m, cfg.largo_nave_m,
                nf, mpf,
                cfg.clearance_pared_m, cfg.pasillo_m, cfg.clearance_lateral_m,
                cfg.gallinas,
            )
            return LayoutConfigResponse(svg=_wrap_svg(parts), metricas=metricas)

        # Para nidal, por ahora devolvemos plano vacío (usar /plano con filas del layout_agent)
        return LayoutConfigResponse(
            svg="", error="Usa /plano para nidal_colectivo"
        )

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


# ── API legacy: desde PlanoRequest (layout_agent filas) ───────────────────────

def generar_plano_svg(req: PlanoRequest) -> PlanoResponse:
    try:
        dw = SVG_W - PAD_L - PAD_R
        dh = SVG_H - PAD_T - PAD_B

        parts: list[str] = ['<rect width="1100" height="720" fill="#ffffff"/>']

        if req.tipo_zona == "aviario":
            # Inferir layout desde las filas del layout_agent
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
            parts += _build_nidal_svg(req, dw, dh)

        parts += _footer(
            req.tipo_zona,
            req.nombre_cliente or "Propuesta GyC",
            req.total_modulos, req.gallinas,
        )
        return PlanoResponse(svg=_wrap_svg(parts))

    except Exception as exc:
        logging.error(f"[plano_agent] generar_plano_svg: {exc}")
        return PlanoResponse(svg="", error=str(exc))

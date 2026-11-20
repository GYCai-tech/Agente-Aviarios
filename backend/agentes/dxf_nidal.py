"""Exportación DXF del nidal colectivo centrado en unidades reales (metros)."""
from __future__ import annotations

from io import StringIO

import ezdxf
from ezdxf import units

import agentes.estudio as _E   # medidas del nidal según la ficha técnica vigente
from agentes.plano_agent import LayoutConfig, generar_desde_config


_LAYERS = {
    "NAVE": (7, "CONTINUOUS"),
    "NIDAL": (1, "CONTINUOUS"),
    "SLAT_IZQ": (6, "CONTINUOUS"),
    "SLAT_DER": (6, "CONTINUOUS"),
    "TENSOR": (2, "CONTINUOUS"),
    "LOCAL_PROPUESTO": (8, "DASHED"),
    "COTAS": (3, "CONTINUOUS"),
    "ROTULOS": (7, "CONTINUOUS"),
}


def _rect(msp, layer: str, x0: float, y0: float, x1: float, y1: float) -> None:
    msp.add_lwpolyline(
        [(x0, y0), (x1, y0), (x1, y1), (x0, y1)],
        close=True,
        dxfattribs={"layer": layer},
    )


def _dimension(msp, p1, p2, base, *, angle: float) -> None:
    dim = msp.add_linear_dim(
        base=base,
        p1=p1,
        p2=p2,
        angle=angle,
        dimstyle="Standard",
        override={
            "dimtxt": 0.18,
            "dimasz": 0.12,
            "dimexo": 0.04,
            "dimexe": 0.08,
            "dimdec": 2,
            "dimzin": 8,
            "dimlfac": 1,
            "dimpost": "<> m",
            "dimtad": 1,
        },
        dxfattribs={"layer": "COTAS"},
    )
    dim.render()


def generar_dxf_nidal(config: LayoutConfig) -> bytes:
    """Devuelve un plano editable en DXF; coordenadas X/Y expresadas en metros."""
    if config.tipo_zona != "nidal_colectivo":
        raise ValueError("La exportación DXF disponible corresponde al nidal colectivo centrado")

    # Reusar las validaciones y el objeto geométrico del plano SVG y del estudio.
    resultado = generar_desde_config(config)
    if resultado.error:
        raise ValueError(resultado.error)
    geo = resultado.metricas.geometria_nidal
    if geo is None:
        raise ValueError("El estudio no devolvió la geometría del nidal")

    largo, ancho = config.largo_nave_m, config.ancho_nave_m
    n = resultado.metricas.total_modulos
    # En el DXF el origen queda en la esquina interior de la nave. Con el local
    # exterior la cadena empieza en X=0 y el local ocupa de -4 a 0 m; con el
    # local dentro, el local ocupa la cabecera y la cadena empieza tras él.
    x_cadena = geo.cadena_inicio_x_m
    x_fin_cadena = x_cadena + geo.cadena_largo_m

    doc = ezdxf.new("R2010", setup=True, units=units.M)
    doc.header["$MEASUREMENT"] = 1
    doc.header["$LUNITS"] = 2
    doc.header["$LUPREC"] = 3
    doc.header["$DIMLUNIT"] = 2
    for name, (color, linetype) in _LAYERS.items():
        doc.layers.new(name, dxfattribs={"color": color, "linetype": linetype})
    msp = doc.modelspace()

    # Origen (0,0): esquina interior de la nave junto al local técnico.
    # X recorre el largo; Y es positivo hacia la pared opuesta del plano.
    _rect(msp, "NAVE", 0, 0, largo, ancho)

    # El SVG dibuja Y hacia abajo; invertimos el eje para conservar Y CAD positiva.
    def cad_rect(layer: str, x0: float, x1: float, y_top: float, depth: float) -> None:
        y0 = ancho - y_top - depth
        _rect(msp, layer, x0, y0, x1, y0 + depth)

    for i in range(n):
        x0 = x_cadena + i * _E.NIDAL_LARGO
        x1 = x0 + _E.NIDAL_LARGO
        cad_rect("SLAT_IZQ", x0, x1, geo.slat_izq_y_m, config.slot_izq_m)
        cad_rect("NIDAL", x0, x1, geo.cuerpo_y_m, _E.NIDAL_ANCHO)
        cad_rect("SLAT_DER", x0, x1, geo.slat_der_y_m, config.slot_der_m)

    # Rodillo tensor al final de la cadena, como en el SVG: diámetro igual a la
    # profundidad del cuerpo. Hasta la pared del fondo el suelo queda libre.
    radio_tensor = _E.NIDAL_ANCHO / 2
    msp.add_circle((x_fin_cadena + radio_tensor, ancho - geo.cuerpo_y_m - radio_tensor),
                   radio_tensor, dxfattribs={"layer": "TENSOR"})

    # Local técnico cuadrado que ya aparece en el plano; se identifica como
    # propuesta porque su dimensión debe cotejarse con el proyecto de obra.
    lado = _E.NIDAL_EQUIP
    cy = ancho - (geo.cuerpo_y_m + _E.NIDAL_ANCHO / 2)
    x_local = 0.0 if config.local_dentro else -lado
    if config.local_dentro:
        # Dentro de la nave el local se cierra de pared a pared
        _rect(msp, "LOCAL_PROPUESTO", x_local, 0, x_local + lado, ancho)
    else:
        _rect(msp, "LOCAL_PROPUESTO", x_local, cy - lado / 2, x_local + lado, cy + lado / 2)

    # Cotas DXF editables; valores medidos por geometría, no textos aproximados.
    _dimension(msp, (0, ancho), (largo, ancho), (largo / 2, ancho + 2.2), angle=0)
    if x_cadena > 0:
        _dimension(msp, (0, ancho), (x_cadena, ancho), (x_cadena / 2, ancho + 1.2), angle=0)
    _dimension(msp, (x_cadena, ancho), (x_fin_cadena, ancho),
               ((x_cadena + x_fin_cadena) / 2, ancho + 1.2), angle=0)
    if largo - x_fin_cadena > 0.005:
        _dimension(msp, (x_fin_cadena, ancho), (largo, ancho),
                   ((x_fin_cadena + largo) / 2, ancho + 1.2), angle=0)
    _dimension(msp, (0, 0), (0, ancho), (-2.0, ancho / 2), angle=90)

    # Desglose transversal que deja visible que el conjunto está centrado.
    perfiles = [0, ancho - geo.conjunto_fin_y_m, ancho - geo.slat_der_y_m,
                ancho - geo.cuerpo_y_m, ancho - geo.slat_izq_y_m, ancho]
    for y0, y1 in zip(perfiles, perfiles[1:]):
        if y1 - y0 > 0.005:
            _dimension(msp, (0, y0), (0, y1), (largo + 0.9, (y0 + y1) / 2), angle=90)

    aves = config.gallinas or resultado.metricas.gallinas_max
    msp.add_text(
        f"NIDAL CENTRADO | {n} MODULOS | LIMITE ESTUDIADO {aves} AVES",
        dxfattribs={"layer": "ROTULOS", "height": 0.24, "insert": (0, ancho + 3.5)},
    )
    msp.add_text(
        "ANTEPROYECTO - MEDIDAS DE NAVE SEGUN INFORME; EQUIPO PENDIENTE DE CONFIRMAR",
        dxfattribs={"layer": "ROTULOS", "height": 0.16, "insert": (0, ancho + 3.1)},
    )
    msp.add_text(
        (f"LOCAL TECNICO {lado:g}x{ancho:g} m DENTRO DE LA NAVE" if config.local_dentro
         else f"LOCAL {lado:g}x{lado:g} m PROPUESTO (ANEXO EXTERIOR)") + " | TENSOR AL FINAL DE LA CADENA",
        dxfattribs={"layer": "ROTULOS", "height": 0.15,
                    "insert": (x_local, -0.6 if config.local_dentro else cy - lado / 2 - 0.35)},
    )
    msp.add_text(
        "ORIGEN (0,0) EN ESQUINA INTERIOR | X: LARGO | Y: ANCHO | UNIDADES: METROS",
        dxfattribs={"layer": "ROTULOS", "height": 0.15, "insert": (0, -2.0)},
    )

    stream = StringIO()
    doc.write(stream)
    return stream.getvalue().encode("utf-8")

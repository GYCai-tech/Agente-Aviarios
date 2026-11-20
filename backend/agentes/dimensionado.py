"""
Dimensionado inverso: qué nave hace falta para alojar un número de gallinas.

No tiene reglas propias: cada propuesta es una nave que se estudia con
`estudiar_nave`, y se busca el largo mínimo (al decímetro) con el que el
estudio sale viable y aloja las gallinas pedidas. Así, estudiar la nave
propuesta da el mismo resultado y el plano coincide.

Las constantes de producto se leen de `agentes.estudio` en tiempo de llamada
(la ficha técnica las sobrescribe).
"""
from __future__ import annotations

import math
from typing import Literal, Optional

from pydantic import BaseModel, Field

from agentes import estudio as E

PASO_LARGO_M = 0.1      # resolución del largo propuesto
LARGO_TOPE_M = 1000.0   # por encima no se propone nave
ANCHO_EXTRA_NIDAL_M = 6.0
ANCHO_PASO_NIDAL_M = 0.5
FILAS_MAX_AVIARIO = 4


class DimensionadoRequest(BaseModel):
    tipo_zona: Literal["nidal_colectivo", "aviario"]
    sistema: E.Sistema = "suelo"
    gallinas: int = Field(gt=0)
    # Aviario: None = la altura mínima de los niveles estudiados
    altura_nave_cm: float | None = Field(default=None, gt=0)
    niveles: Literal[2, 3] | None = None
    slot_izq_m: Literal[0.0, 1.0, 2.0, 3.0] = E.NIDAL_SLOT_DEFAULT
    slot_der_m: Literal[0.0, 1.0, 2.0, 3.0] = E.NIDAL_SLOT_DEFAULT
    paso_izq_m: float = Field(default=E.NIDAL_PASO_PARED, ge=0)
    paso_der_m: float = Field(default=E.NIDAL_PASO_PARED, ge=0)
    local_dentro: bool = False
    libre_fondo_m: float | None = Field(default=None, ge=0)


class OpcionNave(BaseModel):
    titulo: str
    ancho_nave_m: float
    largo_nave_m: float
    altura_nave_cm: float
    superficie_m2: float
    niveles: int = 0
    num_modulos: int
    num_filas: int
    descripcion_layout: str
    gallinas_max: int
    gallinas_min: int
    limitante: str
    recomendada: bool = False


class DimensionadoResponse(BaseModel):
    gallinas: int
    opciones: list[OpcionNave] = []
    motivo: str = ""
    notas: list[str] = []


def _altura(req: DimensionadoRequest) -> float:
    if req.altura_nave_cm is not None:
        return req.altura_nave_cm
    if req.tipo_zona == "nidal_colectivo":
        return 300.0   # el nidal no depende de la altura
    niveles = req.niveles or (2 if req.sistema == "ecologico" else 3)
    return float(E.AVI_ALTURA_MIN[niveles])


def _estudio(req: DimensionadoRequest, ancho: float, largo: float) -> E.EstudioResponse:
    return E.estudiar_nave(E.EstudioRequest(
        tipo_zona=req.tipo_zona, sistema=req.sistema,
        ancho_nave_m=ancho, largo_nave_m=largo, altura_nave_cm=_altura(req),
        slot_izq_m=req.slot_izq_m, slot_der_m=req.slot_der_m,
        paso_izq_m=req.paso_izq_m, paso_der_m=req.paso_der_m,
        local_dentro=req.local_dentro, libre_fondo_m=req.libre_fondo_m,
        niveles=req.niveles, reparto="modulos",
    ))


def _aloja(r: E.EstudioResponse, gallinas: int) -> bool:
    return r.viable and r.gallinas_max >= gallinas


def _largo_minimo(req: DimensionadoRequest, ancho: float, largo_desde: float) -> Optional[E.EstudioResponse]:
    """Estudio de la nave más corta (al decímetro) de ese ancho que aloja las gallinas."""
    lo = max(1, math.floor(largo_desde / PASO_LARGO_M))   # en decímetros, no aloja
    hi = lo * 2
    tope = round(LARGO_TOPE_M / PASO_LARGO_M)
    while not _aloja(_estudio(req, ancho, hi * PASO_LARGO_M), req.gallinas):
        if hi >= tope:
            return None
        lo, hi = hi, min(hi * 2, tope)
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if _aloja(_estudio(req, ancho, mid * PASO_LARGO_M), req.gallinas):
            hi = mid
        else:
            lo = mid
    return _estudio(req, ancho, round(hi * PASO_LARGO_M, 1))


def _opcion(titulo: str, r: E.EstudioResponse) -> OpcionNave:
    return OpcionNave(
        titulo=titulo, ancho_nave_m=r.ancho_nave_m, largo_nave_m=r.largo_nave_m,
        altura_nave_cm=r.altura_nave_cm, superficie_m2=round(r.superficie_nave_m2, 2),
        niveles=r.niveles, num_modulos=r.num_modulos, num_filas=r.num_filas,
        descripcion_layout=r.descripcion_layout, gallinas_max=r.gallinas_max,
        gallinas_min=r.gallinas_min, limitante=r.limitante,
    )


def _opciones_nidal(req: DimensionadoRequest) -> list[OpcionNave]:
    # Una sola fila centrada: el ancho mínimo es el perfil más el mayor paso a cada lado.
    perfil = E.perfil_nidal_m(req.slot_izq_m, req.slot_der_m)
    ancho_min = math.ceil((perfil + 2 * max(req.paso_izq_m, req.paso_der_m)) * 100 - 1e-6) / 100
    inicio, fondo, _ = E.tramos_nidal(0, req.local_dentro, req.libre_fondo_m)
    modulos = math.ceil(req.gallinas / E.NIDAL_CAP)
    largo_desde = inicio + modulos * E.NIDAL_LARGO + fondo - PASO_LARGO_M

    pasos = round(ANCHO_EXTRA_NIDAL_M / ANCHO_PASO_NIDAL_M)
    naves = [r for k in range(pasos + 1)
             if (r := _largo_minimo(req, round(ancho_min + k * ANCHO_PASO_NIDAL_M, 2), largo_desde))]
    if not naves:
        return []
    estrecha = naves[0]
    menor = min(naves, key=lambda r: (round(r.superficie_nave_m2, 2), r.ancho_nave_m))
    corta = min(naves, key=lambda r: (r.largo_nave_m, r.ancho_nave_m))
    opciones: list[OpcionNave] = []
    for titulo, r in (("Menor superficie", menor), ("Nave más estrecha", estrecha), ("Nave más corta", corta)):
        if all((o.ancho_nave_m, o.largo_nave_m) != (r.ancho_nave_m, r.largo_nave_m) for o in opciones):
            opciones.append(_opcion(titulo, r))
    opciones[0].recomendada = True
    return opciones


def _ancho_filas(filas: int, pasillo: float) -> float:
    """Ancho al centímetro en el que caben `filas` filas de aviario (sin paso a pared)."""
    ancho = math.ceil((filas * E.AVI_MOD_B + (filas - 1) * pasillo) * 100 - 1e-6) / 100
    while math.floor((ancho + pasillo) / (E.AVI_MOD_B + pasillo)) < filas:
        ancho = round(ancho + 0.01, 2)
    return ancho


def _opciones_aviario(req: DimensionadoRequest) -> list[OpcionNave]:
    pasillo = E.AVI_PASILLO
    largo_desde = E.AVI_MOD_A + E.AVI_CLEARANCE + E.AVI_CLEARANCE_FONDO - PASO_LARGO_M
    opciones: list[OpcionNave] = []
    for filas in range(1, FILAS_MAX_AVIARIO + 1):
        r = _largo_minimo(req, _ancho_filas(filas, pasillo), largo_desde)
        # Si el estudio usa menos filas, la nave es más ancha de lo necesario
        if r is None or r.num_filas < filas:
            continue
        opciones.append(_opcion(f"{filas} {'fila' if filas == 1 else 'filas'}", r))
    if opciones:
        min(opciones, key=lambda o: (o.superficie_m2, o.num_filas)).recomendada = True
    return opciones


def dimensionar_nave(req: DimensionadoRequest) -> DimensionadoResponse:
    out = DimensionadoResponse(gallinas=req.gallinas)
    if req.sistema == "ecologico" and req.gallinas > E.MAX_GALLINAS_ECOLOGICO:
        out.motivo = (
            f"En producción ecológica el máximo es {E.MAX_GALLINAS_ECOLOGICO:,} gallinas por compartimento "
            f"del gallinero (Regl. (UE) 2018/848). Para {req.gallinas:,} gallinas hacen falta "
            f"{math.ceil(req.gallinas / E.MAX_GALLINAS_ECOLOGICO)} compartimentos: dimensiona cada uno por separado."
        ).replace(",", ".")
        return out
    if req.tipo_zona == "nidal_colectivo" and req.slot_izq_m + req.slot_der_m == 0:
        out.motivo = "El módulo A-Nida necesita al menos un slot lateral."
        return out

    out.opciones = _opciones_nidal(req) if req.tipo_zona == "nidal_colectivo" else _opciones_aviario(req)
    if not out.opciones:
        out.motivo = (f"No hay nave de menos de {LARGO_TOPE_M:g} m de largo que aloje "
                      f"{req.gallinas:,} gallinas con esta configuración.").replace(",", ".")
        return out
    out.notas = [
        f"Largo mínimo al decímetro con el que el estudio cumple toda la normativa y aloja "
        f"{req.gallinas:,} gallinas.".replace(",", "."),
        "Medidas interiores libres. La capacidad puede superar lo pedido porque los módulos son enteros.",
    ]
    if req.tipo_zona == "aviario":
        out.notas.append("Filas de aviario sin paso a las paredes laterales y pasillos de "
                         f"{E.AVI_PASILLO:g} m entre filas.")
    return out

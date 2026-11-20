"""Dimensionado inverso: cada nave propuesta, estudiada, aloja las gallinas pedidas y es la más corta."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent / "backend"))
from agentes.dimensionado import DimensionadoRequest, dimensionar_nave
from agentes.estudio import EstudioRequest, estudiar_nave
from agentes.plano_agent import LayoutConfig, generar_desde_config

CASOS = [
    dict(tipo_zona="nidal_colectivo", sistema="suelo", gallinas=5000),
    dict(tipo_zona="nidal_colectivo", sistema="campero", gallinas=3000, slot_izq_m=2, slot_der_m=2, local_dentro=True),
    dict(tipo_zona="aviario", sistema="campero", gallinas=8688),
    dict(tipo_zona="aviario", sistema="ecologico", gallinas=2500),
    dict(tipo_zona="aviario", sistema="suelo", gallinas=6000, niveles=2),
]


def _estudio(caso: dict, ancho: float, largo: float, altura: float, paso_pared: float = 0):
    extra = {k: v for k, v in caso.items() if k not in ("gallinas", "altura_nave_cm")}
    return estudiar_nave(EstudioRequest(**extra, ancho_nave_m=ancho, largo_nave_m=largo, altura_nave_cm=altura,
                                        reparto="modulos", clearance_pared_m=paso_pared))


@pytest.mark.parametrize("caso", CASOS, ids=lambda c: f"{c['tipo_zona']}-{c['sistema']}-{c['gallinas']}")
def test_opciones_alojan_y_son_minimas(caso):
    r = dimensionar_nave(DimensionadoRequest(**caso))
    assert r.opciones and not r.motivo
    assert sum(o.recomendada for o in r.opciones) == 1
    for o in r.opciones:
        e = _estudio(caso, o.ancho_nave_m, o.largo_nave_m, o.altura_nave_cm, o.paso_pared_m)
        assert e.viable and e.gallinas_max >= caso["gallinas"]
        assert (e.gallinas_max, e.num_modulos, e.num_filas) == (o.gallinas_max, o.num_modulos, o.num_filas)
        corta = _estudio(caso, o.ancho_nave_m, round(o.largo_nave_m - 0.1, 1), o.altura_nave_cm, o.paso_pared_m)
        assert not (corta.viable and corta.gallinas_max >= caso["gallinas"])


def test_plano_coincide_con_la_opcion():
    o = dimensionar_nave(DimensionadoRequest(tipo_zona="aviario", sistema="campero", gallinas=8688)).opciones[-1]
    plano = generar_desde_config(LayoutConfig(ancho_nave_m=o.ancho_nave_m, largo_nave_m=o.largo_nave_m,
                                              tipo_zona="aviario", sistema="campero", niveles=o.niveles,
                                              num_modulos=o.num_modulos, clearance_pared_m=o.paso_pared_m))
    assert plano.metricas.gallinas_max == o.gallinas_max


def test_aviario_deja_paso_a_las_paredes():
    r = dimensionar_nave(DimensionadoRequest(tipo_zona="aviario", sistema="suelo", gallinas=10000))
    assert all(o.paso_pared_m == 1 for o in r.opciones)
    una_fila = next(o for o in r.opciones if o.num_filas == 1)
    assert una_fila.ancho_nave_m >= 3.3 + 2
    # Con paso a pared, una sola fila larga ya no es la nave de menor superficie
    assert next(o for o in r.opciones if o.recomendada).num_filas == 2


def test_ecologico_por_encima_del_tope():
    r = dimensionar_nave(DimensionadoRequest(tipo_zona="nidal_colectivo", sistema="ecologico", gallinas=4000))
    assert not r.opciones and "2 compartimentos" in r.motivo


def test_nidal_sin_slot():
    r = dimensionar_nave(DimensionadoRequest(tipo_zona="nidal_colectivo", gallinas=1000, slot_izq_m=0, slot_der_m=0))
    assert not r.opciones and r.motivo

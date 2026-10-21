"""Regresión de aforo medido y coherencia entre el estudio y el plano."""
import sys
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parent / "backend"))
from agentes.aforo import AforoRequest, EquipamientoMedido, calcular_aforo
from agentes.estudio import EstudioRequest, estudiar_nave
from agentes.plano_agent import LayoutConfig, generar_desde_config


def test_expediente_oficial_como_referencia_perchas_limitan_8688():
    referencia = json.loads((Path(__file__).parent / "backend/referencias/inspeccion_galicia_ponedoras.json").read_text(encoding="utf-8"))
    nave = referencia["nave"]
    equipo = referencia["instalacion"]
    ext = referencia["superficies_exteriores"]
    calculo = referencia["limites_de_capacidad_del_acta"]

    assert nave["largo_m"] * nave["ancho_m"] == pytest.approx(nave["suelo_m2"])
    assert sum(nave["superficies_utiles_por_nivel_m2"].values()) == pytest.approx(
        nave["superficie_util_total_niveles_declarada_m2"], abs=0.01)
    assert equipo["nidales_utiles_unidad_m2"] * equipo["nidales_unidades"] == pytest.approx(
        equipo["nidales_utiles_total_m2"])
    assert ext["preparque_area_declarada_m2"] == pytest.approx(ext["preparque_area_recalculada_m2"], abs=0.0001)

    r = calcular_aforo(AforoRequest(sistema="campero",
        superficie_util_m2=nave["superficie_util_total_niveles_declarada_m2"],
        anexo_util_validado_m2=ext["preparque_area_declarada_m2"],
        referencia_anexo=referencia["fuente"], pasto_m2=ext["pasto_m2"],
        equipamiento=EquipamientoMedido(perchas_m=equipo["perchas_utiles_total_m"],
            nidal_util_m2=equipo["nidales_utiles_total_m2"],
            comedero_lineal_accesible_m=equipo["comedero_lineal_accesible_total_m"],
            bebederos_pezon_copa=equipo["bebederos_pezon_copa"],
            salidas_ancho_util_m=equipo["salidas_ancho_util_total_m"])))
    assert r.gallinas_max == calculo["maximo_gallinas"] == 8688
    assert r.limitantes == ["perchas"]
    limites = {l.criterio: l.gallinas for l in r.limites}
    assert limites == {
        "densidad": calculo["densidad_gallinas"],
        "perchas": calculo["perchas_gallinas"],
        "nidales": 10178,
        "comederos_lineales": 10382,
        "bebederos": calculo["bebederos_gallinas"],
        "pasto": calculo["parque_gallinas"],
        "salidas": calculo["salidas_gallinas"],
    }
    # El PDF no informa de la yacija: no inventar una comprobación completa.
    assert not r.mediciones_completas
    assert "yacija_suelo" in r.pendientes


def test_cero_es_distinto_de_no_medido():
    vacio = calcular_aforo(AforoRequest(superficie_util_m2=100))
    cero = calcular_aforo(AforoRequest(superficie_util_m2=100,
        equipamiento=EquipamientoMedido(perchas_m=0)))
    assert vacio.gallinas_max == 900 and "perchas" in vacio.pendientes
    assert cero.gallinas_max == 0 and "perchas" not in cero.pendientes


def test_anexo_requiere_referencia():
    with pytest.raises(ValidationError):
        AforoRequest(superficie_util_m2=100, anexo_util_validado_m2=40)


@pytest.mark.parametrize("valor", [-1, float("nan"), float("inf")])
def test_medidas_invalidas(valor):
    with pytest.raises(ValidationError):
        EquipamientoMedido(perchas_m=valor)


def test_yacija_doble_requisito():
    r = calcular_aforo(AforoRequest(superficie_util_m2=1000, superficie_suelo_m2=90, yacija_m2=30))
    assert r.gallinas_max == 1200  # 250 cm² por ave
    r = calcular_aforo(AforoRequest(superficie_util_m2=1000, superficie_suelo_m2=91, yacija_m2=30))
    assert r.gallinas_max == 0 and r.cumple_yacija_suelo is False


@pytest.mark.parametrize("tipo,niveles", [("nidal_colectivo", None), ("aviario", 2), ("aviario", 3)])
@pytest.mark.parametrize("perchas", [None, 150.0])
def test_capacidad_estudio_plano_coinciden(tipo, niveles, perchas):
    equipo = EquipamientoMedido() if perchas is None else EquipamientoMedido(perchas_m=perchas)
    req = EstudioRequest(tipo_zona=tipo, ancho_nave_m=12, largo_nave_m=50,
                         altura_nave_cm=400, niveles=niveles, equipamiento=equipo)
    r = estudiar_nave(req)
    plano = generar_desde_config(LayoutConfig(ancho_nave_m=12, largo_nave_m=50,
        tipo_zona=tipo, niveles=niveles or 2, num_filas=r.num_filas,
        mods_por_fila=r.mods_por_fila, gallinas=r.gallinas_max, equipamiento=equipo))
    assert plano.error is None
    assert r.num_modulos == plano.metricas.total_modulos
    assert r.gallinas_max == plano.metricas.gallinas_max
    assert r.sup_yacija_m2 == plano.metricas.yacija_m2
    assert r.densidad_real == plano.metricas.densidad


def test_no_cabe_no_inventa_modulos():
    r = generar_desde_config(LayoutConfig(ancho_nave_m=2, largo_nave_m=5))
    assert r.error and not r.svg and r.metricas.total_modulos == 0


def test_parque_no_aumenta_aforo_automaticamente():
    a = generar_desde_config(LayoutConfig(ancho_nave_m=12, largo_nave_m=50))
    b = generar_desde_config(LayoutConfig(ancho_nave_m=12, largo_nave_m=50, ancho_alero_m=10))
    assert a.error is None and b.error is None
    assert a.metricas == b.metricas


def test_override_imposible_y_objetivo_excesivo():
    for kwargs in ({"num_filas": 10}, {"mods_por_fila": 100}, {"gallinas": 100000}):
        r = generar_desde_config(LayoutConfig(ancho_nave_m=12, largo_nave_m=50, **kwargs))
        assert r.error and not r.svg


def test_pasto_limita_capacidad_y_cero_no_es_ausencia():
    r = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="campero",
        ancho_nave_m=12, largo_nave_m=50, altura_nave_cm=300, sup_pasto_m2=400))
    assert r.gallinas_max == 100 and r.viable
    r = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="campero",
        ancho_nave_m=12, largo_nave_m=50, altura_nave_cm=300, sup_pasto_m2=0))
    assert r.gallinas_max == 0 and not r.viable


def test_ecologico_usa_percha_18cm_y_tope_3000():
    r = calcular_aforo(AforoRequest(sistema="ecologico", superficie_util_m2=1000,
        pasto_m2=12000,
        equipamiento=EquipamientoMedido(perchas_m=500, nidal_util_m2=100,
            comedero_lineal_accesible_m=1000)))
    assert r.gallinas_max == 2777
    assert r.limitantes == ["perchas"]


def test_ecologico_gallinero_no_supera_3000():
    r = calcular_aforo(AforoRequest(sistema="ecologico", superficie_util_m2=1000,
        pasto_m2=20000,
        equipamiento=EquipamientoMedido(perchas_m=1000, nidal_util_m2=300,
            comedero_lineal_accesible_m=3000)))
    assert r.gallinas_max == 3000
    assert r.limitantes == ["tope_gallinas_por_gallinero"]


def test_ecologico_densidad_y_nidal_colectivo():
    r = calcular_aforo(AforoRequest(sistema="ecologico", superficie_util_m2=1000,
        pasto_m2=10000,
        equipamiento=EquipamientoMedido(perchas_m=3000, nidal_util_m2=20,
            comedero_lineal_accesible_m=3000)))
    assert r.gallinas_max == 1666
    assert r.limitantes == ["nidales"]
    assert next(l for l in r.limites if l.criterio == "densidad").gallinas == 6000


def test_estudio_aviario_3_niveles_reproduce_acta_perchas_8688():
    """72 módulos de 3 niveles (3 filas × 24) = instalación del acta: limitan las perchas."""
    referencia = json.loads((Path(__file__).parent / "backend/referencias/inspeccion_galicia_ponedoras.json").read_text(encoding="utf-8"))
    equipo = referencia["instalacion"]
    from agentes.estudio import AVI_EQUIPO_POR_MODULO
    cat = AVI_EQUIPO_POR_MODULO[3]
    assert cat["perchas_m"] * 72 == pytest.approx(equipo["perchas_utiles_total_m"])
    assert cat["nidal_util_m2"] * 72 == pytest.approx(equipo["nidales_utiles_total_m2"])
    assert cat["comedero_lineal_accesible_m"] * 72 == pytest.approx(equipo["comedero_lineal_accesible_total_m"])
    assert cat["bebederos_pezon_copa"] * 72 == equipo["bebederos_pezon_copa"]

    r = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="campero", ancho_nave_m=15,
                                     largo_nave_m=36, altura_nave_cm=400, niveles=3))
    assert r.num_modulos == 72
    assert r.gallinas_max == referencia["limites_de_capacidad_del_acta"]["maximo_gallinas"] == 8688
    assert r.limitante == "perchas"
    assert all(e.limitante == "perchas" for e in r.escenarios)


def test_equipamiento_medido_prevalece_sobre_catalogo_aviario():
    r = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="campero", ancho_nave_m=15,
                                     largo_nave_m=36, altura_nave_cm=400, niveles=3,
                                     equipamiento=EquipamientoMedido(perchas_m=600)))
    assert r.gallinas_max == 4000 and r.limitante == "perchas"


def test_aviario_yacija_redondeada_no_supera_suelo():
    # 29,16 × 13,8 = 402,408 → la yacija se redondea a 402,41
    r = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="campero", ancho_nave_m=13.8,
                                     largo_nave_m=36.16, altura_nave_cm=400, niveles=3))
    assert r.num_modulos == 72 and r.gallinas_max == 8688

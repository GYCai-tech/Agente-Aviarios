"""Regresión del desglose de capacidad para el modelo de nidal A-Nida."""

import sys
from pathlib import Path
import xml.etree.ElementTree as ET

import pytest

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from agentes.estudio import EstudioRequest, estudiar_nave
from agentes.aforo import EquipamientoMedido
from agentes.plano_agent import LayoutConfig, generar_desde_config


def test_nidal_usa_la_geometria_oficial_y_expone_limites_por_criterio():
    estudio = estudiar_nave(EstudioRequest(
        tipo_zona="nidal_colectivo",
        sistema="suelo",
        ancho_nave_m=13.8,
        largo_nave_m=28.96,
        altura_nave_cm=300,
    ))

    assert estudio.superficie_nave_m2 == 399.648
    assert estudio.ancho_nave_minimo_m == 9.4
    assert estudio.num_modulos == 21  # floor((28.96 - 3.00) / 1.20)
    assert estudio.sup_disponible_m2 == 364.37  # nave - 21 × (1.20 × 1.40)
    assert estudio.sup_yacija_m2 == 213.17
    assert estudio.yacija_min_m2 == 133.22
    assert estudio.gallinas_max == 3024  # 21 módulos × 144 aves/módulo

    limites = {limite.criterio: limite for limite in estudio.aforo.limites}
    assert limites["modulos_instalados"].gallinas == 3024
    assert limites["modulos_instalados"].formula == "21 módulos × 144 gallinas/módulo"
    assert limites["densidad"].gallinas == 3279
    assert limites["nidales"].gallinas == 4233
    assert estudio.aforo.pendientes  # los demás equipos siguen requiriendo medición


def test_plano_centrado_usa_geometria_del_estudio_y_cotas_reales():
    datos = dict(tipo_zona="nidal_colectivo", ancho_nave_m=13.8, largo_nave_m=28.96)
    estudio = estudiar_nave(EstudioRequest(**datos, altura_nave_cm=300))
    plano = generar_desde_config(LayoutConfig(**datos))
    assert plano.error is None
    geo = plano.metricas.geometria_nidal
    assert geo == estudio.geometria_nidal
    assert geo.paso_lateral_m == pytest.approx(3.2)
    assert geo.cuerpo_y_m == pytest.approx(6.2)
    assert geo.slat_der_y_m == pytest.approx(7.6)
    assert geo.cadena_largo_m == pytest.approx(25.2)
    assert geo.tensor_fin_x_m == pytest.approx(28.2)
    assert geo.libre_fondo_m == pytest.approx(0.76)

    # Comprobar las entidades dibujadas, además de las métricas declaradas.
    raiz = ET.fromstring(plano.svg)
    entidades = {e.get("data-element"): e for e in raiz.iter() if e.get("data-element")}
    nave, cuerpo = entidades["nave"], entidades["cuerpo-nidal"]
    escala = float(nave.get("height")) / 13.8
    assert float(cuerpo.get("y")) - float(nave.get("y")) == pytest.approx(6.2 * escala, abs=0.15)
    assert float(cuerpo.get("height")) == pytest.approx(1.4 * escala, abs=0.15)
    assert float(cuerpo.get("width")) == pytest.approx(25.2 * escala, abs=0.2)
    textos = [e.text for e in raiz.iter() if e.tag.endswith("}text")]
    assert "28.96 m" in textos and "13.80 m" in textos
    assert textos.count("3.20 m") == 2
    assert "0.76 m libres" in textos
    assert "ESC 1:50" not in textos  # el SVG se adapta a pantalla, sin escala física fija
    assert any("3.024 aves" in (t or "") for t in textos)


def test_centrado_comprueba_cada_paso_aunque_la_suma_quepa():
    datos = dict(tipo_zona="nidal_colectivo", ancho_nave_m=11.4, largo_nave_m=28.96,
                 paso_izq_m=3, paso_der_m=1)
    # Sobran 4 m en total, pero al centrar solo quedan 2 m por lado.
    estudio = estudiar_nave(EstudioRequest(**datos, altura_nave_cm=300))
    plano = generar_desde_config(LayoutConfig(**datos))
    assert not estudio.viable
    assert estudio.ancho_nave_minimo_m == pytest.approx(13.4)
    assert plano.error and not plano.svg


def test_seleccion_automatica_del_plano_considera_equipamiento():
    datos = dict(tipo_zona="nidal_colectivo", ancho_nave_m=13.8, largo_nave_m=28.96,
                 equipamiento=EquipamientoMedido(perchas_m=150))
    estudio = estudiar_nave(EstudioRequest(**datos, altura_nave_cm=300))
    plano = generar_desde_config(LayoutConfig(**datos))
    assert plano.error is None
    assert plano.metricas.total_modulos == estudio.num_modulos == 7
    assert plano.metricas.gallinas_max == estudio.gallinas_max == 1000
    assert plano.metricas.geometria_nidal == estudio.geometria_nidal


@pytest.mark.parametrize("config", [{"num_filas": 2}, {"mods_por_fila": 22}])
def test_plano_centrado_rechaza_distribuciones_que_no_representa(config):
    plano = generar_desde_config(LayoutConfig(tipo_zona="nidal_colectivo",
        ancho_nave_m=13.8, largo_nave_m=28.96, **config))
    assert plano.error and not plano.svg

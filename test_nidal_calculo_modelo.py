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
    # Equipamiento integrado: mínimo normativo para 144 aves por módulo
    # (21,6 m de percha, 14,4 m de comedero, 15 bebederos)
    assert limites["perchas"].formula == "453.6 / 0.15" and limites["perchas"].gallinas == 3024
    assert limites["comederos_lineales"].formula == "302.4 / 0.1" and limites["comederos_lineales"].gallinas == 3024
    assert limites["bebederos"].formula == "315 / 0.1" and limites["bebederos"].gallinas == 3150
    assert estudio.aforo.pendientes == []
    # Empatan con la capacidad de los módulos, de la que se derivan: no son el limitante
    assert estudio.aforo.limitantes == ["modulos_instalados"]


def test_nidal_ecologico_dimensiona_perchas_a_18_cm():
    estudio = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema="ecologico",
        ancho_nave_m=13.8, largo_nave_m=28.96, altura_nave_cm=300, sup_pasto_m2=20000))
    limites = {limite.criterio: limite for limite in estudio.aforo.limites}
    assert limites["perchas"].formula == f"{estudio.num_modulos * 25.92:g} / 0.18"
    assert limites["perchas"].gallinas == estudio.num_modulos * 144


def test_nidal_equipo_medido_prevalece_sobre_el_integrado():
    estudio = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo",
        ancho_nave_m=13.8, largo_nave_m=28.96, altura_nave_cm=300,
        equipamiento={"perchas_m": 300}))
    assert estudio.gallinas_max == 2000  # 300 m / 0,15 m por gallina
    assert estudio.aforo.limitantes == ["perchas"]


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
    assert "3.76 m libres" in textos  # tensor + suelo libre hasta la pared
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


def test_aforo_imprime_superficie_redondeada_y_producto_real_de_modulos():
    estudio = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema="ecologico",
        ancho_nave_m=13.8, largo_nave_m=28.96, altura_nave_cm=300, sup_pasto_m2=20000))
    limites = {limite.criterio: limite for limite in estudio.aforo.limites}
    assert limites["densidad"].formula == "372.768 × 6"
    n = estudio.num_modulos
    assert limites["modulos_instalados"].formula == f"{n} módulos × 144 gallinas/módulo"
    assert limites["modulos_instalados"].gallinas == n * 144
    assert estudio.gallinas_max == limites["densidad"].gallinas == 2236
    assert estudio.aforo.limitantes == ["densidad"]


def test_equipamiento_previsto_cubre_el_minimo_normativo():
    estudio = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo",
        ancho_nave_m=13.8, largo_nave_m=28.96, altura_nave_cm=300))
    equipo = {e.nombre: e for e in estudio.equipamiento}
    assert equipo["Perchas"].previsto == 453.6 and equipo["Perchas"].minimo == 453.6
    assert equipo["Comedero lineal"].previsto == 302.4
    assert equipo["Bebederos de pezón o copa"].previsto == 315 and equipo["Bebederos de pezón o copa"].minimo == 303
    assert equipo["Superficie de nidal"].previsto == 35.28
    assert all(e.cumple and e.origen == "Integrado en el módulo" for e in estudio.equipamiento)


def test_ecologico_lista_requisitos_de_explotacion_y_trampillas():
    r = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema="ecologico",
                                     ancho_nave_m=13.8, largo_nave_m=29, altura_nave_cm=300))
    nombres = [c.nombre for c in r.condiciones]
    assert {"Acceso al exterior", "Trampillas de salida", "Zona al aire libre", "Iluminación"} <= set(nombres)
    assert "Sistema multinivel" not in nombres
    # 2239 gallinas / 6 gal/m² × 4 m / 100 m² = 14,93 m
    assert any(q.nombre.startswith("Trampillas") and q.valor_minimo == 14.93 for q in r.requisitos)
    assert "salidas" in r.aforo.pendientes
    suelo = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema="suelo",
                                         ancho_nave_m=13.8, largo_nave_m=29, altura_nave_cm=300))
    assert suelo.condiciones == []


def test_ecologico_trampillas_medidas_limitan_el_aforo():
    r = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema="ecologico",
                                     ancho_nave_m=13.8, largo_nave_m=29, altura_nave_cm=300,
                                     equipamiento=EquipamientoMedido(salidas_ancho_util_m=10)))
    assert r.gallinas_max == 1500
    assert r.aforo.limitantes == ["salidas"]
    tramp = next(v for v in r.verificaciones if v.parametro == "Trampillas al exterior")
    assert tramp.cumple and tramp.valor_limite == 10


def test_aviario_ecologico_admite_tres_niveles_con_el_suelo():
    auto = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="ecologico",
                                        ancho_nave_m=14, largo_nave_m=60, altura_nave_cm=450))
    assert auto.niveles == 2 and auto.viable
    assert any(c.nombre == "Sistema multinivel" for c in auto.condiciones)
    forzado = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="ecologico", niveles=3,
                                           ancho_nave_m=14, largo_nave_m=60, altura_nave_cm=450))
    assert not forzado.viable
    assert not next(v for v in forzado.verificaciones if v.parametro == "Niveles del aviario").cumple
    suelo = estudiar_nave(EstudioRequest(tipo_zona="aviario", sistema="suelo",
                                         ancho_nave_m=14, largo_nave_m=60, altura_nave_cm=450))
    assert suelo.niveles == 3


def test_local_dentro_y_libre_al_fondo_reparten_el_largo():
    datos = dict(tipo_zona="nidal_colectivo", ancho_nave_m=12, largo_nave_m=28,
                 local_dentro=True, libre_fondo_m=4)
    r = estudiar_nave(EstudioRequest(**datos, altura_nave_cm=300))
    # 28 − 4 m de local − 4 m libres = 20 m → 16 módulos de 1,20 m (19,2 m)
    assert r.viable and r.num_modulos == 16 and r.max_modulos_fisicos == 16
    # El local se cierra de pared a pared: 4 m × 12 m fuera del suelo de las aves
    assert r.sup_local_m2 == 48 and r.sup_total_m2 == 288
    assert r.sup_disponible_m2 == pytest.approx(336 - 48 - 16 * 1.68)
    assert r.geometria_nidal.cadena_inicio_x_m == 4
    largo = next(v for v in r.verificaciones if v.parametro == "Longitud ocupada por la cadena")
    assert largo.valor_real == pytest.approx(27.2) and largo.cumple
    plano = generar_desde_config(LayoutConfig(**datos))
    assert plano.error is None
    assert plano.metricas.gallinas_max == r.gallinas_max
    textos = [e.text for e in ET.fromstring(plano.svg).iter() if e.tag.endswith("}text")]
    assert {"28.00 m", "4 m local", "19.20 m", "4.80 m libres"} <= set(textos)


def test_libre_al_fondo_no_puede_dejar_sin_sitio_al_tensor():
    r = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", ancho_nave_m=12, largo_nave_m=28,
                                     altura_nave_cm=300, libre_fondo_m=2))
    assert not r.viable and "tensor" in r.motivo

"""La ficha técnica editable gobierna el estudio y el plano; restablecerla vuelve a fábrica."""
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parent / "backend"))
from agentes import ficha as F
from agentes.estudio import EstudioRequest, estudiar_nave
from agentes.plano_agent import LayoutConfig, generar_desde_config

CASO = dict(tipo_zona="aviario", sistema="campero", ancho_nave_m=15, largo_nave_m=36,
            altura_nave_cm=400, niveles=3)


@pytest.fixture(autouse=True)
def ficha_temporal(tmp_path, monkeypatch):
    monkeypatch.setattr(F, "_RUTA", tmp_path / "ficha_tecnica.json")
    yield
    F.aplicar_ficha(F.ficha_por_defecto())


def test_por_defecto_reproduce_acta():
    assert not F.ficha_personalizada()
    assert estudiar_nave(EstudioRequest(**CASO)).gallinas_max == 8688


def test_guardar_cambia_estudio_y_plano():
    f = F.cargar_ficha()
    f.aviario.nivel_3.perchas_m = 20.0
    f.aviario.fondo_modulo_m = 3.5
    guardada = F.guardar_ficha(f)
    assert F.ficha_personalizada() and guardada.actualizado
    r = estudiar_nave(EstudioRequest(**CASO))
    assert r.gallinas_max == 9600 and r.limitante == "perchas"
    assert any(p.nombre == "Fondo del módulo" and p.valor == "3,5 m" for p in r.parametros)
    plano = generar_desde_config(LayoutConfig(ancho_nave_m=15, largo_nave_m=36, tipo_zona="aviario", niveles=3,
                                              num_filas=r.num_filas, mods_por_fila=r.mods_por_fila))
    assert plano.metricas.gallinas_max == r.gallinas_max
    assert F.cargar_ficha().aviario.fondo_modulo_m == 3.5


def test_restablecer_vuelve_a_fabrica():
    f = F.cargar_ficha()
    f.aviario.nivel_3.perchas_m = 20.0
    F.guardar_ficha(f)
    F.restablecer_ficha()
    assert not F.ficha_personalizada()
    assert estudiar_nave(EstudioRequest(**CASO)).gallinas_max == 8688


def test_ficha_incoherente_se_rechaza():
    datos = F.ficha_por_defecto().model_dump()
    datos["aviario"]["nivel_3"]["sup_disponible_m2"] = 99
    with pytest.raises(ValidationError):
        F.FichaTecnica.model_validate(datos)


def test_altura_minima_editable():
    f = F.cargar_ficha()
    f.aviario.nivel_3.altura_min_cm = 420
    F.guardar_ficha(f)
    r = estudiar_nave(EstudioRequest(**CASO))
    assert not r.viable and "420 cm" in r.motivo


def test_margen_de_incertidumbre_da_el_intervalo_de_capacidad():
    req = EstudioRequest(tipo_zona="nidal_colectivo", sistema="suelo", ancho_nave_m=12, largo_nave_m=28, altura_nave_cm=350)
    r = estudiar_nave(req)
    # De fábrica, 5 % de superficie: (336 × 0,95 − 20 cuerpos × 1,68) × 9 = 2570,4 → 2570
    assert (r.gallinas_min, r.gallinas_max, r.margen_incertidumbre_pct) == (2570, 2721, 5)

    f = F.ficha_por_defecto()
    f.calculo.margen_incertidumbre_pct = 15
    F.guardar_ficha(f)
    r = estudiar_nave(req)
    assert (r.gallinas_min, r.gallinas_max) == (2268, 2721)  # (336 × 0,85 − 33,6) × 9


def test_ficha_guardada_sin_apartado_de_calculo_toma_el_margen_de_fabrica():
    datos = F.ficha_por_defecto().model_dump()
    del datos["calculo"]
    assert F.FichaTecnica.model_validate(datos).calculo.margen_incertidumbre_pct == 5


def test_margen_sin_efecto_si_la_superficie_no_limita():
    # 5 módulos: limitan las alfombrillas (5 × 1,1781 × 120 = 706), no la superficie
    r = estudiar_nave(EstudioRequest(tipo_zona="nidal_colectivo", sistema="suelo", ancho_nave_m=12,
                                     largo_nave_m=28, altura_nave_cm=350, num_modulos=5))
    assert r.gallinas_min == r.gallinas_max == 706
    assert r.superficie_nave_m2 == 336  # la reducción no se ve en el estudio, solo en el mínimo

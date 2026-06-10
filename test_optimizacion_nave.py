import pytest
from optimizacion_nave import optimizar_nave


@pytest.mark.parametrize("S, m_esperado, n_esperado, limitante", [
    (300, 17, 2442, "densidad"),
    (500, 29, 4061, "densidad"),
    (800, 46, 6504, "densidad"),
])
def test_casos_conocidos(S, m_esperado, n_esperado, limitante):
    r = optimizar_nave(S)
    assert r["m_optimo"] == m_esperado
    assert r["n_optimo"] == n_esperado
    assert r["restriccion_limitante"] == limitante


def test_nave_pequena():
    r = optimizar_nave(10)
    assert r["m_optimo"] == 0
    assert r["n_optimo"] == 0
    assert r["restriccion_limitante"] == "ninguno"


def test_superficie_negativa():
    with pytest.raises(ValueError):
        optimizar_nave(-5)


def test_superficie_cero():
    with pytest.raises(ValueError):
        optimizar_nave(0)


def test_sup_disponible_yacija_coherencia():
    r = optimizar_nave(300)
    m = r["m_optimo"]
    assert abs(r["sup_disponible"] - (300 - 1.68 * m)) < 0.01
    assert abs(r["sup_yacija"] - (300 - 8.88 * m)) < 0.01
    # yacija debe ser al menos un tercio de la nave
    assert r["sup_yacija"] >= 300 / 3 - 0.01


def test_m_max_yacija_devuelto():
    r = optimizar_nave(300)
    import math
    assert r["m_max_yacija"] == math.floor(300 / 13.32)

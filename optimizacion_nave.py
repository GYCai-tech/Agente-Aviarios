import math


def optimizar_nave(S: float) -> dict:
    """
    Calcula el número óptimo de módulos de jaulas para maximizar gallinas en una nave.

    Restricciones:
      1. Densidad: n <= (S - 1.68 * m) * 9
      2. Yacija:   S - 8.88 * m >= S / 3  =>  m <= S / 13.32
      3. Capacidad: n <= 144 * m

    sup_disponible = S - 1.68 * m  (cuerpo descontado; slots cuentan)
    sup_yacija     = S - 8.88 * m  (cuerpo + slots descontados)
    """
    if S <= 0:
        raise ValueError(f"La superficie debe ser positiva, se recibió {S}")

    m_max_yacija = math.floor(S / 13.32)

    if m_max_yacija < 1:
        return {
            "m_optimo": 0,
            "n_optimo": 0,
            "sup_disponible": S,
            "sup_yacija": S,
            "restriccion_limitante": "ninguno",
            "m_max_yacija": m_max_yacija,
        }

    mejor_m = 0
    mejor_n = 0

    for m in range(1, m_max_yacija + 1):
        n_capacidad = 144 * m
        n_densidad = (S - 1.68 * m) * 9
        n_max = min(n_capacidad, n_densidad)
        if n_max > mejor_n:
            mejor_n = n_max
            mejor_m = m

    m = mejor_m
    n_capacidad = 144 * m
    n_densidad = (S - 1.68 * m) * 9
    restriccion = "capacidad" if n_capacidad <= n_densidad else "densidad"

    return {
        "m_optimo": m,
        "n_optimo": math.floor(mejor_n),
        "sup_disponible": round(S - 1.68 * m, 4),
        "sup_yacija": round(S - 8.88 * m, 4),
        "restriccion_limitante": restriccion,
        "m_max_yacija": m_max_yacija,
    }


if __name__ == "__main__":
    casos = [300, 500, 800]
    print(f"{'S':>6}  {'m':>4}  {'n':>6}  {'Limita':<10}  {'sup_disp':>10}  {'sup_yacija':>10}")
    print("-" * 60)
    for S in casos:
        r = optimizar_nave(S)
        print(
            f"{S:>6}  {r['m_optimo']:>4}  {r['n_optimo']:>6}  "
            f"{r['restriccion_limitante']:<10}  {r['sup_disponible']:>10.2f}  {r['sup_yacija']:>10.2f}"
        )

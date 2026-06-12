# Verificación visual de /propuesta con datos de prueba inyectados en localStorage
from playwright.sync_api import sync_playwright

MOCK = """{
  "informe": {
    "sistema": "campero",
    "num_gallinas": 5000,
    "verificaciones_nave": [
      {"parametro": "Densidad de gallinas", "cumple": true, "valor_real": 7.2, "valor_limite": 9, "unidad": "gal/m2", "tipo_limite": "maximo", "articulo": "RD 3/2002 Anexo I"},
      {"parametro": "Espacio de comedero", "cumple": true, "valor_real": 520, "valor_limite": 500, "unidad": "m", "tipo_limite": "minimo", "articulo": "RD 3/2002 Art. 4"},
      {"parametro": "Bebederos", "cumple": true, "valor_real": 55, "valor_limite": 50, "unidad": "uds", "tipo_limite": "minimo", "articulo": "RD 3/2002 Art. 4"},
      {"parametro": "Nidos", "cumple": true, "valor_real": 42, "valor_limite": 42, "unidad": "uds", "tipo_limite": "minimo", "articulo": "RD 3/2002 Anexo I"},
      {"parametro": "Aseladeros", "cumple": true, "valor_real": 760, "valor_limite": 750, "unidad": "m", "tipo_limite": "minimo", "articulo": "RD 3/2002 Anexo I"}
    ],
    "requisitos": [
      {"nombre": "Nidos", "valor_minimo": 42, "unidad": "uds", "formula": "1 nido / 120 gallinas", "articulo": "RD 3/2002"},
      {"nombre": "Comedero", "valor_minimo": 500, "unidad": "m", "formula": "10 cm / gallina", "articulo": "RD 3/2002"},
      {"nombre": "Bebederos", "valor_minimo": 50, "unidad": "uds", "formula": "1 / 100 gallinas", "articulo": "RD 3/2002"}
    ],
    "cumple_nave": true,
    "advertencias": [],
    "consulta_rag": ""
  },
  "argumentario_ventas": "Con **5.000 ponedoras camperas** en 700 m2, el aviario de 2 niveles es la opcion que maximiza tu capacidad sin tocar la nave.\\n\\nFrente a una instalacion en suelo, *duplicas el censo* manteniendo la densidad legal con margen.",
  "argumentos_producto": [],
  "gallinas": "5000",
  "sistema": "campero",
  "superficie": "700",
  "altura": "380",
  "tipo_zona": "aviario",
  "niveles": 2,
  "ancho_nave": "14",
  "largo_nave": "50"
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto("http://localhost:3000/propuesta")
    page.evaluate(f"localStorage.setItem('gc_propuesta', {MOCK!r})")
    page.goto("http://localhost:3000/propuesta")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path="_propuesta_aviario.png", full_page=True)

    # variante nidal
    mock_nidal = MOCK.replace('"tipo_zona": "aviario"', '"tipo_zona": "nidal_colectivo"')
    page.evaluate(f"localStorage.setItem('gc_propuesta', {mock_nidal!r})")
    page.goto("http://localhost:3000/propuesta")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path="_propuesta_nidal.png", full_page=True)

    print("ERRORS:", errors if errors else "none")
    browser.close()

# Genera el PDF de /propuesta con datos de ejemplo para diagnosticar la maquetación de impresión
import json
from playwright.sync_api import sync_playwright

DATA = {
    "informe": {
        "sistema": "suelo",
        "num_gallinas": 20000,
        "verificaciones_nave": [
            {"parametro": "Densidad de aves", "cumple": True, "valor_real": 7.8, "valor_limite": 9, "unidad": "gal/m²", "tipo_limite": "maximo", "articulo": "RD 3/2002 Anexo I"},
            {"parametro": "Espacio de comedero", "cumple": True, "valor_real": 10.5, "valor_limite": 10, "unidad": "cm/ave", "tipo_limite": "minimo", "articulo": "RD 3/2002 Art. 4"},
            {"parametro": "Bebederos de tetina", "cumple": True, "valor_real": 1, "valor_limite": 1, "unidad": "ud/10 aves", "tipo_limite": "minimo", "articulo": "RD 3/2002 Art. 4"},
            {"parametro": "Superficie de yacija", "cumple": True, "valor_real": 0.42, "valor_limite": 0.25, "unidad": "m²/ave", "tipo_limite": "minimo", "articulo": "RD 3/2002 Anexo II"},
            {"parametro": "Espacio de aseladero", "cumple": True, "valor_real": 15.2, "valor_limite": 15, "unidad": "cm/ave", "tipo_limite": "minimo", "articulo": "Directiva 1999/74/CE"},
        ],
        "requisitos": [
            {"nombre": "Nidales", "valor_minimo": 167, "unidad": "uds", "formula": "1/120 aves", "articulo": "RD 3/2002"},
            {"nombre": "Comedero lineal", "valor_minimo": 2000, "unidad": "m", "formula": "10 cm/ave", "articulo": "RD 3/2002"},
            {"nombre": "Bebederos", "valor_minimo": 2000, "unidad": "uds", "formula": "1/10 aves", "articulo": "RD 3/2002"},
            {"nombre": "Aseladero", "valor_minimo": 3000, "unidad": "m", "formula": "15 cm/ave", "articulo": "1999/74/CE"},
            {"nombre": "Yacija", "valor_minimo": 5000, "unidad": "m²", "formula": "0,25 m²/ave", "articulo": "RD 3/2002"},
            {"nombre": "Trampillas", "valor_minimo": 40, "unidad": "m", "formula": "2 m/1000 aves", "articulo": "RD 1084/2005"},
        ],
        "cumple_nave": True,
        "advertencias": [],
        "consulta_rag": "",
    },
    "argumentario_ventas": "Con **20.000 ponedoras** en una nave de 900 m², el aviario de 2 niveles es la única vía para cumplir la densidad normativa sin ampliar la nave.\n\nLa estructura de *acero galvanizado* garantiza una vida útil superior a 20 años con mantenimiento mínimo.\n\nLa recolección automática en cinta reduce el huevo sucio y el trabajo operativo diario.",
    "argumentos_producto": [],
    "gallinas": "20000",
    "sistema": "suelo",
    "superficie": "900",
    "altura": "350",
    "tipo_zona": "aviario",
    "niveles": 2,
    "ancho_nave": "15",
    "largo_nave": "60",
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 1000})
    page.goto("http://localhost:3000")
    page.evaluate("data => localStorage.setItem('gc_propuesta', JSON.stringify(data))", DATA)
    page.goto("http://localhost:3000/propuesta")
    page.wait_for_load_state("networkidle")
    # esperar a que el plano SVG cargue (o el fallback)
    try:
        page.wait_for_selector(".plano-svg svg, .plano-fallback", timeout=30000)
    except Exception as e:
        print("AVISO: plano no cargó:", e)
    page.wait_for_timeout(2000)  # imágenes de fondo
    page.screenshot(path="screenshots/propuesta_web.png", full_page=True)
    page.pdf(
        path="screenshots/propuesta_print.pdf",
        format="A4",
        print_background=True,
        margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
    )
    print("PDF y screenshot generados")
    browser.close()

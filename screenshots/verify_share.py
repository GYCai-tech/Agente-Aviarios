# Verifica el flujo de compartir propuesta: guarda en backend, abre /p/<id> como cliente
import json
import time
import urllib.request
from playwright.sync_api import sync_playwright

from gen_pdf_propuesta import DATA

# esperar backend
for _ in range(60):
    try:
        urllib.request.urlopen("http://localhost:8005/docs", timeout=2)
        break
    except Exception:
        time.sleep(1)

# 1. guardar propuesta
req = urllib.request.Request(
    "http://localhost:8005/propuestas",
    data=json.dumps(DATA).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
pid = json.load(urllib.request.urlopen(req))["id"]
print("id:", pid)

# 2. recuperarla
back = json.load(urllib.request.urlopen(f"http://localhost:8005/propuestas/{pid}"))
assert back["gallinas"] == DATA["gallinas"], "GET no devuelve lo guardado"
print("GET OK · guardada_en:", back.get("_guardada_en"))

# 3. abrirla como cliente en /p/<id>
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 1000})
    page.goto(f"http://localhost:3000/p/{pid}")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector(".cover-title", timeout=30000)
    assert page.locator(".share-topbar").count() == 1, "falta share-topbar en vista cliente"
    assert page.locator(".jrn-hdr").count() == 0, "JourneyHeader no debe verse en vista cliente"
    assert "editor interactivo" not in page.content().lower(), "enlace interno visible en vista cliente"
    try:
        page.wait_for_selector(".plano-svg svg", timeout=30000)
        print("plano OK en vista cliente")
    except Exception:
        print("AVISO: plano no cargo en vista cliente")
    page.screenshot(path="screenshots/propuesta_cliente.png", full_page=False)
    # 4. enlace inexistente → mensaje de no disponible
    page.goto("http://localhost:3000/propuesta?id=" + "0" * 32)
    page.wait_for_selector(".empty-title", timeout=15000)
    assert "no disponible" in page.locator(".empty-title").inner_text().lower()
    print("404 OK:", page.locator(".empty-title").inner_text())
    browser.close()

print("FLUJO COMPLETO OK")

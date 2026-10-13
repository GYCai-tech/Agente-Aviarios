"""
API de cálculo y plano para propuestas comerciales (uso interno).

Sin IA ni RAG: todos los resultados salen de cálculos deterministas en
`agentes.estudio`, `agentes.aforo` y `agentes.plano_agent`.
"""
from __future__ import annotations
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from agentes.aforo import AforoRequest, AforoResultado, calcular_aforo
from agentes.estudio import EstudioRequest, EstudioResponse, estudiar_nave
from agentes.plano_agent import LayoutConfig, LayoutConfigResponse, generar_desde_config
from agentes.dxf_nidal import generar_dxf_nidal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

app = FastAPI(title="Gómez y Crespo — Cálculo de naves")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *filter(None, [os.getenv("FRONTEND_URL")]),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/estudio", response_model=EstudioResponse)
def estudio(request: EstudioRequest):
    """Estudio técnico de nave con el módulo ya elegido."""
    return estudiar_nave(request)


@app.post("/aforo-medido", response_model=AforoResultado)
def aforo_medido(request: AforoRequest):
    """Aforo cuantitativo de instalaciones medidas (suelo/campero)."""
    return calcular_aforo(request)


@app.post("/plano-config", response_model=LayoutConfigResponse)
def plano_config(request: LayoutConfig):
    return generar_desde_config(request)


@app.post("/plano-nidal-dxf")
def plano_nidal_dxf(request: LayoutConfig):
    """DXF editable del nidal centrado, con unidades de dibujo en metros."""
    try:
        contenido = generar_dxf_nidal(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    nombre = f"nidal_centrado_{request.largo_nave_m:.2f}x{request.ancho_nave_m:.2f}m.dxf"
    return Response(content=contenido, media_type="application/dxf",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}"'})


@app.get("/health")
def health():
    return {"status": "ok"}

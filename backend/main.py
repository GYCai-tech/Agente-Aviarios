import logging
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

from fastapi import FastAPI
from schemas.pydantic_models import QueryRequest, QueryResponse, ValidarRequest, ValidarResponse, CalcularRequest, CalcularResponse
from agentes.grafo import app as grafo
from agentes.semantic_cache import inicializar_cache
from agentes.validador_legal import validar_conformidad, calcular_granja

app = FastAPI()


@app.on_event("startup")
def startup():
    inicializar_cache()


@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    resultado = grafo.invoke({"query": request.question})
    return QueryResponse(answer=resultado["answer"])


@app.post("/validar", response_model=ValidarResponse)
def validar(request: ValidarRequest):
    informe = validar_conformidad(request.datos)
    resultado_rag = grafo.invoke({"query": informe.consulta_rag})
    return ValidarResponse(
        informe=informe,
        analisis_legal=resultado_rag["answer"],
    )


@app.post("/calcular", response_model=CalcularResponse)
def calcular(request: CalcularRequest):
    informe = calcular_granja(request.datos)
    resultado_rag = grafo.invoke({"query": informe.consulta_rag})
    return CalcularResponse(
        informe=informe,
        analisis_legal=resultado_rag["answer"],
    )


@app.get("/health")
def health():
    return {"status": "ok"}

import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

from fastapi import FastAPI
from schemas.pydantic_models import QueryRequest, QueryResponse, ValidarRequest, ValidarResponse, CalcularRequest, CalcularResponse, IntakeRequest, IntakeResponse, RecomendacionRequest
from agentes.grafo import app as grafo
from agentes.semantic_cache import inicializar_cache
from agentes.validador_legal import validar_conformidad, calcular_granja
from agentes.intake import generar_informe, recomendar_zona, consulta_ventas
from clients import qdrant_client
from qdrant_client.models import Filter, FieldCondition, MatchValue


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_cache()
    yield

app = FastAPI(lifespan=lifespan)


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


@app.post("/recomendar")
def recomendar(request: RecomendacionRequest):
    return recomendar_zona(request.datos)


def _argumentos_brief() -> list[str]:
    """Recupera chunks del brief aviario y extrae argumentos via Gemini."""
    import os
    try:
        result = qdrant_client.scroll(
            collection_name=os.getenv("COLLECTION_NAME", "normativa_aviario"),
            scroll_filter=Filter(
                must=[FieldCondition(key="tipo", match=MatchValue(value="argumentario_ventas"))]
            ),
            limit=20,
            with_payload=["contenido"],
            with_vectors=False,
        )
        chunks = [p.payload.get("contenido", "") for p in result[0] if p.payload.get("contenido")]
        if not chunks:
            return []
        texto_brief = "\n\n".join(chunks)
        query = (
            f"Dado el siguiente contenido de un brief comercial de Gómez y Crespo sobre su sistema "
            f"aviario industrial:\n\n{texto_brief}\n\n"
            f"Extrae una lista de 5 a 7 argumentos de venta clave, concisos y persuasivos. "
            f"Devuelve SOLO los argumentos, uno por línea, comenzando cada uno con '- '. "
            f"Sin títulos, sin numeración, sin texto adicional."
        )
        resultado = grafo.invoke({"query": query})
        lineas = resultado["answer"].strip().split("\n")
        argumentos = [l.lstrip("- •*").strip() for l in lineas if l.strip() and l.strip() not in ("-", "•", "*")]
        return [a for a in argumentos if len(a) > 10]
    except Exception as e:
        logging.error(f"Error recuperando argumentos brief: {e}")
        return []


@app.post("/intake", response_model=IntakeResponse)
def intake(request: IntakeRequest):
    informe = generar_informe(request.datos)
    resultado_rag = grafo.invoke({"query": informe.consulta_rag})
    resultado_ventas = grafo.invoke({"query": consulta_ventas(request.datos, informe.requisitos)})
    argumentos = _argumentos_brief()
    return IntakeResponse(
        informe=informe,
        analisis_legal=resultado_rag["answer"],
        argumentario_ventas=resultado_ventas["answer"],
        argumentos_producto=argumentos,
    )


@app.get("/health")
def health():
    return {"status": "ok"}

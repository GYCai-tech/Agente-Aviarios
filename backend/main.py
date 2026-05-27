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
from pydantic import BaseModel
from schemas.pydantic_models import (
    QueryRequest, QueryResponse, ValidarRequest, ValidarResponse,
    CalcularRequest, CalcularResponse, IntakeRequest, IntakeResponse,
    RecomendacionRequest, FactibilidadRequest, FactibilidadResponse,
    RecomendacionConRespuestasRequest, Objecion,
)
from agentes.grafo import app as grafo
from agentes.semantic_cache import inicializar_cache
from agentes.validador_legal import validar_conformidad, calcular_granja
from agentes.intake import generar_informe, recomendar_zona, consulta_ventas, calcular_factibilidad, preguntas_dinamicas, calcular_capacidad, ResultadoCapacidad
from agentes.nidal_layout import optimizar_nidal, ResultadoLayoutNidal
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
    return ValidarResponse(informe=informe, analisis_legal=resultado_rag["answer"])


@app.post("/calcular", response_model=CalcularResponse)
def calcular(request: CalcularRequest):
    informe = calcular_granja(request.datos)
    resultado_rag = grafo.invoke({"query": informe.consulta_rag})
    return CalcularResponse(informe=informe, analisis_legal=resultado_rag["answer"])


@app.post("/factibilidad", response_model=FactibilidadResponse)
def factibilidad(request: FactibilidadRequest):
    fact = calcular_factibilidad(request.datos)
    preguntas = preguntas_dinamicas(fact)
    return FactibilidadResponse(factibilidad=fact, preguntas=preguntas)


@app.post("/capacidad", response_model=ResultadoCapacidad)
def capacidad(request: FactibilidadRequest):
    return calcular_capacidad(request.datos)


class LayoutNidalRequest(BaseModel):
    ancho_nave: float
    largo_nave: float
    sistema: str


@app.post("/layout-nidal", response_model=ResultadoLayoutNidal)
def layout_nidal(request: LayoutNidalRequest):
    return optimizar_nidal(request.ancho_nave, request.largo_nave, request.sistema)


@app.post("/recomendar")
def recomendar(request: RecomendacionRequest):
    return recomendar_zona(request.datos)


@app.post("/recomendar-con-respuestas")
def recomendar_con_respuestas(request: RecomendacionConRespuestasRequest):
    return recomendar_zona(request.datos, respuestas=request.respuestas)


def _argumentos_brief(tipo_zona: str) -> list[str]:
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
        producto_label = (
            "sistema aviario industrial multinivel (código 10007)"
            if tipo_zona == "aviario"
            else "sistema de nidales colectivos A-Nida Plus"
        )
        query = (
            f"Eres comercial experto de Gómez y Crespo. Brief comercial del {producto_label}:\n\n"
            f"{texto_brief}\n\n"
            f"Redacta exactamente 5 argumentos de venta persuasivos orientados al BENEFICIO del granjero "
            f"(rentabilidad, ahorro, bienestar animal, cumplimiento normativo, facilidad de manejo). "
            f"Cada argumento debe ser una frase completa y convincente. "
            f"PROHIBIDO: cifras sueltas, densidades en gal/m², medidas en m² o cm, tablas de datos. "
            f"Solo frases de beneficio comercial. "
            f"Devuelve ÚNICAMENTE los 5 argumentos, uno por línea, sin guiones ni numeración."
        )
        resultado = grafo.invoke({"query": query})
        lineas = resultado["answer"].strip().split("\n")
        argumentos = [l.lstrip("0123456789.-•* )").strip() for l in lineas if l.strip()]
        return [a for a in argumentos if len(a) > 20][:6]
    except Exception as e:
        logging.error(f"Error recuperando argumentos brief: {e}")
        return []


_OBJECIONES_FALLBACK = {
    "aviario": [
        Objecion(pregunta="¿No es demasiado costosa la inversión inicial?",
                 respuesta="El ROI medio es inferior a 3 años: la superficie extra por m² de nave amortiza la inversión en el primer ciclo productivo ampliado."),
        Objecion(pregunta="¿Cómo se gestiona el mantenimiento con varios niveles?",
                 respuesta="Las bandejas extractables permiten retirar los residuos nivel a nivel sin detener la producción. Nuestro equipo ofrece formación in situ."),
        Objecion(pregunta="¿Cumple el aviario la normativa de bienestar animal?",
                 respuesta="Sí. Certificado para producción campero y ecológico, cumple la Directiva 1999/74/CE en todos sus niveles operativos."),
    ],
    "nidal_colectivo": [
        Objecion(pregunta="¿No ocupan demasiado espacio en la nave?",
                 respuesta="El cuerpo del módulo solo ocupa 1,68 m². El slot acoplado es zona habitable que computa para densidad normativa."),
        Objecion(pregunta="¿Es difícil la limpieza y desinfección?",
                 respuesta="El diseño abierto en chapa permite limpiar sin desmontar. Las superficies minimizan zonas ocultas donde prolifera el ácaro rojo."),
        Objecion(pregunta="¿Es rentable desde el primer módulo?",
                 respuesta="Desde 144 gallinas ya es rentable. El sistema es modular: se amplía añadiendo módulos sin obras ni parada de producción."),
    ],
}


def _parse_objeciones(texto: str) -> list[Objecion]:
    import re
    objeciones = []
    bloques = re.split(r'OBJECION:\s*', texto, flags=re.IGNORECASE)
    for bloque in bloques[1:]:
        partes = re.split(r'RESPUESTA:\s*', bloque, flags=re.IGNORECASE, maxsplit=1)
        if len(partes) == 2:
            pregunta = partes[0].strip().strip('"').strip()
            respuesta = re.split(r'\nOBJECION:', partes[1], flags=re.IGNORECASE)[0].strip()
            if len(pregunta) > 5 and len(respuesta) > 5:
                objeciones.append(Objecion(pregunta=pregunta, respuesta=respuesta))
    return objeciones[:3]


def _objeciones_producto(datos) -> list[Objecion]:
    sistema_label = {
        "suelo": "en suelo", "campero": "campero",
        "ecologico": "ecológico", "jaulas": "en jaulas enriquecidas",
    }[datos.sistema]
    zona_label = "aviario multinivel" if datos.tipo_zona == "aviario" else "nidal colectivo A-Nida"
    query = (
        f"Eres asesor comercial de Gómez y Crespo. Un granjero con {datos.num_gallinas} gallinas "
        f"en sistema {sistema_label}, nave de {datos.superficie_nave_m2} m², "
        f"está considerando instalar {zona_label}. "
        f"Genera exactamente 3 objeciones de venta típicas de este perfil y su respuesta comercial. "
        f"Formato estricto sin texto adicional:\n"
        f"OBJECION: [texto corto de la objeción]\n"
        f"RESPUESTA: [respuesta en 1-2 frases]\n"
        f"OBJECION: [segunda objeción]\n"
        f"RESPUESTA: [respuesta]\n"
        f"OBJECION: [tercera objeción]\n"
        f"RESPUESTA: [respuesta]"
    )
    try:
        resultado = grafo.invoke({"query": query})
        parsed = _parse_objeciones(resultado["answer"])
        if len(parsed) >= 2:
            return parsed
    except Exception as e:
        logging.error(f"Error generando objeciones: {e}")
    return _OBJECIONES_FALLBACK.get(datos.tipo_zona, [])


@app.post("/intake", response_model=IntakeResponse)
def intake(request: IntakeRequest):
    informe = generar_informe(request.datos)
    resultado_rag = grafo.invoke({"query": informe.consulta_rag})
    resultado_ventas = grafo.invoke({"query": consulta_ventas(request.datos, informe.requisitos)})
    argumentos = _argumentos_brief(request.datos.tipo_zona)
    objeciones = _objeciones_producto(request.datos)
    return IntakeResponse(
        informe=informe,
        analisis_legal=resultado_rag["answer"],
        argumentario_ventas=resultado_ventas["answer"],
        argumentos_producto=argumentos,
        objeciones=objeciones,
    )


@app.get("/health")
def health():
    return {"status": "ok"}

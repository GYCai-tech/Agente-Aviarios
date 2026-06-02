import logging
import os
import base64
import json as _json
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

import google.generativeai as _genai
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
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
from agentes.nidal_layout import optimizar_nidal, ResultadoLayoutNidal, maximizar_nidal, ResultadoMaximizacion
from agentes.plano_agent import (
    PlanoRequest, PlanoResponse, generar_plano_svg,
    LayoutConfig, LayoutConfigResponse, generar_desde_config,
)
from clients import qdrant_client
from qdrant_client.models import Filter, FieldCondition, MatchValue


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_cache()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class MaximizarNidalRequest(BaseModel):
    ancho_nave: float
    largo_nave: float
    gallinas: int
    sistema: str = "suelo"
    sup_exterior_m2: float = 0.0


@app.post("/maximizar-nidal", response_model=ResultadoMaximizacion)
def maximizar_nidal_endpoint(request: MaximizarNidalRequest):
    return maximizar_nidal(
        ancho_nave=request.ancho_nave,
        largo_nave=request.largo_nave,
        gallinas=request.gallinas,
        sistema=request.sistema,
        sup_exterior_m2=request.sup_exterior_m2,
    )


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


@app.post("/plano", response_model=PlanoResponse)
def plano(request: PlanoRequest):
    return generar_plano_svg(request)


@app.post("/plano-config", response_model=LayoutConfigResponse)
def plano_config(request: LayoutConfig):
    return generar_desde_config(request)


class PlanoImagenResponse(BaseModel):
    ancho_m: float | None = None
    largo_m: float | None = None
    altura_cm: float | None = None
    confianza: float = 0.0
    notas: str = ""


@app.post("/analizar-plano-imagen", response_model=PlanoImagenResponse)
async def analizar_plano_imagen(file: UploadFile = File(...)):
    contents = await file.read()
    mime_type = file.content_type or "image/jpeg"
    b64 = base64.b64encode(contents).decode()

    _genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = _genai.GenerativeModel("gemini-2.0-flash")

    prompt = (
        "Analiza esta imagen. Puede ser un plano arquitectónico, fotografía de una nave agrícola "
        "o avícola, croquis, o cualquier imagen que muestre dimensiones de un edificio o recinto.\n\n"
        "Extrae las siguientes medidas si son visibles:\n"
        "- ancho_m: dimensión más corta de la nave en metros (número decimal)\n"
        "- largo_m: dimensión más larga de la nave en metros (número decimal)\n"
        "- altura_cm: altura libre interior si aparece (en centímetros, número decimal)\n\n"
        "Responde ÚNICAMENTE con JSON válido sin markdown ni texto adicional:\n"
        '{"ancho_m":<float|null>,"largo_m":<float|null>,"altura_cm":<float|null>,'
        '"confianza":<0.0-1.0>,"notas":"<descripción breve en español de lo detectado>"}'
    )

    try:
        response = model.generate_content([
            {"inline_data": {"mime_type": mime_type, "data": b64}},
            prompt,
        ])
        text = response.text.strip()
        if "```" in text:
            text = text.split("```")[1].lstrip("json").strip()
        parsed = _json.loads(text)
        return PlanoImagenResponse(**{k: parsed.get(k) for k in PlanoImagenResponse.model_fields})
    except Exception as e:
        logging.error(f"Error analizando plano: {e}")
        return PlanoImagenResponse(notas="No se pudieron extraer dimensiones de la imagen.")


class ConsultaLibreRequest(BaseModel):
    pregunta: str
    num_gallinas: int
    sistema: str
    superficie_nave_m2: float
    altura_nave_cm: float
    tipo_zona: str | None = None


class ConsultaLibreResponse(BaseModel):
    respuesta: str


@app.post("/consulta-libre", response_model=ConsultaLibreResponse)
async def consulta_libre(request: ConsultaLibreRequest):
    from agentes.retriever import retriever_context
    from agentes.reranker import reranking

    sistema_label = {
        "suelo": "en suelo", "campero": "campero",
        "ecologico": "ecológico", "jaulas": "en jaulas enriquecidas",
    }.get(request.sistema, request.sistema)

    producto_label = "aviario industrial multinivel" if request.tipo_zona == "aviario" else "nidal colectivo A-Nida"

    query_enriquecida = (
        f"Granja de {request.num_gallinas} gallinas en sistema {sistema_label}, "
        f"nave de {request.superficie_nave_m2} m², altura {request.altura_nave_cm} cm, "
        f"producto recomendado: {producto_label}. "
        f"Pregunta del cliente: {request.pregunta}"
    )

    chunks = retriever_context(
        text=query_enriquecida,
        model=os.getenv("EMBEDDING_MODEL"),
        api=os.getenv("GOOGLE_API_KEY"),
        collection_name=os.getenv("COLLECTION_NAME", "normativa_aviario"),
    )
    chunks = reranking(query=query_enriquecida, chunks=chunks)
    contexto = "\n\n".join(c["contenido"] for c in chunks[:6])

    system_prompt = (
        "Eres el asesor técnico-comercial de Gómez y Crespo durante una visita a una granja avícola. "
        "El comercial te hace llegar una pregunta del cliente. Responde de forma clara, directa y profesional. "
        "Cita normativa cuando sea relevante (RD 3/2002, Directiva 1999/74/CE, etc.). "
        "Si el contexto no cubre la pregunta, responde con lo que sabes y señala qué habría que consultar. "
        "Responde SIEMPRE en español. Máximo 4 párrafos cortos.\n\n"
        f"CONTEXTO DEL CLIENTE:\n"
        f"- {request.num_gallinas} gallinas ponedoras\n"
        f"- Sistema: {sistema_label}\n"
        f"- Nave: {request.superficie_nave_m2} m², altura {request.altura_nave_cm} cm\n"
        f"- Producto recomendado: {producto_label}\n\n"
        f"DOCUMENTACIÓN DE REFERENCIA:\n{contexto}"
    )

    _genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = _genai.GenerativeModel(
        os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        system_instruction=system_prompt,
    )
    response = model.generate_content(request.pregunta)
    return ConsultaLibreResponse(respuesta=response.text.strip())


@app.get("/health")
def health():
    return {"status": "ok"}

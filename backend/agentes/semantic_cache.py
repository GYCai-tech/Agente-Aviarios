from qdrant_client.models import Distance, VectorParams, PointStruct
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import uuid
import logging
from clients import qdrant_client

logger = logging.getLogger(__name__)


def inicializar_cache():
    try:
        nombres = [c.name for c in qdrant_client.get_collections().collections]
    except Exception as e:
        logger.warning(f"Qdrant no disponible, cache desactivado: {e}")
        return
    if "cache_respuestas" not in nombres:
        try:
            qdrant_client.create_collection(
                collection_name="cache_respuestas",
                vectors_config=VectorParams(size=3072, distance=Distance.COSINE)
            )
            logger.info("Cache collection created")
        except Exception as e:
            logger.error(f"Error while creating cache collection: {e}")


def buscar_cache(query, embedder, score=0.92):
    try:
        embedding = embedder.embed_query(query)
        results = qdrant_client.query_points(
            collection_name="cache_respuestas",
            query=embedding,
            limit=1
        )
        points = results.points
        if points and points[0].score > score:
            return points[0].payload["respuesta"]
    except Exception as e:
        logger.warning(f"Cache lookup failed: {e}")
    return None


def guardar_cache(query, embedder, respuesta):
    embedding = embedder.embed_query(query)
    qdrant_client.upsert(
        collection_name="cache_respuestas",
        points=[
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={"respuesta": respuesta}
            )
        ]
    )

from langchain_google_genai import GoogleGenerativeAIEmbeddings
import logging
from clients import qdrant_client

logger = logging.getLogger(__name__)


def retriever_context(text, model, api, collection_name):
    embedder = GoogleGenerativeAIEmbeddings(model=model, google_api_key=api)
    embedding = embedder.embed_query(text)
    try:
        result = qdrant_client.query_points(collection_name=collection_name, query=embedding, limit=20)
        context = [
            {
                "contenido": p.payload.get("contenido", ""),
                "source": p.payload.get("source", "desconocido"),
                "page": p.payload.get("page", 0),
                "score": p.score,
            }
            for p in result.points
        ]
        logger.info(f"Query returned {len(context)} results")
    except Exception as e:
        logger.error(f"Qdrant query failed: {e}")
        return None
    return context

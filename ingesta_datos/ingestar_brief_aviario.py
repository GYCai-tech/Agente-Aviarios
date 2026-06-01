from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from dotenv import load_dotenv
import os
import uuid
import logging
from datetime import date

load_dotenv(dotenv_path=r"C:\Users\santiago.arce\Desktop\Proyectos\Agente Aviario\.env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

PDF_PATH = r"M:\04 Marketing\06_INDUSTRIAL\06.3_AVICULTURA PROFESIONAL\06.3.5_AVIARIO\GyC2501_BRIEF AVIARIO INDUSTRIAL.pdf"
TIPO = "argumentario_ventas"

api        = os.getenv("GOOGLE_API_KEY")
qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
collection = os.getenv("COLLECTION_NAME", "normativa_aviario")
emb_model  = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")

if __name__ == "__main__":
    logging.info(f"Cargando PDF: {PDF_PATH}")
    loader = PyPDFLoader(PDF_PATH)
    pages  = loader.load()
    logging.info(f"Páginas cargadas: {len(pages)}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=52)
    chunks   = splitter.split_documents(pages)
    logging.info(f"Chunks generados: {len(chunks)}")

    embedder   = GoogleGenerativeAIEmbeddings(model=emb_model, google_api_key=api)
    textos     = [c.page_content for c in chunks]
    vectores   = embedder.embed_documents(textos)
    logging.info(f"Embeddings generados: {len(vectores)}")

    client   = QdrantClient(url=qdrant_url)
    today    = date.today().isoformat()
    source   = os.path.basename(PDF_PATH)

    for i in range(0, len(vectores), 100):
        puntos = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=v,
                payload={
                    "contenido":      t,
                    "source":         source,
                    "page":           chunks[i + j].metadata.get("page", 0),
                    "ingestion_date": today,
                    "tipo":           TIPO,
                }
            )
            for j, (v, t) in enumerate(zip(vectores[i:i+100], textos[i:i+100]))
        ]
        resultado = client.upsert(collection_name=collection, points=puntos)
        logging.info(f"Batch {i//100 + 1} subido: {resultado}")

    logging.info("Ingesta completada.")

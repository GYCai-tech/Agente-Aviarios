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

DOCUMENTOS = [
    {
        "path": r"M:\01 Comercial\010 Clientes\P00362  NELLY MARIBEL RUIZ VERA\Nelly Maribel-- despiece.pdf",
        "tipo": "presupuesto_cliente",
        "cliente": "Nelly Maribel Ruiz Vera",
        "nif": "79243480-Q",
        "nave": "20x10",
        "sistema": "campero",
        "modulos": 9,
        "gallinas": 1290,
        "total_sin_iva": 16426.02,
    },
    {
        "path": r"M:\01 Comercial\010 Clientes\P00362  NELLY MARIBEL RUIZ VERA\Nelly Maribel ultimo.pdf",
        "tipo": "presupuesto_cliente",
        "cliente": "Nelly Maribel Ruiz Vera",
        "nif": "79243480-Q",
        "nave": "17x10",
        "sistema": "campero",
        "modulos": 10,
        "gallinas": 1430,
        "total_sin_iva": 17517.20,
    },
]

api        = os.getenv("GOOGLE_API_KEY")
qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
collection = os.getenv("COLLECTION_NAME", "normativa_aviario")
emb_model  = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")

if __name__ == "__main__":
    embedder = GoogleGenerativeAIEmbeddings(model=emb_model, google_api_key=api)
    client   = QdrantClient(url=qdrant_url)
    today    = date.today().isoformat()
    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=52)

    for doc in DOCUMENTOS:
        logging.info(f"Cargando: {doc['path']}")
        loader = PyPDFLoader(doc["path"])
        pages  = loader.load()
        chunks = splitter.split_documents(pages)
        logging.info(f"  Páginas: {len(pages)} | Chunks: {len(chunks)}")

        textos  = [c.page_content for c in chunks]
        vectores = embedder.embed_documents(textos)

        source = os.path.basename(doc["path"])
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
                        "tipo":           doc["tipo"],
                        "cliente":        doc["cliente"],
                        "nif":            doc["nif"],
                        "nave":           doc["nave"],
                        "sistema":        doc["sistema"],
                        "modulos":        doc["modulos"],
                        "gallinas":       doc["gallinas"],
                        "total_sin_iva":  doc["total_sin_iva"],
                    }
                )
                for j, (v, t) in enumerate(zip(vectores[i:i+100], textos[i:i+100]))
            ]
            resultado = client.upsert(collection_name=collection, points=puntos)
            logging.info(f"  Batch {i//100 + 1} → {resultado}")

        logging.info(f"  OK: {source}")

    logging.info("Ingesta completada.")

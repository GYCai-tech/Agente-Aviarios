from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from dotenv import load_dotenv
import os
import uuid
import logging
from datetime import date

load_dotenv(dotenv_path=r"C:\Users\santiago.arce\Desktop\Proyectos\Agente Aviario\.env")

api = os.getenv("GOOGLE_API_KEY")
path = r"C:\Users\santiago.arce\Desktop\Proyectos\Agente Aviario\ingesta_datos\documentos_base"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


class Ingestor:

    def __init__(self, ebeddingmodel, path, chunk_size, chunk_overlap, google_api, qdrant_url, collection, vector_config):
        self.path = path
        self.ebeddingmodel = ebeddingmodel
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.google_api = google_api
        self.qdrant_url = qdrant_url
        self.collection = collection
        self.vector_config = vector_config

    def connect_qdrant(self):
        self.client = QdrantClient(url=self.qdrant_url)
        nombres = [c.name for c in self.client.get_collections().collections]
        if self.collection not in nombres:
            try:
                self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config=VectorParams(size=self.vector_config, distance=Distance.COSINE)
                )
                logging.info("Collection created")
            except Exception as e:
                logging.error(f"Error while creating the collection: {e}")

    def _documentos_ya_indexados(self):
        indexados = set()
        offset = None
        while True:
            result = self.client.scroll(
                collection_name=self.collection,
                scroll_filter=None,
                limit=1000,
                offset=offset,
                with_payload=["source"],
                with_vectors=False,
            )
            points, next_offset = result
            for p in points:
                if "source" in p.payload:
                    indexados.add(p.payload["source"])
            if next_offset is None:
                break
            offset = next_offset
        return indexados

    def cargar_docs(self):
        self.connect_qdrant()
        ya_indexados = self._documentos_ya_indexados()
        if ya_indexados:
            logging.info(f"Documentos ya indexados (se omiten): {sorted(ya_indexados)}")

        loader = DirectoryLoader(self.path, glob="**/*.pdf", loader_cls=PyPDFLoader)
        todos = loader.load()

        self.docs = [d for d in todos if os.path.basename(d.metadata.get("source", "")) not in ya_indexados]
        nuevos = {os.path.basename(d.metadata.get("source", "")) for d in self.docs}

        if not nuevos:
            logging.info("No hay documentos nuevos para indexar.")
        else:
            logging.info(f"Documentos nuevos a indexar: {sorted(nuevos)}")

    def chunking(self):
        splitter = RecursiveCharacterTextSplitter(chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
        self.chunks = splitter.split_documents(self.docs)

    def embeddings(self):
        if not self.chunks:
            self.embedding = []
            self.chunks_ready = []
            return
        self.embedator = GoogleGenerativeAIEmbeddings(model=self.ebeddingmodel, google_api_key=self.google_api)
        self.chunks_ready = [chunk.page_content for chunk in self.chunks]
        self.embedding = self.embedator.embed_documents(self.chunks_ready)

    def subir(self):
        if not self.embedding:
            logging.info("Nada que subir.")
            return
        today = date.today().isoformat()
        for i in range(0, len(self.embedding), 100):
            grupo_vectors = self.embedding[i:i+100]
            grupo_textos = self.chunks_ready[i:i+100]
            grupo_chunks = self.chunks[i:i+100]
            puntos = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "contenido": texto,
                        "source": os.path.basename(doc.metadata.get("source", "")),
                        "page": doc.metadata.get("page", 0),
                        "ingestion_date": today,
                    }
                )
                for vector, texto, doc in zip(grupo_vectors, grupo_textos, grupo_chunks)
            ]
            try:
                resultado = self.client.upsert(collection_name=self.collection, points=puntos)
                logging.info(f"Batch subido: {resultado}")
            except Exception as e:
                logging.error(f"Error al subir batch: {e}")


if __name__ == "__main__":
    ingestor = Ingestor(
        ebeddingmodel=os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001"),
        path=path,
        chunk_size=512,
        chunk_overlap=52,
        google_api=api,
        qdrant_url=os.getenv("QDRANT_URL", "http://localhost:6333"),
        collection=os.getenv("COLLECTION_NAME", "normativa_aviario"),
        vector_config=3072
    )
    ingestor.cargar_docs()
    ingestor.chunking()
    ingestor.embeddings()
    ingestor.subir()

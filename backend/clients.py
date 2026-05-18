import os
from qdrant_client import QdrantClient

qdrant_client = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))

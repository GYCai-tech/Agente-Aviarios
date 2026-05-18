from sentence_transformers import CrossEncoder
import numpy as np

model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def reranking(query, chunks):
    textos = [str(chunk["contenido"]) for chunk in chunks]
    pairs = [[query, texto] for texto in textos]
    puntuations = model.predict(pairs)
    indices = np.argsort(puntuations)[::-1][:5]
    return [chunks[i] for i in indices]

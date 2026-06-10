import os
from typing import TypedDict
from langgraph.graph import StateGraph, END
from .retriever import retriever_context
from .generator import generator
from .semantic_cache import buscar_cache, guardar_cache
from langchain_google_genai import GoogleGenerativeAIEmbeddings


class RAGState(TypedDict):
    cache_hit: bool
    query: str
    context: list
    answer: str


def node_cache(state: RAGState):
    embedder = GoogleGenerativeAIEmbeddings(
        model=os.getenv("EMBEDDING_MODEL"),
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )
    respuesta = buscar_cache(query=state["query"], embedder=embedder)
    if respuesta:
        return {"answer": respuesta, "cache_hit": True}
    return {"cache_hit": False}


def decidir_ruta(state: RAGState):
    if state["cache_hit"]:
        return "end"
    return "retriever"


def node_retriever(state: RAGState):
    result = retriever_context(
        text=state["query"],
        model=os.getenv("EMBEDDING_MODEL"),
        api=os.getenv("GOOGLE_API_KEY"),
        collection_name=os.getenv("COLLECTION_NAME", "normativa_aviario")
    )
    return {"context": result}


def node_generator(state: RAGState):
    result = generator(
        api=os.getenv("GOOGLE_API_KEY"),
        model=os.getenv("GEMINI_MODEL"),
        context=state["context"],
        query=state["query"],
    )
    return {"answer": result.content}


def node_save_cache(state: RAGState):
    try:
        embedder = GoogleGenerativeAIEmbeddings(
            model=os.getenv("EMBEDDING_MODEL"),
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        guardar_cache(
            query=state["query"],
            embedder=embedder,
            respuesta=state["answer"]
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Cache save skipped (Qdrant unavailable): {e}")
    return {}


graph = StateGraph(RAGState)

graph.add_node("cache", node_cache)
graph.add_node("retriever", node_retriever)
graph.add_node("generator", node_generator)
graph.add_node("save_cache", node_save_cache)

graph.set_entry_point("cache")

graph.add_conditional_edges(
    "cache",
    decidir_ruta,
    {"end": END, "retriever": "retriever"}
)

graph.add_edge("retriever", "generator")
graph.add_edge("generator", "save_cache")
graph.add_edge("save_cache", END)

app = graph.compile()

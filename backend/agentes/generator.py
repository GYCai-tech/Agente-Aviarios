import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from agentes.prompts import rag_prompt

logger = logging.getLogger(__name__)


def generator(api, model, context, query):
    llm = ChatGoogleGenerativeAI(model=model, google_api_key=api)
    context_join = "\n\n".join([r["contenido"] for r in context])
    chain = rag_prompt | llm
    try:
        answer = chain.invoke({"contexto": context_join, "pregunta": query})
        return answer
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise

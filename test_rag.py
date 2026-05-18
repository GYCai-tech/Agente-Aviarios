import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from dotenv import load_dotenv

load_dotenv(dotenv_path=r"C:\Users\santiago.arce\Desktop\Proyectos\Agente Aviario\.env")

from agentes.grafo import app
from agentes.semantic_cache import inicializar_cache

inicializar_cache()

pregunta = "¿Cuáles son los requisitos sanitarios para la cría de aves de corral?"

resultado = app.invoke({"query": pregunta})

print(f"Cache hit: {resultado.get('cache_hit', False)}")
print(resultado["answer"])

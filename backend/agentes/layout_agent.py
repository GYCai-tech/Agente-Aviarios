"""
Agente de layout para nidal colectivo A-Nida.
Gemini razona las posibilidades de configuración en planta y verifica
constraints duras (yacija, densidad, dimensional) con herramientas Python.
Si la yacija interior no es suficiente, indica el déficit y solicita exterior.
"""
import json
import math
import os
import re
from pathlib import Path
from typing import Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

# ── Constantes físicas ────────────────────────────────────────────────────────
_NIDAL_LARGO  = 1.20   # m — a lo largo de nave (encadenamiento)
_NIDAL_ANCHO  = 1.40   # m — cruza el ancho de nave (profundidad del cuerpo)
_NIDAL_CUERPO = round(_NIDAL_LARGO * _NIDAL_ANCHO, 4)  # 1.68 m²
_NIDAL_CAP    = 144    # gallinas/módulo

# ── Carga de especificaciones ─────────────────────────────────────────────────
_DOCS = Path(__file__).parent.parent.parent / "docs"

def _leer_specs() -> str:
    partes = []
    for nombre in ("specs_nidal_anida.md", "specs_aviario_industrial.md"):
        p = _DOCS / nombre
        if p.exists():
            partes.append(p.read_text(encoding="utf-8"))
    return "\n\n---\n\n".join(partes)


# ── Herramientas Python (constraints duras) ───────────────────────────────────

@tool
def modulos_necesarios(gallinas: int) -> dict:
    """Calcula el número mínimo de módulos A-Nida para alojar las gallinas (144 gal/módulo)."""
    n = math.ceil(gallinas / _NIDAL_CAP)
    return {
        "modulos_minimos": n,
        "capacidad_total": n * _NIDAL_CAP,
    }


@tool
def max_modulos_fila(largo_nave_m: float) -> dict:
    """
    Máximo de módulos que caben en una fila a lo largo de la nave.
    Los módulos se encadenan sin separación; cada uno ocupa 1,20 m de largo.
    """
    n = math.floor(largo_nave_m / _NIDAL_LARGO)
    return {
        "max_modulos": n,
        "largo_usado_m": round(n * _NIDAL_LARGO, 2),
        "sobrante_m": round(largo_nave_m - n * _NIDAL_LARGO, 2),
    }


@tool
def verificar_fila(
    ancho_nave_m: float,
    slot_izq_m: int,
    slot_der_m: int,
    pegada_pared_izq: bool = False,
    pegada_pared_der: bool = False,
) -> dict:
    """
    Verifica si una fila de nidales cabe en el ancho de la nave.

    Reglas:
    - slot=0 solo si la fila va pegada a esa pared (sin acceso por ese lado).
    - slot mínimo = 1 m si hay acceso.
    - prof_total = 1,40 (cuerpo) + slot_izq + slot_der debe caber en ancho_nave.

    Args:
        ancho_nave_m: Ancho de la nave en metros.
        slot_izq_m: Longitud del slot izquierdo (0, 1, 2 o 3 m).
        slot_der_m: Longitud del slot derecho (0, 1, 2 o 3 m).
        pegada_pared_izq: True si la fila va pegada a la pared izquierda.
        pegada_pared_der: True si la fila va pegada a la pared derecha.
    """
    if pegada_pared_izq and slot_izq_m != 0:
        return {"valido": False, "error": "slot_izq debe ser 0 si va pegada a pared izquierda"}
    if pegada_pared_der and slot_der_m != 0:
        return {"valido": False, "error": "slot_der debe ser 0 si va pegada a pared derecha"}
    if not pegada_pared_izq and slot_izq_m == 0:
        return {"valido": False, "error": "slot_izq=0 solo si la fila va pegada a pared izquierda"}
    if not pegada_pared_der and slot_der_m == 0:
        return {"valido": False, "error": "slot_der=0 solo si la fila va pegada a pared derecha"}
    if slot_izq_m not in (0, 1, 2, 3) or slot_der_m not in (0, 1, 2, 3):
        return {"valido": False, "error": "Los slots solo pueden ser 0, 1, 2 o 3 metros"}

    prof = _NIDAL_ANCHO + slot_izq_m + slot_der_m
    valido = prof <= ancho_nave_m
    return {
        "valido": valido,
        "prof_total_m": round(prof, 2),
        "espacio_sobrante_m": round(ancho_nave_m - prof, 2),
        "error": f"No cabe: necesita {prof:.2f} m, nave tiene {ancho_nave_m:.2f} m" if not valido else None,
    }


class FilaInput(BaseModel):
    num_modulos: int
    slot_izq: int
    slot_der: int


@tool
def calcular_yacija(nave_m2: float, filas: list[FilaInput]) -> dict:
    """
    Calcula la superficie de yacija interior dado un layout de filas de nidales.

    Args:
        nave_m2: Superficie total de la nave en m².
        filas: Lista de filas, cada una con num_modulos, slot_izq y slot_der.

    Notas:
    - Cuerpo del módulo (1,68 m²) NO computa como yacija NI como sup. efectiva.
    - Slats NO computan como yacija, pero SÍ computan para densidad.
    - sup_yacija  = nave_m2 - sum(n x (1,68 + 1,20 x (slot_izq + slot_der)))
    - sup_efectiva = nave_m2 - sum(n x 1,68)
    """
    sup_cuerpos = 0.0
    sup_slots = 0.0
    total_modulos = 0

    for fila in filas:
        n = int(fila.num_modulos)
        si = int(fila.slot_izq)
        sd = int(fila.slot_der)
        sup_cuerpos += n * _NIDAL_CUERPO
        sup_slots += n * _NIDAL_LARGO * (si + sd)
        total_modulos += n

    sup_efectiva = round(nave_m2 - sup_cuerpos, 2)
    yacija = round(nave_m2 - sup_cuerpos - sup_slots, 2)
    yacija_min = round(nave_m2 / 3, 2)

    return {
        "total_modulos": total_modulos,
        "sup_efectiva_m2": sup_efectiva,
        "yacija_interior_m2": yacija,
        "yacija_minima_nave_m2": yacija_min,
        "cumple_yacija_interior": yacija >= yacija_min,
        "deficit_interior_m2": round(yacija_min - yacija, 2) if yacija < yacija_min else 0,
        "sup_cuerpos_m2": round(sup_cuerpos, 2),
        "sup_slots_m2": round(sup_slots, 2),
    }


@tool
def verificar_normativa(
    gallinas: int,
    sup_efectiva_m2: float,
    yacija_interior_m2: float,
    nave_m2: float,
    sistema: str,
    exterior_m2: float = 0,
) -> dict:
    """
    Verifica el cumplimiento normativo completo (densidad + yacija).

    Args:
        gallinas: Número de gallinas.
        sup_efectiva_m2: Superficie efectiva (nave - cuerpos de módulos).
        yacija_interior_m2: Yacija interior calculada.
        nave_m2: Superficie total de la nave.
        sistema: "suelo", "campero" o "ecologico".
        exterior_m2: Superficie exterior disponible (0 si no hay).

    Nota: Para campero/ecológico la yacija exterior puede compensar la interior.
    Para suelo solo computa la interior.
    """
    densidad_max = 6.0 if sistema == "ecologico" else 9.0
    densidad_real = round(gallinas / sup_efectiva_m2, 2) if sup_efectiva_m2 > 0 else float("inf")
    cumple_densidad = densidad_real <= densidad_max

    yacija_min_tercio = round(nave_m2 / 3, 2)
    yacija_min_gallinas = round(gallinas * 250 / 10_000, 2)
    yacija_requerida = max(yacija_min_tercio, yacija_min_gallinas)

    if sistema in ("campero", "ecologico"):
        yacija_computable = yacija_interior_m2 + exterior_m2
        nota_exterior = f"Exterior computable ({exterior_m2} m²) según Regl. CE 589/2008."
    else:
        yacija_computable = yacija_interior_m2
        nota_exterior = "Sistema suelo: solo computa yacija interior."

    cumple_yacija = yacija_computable >= yacija_requerida

    return {
        "densidad_real": densidad_real,
        "densidad_max": densidad_max,
        "cumple_densidad": cumple_densidad,
        "yacija_requerida_m2": yacija_requerida,
        "yacija_computable_m2": round(yacija_computable, 2),
        "cumple_yacija": cumple_yacija,
        "deficit_yacija_m2": round(yacija_requerida - yacija_computable, 2) if not cumple_yacija else 0,
        "exterior_exterior_m2": exterior_m2,
        "nota": nota_exterior,
    }


# ── Modelos de respuesta ──────────────────────────────────────────────────────

class FilaLayout(BaseModel):
    num_modulos: int
    slot_izq: int
    slot_der: int
    pegada_pared_izq: bool = False
    pegada_pared_der: bool = False


class ResultadoLayout(BaseModel):
    viable: bool
    filas: list[FilaLayout] = []
    total_modulos: int = 0
    max_gallinas: int = 0
    yacija_interior_m2: float = 0
    yacija_exterior_m2: float = 0
    cumple_normativa: bool = False
    necesita_exterior: bool = False
    deficit_yacija_m2: float = 0
    explicacion: str = ""
    error: Optional[str] = None


# ── Agente principal ──────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
Eres un experto en diseño de instalaciones avícolas de Gómez y Crespo.
Tu tarea es diseñar el layout óptimo de nidales colectivos A-Nida en una nave.

ESPECIFICACIONES TÉCNICAS:
{specs}

OBJETIVO:
1. Determinar cuántas filas de nidales caben en el ancho de la nave.
2. Determinar cuántos módulos por fila caben en el largo.
3. Maximizar gallinas alojadas sin superar la densidad máxima legal.
4. Garantizar que la superficie de yacija cumpla normativa (≥ 1/3 de la nave).
5. Si la yacija interior es insuficiente en todas las configuraciones viables,
   informar del déficit y preguntar si hay superficie exterior disponible.

REGLAS DE DISEÑO:
- Los nidales NUNCA van espalda con espalda.
- Si hay varias filas paralelas, entre ellas debe haber al menos 1 m de pasillo.
- Una fila puede ir pegada a pared lateral (slot=0 en ese lado, sin clearance mínimo).
- slot=0 SOLO está permitido si la fila va pegada a esa pared.
- Prueba primero slots de 3 m; reduce si no cabe o si la yacija no cumple.
- Usa siempre las herramientas para verificar antes de proponer.

Responde SIEMPRE con un bloque JSON con esta estructura exacta:
```json
{{
  "viable": true,
  "filas": [
    {{"num_modulos": 10, "slot_izq": 3, "slot_der": 3, "pegada_pared_izq": false, "pegada_pared_der": false}}
  ],
  "total_modulos": 10,
  "max_gallinas": 1440,
  "yacija_interior_m2": 120.5,
  "yacija_exterior_m2": 0,
  "cumple_normativa": true,
  "necesita_exterior": false,
  "deficit_yacija_m2": 0,
  "explicacion": "Una fila de 10 módulos con slots 3+3 m."
}}
```
"""


_TOOLS = [modulos_necesarios, max_modulos_fila, verificar_fila, calcular_yacija, verificar_normativa]
_TOOLS_BY_NAME = {t.name: t for t in _TOOLS}


def disenar_layout_nidal(
    nave_m2: float,
    ancho_nave_m: float,
    largo_nave_m: float,
    gallinas: int,
    sistema: str,
    exterior_m2: float = 0,
) -> ResultadoLayout:
    """
    Diseña el layout óptimo de nidales A-Nida en la nave usando Gemini.
    Si exterior_m2=0 y la yacija interior no alcanza, devuelve necesita_exterior=True.
    """
    specs = _leer_specs()
    densidad_max = 6.0 if sistema == "ecologico" else 9.0
    yacija_minima = round(nave_m2 / 3, 1)

    _base_llm = ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0,
    )
    llm          = _base_llm.bind_tools(_TOOLS)
    llm_no_tools = _base_llm  # sin herramientas → fuerza respuesta de texto

    system_msg = SystemMessage(content=_SYSTEM_PROMPT.format(specs=specs))
    user_msg = HumanMessage(content=f"""
Diseña el layout de nidales A-Nida para esta nave:
- Superficie nave: {nave_m2} m²
- Ancho nave: {ancho_nave_m} m
- Largo nave: {largo_nave_m} m
- Gallinas a alojar: {gallinas}
- Sistema: {sistema} (densidad máxima: {densidad_max} gal/m²)
- Yacija mínima requerida: {yacija_minima} m² (1/3 de la nave)
- Superficie exterior disponible: {exterior_m2} m²

Instrucciones:
1. Calcula cuántos módulos mínimos necesitas para {gallinas} gallinas.
2. Calcula cuántos módulos caben por fila en {largo_nave_m} m de largo.
3. Prueba configuraciones de filas (una fila, dos filas, fila pegada a pared...)
   verificando que cada una cabe en {ancho_nave_m} m de ancho.
   Si hay 2+ filas paralelas, deja al menos 1 m de pasillo entre ellas.
4. Para cada configuración viable, calcula la yacija y verifica normativa.
5. Elige la configuración que aloje más gallinas cumpliendo todas las restricciones.
6. Si ninguna cumple la yacija interior y exterior_m2=0, marca necesita_exterior=true.

Devuelve el resultado en el bloque JSON indicado.
""")

    messages = [system_msg, user_msg]
    _FORCE_STOP_AFTER = 8   # tras N rondas de herramientas, forzar respuesta final
    _MAX_ITER = 14

    try:
        for i in range(_MAX_ITER):
            # Tras _FORCE_STOP_AFTER rondas, desactivar herramientas para forzar respuesta
            llm_step = llm if i < _FORCE_STOP_AFTER else llm_no_tools
            response: AIMessage = llm_step.invoke(messages)
            messages.append(response)

            # Si no hay tool calls, el agente terminó → parsear
            if not response.tool_calls:
                content = response.content
                if isinstance(content, list):
                    content = " ".join(
                        p.get("text", "") if isinstance(p, dict) else str(p)
                        for p in content
                    )
                resultado = _parsear_resultado(content)
                # Si el parser falló y aún quedan iteraciones, pedir el JSON explícitamente
                if resultado.error and "JSON" in (resultado.error or "") and i < _MAX_ITER - 1:
                    logging.warning("[layout_agent] JSON no encontrado, reintentando con petición explícita")
                    messages.append(HumanMessage(content=(
                        "Tu respuesta no contiene el bloque JSON requerido. "
                        "Responde ÚNICAMENTE con el bloque ```json { ... }``` del resultado, sin texto adicional."
                    )))
                    continue
                return resultado

            # Justo antes de agotar el presupuesto, inyectar mensaje de cierre
            if i == _FORCE_STOP_AFTER - 1:
                messages.append(HumanMessage(content=(
                    "Ya tienes suficiente información. "
                    "Emite AHORA el bloque JSON final sin más llamadas a herramientas."
                )))

            # Ejecutar las herramientas llamadas
            for tc in response.tool_calls:
                fn = _TOOLS_BY_NAME.get(tc["name"])
                if fn is None:
                    result_str = json.dumps({"error": f"Herramienta desconocida: {tc['name']}"})
                else:
                    try:
                        result_str = json.dumps(fn.invoke(tc["args"]))
                    except Exception as e:
                        result_str = json.dumps({"error": str(e)})
                messages.append(ToolMessage(content=result_str, tool_call_id=tc["id"]))

        return ResultadoLayout(viable=False, error="Máximo de iteraciones alcanzado")

    except Exception as e:
        return ResultadoLayout(
            viable=False,
            error=f"Error en el agente: {e}",
            explicacion=str(e),
        )


def _parsear_resultado(output: str) -> ResultadoLayout:
    """Extrae el JSON del output del agente y lo convierte a ResultadoLayout."""
    import logging
    logging.info(f"[layout_agent] output del agente ({len(output)} chars):\n{output[:800]}")

    json_str: str | None = None

    # 1. Busca bloque ```json ... ``` (greedy para capturar JSON con objetos anidados)
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", output, re.DOTALL)
    if m:
        json_str = m.group(1)
    else:
        # 2. Busca el primer { hasta el último } del string completo
        start = output.find("{")
        end = output.rfind("}")
        if start != -1 and end != -1 and end > start:
            json_str = output[start:end + 1]

    if not json_str:
        logging.error(f"[layout_agent] no se encontró JSON en: {output[:300]}")
        return ResultadoLayout(
            viable=False,
            error="No se pudo extraer JSON del resultado del agente",
            explicacion=output,
        )
    try:
        data = json.loads(json_str)
        filas = [FilaLayout(**f) for f in data.get("filas", [])]
        return ResultadoLayout(
            viable=data.get("viable", False),
            filas=filas,
            total_modulos=data.get("total_modulos", 0),
            max_gallinas=data.get("max_gallinas", 0),
            yacija_interior_m2=data.get("yacija_interior_m2", 0),
            yacija_exterior_m2=data.get("yacija_exterior_m2", 0),
            cumple_normativa=data.get("cumple_normativa", False),
            necesita_exterior=data.get("necesita_exterior", False),
            deficit_yacija_m2=data.get("deficit_yacija_m2", 0),
            explicacion=data.get("explicacion", ""),
        )
    except Exception as e:
        logging.error(f"[layout_agent] error parseando JSON: {e}\njson_str={json_str[:300]}")
        return ResultadoLayout(
            viable=False,
            error=f"Error parseando JSON: {e}",
            explicacion=output,
        )

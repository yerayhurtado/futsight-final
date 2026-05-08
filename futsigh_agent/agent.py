"""
Agente de scouting de fútbol.
Introduce lo que buscas en un jugador (ej: "Extremo joven con mucho regate y gol")
y te devuelve los IDs de los jugadores para que la web renderice las tarjetas.
"""
import json
import time
import logging
from collections import OrderedDict
from typing import Generator
from langgraph.graph import START, END, StateGraph
from utils.state import AgentState
from utils.nodes import analyzer_node, search_node, explain_node, format_node

logger = logging.getLogger(__name__)

# Cache de búsquedas: misma query normalizada → misma respuesta (max 100 entradas)
_SEARCH_CACHE: OrderedDict = OrderedDict()
_SEARCH_CACHE_MAX = 100


def _normalize_query_for_cache(q: str) -> str:
    return (q or "").strip().lower()


def create_scouting_agent():
    """Crea el grafo del agente de scouting."""
    graph = StateGraph(AgentState)

    # Nodos: analizar -> buscar -> explicar -> formatear
    graph.add_node("analyzer", analyzer_node)
    graph.add_node("search", search_node)
    graph.add_node("explain", explain_node)
    graph.add_node("format", format_node)

    # Flujo lineal
    graph.add_edge(START, "analyzer")
    graph.add_edge("analyzer", "search")
    graph.add_edge("search", "explain")
    graph.add_edge("explain", "format")
    graph.add_edge("format", END)

    return graph.compile()


def buscar_jugadores(query: str) -> dict:
    """
    Busca jugadores según la descripción en lenguaje natural.
    Usa cache por query normalizada para no repetir llamadas al LLM.
    
    Args:
        query: Descripción del jugador buscado (ej: "Extremo joven con mucho regate y gol")
    
    Returns:
        dict con 'players' (lista de {id: int}) y 'response' (JSON: {"player_ids": [...]})
    """
    key = _normalize_query_for_cache(query)
    if key in _SEARCH_CACHE:
        _SEARCH_CACHE.move_to_end(key)
        logger.info("search_cache_hit query=%s", query[:80])
        return _SEARCH_CACHE[key]
    t0 = time.perf_counter()
    try:
        agent = create_scouting_agent()
        result = agent.invoke({"query": query})
        duration_ms = (time.perf_counter() - t0) * 1000
        logger.info("search_end query=%s duration_ms=%.0f success=true", query[:80], duration_ms)
        if len(_SEARCH_CACHE) >= _SEARCH_CACHE_MAX:
            _SEARCH_CACHE.popitem(last=False)
        _SEARCH_CACHE[key] = result
        return result
    except Exception as e:
        duration_ms = (time.perf_counter() - t0) * 1000
        logger.warning("search_end query=%s duration_ms=%.0f success=false error=%s", query[:80], duration_ms, e)
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Versión streaming: ejecuta nodo a nodo y emite eventos SSE
# ─────────────────────────────────────────────────────────────────────────────

_NODE_META = {
    "analyzer": {"step": 0, "label": "Analizando consulta"},
    "search":   {"step": 1, "label": "Buscando jugadores"},
    "explain":  {"step": 2, "label": "Generando análisis"},
    "format":   {"step": 3, "label": "Preparando resultados"},
}


def _sse_event(event_type: str, data: dict) -> str:
    """Formatea un evento SSE."""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def buscar_jugadores_stream(query: str) -> Generator[str, None, None]:
    """
    Ejecuta el agente nodo a nodo y emite eventos SSE reales.
    
    Eventos emitidos:
        node_start  - Cuando empieza un nodo {step, label}
        node_end    - Cuando termina un nodo {step, label, duration_ms}
        result      - Resultado final (mismo payload que /buscar)
        error       - Si algo falla {message}
    """
    t0 = time.perf_counter()
    state: dict = {"query": query}
    
    nodes = [
        ("analyzer", analyzer_node),
        ("search",   search_node),
        ("explain",  explain_node),
        ("format",   format_node),
    ]
    
    try:
        for name, node_fn in nodes:
            meta = _NODE_META[name]
            yield _sse_event("node_start", {"step": meta["step"], "label": meta["label"]})
            
            tn = time.perf_counter()
            result = node_fn(state)
            state.update(result)
            node_ms = (time.perf_counter() - tn) * 1000
            
            yield _sse_event("node_end", {
                "step": meta["step"],
                "label": meta["label"],
                "duration_ms": round(node_ms),
            })
        
        # Parsear la respuesta final
        response_json = state.get("response", "{}")
        data = json.loads(response_json)
        total_ms = (time.perf_counter() - t0) * 1000
        data["total_duration_ms"] = round(total_ms)
        
        yield _sse_event("result", data)
        
    except Exception as e:
        logger.exception("Error en buscar_jugadores_stream: %s", e)
        yield _sse_event("error", {"message": str(e)})


def main():
    """Ejecuta el agente de forma interactiva."""
    agent = create_scouting_agent()

    print("=" * 60)
    print("⚽ AGENTE DE SCOUTING DE FÚTBOL")
    print("=" * 60)
    print("Ejemplos de búsquedas:")
    print('  - "Extremo joven con mucho regate y gol"')
    print('  - "Delantero goleador experimentado"')
    print('  - "Centrocampista creativo con asistencias"')
    print('  - "Lateral joven barato"')
    print("=" * 60)

    while True:
        try:
            query = input("\n🔍 ¿Qué jugador buscas? (o 'salir' para terminar): ").strip()
            if not query:
                continue
            if query.lower() in ("salir", "exit", "q"):
                print("¡Hasta luego!")
                break

            result = agent.invoke({"query": query})
            response = result.get("response", "{}")
            try:
                data = json.loads(response)
                ids = data.get("player_ids", [])
                if ids:
                    print(f"\nIDs de jugadores: {ids}")
                    if data.get("explicacion"):
                        print(f"\n📋 Explicación: {data['explicacion']}")
                    if data.get("basado_en"):
                        print(f"\n📌 Basado en: {data['basado_en']}")
                    if data.get("recomendacion"):
                        print(f"\n💡 Recomendación: {data['recomendacion']}")
                else:
                    print(f"\n{data.get('error', 'No se encontraron resultados.')}")
                    if data.get("recomendacion"):
                        print(f"\n💡 Recomendación: {data['recomendacion']}")
            except json.JSONDecodeError:
                print("\n" + response)

        except KeyboardInterrupt:
            print("\n¡Hasta luego!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    main()

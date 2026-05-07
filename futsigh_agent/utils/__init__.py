"""
utils/__init__.py — Paquete de utilidades del agente de scouting.

Exporta los símbolos públicos de cada módulo para que el resto del proyecto
pueda importarlos directamente desde `utils` sin conocer la estructura interna.

Uso:
    # En lugar de:
    from utils.tools import SCOUTING_TOOLS
    from utils.nodes import analyzer_node, search_node
    from utils.state import AgentState

    # Se puede hacer:
    from utils import SCOUTING_TOOLS, analyzer_node, AgentState

IMPORTANTE — Nombres que colisionan:
    tools.py  →  buscar_jugadores()  es una @tool de LangChain (herramienta del agente)
    agent.py  →  buscar_jugadores()  es la función pública de la API (invoca el grafo)

    Son dos cosas distintas. Para evitar confusión este paquete NO re-exporta
    la `buscar_jugadores` de tools con el mismo nombre. Se exporta con alias:

        from agent import buscar_jugadores        ✅  invoca el grafo completo
        from utils import tool_buscar_jugadores   ✅  la @tool de LangChain (uso interno)
        from utils.tools import buscar_jugadores  ✅  también válido si se necesita la @tool
"""

# ── Herramientas LangChain (@tool) ────────────────────────────────────────────
# buscar_jugadores de tools.py se exporta con alias para evitar colisión con agent.py
from utils.tools import (
    SCOUTING_TOOLS,
    buscar_jugadores as tool_buscar_jugadores,
    listar_perfiles,
    listar_posiciones,
    obtener_jugador,
)

# ── Nodos del grafo ───────────────────────────────────────────────────────────
from utils.nodes import (
    analyzer_node,
    explain_node,
    format_node,
    get_informe_jugador,
    search_node,
)

# ── Estado del agente ─────────────────────────────────────────────────────────
from utils.state import AgentState, PlayerRef, ScoutFilters

__all__ = [
    # Herramientas LangChain
    "SCOUTING_TOOLS",
    "tool_buscar_jugadores",
    "obtener_jugador",
    "listar_perfiles",
    "listar_posiciones",
    # Nodos del grafo
    "analyzer_node",
    "search_node",
    "explain_node",
    "format_node",
    "get_informe_jugador",
    # Estado
    "AgentState",
    "PlayerRef",
    "ScoutFilters",
]
"""
state.py — Estado compartido del agente LangGraph de scouting.

El estado (AgentState) es el "canal de comunicación" entre nodos.
Cada nodo lee lo que necesita y escribe su output en el mismo dict.

Flujo del agente:
    query (usuario)
        │
        ▼
    [analyzer_node]   → extrae `filters` desde lenguaje natural
        │
        ▼
    [search_node]     → aplica filtros, devuelve `players` + `filtros_relajados`
        │
        ▼
    [explain_node]    → genera `explicacion`, `basado_en`, `recomendacion`, `orden`
        │
        ▼
    [format_node]     → produce `response` (JSON final para la API/UI)
"""

from __future__ import annotations

from typing import Annotated, Optional
from typing_extensions import TypedDict


# ─────────────────────────────────────────────────────────────────────────────
# Tipos auxiliares (documentan la forma exacta de cada campo)
# ─────────────────────────────────────────────────────────────────────────────

class PlayerRef(TypedDict):
    """Referencia mínima a un jugador: solo su ID.
    
    El ID se usa para que la UI/API cargue la tarjeta completa desde el CSV
    sin tener que serializar todos los campos en el estado del agente.
    """
    id: int


class ScoutFilters(TypedDict, total=False):
    """
    Filtros técnicos que el nodo 'analyzer' extrae de la query del usuario.

    Todos los campos son opcionales (total=False): si el usuario no menciona
    un criterio, el campo queda como None y el nodo de búsqueda lo ignora.

    Nomenclatura:
      - Campos que empiezan con 'min_' → umbral inferior (≥ X)
      - Campos que empiezan con 'max_' → umbral superior (≤ X)
    """

    # ── Posición y perfil ──────────────────────────────────────────────────
    pos: Optional[str]
    """Código de posición: 'df' | 'mf' | 'fw' | 'gk'"""

    perfil_principal: Optional[str]
    """Perfil de juego del jugador, p.ej. 'Extremo', 'Organizador', 'Marcador'."""

    perfil_excluir: Optional[list[str]]
    """Perfiles a excluir de los resultados, p.ej. ['Extremo'] para no-extremos."""

    # ── Contexto geográfico ────────────────────────────────────────────────
    league: Optional[str]
    """Liga donde juega: 'la liga' | 'premier league' | 'bundesliga' | 'serie a' | 'ligue 1'."""

    nation: Optional[str]
    """Código de nacionalidad de 3 letras (ISO): 'esp', 'bra', 'ger', 'fra', etc."""

    # ── Demografía ─────────────────────────────────────────────────────────
    min_age: Optional[int]
    """Edad mínima (inclusiva). Ej: 28 para jugadores con experiencia."""

    max_age: Optional[int]
    """Edad máxima (inclusiva). Ej: 23 para jugadores jóvenes/promesas."""

    min_height: Optional[int]
    """Altura mínima en cm. Ej: 185 cuando se pide 'jugador alto'."""

    max_height: Optional[int]
    """Altura máxima en cm. Ej: 175 cuando se pide 'jugador bajo o rápido'."""

    foot: Optional[str]
    """Pierna hábil: 'left' (zurdo) | 'right' (diestro) | 'both' (ambidiestro)."""

    # ── Rendimiento ofensivo ───────────────────────────────────────────────
    min_goals: Optional[int]
    """Goles mínimos (media ponderada por temporada). Ej: 8 para 'goleador'."""

    max_goals: Optional[int]
    """Goles máximos (útil para filtrar perfiles no goleadores)."""

    min_assists: Optional[int]
    """Asistencias mínimas (media ponderada). Ej: 5 para 'creador de juego'."""

    max_assists: Optional[int]
    """Asistencias máximas."""

    min_dribbles: Optional[int]
    """Regates exitosos mínimos (media ponderada). Ej: 20 para 'regatista'."""

    min_xg: Optional[int]
    """xG mínimo (Expected Goals): calidad de las oportunidades creadas."""

    min_kp: Optional[int]
    """Pases clave mínimos (key passes): pases que generan oportunidad de gol."""

    min_sot: Optional[int]
    """Disparos a puerta mínimos (Shots on Target)."""

    # ── Rendimiento defensivo ──────────────────────────────────────────────
    min_tkl: Optional[int]
    """Entradas (tackles) mínimas. Para defensas o mediocampistas defensivos."""

    min_int: Optional[int]
    """Intercepciones mínimas."""

    # ── Participación ──────────────────────────────────────────────────────
    min_minutes: Optional[int]
    """Minutos jugados mínimos. Default: 90 (≈1 partido). 900 para titulares fijos."""

    min_90s: Optional[int]
    """Número mínimo de '90 minutos' completos jugados en la temporada."""

    # ── Mercado ────────────────────────────────────────────────────────────
    min_market_value: Optional[int]
    """Valor de mercado mínimo en €. Para buscar jugadores de nivel contrastado."""

    max_market_value: Optional[int]
    """Valor de mercado máximo en €. Para búsquedas con restricción de presupuesto."""

    value_trend: Optional[str]
    """Tendencia del valor de mercado: 'up' (en alza) | 'down' (bajando) | 'stable'."""

    # ── Control interno ───────────────────────────────────────────────────
    limit: int
    """Número máximo de jugadores a devolver. Rango válido: 5-12. Default: 12."""


# ─────────────────────────────────────────────────────────────────────────────
# Estado principal del agente
# ─────────────────────────────────────────────────────────────────────────────

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    Estado compartido del agente LangGraph de scouting de fútbol.

    Cada nodo del grafo lee y/o escribe en este diccionario.
    LangGraph garantiza que el estado se propaga automáticamente entre nodos.

    IMPORTANTE: todos los campos excepto `query` son Optional porque al inicio
    del flujo solo existe la query; el resto se va rellenando nodo a nodo.
    """

    # ── HISTORIAL (Memoria) ───────────────────────────────────────────────
    chat_history: Annotated[list[BaseMessage], add_messages]
    """Historial de la conversación para mantener el contexto."""

    # ── INPUT (viene del usuario) ──────────────────────────────────────────
    query: str
    """
    Búsqueda en lenguaje natural tal como la escribió el usuario.
    Ejemplo: 'extremo zurdo joven en la Premier League con buen regate'
    
    Es el único campo obligatorio al iniciar el agente.
    """

    # ── NODO 1: analyzer_node ──────────────────────────────────────────────
    filters: Optional[ScoutFilters]
    """
    Filtros técnicos extraídos de `query` por el LLM.
    
    El analyzer_node traduce lenguaje natural → parámetros estructurados.
    Ejemplo: 'joven' → max_age=23, 'zurdo' → foot='left', 'Premier' → league='premier league'
    
    Rellenado por: analyzer_node
    Leído por:     search_node, explain_node
    """

    # ── NODO 2: search_node ────────────────────────────────────────────────
    players: Optional[list[PlayerRef]]
    """
    Lista de jugadores que coinciden con los filtros. Solo contiene IDs.
    
    La UI/API usa estos IDs para cargar las tarjetas completas desde el CSV,
    evitando serializar datos redundantes en el estado del agente.
    Ejemplo: [{'id': 2554}, {'id': 39728}, ...]
    
    Rellenado por: search_node
    Leído por:     explain_node, format_node
    """

    filtros_relajados: Optional[str]
    """
    Mensaje informativo cuando el search_node tuvo que relajar los filtros
    porque no había suficientes resultados con los criterios originales.
    
    Ejemplo: 'Se quitó el mínimo de minutos para mostrar más opciones.'
    None si no hubo relajación (los filtros originales dieron suficientes resultados).
    
    Rellenado por: search_node
    Leído por:     format_node (se incluye en la respuesta final)
    """

    # ── NODO 3: explain_node ───────────────────────────────────────────────
    explicacion: Optional[str]
    """
    Frase resumen de cuántos jugadores se encontraron y con qué criterios.
    Ejemplo: 'Se encontraron 8 jugadores que coinciden con tu búsqueda.'
    
    Rellenado por: explain_node
    """

    basado_en: Optional[str]
    """
    Lista legible de los filtros aplicados, para transparencia con el usuario.
    Ejemplo: 'posición fw, liga: premier league, edad máxima 23 años, pierna: zurdo'
    
    Rellenado por: explain_node
    """

    recomendacion: Optional[str]
    """
    Consejo o acción sugerida al usuario tras ver los resultados.
    Ejemplo: 'Revisa las tarjetas y prioriza según presupuesto y proyección.'
    
    Rellenado por: explain_node
    """

    orden: Optional[str]
    """
    Explica el criterio de ordenación de los resultados.
    Ejemplo: 'Ordenados por rendimiento (goles, asistencias, xG) por 90 min.'
    
    Rellenado por: explain_node
    """

    # ── NODO 4: format_node ────────────────────────────────────────────────
    response: Optional[str]
    """
    JSON serializado con el payload completo para la API/UI.
    
    Estructura del JSON:
    {
        "player_ids":        [2554, 39728, ...],
        "explicacion":       "Se encontraron 8 jugadores...",
        "basado_en":         "posición fw, liga: premier league...",
        "recomendacion":     "Revisa las tarjetas...",
        "orden":             "Ordenados por rendimiento...",
        "filtros_relajados": "Se quitó el mínimo de minutos..." | "",
        "busquedas_similares": [...] (solo cuando player_ids está vacío)
    }
    
    Rellenado por: format_node (nodo final del grafo)
    """
"""
nodes.py — Nodos del grafo LangGraph del agente de scouting.

Cada función de este módulo es un nodo del grafo. Recibe el estado completo
(AgentState) y devuelve un dict con solo los campos que modifica.
LangGraph hace el merge automáticamente con el estado existente.

Flujo del grafo:
    ┌──────────────────────────────────────────────────────────────┐
    │                                                              │
    │   query ──► [analyzer_node]                                 │
    │                    │  filters                               │
    │                    ▼                                         │
    │             [search_node]                                   │
    │                    │  players + filtros_relajados            │
    │                    ▼                                         │
    │             [explain_node]                                  │
    │                    │  explicacion, basado_en,               │
    │                    │  recomendacion, orden                  │
    │                    ▼                                         │
    │             [format_node]  ──►  response (JSON final)       │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘

Dependencias externas:
    - LangChain / LangGraph para el decorador @tool y el sistema de mensajes.
    - Ollama (llama3) para el nodo analyzer. Si no está disponible, se usa
      un fallback basado en regex y palabras clave (sin LLM).
    - Pandas para el filtrado del CSV en search_node.
"""

from __future__ import annotations

import difflib
import json
import logging
import os
import re
import time
import urllib.request
import urllib.error
from functools import lru_cache
from pathlib import Path
from typing import Optional

import pandas as pd
from langchain_core.prompts import ChatPromptTemplate

from utils.state import AgentState

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Configuración global
# ─────────────────────────────────────────────────────────────────────────────

# Minutos mínimos para considerar que un jugador tiene datos "relevantes"
# 90 min = ~1 partido. Umbral bajo para no excluir suplentes o lesionados.
MIN_MINUTES_DEFAULT = 90

# Si hay pocos resultados con los filtros estrictos, bajamos a este umbral
MIN_RESULTADOS_DESEADOS = 10

# Límite máximo de jugadores que puede devolver una búsqueda
MAX_RESULTADOS = 12

# Claves válidas que puede devolver el LLM en el nodo analyzer
# (evita que el LLM invente campos inexistentes en ScoutFilters)
_CLAVES_FILTROS_VALIDAS = {
    "pos", "perfil_principal", "perfil_excluir", "league", "nation",
    "max_age", "min_age", "min_goals", "max_goals", "min_assists", "max_assists",
    "min_dribbles", "min_minutes", "min_xg", "min_kp", "min_sot", "min_90s",
    "min_tkl", "min_int", "max_market_value", "min_market_value", "limit",
    "foot", "min_height", "max_height", "value_trend",
}

# Posiciones válidas en el CSV
_POSICIONES_VALIDAS = {"df", "mf", "fw", "gk"}

# Catálogo de perfiles existentes en el CSV (para fuzzy matching)
_PERFILES_DISPONIBLES = [
    "Extremo", "Marcador", "Lateral", "Defensa con Toque",
    "Organizador", "Pivote Defensivo", "Mediapunta", "Segundo Delantero",
    "Cazagoles", "Falso 9", "Líbero", "Portero con Saque", "Todocampista",
]

# Nombres legibles de posición (para la explicación)
_NOMBRE_POSICION = {"df": "defensa", "mf": "centrocampista", "fw": "delantero", "gk": "portero"}

# Alias de idioma → código de nación del CSV (3 letras, minúsculas)
_ALIAS_NACION = {
    "esp": "esp", "spain": "esp", "españa": "esp", "español": "esp",
    "ger": "ger", "germany": "ger", "alemania": "ger", "alemán": "ger",
    "fra": "fra", "france": "fra", "francia": "fra", "francés": "fra",
    "ita": "ita", "italy": "ita", "italia": "ita", "italiano": "ita",
    "eng": "eng", "england": "eng", "inglaterra": "eng", "inglés": "eng",
    "bra": "bra", "brazil": "bra", "brasil": "bra", "brasileño": "bra",
    "arg": "arg", "argentina": "arg", "argentino": "arg",
    "por": "por", "portugal": "por", "portugués": "por",
    "ned": "ned", "netherlands": "ned", "holanda": "ned", "holandés": "ned",
    "uru": "uru", "uruguay": "uru", "uruguayo": "uru",
    "bel": "bel", "belgium": "bel", "bélgica": "bel", "belga": "bel",
    "cro": "cro", "croatia": "cro", "croacia": "cro", "croata": "cro",
}

# Alias de liga → nombre canónico del CSV
_ALIAS_LIGA = {
    "la liga": "la liga", "liga española": "la liga", "spain": "la liga",
    "premier": "premier league", "premier league": "premier league", "england": "premier league",
    "bundesliga": "bundesliga", "alemania": "bundesliga", "germany": "bundesliga",
    "serie a": "serie a", "italia": "serie a", "italy": "serie a",
    "ligue 1": "ligue 1", "francia": "ligue 1", "france": "ligue 1",
    "eredivisie": "eredivisie", "holanda": "eredivisie",
    "primeira liga": "primeira liga", "portugal": "primeira liga",
}

# Sugerencias de búsqueda cuando hay 0 resultados
_SUGERENCIAS_BUSQUEDA = [
    "delantero español",
    "extremo joven con regate",
    "mediocentro con asistencias",
    "lateral joven",
    "goleador sin filtro de goles",
]

# Columnas numéricas del CSV (necesitan coerción al cargar)
_COLS_NUMERICAS = [
    "Age", "Gls", "Ast", "Won", "Min", "market_value_in_eur",
    "xG", "npxG", "KP", "SoT", "90s", "Tkl", "Int", "Altura", "Valor_Mercado",
]

# Columnas de rendimiento que se promedian entre temporadas
_COLS_RENDIMIENTO = ["Gls", "Ast", "Won", "Min", "xG", "npxG", "KP", "SoT", "90s", "Tkl", "Int"]


def _league_exigencia_coeff(league: object) -> float:
    """Retorna el coeficiente de peso según el nivel de la liga."""
    if league is None or (isinstance(league, float) and pd.isna(league)):
        return 1.0
    L = str(league).strip().lower()
    if not L:
        return 1.0
    rules: list[tuple[tuple[str, ...], float]] = (
        (("premier league", "premier"), 1.16),
        (("la liga", "laliga", "primera división", "primera division"), 1.14),
        (("serie a",), 1.12),
        (("bundesliga",), 1.12),
        (("ligue 1", "ligue1"), 1.10),
        (("primeira liga", "liga portugal", "eredivisie", "belgian", "scottish"), 1.06),
        (("championship", "segunda división", "segunda division", "2. bundesliga", "serie b"), 0.90),
        (("segunda", "second division", "league one", "league two"), 0.88),
    )
    for keys, coeff in rules:
        if any(k in L for k in keys):
            return round(coeff, 2)
    return 1.0


 # ─────────────────────────────────────────────────────────────────────────────
 # Inicialización del LLM (Ollama)
 # ─────────────────────────────────────────────────────────────────────────────

def _init_llm():
    """
    Intenta conectar con Ollama. Si no está disponible, devuelve None
    y el nodo analyzer usará el fallback basado en regex.
    """
    try:
        from langchain_ollama import ChatOllama
        model_name = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
        kwargs = {
            "model": model_name,
            "temperature": 0,        # determinista: misma query → mismo JSON
            "format": "json",        # forzar JSON output
            "num_predict": 400,      # limitar tokens para respuestas rápidas
            "client_kwargs": {"timeout": 60},
        }
        base_url = os.environ.get("OLLAMA_BASE_URL")
        if base_url:
            kwargs["base_url"] = base_url
        return ChatOllama(**kwargs)
    except Exception as e:
        logger.warning("Ollama no disponible, se usará fallback sin LLM: %s", e)
        return None


_llm = _init_llm()


# ─────────────────────────────────────────────────────────────────────────────
# Cache del Clustering Service (perfiles GMM dinámicos)
# ─────────────────────────────────────────────────────────────────────────────

_clustering_cache: dict[int, dict] | None = None
_clustering_cache_time: float = 0.0
_CLUSTERING_CACHE_TTL = 300  # 5 minutos


def _fetch_clustering_data() -> dict[int, dict]:
    """Obtiene clasificaciones GMM del clustering-service (con cache de 5 min)."""
    global _clustering_cache, _clustering_cache_time
    now = time.time()
    if _clustering_cache is not None and (now - _clustering_cache_time) < _CLUSTERING_CACHE_TTL:
        return _clustering_cache

    url = os.environ.get("CLUSTERING_API_URL", "http://localhost:8003")
    try:
        req = urllib.request.Request(f"{url}/classify/all")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            raw = data.get("classifications", {})
            # Las claves vienen como strings del JSON, convertir a int
            _clustering_cache = {int(k): v for k, v in raw.items()}
            _clustering_cache_time = now
            logger.info("[clustering] Cache actualizado: %d jugadores", len(_clustering_cache))
            return _clustering_cache
    except Exception as e:
        logger.warning("[clustering] Servicio no disponible: %s", e)
        return _clustering_cache or {}


# ─────────────────────────────────────────────────────────────────────────────
# Carga y caché de la Base de Datos (SQLite)
# ─────────────────────────────────────────────────────────────────────────────

def _get_db_path() -> Path:
    """Localiza la DB buscando en futsight-web/dev.db o futsight-web/prisma/dev.db."""
    # Intentar subir desde futsigh_agent a la raíz del monorepo
    root = Path(__file__).resolve().parent.parent.parent
    candidates = [
        root / "dev.db",
        root / "futsight-web" / "dev.db",
        root / "futsight-web" / "prisma" / "dev.db",
        Path.cwd() / "dev.db",
        Path.cwd().parent / "futsight-web" / "dev.db",
        Path.cwd().parent / "futsight-web" / "prisma" / "dev.db",
    ]
    for c in candidates:
        if c.exists() and c.stat().st_size > 0:
            return c
    return None


@lru_cache(maxsize=32)
def _cargar_df_optimizado(db_path: str, mtime: float, sql_where: str = "") -> pd.DataFrame:
    """
    Versión optimizada que permite filtrar por SQL antes de cargar a Pandas.
    Cacheamos hasta 32 combinaciones de filtros comunes.
    """
    import sqlite3
    import json
    
    query = "SELECT * FROM Player"
    if sql_where:
        query += f" WHERE {sql_where}"
    
    logger.info("Cargando datos (SQL: %s)", query)
    conn = sqlite3.connect(db_path)
    df_raw = pd.read_sql_query(query, conn)
    conn.close()

    if df_raw.empty:
        return pd.DataFrame()

    # (El resto del preprocesamiento es igual, lo muevo a una función interna)
    return _procesar_df_raw(df_raw)


def _procesar_df_raw(df_raw: pd.DataFrame) -> pd.DataFrame:
    import json
    # 1. Reconstruir el DataFrame expandiendo statsJson
    stats_list = df_raw['statsJson'].apply(json.loads).tolist()
    df_stats = pd.DataFrame(stats_list)
    df_base = df_raw.drop(columns=['statsJson', 'id'])
    
    rename_map = {
        'playerID': 'PlayerID', 'player': 'Player', 'squad': 'Squad', 'league': 'League',
        'nation': 'Nation', 'pos_main': 'Pos_Main', 'age': 'Age', 'season': 'Season',
        'marketValue': 'Valor_Mercado', 'altura': 'Altura', 'strCutout': 'strCutout',
        'piernaBuena': 'Pierna_Buena'
    }
    df_base = df_base.rename(columns=rename_map)
    
    if "Valor_Mercado" in df_base.columns:
        df_base["market_value_in_eur"] = df_base["Valor_Mercado"]

    df = pd.concat([df_base, df_stats], axis=1)
    df = df.loc[:, ~df.columns.duplicated()]

    for col in _COLS_NUMERICAS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # 3. Tendencia de valor
    trend_map = _calcular_tendencia_valor(df)

    # 4. Metadatos: temporada más reciente
    df_reciente = df.sort_values(["PlayerID", "Season"], ascending=[True, False]).groupby("PlayerID").first().reset_index()

    # 5. Stats per 90
    cols_rend = [c for c in _COLS_RENDIMIENTO if c in df_reciente.columns]
    if cols_rend:
        ultima_temporada_global = df["Season"].dropna().max()
        df_reciente["is_active_latest"] = df_reciente["Season"] == ultima_temporada_global
        min_col = df_reciente["Min"].replace(0, 1)
        
        # Aplicar coeficiente de exigencia de liga
        league_coeffs = df_reciente["League"].apply(_league_exigencia_coeff)
        
        for col in cols_rend:
            # Calculamos per-90 y multiplicamos por el factor de liga
            df_reciente[f"{col}_90"] = (df_reciente[col] / min_col) * 90 * league_coeffs
        df_reciente["Min_Weighted"] = df_reciente["Min"]

    df_reciente["valor_trend"] = df_reciente["PlayerID"].map(trend_map).fillna("stable")

    # Enriquecer con perfiles GMM del clustering-service
    try:
        cls_data = _fetch_clustering_data()
        if cls_data:
            for col, key in [
                ("Cluster_ID", "cluster_id"),
                ("Puresa_Perfil", "cluster_prob"),
                ("Es_Hibrid", "is_hybrid"),
                ("Perfil_Nom", "perfil_principal"),
                ("Perfil_Principal", "perfil_principal"),
                ("Perfil_Secundari", "perfil_secundari"),
                ("Perfil_Historico", "perfil_historico"),
            ]:
                df_reciente[col] = df_reciente["PlayerID"].map(
                    lambda pid, k=key: cls_data.get(pid, {}).get(k)
                )
            logger.info("[clustering] DataFrame enriquecido con %d perfiles GMM", len(cls_data))
    except Exception as e:
        logger.warning("[clustering] No se pudieron cargar perfiles: %s", e)

    return df_reciente


def _get_df(filters: Optional[dict] = None) -> tuple[Optional[pd.DataFrame], Optional[str]]:
    """
    Carga los datos aplicando filtros SQL si es posible para ganar velocidad.
    """
    db_path = _get_db_path()
    if not db_path:
        return None, "DB no encontrada"
    
    try:
        mtime = db_path.stat().st_mtime
        sql_parts = []
        if filters:
            if filters.get("pos"): sql_parts.append(f"pos_main = '{filters['pos']}'")
            if filters.get("nation"): sql_parts.append(f"nation = '{filters['nation']}'")
            if filters.get("league"): sql_parts.append(f"league = '{filters['league']}'")
        
        sql_where = " AND ".join(sql_parts) if sql_parts else ""
        df = _cargar_df_optimizado(str(db_path), mtime, sql_where)
        return df, None
    except Exception as e:
        logger.exception("Error cargando base de datos para el agente")
        return None, str(e)


def _calcular_tendencia_valor(df: pd.DataFrame) -> dict[int, str]:
    """Calcula si el valor de un jugador sube, baja o está estable."""
    valor_col = "Valor_Mercado"
    if valor_col not in df.columns: return {}
    
    trend_map: dict[int, str] = {}
    historial = df[["PlayerID", "Season", valor_col]].query(f"{valor_col} > 0").sort_values(["PlayerID", "Season"])
    
    for pid, grupo in historial.groupby("PlayerID"):
        valores = grupo[valor_col].tolist()
        if len(valores) < 2: 
            trend_map[int(pid)] = "stable"
            continue
        ultimas = valores[-4:]
        diffs = [ultimas[i+1] - ultimas[i] for i in range(len(ultimas)-1)]
        if all(d > 0 for d in diffs): trend_map[int(pid)] = "up"
        elif all(d < 0 for d in diffs): trend_map[int(pid)] = "down"
        else: trend_map[int(pid)] = "stable"
    return trend_map


def _extraer_nombre_referencia(query: str) -> Optional[str]:
    """
    Intenta extraer un nombre de jugador de patrones tipo:
      - "como Haaland"
      - "tipo Haaland pero más barato"
    Devuelve el nombre sin recortar (minúsculas/espacios limpios) o None.
    """
    q = query.lower()
    # Buscar "como <nombre>" o "tipo <nombre>"
    m = re.search(r"(?:como|tipo)\s+([a-záéíóúüñ\s]+)", q)
    if not m:
        return None
    nombre = m.group(1)
    # Cortar en conectores típicos
    for sep in [" pero ", " que ", " con ", " en ", ".", ","]:
        if sep in nombre:
            nombre = nombre.split(sep, 1)[0]
    nombre = " ".join(nombre.strip().split())
    return nombre or None


# ─────────────────────────────────────────────────────────────────────────────
# Utilidades de parsing
# ─────────────────────────────────────────────────────────────────────────────

def _safe_int(value, default=None) -> Optional[int]:
    """Convierte a int de forma segura. Devuelve `default` si falla."""
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _normalizar_texto(texto: str) -> str:
    """Minúsculas + eliminar acentos para búsquedas tolerantes (Mbappé → mbappe)."""
    s = str(texto).lower().strip()
    for acento, sin_acento in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ü","u"),("ñ","n")]:
        s = s.replace(acento, sin_acento)
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Nodo 1: analyzer_node
# ─────────────────────────────────────────────────────────────────────────────

# Filtros "vacíos" por defecto: ningún criterio activo
_FILTROS_VACIOS: dict = {
    "pos": None, "perfil_principal": None, "perfil_excluir": [],
    "league": None, "nation": None,
    "max_age": None, "min_age": None,
    "min_goals": None, "max_goals": None,
    "min_assists": None, "max_assists": None,
    "min_dribbles": None, "min_minutes": MIN_MINUTES_DEFAULT,
    "min_xg": None, "min_kp": None, "min_sot": None,
    "min_90s": None, "min_tkl": None, "min_int": None,
    "max_market_value": None, "min_market_value": None,
    "foot": None, "min_height": None, "max_height": None,
    "value_trend": None, "limit": MAX_RESULTADOS,
}

# Prompt para el LLM: extrae filtros en JSON desde lenguaje natural
_ANALYZER_PROMPT = ChatPromptTemplate.from_template("""
Eres un extractor de filtros para búsqueda de futbolistas. 
Convierte la búsqueda del usuario en un JSON de filtros.

REGLAS FUNDAMENTALES:
- Pon null en TODOS los campos que el usuario NO mencione explícitamente.
- NO inventes filtros de rendimiento que el usuario no haya pedido.
- Las stats son medias por 90 minutos (no de una sola temporada).

POSICIONES (campo 'pos'):
  df=defensa, mf=centrocampista, fw=delantero/extremo, gk=portero

PERFIL (campo 'perfil_principal'):
  Solo si piden: extremo/ala → Extremo | mediapunta/enganche → Mediapunta
  | lateral → Lateral | pivote/doble pivote → null (sin perfil)
  NUNCA perfil para: defensas genéricos, porteros, mediocentros sin especificar

NACIÓN (campo 'nation'): códigos 3 letras: esp, bra, arg, ger, fra, ita, eng, por

LIGA (campo 'league'): 
  "la liga" | "premier league" | "bundesliga" | "serie a" | "ligue 1"

CONVERSIONES DE LENGUAJE NATURAL:
  - joven / promesa / talento → max_age: 21
  - sub-23 / joven jugador → max_age: 23
  - goleador / muchos goles → min_goals: 10
  - asistencias / creador → min_assists: 6
  - regate / regatista / 1vs1 → min_dribbles: 25
  - titular / muchos minutos / habitual → min_minutes: 1200
  - zurdo → foot: "left" | diestro → foot: "right" | ambidiestro → foot: "both"
  - alto / corpulento / juego aéreo → min_height: 188
  - bajo / menudo / ratonero → max_height: 172
  - barato / asequible / ganga → max_market_value: 15000000
  - caro / estrella / top → min_market_value: 40000000
  - revaloriza / en alza / futuro → value_trend: "up"

Devuelve SOLO este JSON (sin texto adicional, sin markdown):
{{
  "pos": null, "perfil_principal": null, "league": null, "nation": null,
  "max_age": null, "min_age": null, "min_goals": null, "min_assists": null,
  "min_dribbles": null, "min_minutes": null, "min_xg": null, "min_kp": null,
  "min_sot": null, "min_90s": null, "min_tkl": null, "min_int": null,
  "max_market_value": null, "min_market_value": null,
  "foot": null, "min_height": null, "max_height": null, "value_trend": null,
  "limit": 12
}}

Historial de la charla (si existe):
{history}

Búsqueda actual del usuario: {query}
""")


# Prompt para el LLM: genera un informe de ojeador narrativo
_EXPLAIN_PROMPT = ChatPromptTemplate.from_template("""
Eres un Ojeador de Fútbol Profesional de alto nivel.
Redacta exactamente 2-3 frases de análisis de mercado, específicas y concretas.

BÚSQUEDA DEL DIRECTOR DEPORTIVO: {query}

FILTROS TÉCNICOS APLICADOS: {criterios}

JUGADORES ENCONTRADOS: {num_players}

DATA DE LOS MEJORES CANDIDATOS HALLADOS:
{top_players_data}

REGLAS ESTRICTAS:
- Menciona datos concretos de los jugadores encontrados (medias de goles, asistencias, valor, edades, ligas).
- Comenta si el mercado está saturado o es escaso para este perfil.
- Si se pidió un perfil específico (extremo, cazagoles, pivote...) coméntalo con lenguaje técnico.
- NO inventes datos que no estén en la data proporcionada.
- Devuelve SOLO el texto del informe, sin prefijos ni comillas externas, en español.
- Responde en formato JSON: {{"informe": "<tu texto aqui>"}}

Ejemplo de tono: "El mercado ofrece {num_players} opciones viables. Los mejores perfiles oscilan entre los 22 y 26 años, con medias de 12 goles y valor de mercado entre 15M€ y 40M€. El perfil de extremo zurdo es escaso en la Premier pero abundante en Ligue 1."
""")


def _sanitizar_filtros_llm(raw: dict) -> dict:
    """
    Valida y limpia la respuesta JSON del LLM:
    - Elimina claves no reconocidas.
    - Coerciona tipos (int, str, list).
    - Ignora valores None.
    """
    if not isinstance(raw, dict):
        return {}

    filtros: dict = {}
    for clave, valor in raw.items():
        if clave not in _CLAVES_FILTROS_VALIDAS or valor is None:
            continue

        if clave in ("pos", "perfil_principal", "league", "nation", "foot", "value_trend"):
            filtros[clave] = str(valor).strip() or None

        elif clave == "perfil_excluir":
            if isinstance(valor, list):
                filtros[clave] = [str(x).strip() for x in valor if x]
            else:
                filtros[clave] = [str(valor).strip()] if valor else []

        elif clave in (
            "max_age", "min_age", "min_goals", "max_goals", "min_assists", "max_assists",
            "min_dribbles", "min_minutes", "min_xg", "min_kp", "min_sot", "min_90s",
            "min_tkl", "min_int", "max_market_value", "min_market_value", "limit",
            "min_height", "max_height",
        ):
            n = _safe_int(valor)
            if n is not None:
                filtros[clave] = n

    return filtros


def _aplicar_correcciones_postllm(filtros: dict, query: str) -> dict:
    """
    Correcciones de coherencia que el LLM no siempre garantiza:
    - Limpia perfiles de ataque asignados a defensas/porteros.
    - Elimina filtros inferidos si el usuario no los mencionó.
    - Normaliza ligas y naciones a su valor canónico.
    - Detecta rangos explícitos con regex ("entre 20 y 25 años").
    - Infiere filtros de rendimiento desde palabras clave.
    """
    q = query.lower()
    palabras = set(q.split())

    # ── Consistencia posición-perfil ────────────────────────────────────────
    pos = str(filtros.get("pos") or "").lower()
    perfil = str(filtros.get("perfil_principal") or "").lower()

    # Defensas/porteros no tienen perfil de ataque (Extremo, Ala...)
    if pos in ("df", "gk") and perfil in ("extremo", "ala", "lateral derecho", "lateral izquierdo"):
        if not any(t in q for t in ("extremo", "ala", "lateral")):
            filtros["perfil_principal"] = None

    # "mediocentro/pivote" sin "mediapunta" → limpiar Mediapunta asignado por el LLM
    terminos_mediocentro = ("mediocentro", "pivote", "pivote defensivo", "doble pivote")
    pide_mediapunta = any(t in q for t in ("mediapunta", "enganche", "número 10"))
    if any(t in q for t in terminos_mediocentro) and not pide_mediapunta:
        if perfil in ("mediapunta", "segundo delantero", "organizador"):
            filtros["perfil_principal"] = None

    # ── Eliminar filtros inferidos que el usuario no pidió ──────────────────
    terminos_edad = ("joven", "jóvenes", "promesa", "años", "edad", "sub-", "u21", "u23")
    if filtros.get("max_age") == 23 and not any(t in q for t in terminos_edad):
        filtros["max_age"] = None
    if filtros.get("min_age") and not any(t in q for t in terminos_edad):
        filtros["min_age"] = None

    terminos_minutos = ("titular", "titulares", "muchos minutos", "habitual")
    if _safe_int(filtros.get("min_minutes"), 0) >= 900 and not any(t in q for t in terminos_minutos):
        filtros["min_minutes"] = MIN_MINUTES_DEFAULT

    terminos_valor = ("valor", "millones", "€", "euro", "barato", "caro", "precio",
                      "asequible", "económico", "mercado")
    if not any(t in q for t in terminos_valor):
        filtros["min_market_value"] = None
        filtros["max_market_value"] = None

    # ── Normalizar liga y nación ────────────────────────────────────────────
    if filtros.get("league"):
        raw = str(filtros["league"]).lower().strip()
        filtros["league"] = _ALIAS_LIGA.get(raw) or raw
    if filtros.get("nation"):
        raw = str(filtros["nation"]).lower().strip()
        filtros["nation"] = _ALIAS_NACION.get(raw) or raw

    # ── Detección de rangos explícitos con regex ────────────────────────────
    # "entre 20 y 25 años"
    m = re.search(r"entre\s+(\d+)\s*y\s*(\d+)\s*años?", q, re.IGNORECASE)
    if m:
        a1, a2 = int(m.group(1)), int(m.group(2))
        filtros["min_age"], filtros["max_age"] = min(a1, a2), max(a1, a2)

    # "de 5 a 10 goles"
    m = re.search(r"(?:de\s+)?(\d+)\s*(?:a|y)\s*(\d+)\s*goles?", q, re.IGNORECASE)
    if m:
        g1, g2 = int(m.group(1)), int(m.group(2))
        filtros["min_goals"], filtros["max_goals"] = min(g1, g2), max(g1, g2)

    # "más de 185 cm" / "menos de 175 cm"
    m_min_h = re.search(r"(?:más de|mayor de|superior a)\s+(\d{2,3})\s*cm?", q, re.IGNORECASE)
    if m_min_h and not filtros.get("min_height"):
        h = int(m_min_h.group(1))
        filtros["min_height"] = h if h > 100 else h * 100
    m_max_h = re.search(r"(?:menos de|menor de|inferior a)\s+(\d{2,3})\s*cm?", q, re.IGNORECASE)
    if m_max_h and not filtros.get("max_height"):
        h = int(m_max_h.group(1))
        filtros["max_height"] = h if h > 100 else h * 100

    # ── Corrección de dirección de altura ───────────────────────────────────
    # "alto" → solo min_height. "bajo" → solo max_height. Evita confusión LLM.
    pide_alto = any(t in q for t in ("alto", "alta", "corpulento", "imponente", "grandote"))
    pide_bajo = any(t in q for t in ("bajo", "baja", "pequeño", "pequeña", "menudo"))
    if pide_alto and not pide_bajo:
        h = filtros.get("min_height") or filtros.get("max_height")
        filtros["min_height"] = h
        filtros["max_height"] = None
    elif pide_bajo and not pide_alto:
        h = filtros.get("max_height") or filtros.get("min_height")
        filtros["max_height"] = h
        filtros["min_height"] = None

    # ── Negaciones: "que no sea extremo" ────────────────────────────────────
    no_perfil = re.search(r"no\s+sea\s+(extremo|ala|mediapunta|lateral|marcador)", q, re.IGNORECASE)
    if no_perfil:
        perfil_excluir = filtros.get("perfil_excluir") or []
        nuevo = no_perfil.group(1).capitalize()
        if nuevo not in perfil_excluir:
            filtros["perfil_excluir"] = perfil_excluir + [nuevo]

    # ── Inferir posición desde palabras clave si el LLM no la puso ─────────
    if not filtros.get("pos"):
        if palabras & {"delantero", "delanteros", "punta", "goleador", "goleadora"}:
            filtros["pos"] = "fw"
        elif palabras & {"extremo", "extremos", "ala", "alas"}:
            filtros["pos"] = "fw"
        elif palabras & {"medio", "medios", "centrocampista", "mediocentro", "pivote", "mediapunta"}:
            filtros["pos"] = "mf"
        elif palabras & {"defensa", "defensas", "defensor", "central", "lateral"}:
            filtros["pos"] = "df"
        elif palabras & {"portero", "porteros", "guardameta", "arquero"}:
            filtros["pos"] = "gk"

    # ── "delantero" genérico → no filtrar por perfil ────────────────────────
    pide_delantero = palabras & {"delantero", "delanteros", "punta", "goleador"}
    pide_perfil_concreto = palabras & {"extremo", "extremos", "ala", "alas", "mediapunta", "segundo"}
    if pide_delantero and not pide_perfil_concreto:
        filtros["perfil_principal"] = None

    # ── Inferir filtros de rendimiento desde palabras clave ─────────────────
    if any(t in q for t in ("gol", "goles", "goleador")) and not filtros.get("min_goals"):
        filtros["min_goals"] = 10
    if any(t in q for t in ("asistencia", "asistencias", "creador")) and not filtros.get("min_assists"):
        filtros["min_assists"] = 6
    if any(t in q for t in ("regate", "regates", "regatista", "1vs1")) and not filtros.get("min_dribbles"):
        filtros["min_dribbles"] = 25

    # ── Pierna (desde palabras clave si el LLM no la puso) ──────────────────
    if not filtros.get("foot"):
        if any(t in q for t in ("zurdo", "zurda", "pie izquierdo")):
            filtros["foot"] = "left"
        elif any(t in q for t in ("diestro", "diestra", "pie derecho")):
            filtros["foot"] = "right"
        elif any(t in q for t in ("ambidiestro", "ambas piernas", "los dos pies")):
            filtros["foot"] = "both"

    # ── Tendencia de valor (desde palabras clave si el LLM no la puso) ──────
    if not filtros.get("value_trend"):
        if any(t in q for t in ("revaloriza", "en alza", "suba de valor", "en progresión", "futuro")):
            filtros["value_trend"] = "up"
        elif any(t in q for t in ("baja de valor", "pierde valor", "se deprecia")):
            filtros["value_trend"] = "down"

    # ── Titular → subir mínimo de minutos ───────────────────────────────────
    if any(t in q for t in ("titular", "titulares", "muchos minutos", "habitual")):
        filtros["min_minutes"] = 1200

    # ── Clamp del límite ────────────────────────────────────────────────────
    filtros["limit"] = max(5, min(MAX_RESULTADOS, _safe_int(filtros.get("limit"), MAX_RESULTADOS)))

    return filtros


def analyzer_node(state: AgentState) -> dict:
    """
    Nodo 1: Traduce la query en lenguaje natural a filtros estructurados.

    Estrategia:
    1. Si hay LLM disponible (Ollama llama3): invocar con hasta 3 reintentos.
    2. Aplicar correcciones post-LLM para garantizar coherencia.
    3. Si el LLM falla o no está disponible: usar solo el fallback de regex/keywords.

    Input del estado:  query
    Output al estado:  filters
    """
    print("--- Nodo 1: ANALYZER ---")
    query = (state.get("query") or "").strip()
    filtros = {**_FILTROS_VACIOS}

    if not query:
        return {"filters": filtros}

    # ── Intentar con LLM ────────────────────────────────────────────────────
    llm_success = False
    if _llm:
        # Preparar historial legible para el prompt
        historial_str = ""
        if "chat_history" in state and state["chat_history"]:
            for msg in state["chat_history"][-5:]: # Últimos 5 mensajes
                role = "Usuario" if msg.type == "human" else "Agente"
                historial_str += f"{role}: {msg.content}\n"

        chain = _ANALYZER_PROMPT | _llm
        for intento in range(2): 
            try:
                if intento > 0:
                    time.sleep(0.5)
                # Pasar tanto la query como el historial
                respuesta = chain.invoke({"query": query, "history": historial_str})
                raw = json.loads(respuesta.content)
                filtros_llm = _sanitizar_filtros_llm(raw)
                filtros = {**filtros, **{k: v for k, v in filtros_llm.items() if v is not None}}
                logger.info("Filtros extraídos por LLM: %s", filtros_llm)
                llm_success = True
                break
            except Exception as e:
                logger.warning("Intento %d fallido con LLM: %s", intento + 1, e)
        
    if not llm_success:
        logger.info("Usando lógica de fallback para extracción de filtros.")

    # ── Correcciones post-LLM (también aplican en modo fallback) ────────────
    filtros = _aplicar_correcciones_postllm(filtros, query)

    print(f"   Filtros resultantes: {filtros}")
    return {"filters": filtros}


# ─────────────────────────────────────────────────────────────────────────────
# Nodo 2: search_node
# ─────────────────────────────────────────────────────────────────────────────

def _aplicar_filtros_df(df: pd.DataFrame, filtros: dict, min_minutos_override=None) -> pd.Series:
    """
    Construye y devuelve una máscara booleana aplicando todos los filtros activos.

    Args:
        df:                    DataFrame de jugadores.
        filtros:               Dict de filtros del AgentState.
        min_minutos_override:  Si se pasa, sobreescribe filtros['min_minutes'].
    """
    mask = pd.Series(True, index=df.index)

    # Mínimo de minutos
    umbral = min_minutos_override if min_minutos_override is not None else filtros.get("min_minutes")
    mask &= df["Min"].fillna(0) >= _safe_int(umbral, MIN_MINUTES_DEFAULT)

    # Posición
    if filtros.get("pos"):
        pos = str(filtros["pos"]).lower()
        if pos in _POSICIONES_VALIDAS:
            mask &= (
                df["Pos_Main"].fillna("").str.lower().eq(pos)
                | df["Pos"].fillna("").str.lower().str.startswith(pos)
            )

    # Perfil principal (busca en principal y secundario)
    if filtros.get("perfil_principal"):
        p = str(filtros["perfil_principal"]).lower()
        # Fuzzy match al catálogo conocido
        match = next(
            (perf for perf in _PERFILES_DISPONIBLES if p in perf.lower() or perf.lower() in p),
            p
        )
        mask &= (
            df["Perfil_Principal"].fillna("").str.lower().str.contains(match.lower(), regex=False)
            | df["Perfil_Secundari"].fillna("").str.lower().str.contains(match.lower(), regex=False)
        )

    # Perfiles a excluir
    for excl in (filtros.get("perfil_excluir") or []):
        if excl:
            e = str(excl).lower()
            mask &= ~(
                df["Perfil_Principal"].fillna("").str.lower().str.contains(e, regex=False)
                | df["Perfil_Secundari"].fillna("").str.lower().str.contains(e, regex=False)
            )

    # Liga
    if filtros.get("league"):
        liga = _ALIAS_LIGA.get(str(filtros["league"]).lower()) or str(filtros["league"]).lower()
        mask &= df["League"].fillna("").str.lower().str.contains(liga, regex=False)

    # Nación
    if filtros.get("nation"):
        nacion = _ALIAS_NACION.get(str(filtros["nation"]).lower()) or str(filtros["nation"]).lower()
        mask &= df["Nation"].fillna("").str.lower().str.contains(nacion, regex=False)

    # Edad
    if _safe_int(filtros.get("max_age")) is not None:
        mask &= df["Age"] <= _safe_int(filtros["max_age"])
    if _safe_int(filtros.get("min_age")) is not None:
        mask &= df["Age"] >= _safe_int(filtros["min_age"])

    # Stats de rendimiento
    for campo, col in [
        ("min_goals", "Gls"), ("min_assists", "Ast"), ("min_dribbles", "Won"),
        ("min_xg", "xG"), ("min_kp", "KP"), ("min_sot", "SoT"),
        ("min_90s", "90s"), ("min_tkl", "Tkl"), ("min_int", "Int"),
    ]:
        if filtros.get(campo) is not None and col in df.columns:
            mask &= df[col].fillna(0) >= _safe_int(filtros[campo], 0)
    for campo, col in [("max_goals", "Gls"), ("max_assists", "Ast")]:
        if filtros.get(campo) is not None and col in df.columns:
            mask &= df[col].fillna(0) <= _safe_int(filtros[campo])

    # Valor de mercado
    if _safe_int(filtros.get("max_market_value")) is not None:
        mask &= df["market_value_in_eur"] <= _safe_int(filtros["max_market_value"])
    if _safe_int(filtros.get("min_market_value")) is not None:
        mask &= df["market_value_in_eur"] >= _safe_int(filtros["min_market_value"])

    # Pierna buena
    if filtros.get("foot") and "Pierna_Buena" in df.columns:
        pie = str(filtros["foot"]).lower()
        pierna_col = df["Pierna_Buena"].fillna("").str.lower().str.strip()
        if pie == "both":
            mask &= pierna_col == "both"
        else:
            mask &= (pierna_col == pie) | (pierna_col == "both")

    # Altura
    if _safe_int(filtros.get("min_height")) is not None and "Altura" in df.columns:
        mask &= df["Altura"].fillna(0) >= _safe_int(filtros["min_height"])
    if _safe_int(filtros.get("max_height")) is not None and "Altura" in df.columns:
        mask &= df["Altura"].fillna(0) <= _safe_int(filtros["max_height"])

    # Tendencia de valor de mercado
    if filtros.get("value_trend") and "valor_trend" in df.columns:
        mask &= df["valor_trend"].fillna("stable").str.lower() == str(filtros["value_trend"]).lower()

    return mask


def _calcular_score_contextual(df_subset: pd.DataFrame, filtros: dict, ref_cluster: Optional[int] = None) -> pd.Series:
    """
    Calcula un score de ordenación adaptado al criterio de búsqueda.
    """
    # Stats base (media por 90 min)
    g   = df_subset["Gls_90"].fillna(0) if "Gls_90" in df_subset.columns else df_subset["Gls"].fillna(0)
    a   = df_subset["Ast_90"].fillna(0) if "Ast_90" in df_subset.columns else df_subset["Ast"].fillna(0)
    w   = df_subset["Won_90"].fillna(0) if "Won_90" in df_subset.columns else df_subset["Won"].fillna(0)
    xg  = df_subset["xG_90"].fillna(0)  if "xG_90"  in df_subset.columns else 0
    kp  = df_subset["KP_90"].fillna(0)  if "KP_90"  in df_subset.columns else 0
    tkl = df_subset["Tkl_90"].fillna(0) if "Tkl_90" in df_subset.columns else 0
    int_= df_subset["Int_90"].fillna(0) if "Int_90" in df_subset.columns else 0
    sca = df_subset["SCA_90"].fillna(0) if "SCA_90" in df_subset.columns else 0
    pp  = df_subset["PrgP_90"].fillna(0)if "PrgP_90"in df_subset.columns else 0
    pr  = df_subset["PrgR_90"].fillna(0)if "PrgR_90"in df_subset.columns else 0

    # Pesos por defecto
    wg, wa, ww, wt, wi = 3.0, 2.0, 1.0, 0.4, 0.3

    # Ajustar pesos según criterio dominante de la búsqueda
    if filtros.get("min_goals"):
        wg, wa, ww, wt, wi = 10.0, 1.2, 0.4, 0.2, 0.1
    elif filtros.get("min_assists"):
        wg, wa, ww, wt, wi = 1.5, 10.0, 0.8, 0.2, 0.1
    elif filtros.get("min_dribbles"):
        wg, wa, ww, wt, wi = 1.5, 0.8, 10.0, 0.2, 0.1
    elif filtros.get("min_tkl") or filtros.get("min_int"):
        wg, wa, ww, wt, wi = 0.4, 0.2, 0.2, 7.0, 6.0

    score = (
        g * wg + a * wa + w * ww
        + xg * 1.5 + kp * 0.8
        + tkl * wt + int_ * wi
        + sca * 1.2 + (pp + pr) * 0.5
    )

    # BOOST POR CLUSTER DE REFERENCIA (SIMILITUD ESTADÍSTICA)
    if ref_cluster is not None and "Cluster_ID" in df_subset.columns:
        # Multiplicador potente para jugadores del mismo clúster GMM
        score = score.where(df_subset["Cluster_ID"] != ref_cluster, score * 2.5)

    # Factor de fiabilidad: necesita ~900 min para score completo
    min_w = df_subset["Min_Weighted"].fillna(0) if "Min_Weighted" in df_subset.columns else 0
    reliability = (min_w / 900).clip(upper=1.0)
    score *= reliability

    # Recency penalty: −30% si no tiene datos en la temporada en curso
    is_active = df_subset["is_active_latest"].fillna(False) if "is_active_latest" in df_subset.columns else True
    score = score.where(is_active, score * 0.7)

    return score


def _buscar_por_nombre(df: pd.DataFrame, query: str, max_results: int = 12) -> list[int]:
    """
    Detecta si la query parece un nombre de jugador y devuelve sus IDs.

    Estrategia en cascada:
    1. Búsqueda exacta (con y sin acentos).
    2. Todas las palabras en el nombre.
    3. Fuzzy matching con difflib (tolera typos, ratio ≥ 0.82).
    """
    q = _normalizar_texto(query.strip())
    if not q or len(q) < 2:
        return []

    col = "Player" if "Player" in df.columns else None
    if not col:
        return []

    nombres_norm = df[col].fillna("").apply(_normalizar_texto)

    # Paso 1: contiene la query como subcadena
    mask = nombres_norm.str.contains(q, regex=False)
    if mask.any():
        return [int(pid) for pid in df.loc[mask, "PlayerID"].unique()[:max_results]]

    # Paso 2: todas las palabras de la query aparecen en el nombre
    palabras = [w for w in q.split() if len(w) >= 2]
    if palabras:
        mask = pd.Series(True, index=df.index)
        for w in palabras:
            mask &= nombres_norm.str.contains(w, regex=False)
        ids = df.loc[mask, "PlayerID"].unique()
        if len(ids):
            return [int(pid) for pid in ids[:max_results]]

    # Paso 3: fuzzy matching
    candidatos = []
    for _, row in df[["Player", "PlayerID"]].drop_duplicates("PlayerID").iterrows():
        nombre_norm = _normalizar_texto(row["Player"])
        ratio = difflib.SequenceMatcher(None, q, nombre_norm).ratio()
        if ratio >= 0.82:
            candidatos.append((ratio, int(row["PlayerID"])))
    if candidatos:
        candidatos.sort(key=lambda x: -x[0])
        return [pid for _, pid in candidatos[:max_results]]

    return []


def search_node(state: AgentState) -> dict:
    """
    Nodo 2: Aplica los filtros al DataFrame y devuelve la lista de jugadores.

    Estrategia de fallback en cascada (hasta 5 niveles):
    1. Filtros completos con mínimo de minutos.
    2. Sin mínimo de minutos (min_minutes=0).
    3. Sin filtro de perfil.
    4. Sin filtros de stats (goles, asistencias, regates, etc.).
    5. Solo país/liga/posición → si sigue vacío: top jugadores global.

    Si la query era un nombre de jugador, ese jugador aparece primero en los resultados.

    Input del estado:  query, filters
    Output al estado:  players, filtros_relajados
    """
    print("--- Nodo 2: SEARCH ---")
    query = state.get("query", "") or ""
    filtros = state.get("filters") or {}

    # Carga de datos
    nombre_ref = _extraer_nombre_referencia(query)
    
    # Si hay una referencia (ej: "como Lamine"), necesitamos TODA la DB para encontrarlo,
    # no solo el subset filtrado por SQL (ej: Alemania).
    if nombre_ref:
        df, error = _get_df() # Carga global
    else:
        df, error = _get_df(filters=filtros) # Carga optimizada
        
    if df is None or df.empty:
        # Reintento sin filtros SQL si falló
        df, error = _get_df()
        if df is None:
            print(f"   ERROR cargando datos: {error}")
            return {"players": [], "filtros_relajados": None}

    # ── Jugador de referencia: "tipo Haaland", "como X" ───────────────────────
    ref_cluster = None
    if nombre_ref:
        try:
            ids_ref = _buscar_por_nombre(df, nombre_ref, max_results=1)
            if ids_ref:
                ref_id = ids_ref[0]
                fila_ref = df[df["PlayerID"] == ref_id].iloc[0]
                print(f"   Referencia a jugador tipo: {fila_ref.get('Player')} (ID={ref_id})")
                
                # 1. Cluster estadístico (GMM)
                ref_cluster = _safe_int(fila_ref.get("Cluster_ID"))

                # 2. Perfil IA (Extremo, Marcador, etc.)
                if not filtros.get("perfil_principal"):
                    p_hist = fila_ref.get("Perfil_Historico") or fila_ref.get("Perfil_Principal")
                    if p_hist and pd.notna(p_hist):
                        filtros["perfil_principal"] = str(p_hist)

                # 3. Posición principal
                if not filtros.get("pos") and pd.notna(fila_ref.get("Pos_Main")):
                    filtros["pos"] = str(fila_ref["Pos_Main"]).lower()

                # 4. Smart Age Matching (Si el ref es joven, buscar jóvenes)
                edad_ref = _safe_int(fila_ref.get("Age"))
                if edad_ref and edad_ref <= 22:
                    if filtros.get("max_age") is None:
                        filtros["max_age"] = min(25, edad_ref + 3)
                elif edad_ref:
                    # Rango ±3 años por defecto
                    if filtros.get("min_age") is None: filtros["min_age"] = max(16, edad_ref - 4)
                    if filtros.get("max_age") is None: filtros["max_age"] = edad_ref + 4

                # 5. Valor de mercado
                q_low = query.lower()
                valor_ref = _safe_int(fila_ref.get("Valor_Mercado") or fila_ref.get("market_value_in_eur"))
                if valor_ref and any(t in q_low for t in ("barato", "más barato", "mas barato", "más asequible")):
                    techo = int(valor_ref * 0.7)
                    if filtros.get("max_market_value") is None or techo < _safe_int(filtros.get("max_market_value"), techo):
                        filtros["max_market_value"] = techo
        except Exception as e:
            logger.warning("Error aplicando referencia de jugador en search_node: %s", e)

    limite = max(5, min(MAX_RESULTADOS, _safe_int(filtros.get("limit"), MAX_RESULTADOS)))
    filtros_relajados = None

    # Detectar si la query es un nombre de jugador
    ids_por_nombre = _buscar_por_nombre(df, query, max_results=limite)

    def _buscar(filtros_uso: dict, min_min_override=None) -> pd.DataFrame:
        """Aplica filtros, calcula score y devuelve top N."""
        mask = _aplicar_filtros_df(df, filtros_uso, min_min_override)
        sub = df[mask].copy()
        sub["_score"] = _calcular_score_contextual(sub, filtros_uso, ref_cluster=ref_cluster)
        return sub.sort_values("_score", ascending=False).head(limite)

    # ── Nivel 1: filtros completos ──────────────────────────────────────────
    resultado = _buscar(filtros)

    # ── Nivel 2: sin mínimo de minutos ──────────────────────────────────────
    if len(resultado) < MIN_RESULTADOS_DESEADOS:
        resultado = _buscar(filtros, min_min_override=0)
        filtros_relajados = "Se quitó el mínimo de minutos para mostrar más opciones."

    # ── Nivel 3: sin filtro de perfil ────────────────────────────────────────
    if len(resultado) < MIN_RESULTADOS_DESEADOS and filtros.get("perfil_principal"):
        filtros_sin_perfil = {**filtros, "perfil_principal": None}
        resultado = _buscar(filtros_sin_perfil, min_min_override=0)
        filtros_relajados = "Se amplió la búsqueda sin filtrar por perfil para ofrecer más jugadores."

    # ── Nivel 4: sin filtros de stats ────────────────────────────────────────
    if len(resultado) < MIN_RESULTADOS_DESEADOS:
        claves_stats = {"min_goals", "max_goals", "min_assists", "max_assists",
                        "min_dribbles", "min_xg", "min_kp", "min_sot", "min_tkl", "min_int"}
        filtros_sin_stats = {k: v for k, v in filtros.items() if k not in claves_stats}
        resultado = _buscar(filtros_sin_stats, min_min_override=0)
        filtros_relajados = "Se relajaron los filtros de estadísticas para mostrar más resultados."

    # ── Nivel 5: solo país/liga/posición ────────────────────────────────────
    if len(resultado) < MIN_RESULTADOS_DESEADOS:
        filtros_basicos = {k: v for k, v in filtros.items() if k in ("nation", "league", "pos") and v}
        if filtros_basicos:
            resultado = _buscar(filtros_basicos, min_min_override=0)
            filtros_relajados = "Se mantuvieron país, liga y posición mostrando los mejores por rendimiento."
        if len(resultado) < MIN_RESULTADOS_DESEADOS:
            # Fallback absoluto: mejores jugadores globales
            df_global = df.copy()
            df_global["_score"] = _calcular_score_contextual(df_global, {})
            resultado = df_global.nlargest(limite, "_score")
            filtros_relajados = "Se mostraron los mejores jugadores por rendimiento global."

    # ── Construir lista de players ───────────────────────────────────────────
    players = [{"id": int(row["PlayerID"])} for _, row in resultado.iterrows()]

    # Rellenar hasta MIN_RESULTADOS_DESEADOS si aún faltan
    ids_ya = {p["id"] for p in players}
    if len(players) < MIN_RESULTADOS_DESEADOS:
        df_extra = df.copy()
        df_extra["_score"] = _calcular_score_contextual(df_extra, {})
        for _, row in df_extra.sort_values("_score", ascending=False).iterrows():
            if len(players) >= MIN_RESULTADOS_DESEADOS:
                break
            pid = int(row["PlayerID"])
            if pid not in ids_ya:
                players.append({"id": pid})
                ids_ya.add(pid)
        filtros_relajados = filtros_relajados or "Se completó la lista con más jugadores por rendimiento."

    # Si la query era un nombre, ese jugador va primero
    if ids_por_nombre:
        otros_ids = [p["id"] for p in players if p["id"] not in ids_por_nombre]
        players = [{"id": pid} for pid in ids_por_nombre + otros_ids][:limite]

    print(f"   Jugadores encontrados: {len(players)} | Relajado: {bool(filtros_relajados)}")
    return {"players": players, "filtros_relajados": filtros_relajados}


# ─────────────────────────────────────────────────────────────────────────────
# Nodo 3: explain_node
# ─────────────────────────────────────────────────────────────────────────────

def explain_node(state: AgentState) -> dict:
    """
    Nodo 3: Genera la explicación de los resultados (basada en plantilla, sin LLM).

    Produce cuatro campos de texto para mostrar al usuario:
    - explicacion:   Cuántos jugadores se encontraron.
    - basado_en:     Lista legible de los filtros aplicados.
    - recomendacion: Consejo de acción.
    - orden:         Criterio de ordenación de las tarjetas.

    Input del estado:  filters, players
    Output al estado:  explicacion, basado_en, recomendacion, orden
    """
    print("--- Nodo 3: EXPLAIN ---")
    filtros = state.get("filters") or {}
    players = state.get("players") or []

    if not players:
        return {
            "explicacion": "",
            "basado_en": "",
            "recomendacion": "No se encontraron jugadores. Prueba a relajar los criterios de búsqueda.",
            "orden": "",
        }

    # ── Construir lista legible de criterios aplicados ───────────────────────
    criterios = []

    # Posición y perfil
    if filtros.get("pos"):
        pos = filtros["pos"]
        criterios.append(f"posición: {_NOMBRE_POSICION.get(pos, pos)} ({pos})")
    if filtros.get("perfil_principal"):
        criterios.append(f"perfil: {filtros['perfil_principal']}")
    if filtros.get("perfil_excluir"):
        criterios.append(f"excluir perfil: {', '.join(filtros['perfil_excluir'])}")

    # Contexto geográfico
    if filtros.get("league"):
        criterios.append(f"liga: {filtros['league']}")
    if filtros.get("nation"):
        criterios.append(f"nación: {filtros['nation']}")

    # Demografía
    if filtros.get("max_age"):
        criterios.append(f"edad máx. {filtros['max_age']} años")
    if filtros.get("min_age"):
        criterios.append(f"edad mín. {filtros['min_age']} años")
    if filtros.get("min_height"):
        criterios.append(f"altura mín. {filtros['min_height']} cm")
    if filtros.get("max_height"):
        criterios.append(f"altura máx. {filtros['max_height']} cm")
    if filtros.get("foot"):
        etiqueta_pie = {"left": "zurdo", "right": "diestro", "both": "ambidiestro"}
        criterios.append(f"pierna: {etiqueta_pie.get(filtros['foot'], filtros['foot'])}")

    # Rendimiento ofensivo
    if filtros.get("min_goals"):
        criterios.append(f"mín. {filtros['min_goals']} goles")
    if filtros.get("max_goals"):
        criterios.append(f"máx. {filtros['max_goals']} goles")
    if filtros.get("min_assists"):
        criterios.append(f"mín. {filtros['min_assists']} asistencias")
    if filtros.get("max_assists"):
        criterios.append(f"máx. {filtros['max_assists']} asistencias")
    if filtros.get("min_dribbles"):
        criterios.append(f"mín. {filtros['min_dribbles']} regates")
    if filtros.get("min_xg"):
        criterios.append(f"xG mín. {filtros['min_xg']}")
    if filtros.get("min_kp"):
        criterios.append(f"pases clave mín. {filtros['min_kp']}")

    # Rendimiento defensivo
    if filtros.get("min_tkl"):
        criterios.append(f"entradas mín. {filtros['min_tkl']}")
    if filtros.get("min_int"):
        criterios.append(f"intercepciones mín. {filtros['min_int']}")

    # Participación
    min_min = _safe_int(filtros.get("min_minutes"), 0)
    if min_min and min_min > MIN_MINUTES_DEFAULT:
        criterios.append(f"mín. {min_min} minutos jugados")

    # Mercado
    if filtros.get("max_market_value"):
        v = _safe_int(filtros["max_market_value"], 0)
        criterios.append(f"valor máx. {v:,}€".replace(",", "."))
    if filtros.get("min_market_value"):
        v = _safe_int(filtros["min_market_value"], 0)
        criterios.append(f"valor mín. {v:,}€".replace(",", "."))
    if filtros.get("value_trend"):
        etiqueta_trend = {"up": "valor en ascenso ↑", "down": "valor en descenso ↓", "stable": "valor estable"}
        criterios.append(f"tendencia: {etiqueta_trend.get(filtros['value_trend'], filtros['value_trend'])}")

    criterios_str = ", ".join(criterios) if criterios else "ninguno"

    # ── Criterio de ordenación ───────────────────────────────────────────────
    if filtros.get("min_tkl") or filtros.get("min_int"):
        orden = "Ordenados por entradas, intercepciones, goles y asistencias (media por 90 min)."
    elif filtros.get("min_assists"):
        orden = "Ordenados por asistencias, goles y pases clave (media por 90 min)."
    elif filtros.get("min_dribbles"):
        orden = "Ordenados por regates, goles y asistencias (media por 90 min)."
    else:
        orden = "Ordenados por rendimiento: goles, asistencias, xG y pases clave (media por 90 min)."

    # ── Construir contexto de los top jugadores para el LLM ─────────────────
    top_players_data = "Sin datos de jugadores disponibles."
    df_global, _ = _get_df()
    if df_global is not None and players:
        try:
            top_ids = [p["id"] for p in players[:5]]
            df_top = df_global[df_global["PlayerID"].isin(top_ids)].copy()
            lineas = []
            for _, row in df_top.iterrows():
                nombre = row.get("Player", "?")
                club   = row.get("Squad", "?")
                liga   = row.get("League", "?")
                edad   = _safe_int(row.get("Age"))
                gls    = _safe_int(row.get("Gls"), 0)
                ast    = _safe_int(row.get("Ast"), 0)
                won    = _safe_int(row.get("Won"), 0)
                mins   = _safe_int(row.get("Min"), 0)
                valor  = _safe_int(row.get("market_value_in_eur") or row.get("Valor_Mercado"))
                perfil_j = row.get("Perfil_Principal") or row.get("Perfil_Historico") or ""
                valor_str = f"{valor // 1_000_000}M€" if valor and valor >= 1_000_000 else (f"{valor // 1_000}K€" if valor else "N/D")
                lineas.append(
                    f"- {nombre} ({edad}a, {perfil_j}) | {club} - {liga} | "
                    f"{gls}G {ast}A {won}Reg | {mins}min | Valor: {valor_str}"
                )
            if lineas:
                top_players_data = "\n".join(lineas)
        except Exception as e:
            logger.warning("Error construyendo contexto de jugadores para explain: %s", e)

    # ── Generar explicación con LLM ──────────────────────────────────────────
    explicacion_final = f"Se encontraron {len(players)} jugadores que coinciden con tu búsqueda."
    if _llm and players:
        try:
            chain = _EXPLAIN_PROMPT | _llm
            res = chain.invoke({
                "query": state.get("query", ""),
                "num_players": len(players),
                "criterios": criterios_str,
                "top_players_data": top_players_data,
            })
            raw_content = res.content or ""
            # El LLM devuelve JSON: {"informe": "..."} — extraer el texto
            try:
                parsed = json.loads(raw_content)
                # Buscar la clave del informe con tolerancia a mayúsculas/minúsculas
                for key in ("informe", "Informe", "text", "explanation", "resultado"):
                    if key in parsed and isinstance(parsed[key], str) and parsed[key].strip():
                        explicacion_final = parsed[key].strip()
                        break
                else:
                    # Si no hay clave conocida, tomar el primer valor string
                    for v in parsed.values():
                        if isinstance(v, str) and v.strip():
                            explicacion_final = v.strip()
                            break
            except (json.JSONDecodeError, AttributeError):
                # No es JSON: usarlo directamente si parece texto plano
                if raw_content.strip() and not raw_content.strip().startswith('{'):
                    explicacion_final = raw_content.strip()
        except Exception as e:
            logger.warning("Error generando explicación con LLM: %s", e)

    print(f"   Criterios aplicados: {criterios_str}")
    return {
        "explicacion": explicacion_final,
        "basado_en": criterios_str,
        "recomendacion": "Revisa las tarjetas y prioriza según tu presupuesto y el potencial del jugador.",
        "orden": orden,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Nodo 4: format_node
# ─────────────────────────────────────────────────────────────────────────────

def format_node(state: AgentState) -> dict:
    """
    Nodo 4 (final): Serializa el estado completo en un JSON listo para la API/UI.

    El JSON de respuesta tiene la siguiente estructura:
    {
        "player_ids":         [2554, 39728, ...],   // IDs para renderizar tarjetas
        "explicacion":        "Se encontraron 8 jugadores...",
        "basado_en":          "posición fw, liga: premier league...",
        "recomendacion":      "Revisa las tarjetas...",
        "orden":              "Ordenados por rendimiento...",
        "filtros_relajados":  "Se quitó el mínimo de minutos..." | "",
        "busquedas_similares": [...]   // solo cuando no hay resultados
    }

    Input del estado:  players, query, explicacion, basado_en, recomendacion,
                       orden, filtros_relajados
    Output al estado:  response
    """
    print("--- Nodo 4: FORMAT ---")
    players = state.get("players") or []
    query = state.get("query", "")

    if not players:
        payload = {
            "player_ids": [],
            "error": f"No encontré jugadores para: \"{query}\"",
            "explicacion": "",
            "basado_en": "",
            "recomendacion": state.get("recomendacion") or "Prueba a relajar los criterios de búsqueda.",
            "orden": "",
            "filtros_relajados": "",
            "busquedas_similares": _SUGERENCIAS_BUSQUEDA,
        }
        return {"response": json.dumps(payload, ensure_ascii=False)}

    payload = {
        "player_ids":        [p["id"] for p in players],
        "explicacion":       state.get("explicacion") or "",
        "basado_en":         state.get("basado_en") or "",
        "recomendacion":     state.get("recomendacion") or "",
        "orden":             state.get("orden") or "",
        "filtros_relajados": state.get("filtros_relajados") or "",
    }

    print(f"   Response generada con {len(players)} jugadores.")
    return {"response": json.dumps(payload, ensure_ascii=False)}


# Compat: nombre antiguo usado por algunas integraciones
format_response_node = format_node


# ─────────────────────────────────────────────────────────────────────────────
# Utilidad extra: informe individual de jugador (fuera del grafo principal)
# ─────────────────────────────────────────────────────────────────────────────

def get_informe_jugador(player_id: int) -> Optional[dict]:
    """
    Genera un informe breve de un jugador dado su PlayerID.

    Usado por la UI para mostrar el detalle expandido de una tarjeta.
    No forma parte del grafo LangGraph; es una función auxiliar sincrónica.

    Args:
        player_id: ID del jugador (columna PlayerID del CSV).

    Returns:
        Dict con 'resumen', 'fortalezas' y 'debilidades', o None si no se encuentra.
    """
    df, err = _get_df()
    if df is None or err:
        return None

    fila = df[df["PlayerID"] == player_id]
    if fila.empty:
        return None
    r = fila.iloc[0]

    nombre = r.get("Player", "Jugador")
    edad   = _safe_int(r.get("Age"))
    pos    = r.get("Pos_Main") or r.get("Pos", "")
    perfil = r.get("Perfil_Principal") or "—"
    gols   = _safe_int(r.get("Gls"), 0)
    asis   = _safe_int(r.get("Ast"), 0)
    reg    = _safe_int(r.get("Won"), 0)
    mins   = _safe_int(r.get("Min"), 0)
    valor  = _safe_int(r.get("market_value_in_eur"))
    club   = r.get("Squad", "")
    liga   = r.get("League", "")

    if valor:
        resumen = (
            f"{nombre}, {edad} años, {pos}. {club} ({liga}). "
            f"Perfil: {perfil}. {gols} goles, {asis} asistencias, {reg} regates "
            f"en {mins} min. Valor: {valor:,}€".replace(",", ".")
        )
    else:
        resumen = f"{nombre}, {edad} años, {pos}. {gols} goles, {asis} asistencias."

    fortalezas = []
    if gols >= 5:
        fortalezas.append("Alta aportación goleadora")
    if asis >= 3:
        fortalezas.append("Buen creador de juego (asistencias)")
    if reg >= 15:
        fortalezas.append("Desequilibrador por regate")
    if mins >= 1500:
        fortalezas.append("Titular habitual con muchos minutos")
    if not fortalezas:
        fortalezas.append("Datos de temporada reciente disponibles")

    debilidades = []
    if gols == 0 and str(pos).lower() in ("fw", "mf"):
        debilidades.append("Poca aportación goleadora")
    if mins < 450:
        debilidades.append("Pocos minutos jugados (revisar rol en equipo)")
    if not debilidades:
        debilidades.append("Sin señales claras de debilidad en los datos disponibles")

    return {
        "player_id": int(player_id),
        "resumen":     resumen,
        "fortalezas":  fortalezas,
        "debilidades": debilidades,
    }
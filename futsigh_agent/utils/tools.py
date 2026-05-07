"""
tools.py — Herramientas de acceso a datos del agente de scouting.

Este módulo expone las herramientas que el agente puede invocar directamente
(decoradas con @tool de LangChain) más utilidades internas de carga y filtrado.

Arquitectura:
    ┌─────────────────────────────────────────────────────────────┐
    │  Herramientas públicas (@tool)   ← el agente las invoca    │
    │  ─────────────────────────────                             │
    │  buscar_jugadores()     → filtra + devuelve IDs            │
    │  obtener_jugador()      → busca un jugador por nombre      │
    │  listar_perfiles()      → catálogo de perfiles disponibles │
    │  listar_posiciones()    → catálogo de posiciones           │
    ├─────────────────────────────────────────────────────────────┤
    │  Utilidades internas (_privadas)                           │
    │  ─────────────────────────────                             │
    │  _cargar_jugadores()    → lee y cachea el CSV              │
    │  _filtrar_jugadores()   → aplica filtros al DataFrame      │
    └─────────────────────────────────────────────────────────────┘

NOTA sobre los IDs:
    Las herramientas devuelven solo PlayerIDs. La UI renderiza las tarjetas
    completas usando esos IDs para consultar el CSV o una API propia.
    Esto evita serializar datos redundantes en el estado del agente.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import pandas as pd
from langchain_core.tools import tool

# ─────────────────────────────────────────────────────────────────────────────
# Configuración
# ─────────────────────────────────────────────────────────────────────────────

# Ruta al CSV principal de jugadores (relativa al directorio del proyecto)
CSV_PATH = Path(__file__).parent.parent / "data" / "jugadores_con_historial_y_cutout.csv"

# Mínimo de minutos jugados para considerar a un jugador "activo"
# 90 min ≈ 1 partido. Umbral bajo a propósito para no excluir suplentes o lesionados.
MIN_MINUTES_DEFAULT = 90

# Columnas numéricas que necesitan coerción explícita al cargar el CSV
_NUMERIC_COLS = ["Age", "Gls", "Ast", "Won", "Min", "market_value_in_eur"]


# ─────────────────────────────────────────────────────────────────────────────
# Carga y caché del CSV
# ─────────────────────────────────────────────────────────────────────────────

_df_cache: Optional[pd.DataFrame] = None


def _cargar_jugadores() -> pd.DataFrame:
    """
    Carga el CSV de jugadores y devuelve una fila por jugador (temporada más reciente).

    El resultado se cachea en memoria para que llamadas sucesivas no repasen
    el disco. Si el CSV no existe, devuelve un DataFrame vacío.

    Returns:
        DataFrame con una fila por PlayerID, ordenado por temporada descendente
        para que groupby().first() capture siempre la temporada más reciente.
    """
    global _df_cache
    if _df_cache is not None:
        return _df_cache

    if not CSV_PATH.exists():
        return pd.DataFrame()

    df = pd.read_csv(CSV_PATH, low_memory=False)

    # Coerción de columnas numéricas (valores no parseables → 0)
    for col in _NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Una fila por jugador: conserva siempre la temporada más reciente
    df = (
        df.sort_values(["PlayerID", "Season"], ascending=[True, False])
        .groupby("PlayerID")
        .first()
        .reset_index()
    )

    _df_cache = df
    return df


def invalidar_cache() -> None:
    """Limpia la caché del DataFrame. Útil si el CSV se actualiza en disco."""
    global _df_cache
    _df_cache = None


# ─────────────────────────────────────────────────────────────────────────────
# Lógica interna de filtrado
# ─────────────────────────────────────────────────────────────────────────────

def _filtrar_jugadores(
    df: pd.DataFrame,
    # ── Posición y perfil ──────────────────────────────────────
    pos: Optional[str] = None,
    perfil: Optional[str] = None,
    # ── Contexto geográfico ────────────────────────────────────
    liga: Optional[str] = None,
    pais: Optional[str] = None,
    # ── Demografía ─────────────────────────────────────────────
    min_edad: Optional[int] = None,
    max_edad: Optional[int] = None,
    min_altura: Optional[int] = None,
    max_altura: Optional[int] = None,
    pierna: Optional[str] = None,
    # ── Rendimiento ────────────────────────────────────────────
    min_goles: Optional[int] = None,
    min_asistencias: Optional[int] = None,
    min_regates: Optional[int] = None,
    min_minutos: Optional[int] = None,
    # ── Mercado ────────────────────────────────────────────────
    max_valor: Optional[int] = None,
    min_valor: Optional[int] = None,
    # ── Control ────────────────────────────────────────────────
    limite: int = 15,
) -> list[dict]:
    """
    Construye una máscara booleana sobre el DataFrame y devuelve los mejores
    jugadores ordenados por un score simple (goles × 2 + asistencias × 1.5 + regates × 0.5).

    Args:
        df:              DataFrame de jugadores (una fila por jugador).
        pos:             Código de posición ('df', 'mf', 'fw', 'gk').
        perfil:          Perfil de juego (búsqueda parcial, case-insensitive).
        liga:            Nombre de la liga (búsqueda parcial).
        pais:            Código de país de 3 letras ('esp', 'bra', etc.).
        min_edad:        Edad mínima.
        max_edad:        Edad máxima.
        min_altura:      Altura mínima en cm.
        max_altura:      Altura máxima en cm.
        pierna:          'left' | 'right' | 'both'.
        min_goles:       Goles mínimos.
        min_asistencias: Asistencias mínimas.
        min_regates:     Regates exitosos mínimos.
        min_minutos:     Minutos jugados mínimos (default: MIN_MINUTES_DEFAULT).
        max_valor:       Valor de mercado máximo en €.
        min_valor:       Valor de mercado mínimo en €.
        limite:          Máximo de resultados (1-30).

    Returns:
        Lista de dicts con solo {'id': PlayerID}, lista vacía si no hay resultados.
    """
    # Partimos de un mask donde todos son True (sin restricciones)
    mask = pd.Series(True, index=df.index)

    # ── Mínimo de minutos (siempre activo) ──────────────────────────────────
    umbral_minutos = min_minutos if min_minutos is not None else MIN_MINUTES_DEFAULT
    mask &= df["Min"].fillna(0) >= umbral_minutos

    # ── Posición ────────────────────────────────────────────────────────────
    if pos:
        pos_norm = pos.lower().strip()
        # Acepta tanto Pos_Main exacto como Pos que contenga la cadena (ej. 'df,mf')
        mask &= (
            df["Pos_Main"].fillna("").str.lower().eq(pos_norm)
            | df["Pos"].fillna("").str.lower().str.contains(pos_norm, regex=False)
        )

    # ── Perfil de juego (busca en perfil principal y secundario) ────────────
    if perfil:
        perfil_norm = perfil.lower().strip()
        mask &= (
            df["Perfil_Principal"].fillna("").str.lower().str.contains(perfil_norm, regex=False)
            | df["Perfil_Secundari"].fillna("").str.lower().str.contains(perfil_norm, regex=False)
        )

    # ── Liga ────────────────────────────────────────────────────────────────
    if liga:
        mask &= df["League"].fillna("").str.lower().str.contains(liga.lower(), regex=False)

    # ── Nacionalidad ────────────────────────────────────────────────────────
    if pais:
        mask &= df["Nation"].fillna("").str.lower().str.contains(pais.lower(), regex=False)

    # ── Rango de edad ───────────────────────────────────────────────────────
    if max_edad is not None:
        mask &= df["Age"] <= max_edad
    if min_edad is not None:
        mask &= df["Age"] >= min_edad

    # ── Goles, asistencias, regates ─────────────────────────────────────────
    if min_goles is not None:
        mask &= df["Gls"].fillna(0) >= min_goles
    if min_asistencias is not None:
        mask &= df["Ast"].fillna(0) >= min_asistencias
    if min_regates is not None:
        mask &= df["Won"].fillna(0) >= min_regates

    # ── Valor de mercado ────────────────────────────────────────────────────
    if max_valor is not None:
        mask &= df["market_value_in_eur"].fillna(0) <= max_valor
    if min_valor is not None:
        mask &= df["market_value_in_eur"].fillna(0) >= min_valor

    # ── Pierna buena ────────────────────────────────────────────────────────
    if pierna and "Pierna_Buena" in df.columns:
        pierna_norm = pierna.lower().strip()
        pierna_col = df["Pierna_Buena"].fillna("").str.lower().str.strip()
        if pierna_norm == "both":
            # Ambidiestro: solo los que tienen 'both'
            mask &= pierna_col == "both"
        else:
            # Zurdo o diestro: aceptamos también ambidiestros (pueden jugar con ambas)
            mask &= (pierna_col == pierna_norm) | (pierna_col == "both")

    # ── Altura ──────────────────────────────────────────────────────────────
    if min_altura is not None and "Altura" in df.columns:
        mask &= df["Altura"].fillna(0) >= min_altura
    if max_altura is not None and "Altura" in df.columns:
        mask &= df["Altura"].fillna(0) <= max_altura

    # ── Aplicar máscara + ordenar por score simple ──────────────────────────
    resultado = df[mask].copy()
    resultado["_score"] = (
        resultado["Gls"].fillna(0) * 2.0
        + resultado["Ast"].fillna(0) * 1.5
        + resultado["Won"].fillna(0) * 0.5
    )

    top = (
        resultado
        .sort_values("_score", ascending=False)
        .head(max(1, min(limite, 30)))  # clamp: mínimo 1, máximo 30
    )

    return [{"id": int(row["PlayerID"])} for _, row in top.iterrows()]


# ─────────────────────────────────────────────────────────────────────────────
# Herramientas públicas del agente (@tool)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def buscar_jugadores(
    posicion: Optional[str] = None,
    perfil: Optional[str] = None,
    liga: Optional[str] = None,
    pais: Optional[str] = None,
    max_edad: Optional[int] = None,
    min_edad: Optional[int] = None,
    min_goles: Optional[int] = None,
    min_asistencias: Optional[int] = None,
    min_regates: Optional[int] = None,
    min_minutos: Optional[int] = None,
    max_valor_mercado: Optional[int] = None,
    min_valor_mercado: Optional[int] = None,
    pierna: Optional[str] = None,
    min_altura: Optional[int] = None,
    max_altura: Optional[int] = None,
    limite: int = 15,
) -> str:
    """
    Busca jugadores aplicando filtros combinados. Devuelve JSON con los IDs.

    La UI usa esos IDs para renderizar las tarjetas con foto, stats y valor.
    Todos los parámetros son opcionales: si no se especifica uno, no filtra por él.

    Args:
        posicion:          Código de posición: 'df' (defensa), 'mf' (centrocampista),
                           'fw' (delantero/extremo), 'gk' (portero).
        perfil:            Perfil de juego. Valores comunes: 'Extremo', 'Marcador',
                           'Lateral', 'Organizador', 'Pivote Defensivo', 'Mediapunta'.
        liga:              Nombre de la liga. Ej: 'la liga', 'premier league',
                           'bundesliga', 'serie a', 'ligue 1'.
        pais:              Código ISO de 3 letras del país de la selección.
                           Ej: 'esp', 'bra', 'arg', 'ger', 'fra', 'ita', 'eng'.
        max_edad:          Edad máxima. Ej: 23 para jugadores jóvenes.
        min_edad:          Edad mínima. Ej: 28 para jugadores experimentados.
        min_goles:         Goles mínimos (media por temporada).
        min_asistencias:   Asistencias mínimas (media por temporada).
        min_regates:       Regates exitosos mínimos (media por temporada).
        min_minutos:       Minutos jugados mínimos. Default: 90 (≈1 partido).
                           Usa 900 para buscar solo titulares habituales.
        max_valor_mercado: Valor de mercado máximo en €. Ej: 10_000_000 (10M€).
        min_valor_mercado: Valor de mercado mínimo en €.
        pierna:            Pierna hábil: 'left' (zurdo), 'right' (diestro), 'both'.
        min_altura:        Altura mínima en cm. Ej: 185 para 'jugador alto'.
        max_altura:        Altura máxima en cm. Ej: 175 para 'jugador bajo'.
        limite:            Número máximo de resultados (1-30, default: 15).

    Returns:
        JSON string con estructura:
        {
            "player_ids": [2554, 39728, ...],   // IDs encontrados
            "error": "..."                       // solo si hubo un problema
        }

    Examples:
        >>> buscar_jugadores(posicion='fw', max_edad=23, liga='premier league')
        '{"player_ids": [45123, 22310, ...]}'

        >>> buscar_jugadores(posicion='mf', pierna='left', min_asistencias=5)
        '{"player_ids": [...]}'
    """
    df = _cargar_jugadores()
    if df.empty:
        return json.dumps({
            "player_ids": [],
            "error": "No se pudo cargar la base de datos de jugadores."
        })

    jugadores = _filtrar_jugadores(
        df,
        pos=posicion,
        perfil=perfil,
        liga=liga,
        pais=pais,
        min_edad=min_edad,
        max_edad=max_edad,
        min_goles=min_goles,
        min_asistencias=min_asistencias,
        min_regates=min_regates,
        min_minutos=min_minutos,
        max_valor=max_valor_mercado,
        min_valor=min_valor_mercado,
        pierna=pierna,
        min_altura=min_altura,
        max_altura=max_altura,
        limite=limite,
    )

    if not jugadores:
        return json.dumps({
            "player_ids": [],
            "error": "No se encontraron jugadores con esos criterios. Prueba a relajar los filtros."
        })

    return json.dumps({"player_ids": [p["id"] for p in jugadores]})


@tool
def obtener_jugador(nombre: str) -> str:
    """
    Busca un jugador por nombre y devuelve su ID.

    La búsqueda es parcial y case-insensitive. Útil cuando el usuario escribe
    directamente el nombre de un jugador en lugar de un perfil de búsqueda.

    Args:
        nombre: Nombre o fragmento del nombre del jugador.
                Ejemplos: 'Mbappé', 'lewandowski', 'vini', 'pedri'.

    Returns:
        JSON string con estructura:
        {
            "player_id": 2554,     // ID del primer resultado encontrado
            "error": "..."         // solo si no se encontró
        }

    Examples:
        >>> obtener_jugador("pedri")
        '{"player_id": 12345}'

        >>> obtener_jugador("jugador_que_no_existe")
        '{"player_id": null, "error": "No se encontró ningún jugador con ..."}'
    """
    df = _cargar_jugadores()
    if df.empty:
        return json.dumps({"player_id": None, "error": "No se pudo cargar la base de datos."})

    matches = df[df["Player"].fillna("").str.lower().str.contains(nombre.lower(), regex=False)]

    if matches.empty:
        return json.dumps({
            "player_id": None,
            "error": f"No se encontró ningún jugador con '{nombre}'."
        })

    return json.dumps({"player_id": int(matches.iloc[0]["PlayerID"])})


@tool
def listar_perfiles() -> str:
    """
    Devuelve el catálogo completo de perfiles de jugador disponibles en la BD.

    Útil para que el agente sepa qué valores exactos puede usar en el parámetro
    `perfil` de `buscar_jugadores`, evitando nombres que no existen en el CSV.

    Returns:
        String con todos los perfiles disponibles, separados por comas.

    Example:
        >>> listar_perfiles()
        'Perfiles disponibles: Cazagoles, Defensa con Toque, Extremo, ...'
    """
    df = _cargar_jugadores()
    if df.empty:
        return "No se pudo cargar la base de datos."

    perfiles = sorted(
        p for p in df["Perfil_Principal"].dropna().unique()
        if str(p).strip()
    )
    return "Perfiles disponibles: " + ", ".join(perfiles)


@tool
def listar_posiciones() -> str:
    """
    Devuelve el mapeo de códigos de posición a nombres legibles.

    Útil para que el agente entienda qué código usar en `buscar_jugadores`
    según lo que el usuario haya pedido en lenguaje natural.

    Returns:
        String con el mapeo código → nombre para cada posición.

    Example:
        >>> listar_posiciones()
        'Posiciones disponibles: df: defensa, mf: centrocampista, ...'
    """
    return (
        "Posiciones disponibles:\n"
        "  df  → defensa (central, lateral, líbero)\n"
        "  mf  → centrocampista (pivote, organizador, mediapunta)\n"
        "  fw  → delantero (punta, extremo, falso 9)\n"
        "  gk  → portero (guardameta, arquero)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Registro centralizado de herramientas
# ─────────────────────────────────────────────────────────────────────────────

SCOUTING_TOOLS = [
    buscar_jugadores,
    obtener_jugador,
    listar_perfiles,
    listar_posiciones,
]
"""
Lista de todas las herramientas registradas para el agente.

Uso en el grafo:
    from tools import SCOUTING_TOOLS
    agent = create_react_agent(llm, tools=SCOUTING_TOOLS)
"""
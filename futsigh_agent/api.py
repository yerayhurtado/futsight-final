"""
api.py — API REST del agente de scouting de fútbol.

Integra el agente con cualquier frontend (React, Vue, Next.js, etc.)
mediante endpoints HTTP estándar.

Arrancar el servidor:
    uvicorn api:app --reload --port 8000

Endpoints disponibles:
    GET  /                           → Info del servicio y mapa de endpoints
    POST /buscar                     → Búsqueda en lenguaje natural → player_ids
    GET  /jugadores?ids=1,2,3        → Datos completos de jugadores por ID (tarjetas)
    GET  /jugador/{id}/informe       → Informe individual (resumen, fortalezas, debilidades)
    GET  /health                     → Health check (para load balancers / k8s)

Ejemplo de flujo completo:
    1. POST /buscar  {"query": "extremo joven zurdo en la Premier League"}
       → {"player_ids": [45123, 22310, ...], "explicacion": "...", ...}

    2. GET  /jugadores?ids=45123,22310
       → {"jugadores": [{PlayerID, Player, Squad, Gls, strCutout, ...}, ...]}

    3. GET  /jugador/45123/informe
       → {"resumen": "...", "fortalezas": [...], "debilidades": [...]}
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

# ── Importaciones del propio proyecto ────────────────────────────────────────
# El módulo ahora se llama agent.py (no main.py)
from agent import buscar_jugadores, buscar_jugadores_stream
from utils.nodes import get_informe_jugador

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Configuración de la app
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Scouting Agent API",
    description=(
        "Búsqueda de jugadores de fútbol en lenguaje natural. "
        "Devuelve IDs de jugadores para que el frontend renderice las tarjetas."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: en producción reemplaza ["*"] por el dominio de tu frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Utilidades internas
# ─────────────────────────────────────────────────────────────────────────────

# Columnas que se devuelven en /jugadores (las que necesita la tarjeta en el frontend)
_COLUMNAS_TARJETA = [
    "PlayerID", "Player", "Squad", "League", "Nation",
    "Pos", "Pos_Main", "Perfil_Principal",
    "Age", "Altura", "Pierna_Buena",
    "Gls", "Ast", "Won", "Min", "xG", "KP", "SoT", "90s",
    "market_value_in_eur", "Valor_Mercado",
    "strCutout",
]


# Ya no usamos _get_csv_path, usamos la DB a través de utils.nodes


def _limpiar_fila(row: dict) -> dict:
    """
    Limpia una fila del DataFrame para que sea serializable en JSON:
    - NaN/NaT → None
    - floats que son enteros (1.0) → int (1)
    """
    resultado = {}
    for k, v in row.items():
        if v is None or (isinstance(v, float) and pd.isna(v)):
            resultado[k] = None
        elif isinstance(v, float) and v == int(v):
            resultado[k] = int(v)
        else:
            resultado[k] = v
    return resultado


# ─────────────────────────────────────────────────────────────────────────────
# Modelos de request / response (Pydantic)
# ─────────────────────────────────────────────────────────────────────────────

class BuscarRequest(BaseModel):
    """Body del endpoint POST /buscar."""
    query: str

    @field_validator("query")
    @classmethod
    def query_no_vacia(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La query no puede estar vacía.")
        if len(v) > 500:
            raise ValueError("La query no puede superar los 500 caracteres.")
        return v


class BuscarResponse(BaseModel):
    """Respuesta del endpoint POST /buscar."""
    player_ids:       list[int]  = []
    explicacion:      str        = ""
    basado_en:        str        = ""
    recomendacion:    str        = ""
    orden:            str        = ""
    filtros_relajados: str       = ""
    error:            Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Info"])
def root():
    """Mapa de endpoints del servicio."""
    return {
        "service": "Scouting Agent API v1.0",
        "endpoints": {
            "POST /buscar":              "Búsqueda en lenguaje natural → player_ids",
            "GET  /jugadores?ids=1,2,3": "Datos completos de jugadores para tarjetas",
            "GET  /jugador/{id}/informe": "Informe individual (resumen, fortalezas, debilidades)",
            "GET  /health":              "Health check",
        },
        "docs": "/docs",
    }


@app.get("/health", tags=["Info"])
def health():
    """
    Health check para load balancers y sistemas de monitoreo.
    Verifica que la base de datos esté accesible.
    """
    from utils.nodes import _get_db_path
    db_path = _get_db_path()
    db_ok = db_path is not None and db_path.exists()
    return {
        "status": "ok" if db_ok else "degraded",
        "db_disponible": db_ok,
        "db_path": str(db_path) if db_path else None,
    }


@app.post("/buscar", response_model=BuscarResponse, tags=["Scouting"])
def buscar(body: BuscarRequest):
    """
    Busca jugadores según una descripción en lenguaje natural.

    El agente extrae automáticamente los filtros de la query (posición, edad,
    pierna, liga, estadísticas, etc.) y devuelve una lista de PlayerIDs ordenada
    por relevancia.

    El frontend usa esos IDs para llamar a GET /jugadores y renderizar las tarjetas.

    **Ejemplos de query:**
    - `"extremo zurdo joven en la Premier League"`
    - `"delantero goleador con más de 10 goles, barato"`
    - `"mediocentro organizador en la Bundesliga"`
    - `"defensa central alto, valor en ascenso"`
    """
    try:
        resultado = buscar_jugadores(body.query)
        data = json.loads(resultado.get("response", "{}"))
    except json.JSONDecodeError as e:
        logger.error("Respuesta del agente no es JSON válido: %s", e)
        raise HTTPException(status_code=500, detail="Respuesta del agente inválida.")
    except Exception as e:
        logger.exception("Error ejecutando el agente para query=%s", body.query[:80])
        raise HTTPException(status_code=500, detail=str(e))

    return BuscarResponse(
        player_ids=data.get("player_ids", []),
        explicacion=data.get("explicacion", ""),
        basado_en=data.get("basado_en", ""),
        recomendacion=data.get("recomendacion", ""),
        orden=data.get("orden", ""),
        filtros_relajados=data.get("filtros_relajados", ""),
        error=data.get("error"),
    )


@app.post("/buscar-stream", tags=["Scouting"])
def buscar_stream(body: BuscarRequest):
    """
    Versión streaming de /buscar. Emite eventos SSE en tiempo real
    para cada nodo del pipeline del agente.

    Eventos emitidos:
        - node_start: {step, label}
        - node_end:   {step, label, duration_ms}
        - result:     payload final (mismo que /buscar)
        - error:      {message}
    """
    return StreamingResponse(
        buscar_jugadores_stream(body.query),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Evita buffering en nginx
        },
    )


@app.get("/jugadores", tags=["Jugadores"])
def jugadores_por_ids(
    ids: str = Query(
        ...,
        description="IDs de jugadores separados por coma. Ejemplo: 12345,67890,11111",
        examples=["12345,67890"],
    ),
):
    """
    Devuelve los datos completos de una lista de jugadores para renderizar tarjetas.

    Los IDs vienen del endpoint POST /buscar. El orden de la respuesta respeta
    el orden de los IDs recibidos (el primero es el más relevante según el agente).

    Cada jugador incluye: nombre, club, liga, posición, stats, valor de mercado
    y URL de la foto (strCutout).
    """
    # Parsear y validar IDs
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="'ids' debe ser una lista de números enteros separados por coma. Ejemplo: 1,2,3"
        )

    if not id_list:
        raise HTTPException(status_code=400, detail="Indica al menos un ID.")

    if len(id_list) > 50:
        raise HTTPException(status_code=400, detail="Máximo 50 IDs por petición.")

    # Cargar datos desde la DB (vía nodes que tiene caché)
    from utils.nodes import _get_df
    df, err = _get_df()
    
    if df is None:
        raise HTTPException(
            status_code=503,
            detail=f"Base de datos no disponible: {err}"
        )

    # Filtrar por IDs solicitados
    df_filtrado = df[df["PlayerID"].isin(id_list)].copy()

    if df_filtrado.empty:
        return {"jugadores": []}

    # Una fila por jugador: la temporada más reciente (ya viene así de _get_df, pero por seguridad)
    df = df_filtrado.groupby("PlayerID", as_index=False).first()

    # Respetar el orden original de la lista de IDs (relevancia del agente)
    orden = {pid: i for i, pid in enumerate(id_list)}
    df["_order"] = df["PlayerID"].map(orden)
    df = df.sort_values("_order").drop(columns=["_order"])

    # Devolver solo las columnas que necesita el frontend
    cols_disponibles = [c for c in _COLUMNAS_TARJETA if c in df.columns]
    jugadores = [_limpiar_fila(row) for row in df[cols_disponibles].to_dict(orient="records")]

    return {"jugadores": jugadores, "total": len(jugadores)}


@app.get("/jugador/{player_id}/informe", tags=["Jugadores"])
def informe_jugador(player_id: int):
    """
    Devuelve un informe individual de un jugador: resumen narrativo,
    lista de fortalezas y lista de debilidades, basado en sus estadísticas.

    Útil para el panel de detalle de una tarjeta en el frontend.
    """
    if player_id <= 0:
        raise HTTPException(status_code=400, detail="El player_id debe ser un número positivo.")

    informe = get_informe_jugador(player_id)
    if informe is None:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró el jugador con ID {player_id}."
        )
    return informe
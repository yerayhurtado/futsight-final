from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from model import predict_player_value, load_data
import pandas as pd

app = FastAPI(
    title="FutSight Prediction API",
    description="Microservicio de predicción de valor de mercado de jugadores de fútbol",
    version="1.0.0",
)

# Permitir peticiones desde el frontend Next.js (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pre-cargar el dataset al arrancar para que la primera petición no sea lenta
@app.on_event("startup")
def startup_event():
    try:
        load_data()
        print("[startup] Dataset listo.")
    except FileNotFoundError as e:
        print(f"[startup] ADVERTENCIA: {e}")


@app.get("/")
def root():
    return {"status": "ok", "service": "FutSight Prediction API v1.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/predict")
def predict(player: str = Query(..., description="Nombre del jugador a predecir")):
    """
    Predice el valor de mercado de un jugador dado su nombre.
    Ejemplo: GET /predict?player=Lamine+Yamal

    La respuesta incluye campos numéricos habituales y explicación XAI generada en
    `predict_player_value`: `explanation_details` (top impactos), `age_analysis`,
    `league`, `league_coeff`.
    """
    if not player or len(player.strip()) < 2:
        raise HTTPException(status_code=400, detail="El nombre del jugador es demasiado corto.")

    result = predict_player_value(player.strip())

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@app.get("/predict/batch")
def predict_batch(players: str = Query(..., description="Lista de jugadores separados por coma")):
    """
    Predice el valor de mercado de múltiples jugadores.
    Ejemplo: GET /predict/batch?players=Lamine+Yamal,Erling+Haaland
    """
    names = [p.strip() for p in players.split(",") if p.strip()]
    if not names:
        raise HTTPException(status_code=400, detail="No se proporcionaron nombres de jugadores.")

    results = []
    for name in names:
        result = predict_player_value(name)
        results.append(result)

    return {"count": len(results), "predictions": results}


@app.get("/search")
def search_players(q: str = Query(..., min_length=2, description="Término de búsqueda")):
    """
    Busca jugadores en el dataset por nombre (útil para autocompletar).
    Ejemplo: GET /search?q=lamine
    """
    try:
        df = load_data()
        mask = df["Player"].str.contains(q, case=False, na=False)
        matches = df[mask][["Player", "Squad", "Age", "Pos", "Valor_Mercado", "Season"]]
        # Solo temporada más reciente por jugador
        matches = matches.sort_values("Season", ascending=False).drop_duplicates(subset="Player")
        return {"results": matches.head(20).to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

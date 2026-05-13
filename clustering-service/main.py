"""
FutSight Clustering Service — API REST (FastAPI).

Microservicio de clasificación de jugadores mediante GMM.
Se entrena dinámicamente al arrancar y expone perfiles de scouting.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from clustering import classifier

app = FastAPI(
    title="FutSight Clustering API",
    description="Clasificación dinámica de jugadores mediante Gaussian Mixture Model",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Entrena los modelos GMM al arrancar."""
    try:
        classifier.fit()
    except Exception as e:
        print(f"[startup] Error entrenando GMM: {e}")


@app.get("/health")
def health():
    return {"status": "ok", "service": "clustering", "fitted": classifier._is_fitted}


@app.get("/profiles")
def get_profiles():
    """Catálogo de todos los perfiles de scouting disponibles."""
    profiles = classifier.get_all_profiles()
    return {"count": len(profiles), "profiles": profiles}


@app.post("/refit")
def refit():
    """Fuerza re-entrenamiento del modelo GMM."""
    try:
        classifier.fit()
        return {"status": "ok", "players_classified": len(classifier.player_map)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/clusters/{pos}")
def get_clusters(pos: str):
    """Info de clusters para una posición (df/mf/fw/gk)."""
    pos = pos.lower()
    if pos not in ("df", "mf", "fw", "gk"):
        raise HTTPException(status_code=400, detail="Posición debe ser: df, mf, fw, gk")
    clusters = classifier.get_clusters(pos)
    if not clusters:
        raise HTTPException(status_code=404, detail=f"No hay clusters para {pos.upper()}.")
    return {"position": pos, "clusters": clusters}


# IMPORTANTE: las rutas con prefijo fijo deben ir ANTES de la ruta con path param
@app.get("/classify/all")
def classify_all():
    """Todas las clasificaciones (para enriquecer datos en frontend/agent)."""
    all_data = classifier.classify_all()
    return {"count": len(all_data), "classifications": all_data}


@app.get("/classify/batch")
def classify_batch(ids: str = Query(..., description="IDs separados por coma")):
    """Clasificación batch de múltiples jugadores."""
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="IDs deben ser enteros separados por comas.")
    
    results = classifier.classify_batch(id_list)
    return {"count": len(results), "classifications": results}


@app.get("/classify/{player_id}")
def classify_player(player_id: int):
    """Clasificación GMM de un jugador individual."""
    result = classifier.classify(player_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Jugador {player_id} no clasificado.")
    return result

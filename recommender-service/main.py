from fastapi import FastAPI, HTTPException
from recommender import recommender

app = FastAPI(title="FutSight Recommender API")

@app.on_event("startup")
def startup():
    try:
        recommender.fit()
    except Exception as e:
        print(f"Error on startup: {e}")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/similar/{player_id}")
def get_similar(player_id: int, n: int = 5):
    results = recommender.find_similar(player_id, n=n)
    if not results:
        raise HTTPException(status_code=404, detail="No similar players found.")
    return {"player_id": player_id, "similar": results}

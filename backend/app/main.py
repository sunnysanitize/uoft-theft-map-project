from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .services import get_thefts

app = FastAPI(title="UofT Theft Heatmap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/thefts")
def thefts(limit: int = Query(default=5000, ge=1, le=50000)) -> list[dict]:
    return [item.model_dump() for item in get_thefts(limit=limit)]

# UofT Theft Heatmap

This project now has a minimal full-stack setup:

- `backend/scripts/ingest_data.py`: reads Toronto theft CSV and keeps only incidents inside an approximate UofT St. George campus polygon.
- `backend/app/main.py`: FastAPI server exposing `GET /thefts` for the filtered records.
- `frontend/app/page.tsx`: UI that fetches live backend data and falls back to `frontend/public/thefts.json` when backend is unavailable.

## Run backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/ingest_data.py
uvicorn app.main:app --reload
```

`python scripts/ingest_data.py` now writes both:

- `backend/data/thefts.db` for FastAPI
- `frontend/public/thefts.json` as a frontend fallback dataset

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

If your API is not at `http://localhost:8000`, set:

```bash
NEXT_PUBLIC_API_BASE=http://your-host:your-port
```

If your shell prompt is stuck in the virtualenv, run:

```bash
deactivate
```

## Notes

- The St. George filter currently uses a campus polygon in `backend/scripts/ingest_data.py`.
- For production heatmaps, you can replace that polygon with a more exact campus boundary (GeoJSON) and render points on Leaflet or Mapbox.

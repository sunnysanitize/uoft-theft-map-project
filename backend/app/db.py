from __future__ import annotations

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "thefts.db"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS theft_incidents (
                event_unique_id TEXT PRIMARY KEY,
                occ_date TEXT,
                offence TEXT,
                neighbourhood TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL
            )
            """
        )
        conn.commit()

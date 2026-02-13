from __future__ import annotations

from collections.abc import Iterable

from .db import get_connection, init_db
from .models import TheftPoint


def replace_thefts(rows: Iterable[TheftPoint]) -> int:
    rows = list(rows)
    init_db()
    with get_connection() as conn:
        conn.execute("DELETE FROM theft_incidents")
        conn.executemany(
            """
            INSERT INTO theft_incidents (
                event_unique_id,
                occ_date,
                offence,
                neighbourhood,
                lat,
                lng
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row.event_unique_id,
                    row.occ_date,
                    row.offence,
                    row.neighbourhood,
                    row.lat,
                    row.lng,
                )
                for row in rows
            ],
        )
        conn.commit()
    return len(rows)


def get_thefts(limit: int = 5000) -> list[TheftPoint]:
    init_db()
    with get_connection() as conn:
        result = conn.execute(
            """
            SELECT event_unique_id, occ_date, offence, neighbourhood, lat, lng
            FROM theft_incidents
            ORDER BY occ_date DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        TheftPoint(
            event_unique_id=row["event_unique_id"],
            occ_date=row["occ_date"],
            offence=row["offence"],
            neighbourhood=row["neighbourhood"],
            lat=row["lat"],
            lng=row["lng"],
        )
        for row in result
    ]

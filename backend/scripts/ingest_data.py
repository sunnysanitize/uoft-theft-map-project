from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
CSV_PATH = BASE_DIR / "data" / "Theft_Over_Open_Data_7348364305527531123.csv"
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.models import TheftPoint
from app.services import replace_thefts

# Approximate polygon around UTSG
# Stored as (longitude, latitude)
ST_GEORGE_POLYGON = [
    (-79.4098, 43.6631),
    (-79.4056, 43.6699),
    (-79.3988, 43.6703),
    (-79.3930, 43.6675),
    (-79.3925, 43.6603),
    (-79.3980, 43.6548),
    (-79.4068, 43.6551),
]
FRONTEND_DATA_PATH = BASE_DIR.parent / "frontend" / "public" / "thefts.json"


def point_in_polygon(lat: float, lng: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(polygon) - 1

    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]

        intersects = (yi > lat) != (yj > lat)
        if intersects:
            x_at_lat = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lng < x_at_lat:
                inside = not inside

        j = i

    return inside


def parse_float(value: str) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number == 0:
        return None
    return number


def load_and_filter() -> list[TheftPoint]:
    points: list[TheftPoint] = []

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            lat = parse_float(row.get("LAT_WGS84", ""))
            lng = parse_float(row.get("LONG_WGS84", ""))
            if lat is None or lng is None:
                continue

            if not point_in_polygon(lat=lat, lng=lng, polygon=ST_GEORGE_POLYGON):
                continue

            points.append(
                TheftPoint(
                    event_unique_id=row.get("EVENT_UNIQUE_ID", ""),
                    occ_date=row.get("OCC_DATE"),
                    offence=row.get("OFFENCE"),
                    neighbourhood=row.get("NEIGHBOURHOOD_158") or row.get("NEIGHBOURHOOD_140"),
                    lat=lat,
                    lng=lng,
                )
            )

    return points


def export_frontend_json(points: list[TheftPoint]) -> None:
    FRONTEND_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = [point.model_dump() for point in points]
    with FRONTEND_DATA_PATH.open("w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=True)


def main() -> None:
    points = load_and_filter()
    total = replace_thefts(points)
    export_frontend_json(points)
    print(f"Loaded {total} St. George theft records into SQLite.")


if __name__ == "__main__":
    main()

from pydantic import BaseModel


class TheftPoint(BaseModel):
    event_unique_id: str
    occ_date: str | None
    offence: str | None
    neighbourhood: str | None
    lat: float
    lng: float

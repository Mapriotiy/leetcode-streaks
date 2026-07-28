from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ProblemResponse(BaseModel):
    title: str
    title_slug: str
    difficulty: str
    url: str


class ProvinceResponse(BaseModel):
    province_id: str
    region_id: str
    region_name: str
    problem: Optional[ProblemResponse] = None
    captured_by: Optional[int] = None
    captured_by_username: Optional[str] = None
    captured_at: Optional[datetime] = None


class WeeklyMapResponse(BaseModel):
    week_start: date
    friendship_id: int
    provinces: list[ProvinceResponse]


class SyncResponse(BaseModel):
    captured_count: int
    provinces: list[ProvinceResponse]
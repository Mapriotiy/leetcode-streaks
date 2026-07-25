from pydantic import BaseModel


class SolvedStats(BaseModel):
    total: int = 0
    easy: int = 0
    medium: int = 0
    hard: int = 0


class LeetCodeProfileResponse(BaseModel):
    username: str
    real_name: str | None = None
    avatar_url: str | None = None
    ranking: int | None = None
    solved: SolvedStats
    submission_calendar: dict[str, int]
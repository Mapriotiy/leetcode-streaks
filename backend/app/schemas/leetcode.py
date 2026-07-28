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


class RecentAcceptedSubmission(BaseModel):
    title: str
    title_slug: str
    url: str
    submitted_at: str
    language: str | None = None
    submission_id: int | None = None
    submission_url: str | None = None
    runtime_ms: int | None = None

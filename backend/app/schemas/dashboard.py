from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TodaySubmissionResponse(BaseModel):
    title: str
    title_slug: str
    url: str
    submitted_at: str
    language: str | None = None
    difficulty: str | None = None
    topic_tags: list[str] = Field(default_factory=list)


class ActivityCalendarDayResponse(BaseModel):
    date: str
    count: int


class SyncMetaResponse(BaseModel):
    status: Literal[
        "synced",
        "recently_synced",
        "in_progress",
        "rate_limited",
        "failed",
        "skipped",
    ]
    last_synced_at: datetime | None = None
    next_sync_after: datetime | None = None
    error: str | None = None


class DashboardSyncResponse(BaseModel):
    recent: SyncMetaResponse
    profile: SyncMetaResponse


class DashboardLobbyPlayerResponse(BaseModel):
    user_id: int
    leetcode_username: str
    faction_id: int | None = None
    status: str


class DashboardFactionResponse(BaseModel):
    id: int
    name: str
    color: str


class DashboardLobbyResponse(BaseModel):
    id: int
    name: str
    status: str
    game_mode: str
    map_size: str
    max_players: int
    faction_mode: bool = False
    faction_count: int = 0
    factions: list[DashboardFactionResponse] = Field(default_factory=list)
    programming_language: str = "python3"
    creator_id: int
    players: list[DashboardLobbyPlayerResponse] = Field(default_factory=list)


class DashboardResponse(BaseModel):
    leetcode_username: str
    avatar_url: str | None = None
    current_streak: int
    current_streak_state: Literal["lit", "pending", "broken"]
    today_active: bool
    longest_streak: int
    active_days_count: int
    today_submissions: list[TodaySubmissionResponse] = Field(default_factory=list)
    activity_calendar: list[ActivityCalendarDayResponse] = Field(default_factory=list)
    lobbies: list[DashboardLobbyResponse] = Field(default_factory=list)
    sync: DashboardSyncResponse | None = None

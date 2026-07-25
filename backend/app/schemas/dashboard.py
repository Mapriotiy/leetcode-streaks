from typing import Literal

from pydantic import BaseModel


class DashboardResponse(BaseModel):
    leetcode_username: str
    avatar_url: str | None = None
    current_streak: int
    current_streak_state: Literal["lit", "pending", "broken"]
    today_active: bool
    longest_streak: int
    active_days_count: int

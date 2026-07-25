from pydantic import BaseModel


class DashboardResponse(BaseModel):
    leetcode_username: str
    current_streak: int
    longest_streak: int
    active_days_count: int
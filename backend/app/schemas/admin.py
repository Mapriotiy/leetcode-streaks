from datetime import datetime

from pydantic import BaseModel


class AdminUserOut(BaseModel):
    id: int
    google_sub: str | None = None
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    leetcode_username: str | None = None
    leetcode_verified_at: datetime | None = None
    is_admin: bool = False
    is_banned: bool = False
    created_at: datetime


class AdminUserListResponse(BaseModel):
    total: int
    offset: int
    limit: int
    users: list[AdminUserOut]


class AdminUserUpdate(BaseModel):
    is_admin: bool | None = None
    is_banned: bool | None = None

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class FriendUserResponse(BaseModel):
    id: int
    leetcode_username: str


class CreateInviteResponse(BaseModel):
    token: str
    invite_url: str


class InviteResponse(BaseModel):
    token: str
    status: str
    inviter: FriendUserResponse
    created_at: datetime


class AcceptInviteResponse(BaseModel):
    friendship_id: int
    friend: FriendUserResponse


class TodayFriendStatusResponse(BaseModel):
    you_active: bool
    friend_active: bool
    shared_active: bool

class FriendStreakResponse(BaseModel):
    display_count: int
    current_count: int
    longest_count: int
    state: Literal["lit", "pending", "broken"]
    last_shared_active_date: date | None
    started_at: date
    today: TodayFriendStatusResponse


class FriendResponse(BaseModel):
    friendship_id: int
    friend: FriendUserResponse
    streak: FriendStreakResponse
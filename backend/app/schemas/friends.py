from datetime import datetime

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


class FriendResponse(BaseModel):
    friendship_id: int
    friend: FriendUserResponse
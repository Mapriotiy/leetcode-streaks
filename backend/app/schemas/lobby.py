from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class FactionResponse(BaseModel):
    id: int
    name: str
    color: str


class LobbyPlayerResponse(BaseModel):
    user_id: int
    leetcode_username: str
    faction_id: Optional[int] = None
    status: str


class LobbyResponse(BaseModel):
    id: int
    creator_id: int
    name: str
    status: str
    game_mode: str
    map_size: str
    max_players: int
    faction_mode: bool
    faction_count: int
    factions: list[FactionResponse] = Field(default_factory=list)
    programming_language: str = "python3"
    win_condition: dict
    players: list[LobbyPlayerResponse]
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    invite_url: Optional[str] = None


class CreateLobbyRequest(BaseModel):
    name: str
    game_mode: str = "free_for_all"
    map_size: str = "medium"
    max_players: int = 2
    faction_mode: bool = False
    faction_count: int = 0
    programming_language: str = "python3"
    win_condition: dict = {"type": "territory_control", "threshold": 0.5, "duration_hours": 0}


class CreateLobbyResponse(BaseModel):
    lobby: LobbyResponse
    invite_url: str


class InviteLobbyResponse(BaseModel):
    lobby_id: int
    lobby_name: str
    creator_username: str
    player_count: int
    max_players: int
    faction_mode: bool = False
    faction_count: int = 0
    programming_language: str = "python3"
    status: str


class LobbyMapProvinceResponse(BaseModel):
    province_id: str
    region_id: str
    problem: Optional[dict] = None
    captured_by: Optional[int] = None
    captured_by_username: Optional[str] = None
    captured_at: Optional[datetime] = None
    captured_submission_url: Optional[str] = None
    capturer_leetcode_username: Optional[str] = None


class LobbyMapResponse(BaseModel):
    lobby_id: int
    provinces: list[LobbyMapProvinceResponse]


class LobbyMapSyncResponse(BaseModel):
    captured_count: int
    provinces: list[LobbyMapProvinceResponse]


class UpdateFactionRequest(BaseModel):
    name: str
    color: str


class UpdatePlayerFactionRequest(BaseModel):
    faction_id: int

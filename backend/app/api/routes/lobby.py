"""Lobby lifecycle routes. Game logic lives in app.services.game_modes;
these routes dispatch on lobby.game_mode via the mode registry."""

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.lobby import Lobby
from app.models.lobby_player import LobbyPlayer
from app.models.lobby_invite import LobbyInvite
from app.models.user import User
from app.schemas.lobby import (
    CreateLobbyRequest,
    CreateLobbyResponse,
    InviteLobbyResponse,
    LobbyEventResponse,
    LobbyPlayerResponse,
    LobbyResponse,
    FactionResponse,
    UpdateFactionRequest,
    UpdatePlayerFactionRequest,
)
from app.services.events import get_lobby_events
from app.services.game_modes import get_mode
from app.services.lobby_settings import (
    ALLOWED_FACTION_COLORS,
    ALLOWED_PROGRAMMING_LANGUAGES,
    FACTION_NAMES,
    default_factions,
    lobby_factions,
    lobby_programming_language,
    ordered_players,
    set_lobby_factions,
    utcnow,
)
from app.services.problem_catalog import ensure_catalog

logger = logging.getLogger(__name__)
router = APIRouter()


def _invite_url(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/?lobby={token}"


def _to_lobby_response(lobby: Lobby, db: Session, invite_url: str | None = None) -> LobbyResponse:
    players = [
        LobbyPlayerResponse(
            user_id=u.id,
            leetcode_username=u.leetcode_username,
            faction_id=lp.faction_id,
            status=lp.status,
        )
        for lp, u in ordered_players(lobby.id, db)
    ]
    return LobbyResponse(
        id=lobby.id,
        creator_id=lobby.creator_id,
        name=lobby.name,
        status=lobby.status,
        game_mode=lobby.game_mode,
        map_size=lobby.map_size,
        max_players=lobby.max_players,
        faction_mode=lobby.faction_mode,
        faction_count=lobby.faction_count,
        factions=[FactionResponse(**faction) for faction in lobby_factions(lobby)],
        programming_language=lobby_programming_language(lobby),
        win_condition=lobby.win_condition,
        players=players,
        created_at=lobby.created_at,
        started_at=lobby.started_at,
        finished_at=lobby.finished_at,
        winner_id=lobby.winner_id,
        winner_faction_id=lobby.winner_faction_id,
        invite_url=invite_url,
    )


def _add_player(lobby: Lobby, user_id: int, db: Session) -> None:
    if db.query(LobbyPlayer).filter_by(lobby_id=lobby.id, user_id=user_id).first():
        return
    count = db.query(LobbyPlayer).filter_by(lobby_id=lobby.id).count()
    if not lobby.faction_mode and count >= lobby.max_players:
        raise HTTPException(409, "Lobby is full")

    if lobby.faction_mode and lobby.faction_count > 0:
        counts: dict[int, int] = {}
        for (fid,) in db.query(LobbyPlayer.faction_id).filter_by(lobby_id=lobby.id).all():
            if fid:
                counts[fid] = counts.get(fid, 0) + 1
        fid = min(range(1, lobby.faction_count + 1), key=lambda f: counts.get(f, 0))
    else:
        fid = count + 1

    db.add(LobbyPlayer(lobby_id=lobby.id, user_id=user_id, faction_id=fid, status="accepted"))


# ── Create ──

@router.post("", response_model=CreateLobbyResponse)
def create_lobby(
    payload: CreateLobbyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_mode(payload.game_mode)  # 400 on unknown modes

    faction_count = min(max(payload.faction_count, 2), 4) if payload.faction_mode else 0
    win_condition = dict(payload.win_condition or {})
    programming_language = payload.programming_language if payload.programming_language in ALLOWED_PROGRAMMING_LANGUAGES else "python3"
    win_condition["programming_language"] = programming_language
    if payload.faction_mode:
        win_condition["factions"] = default_factions(faction_count)
    lobby = Lobby(
        creator_id=current_user.id,
        name=payload.name,
        game_mode=payload.game_mode,
        map_size=payload.map_size,
        max_players=0 if payload.faction_mode else payload.max_players,
        faction_mode=payload.faction_mode,
        faction_count=faction_count,
        win_condition=win_condition,
    )
    db.add(lobby)
    db.flush()

    db.add(LobbyPlayer(lobby_id=lobby.id, user_id=current_user.id, faction_id=1, status="ready"))

    token = secrets.token_urlsafe(24)
    db.add(LobbyInvite(lobby_id=lobby.id, token=token, created_by_user_id=current_user.id))
    db.commit()
    db.refresh(lobby)

    url = _invite_url(token)
    return CreateLobbyResponse(lobby=_to_lobby_response(lobby, db, url), invite_url=url)


# ── Get ──

@router.get("/{lobby_id}", response_model=LobbyResponse)
def get_lobby(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    invite = db.query(LobbyInvite).filter_by(lobby_id=lobby.id).first()
    url = _invite_url(invite.token) if invite else None
    return _to_lobby_response(lobby, db, url)


# ── Invite via token ──

@router.get("/invites/{token}", response_model=InviteLobbyResponse)
def get_invite(token: str, db: Session = Depends(get_db)):
    invite = db.query(LobbyInvite).filter_by(token=token).first()
    if not invite:
        raise HTTPException(404, "Invite not found")
    lobby = db.get(Lobby, invite.lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    creator = db.get(User, lobby.creator_id)
    count = db.query(LobbyPlayer).filter_by(lobby_id=lobby.id).count()
    return InviteLobbyResponse(
        lobby_id=lobby.id, lobby_name=lobby.name,
        creator_username=creator.leetcode_username if creator else "?",
        player_count=count, max_players=lobby.max_players, status=lobby.status,
        faction_mode=lobby.faction_mode, faction_count=lobby.faction_count,
        programming_language=lobby_programming_language(lobby),
    )


@router.post("/invites/{token}/accept", response_model=LobbyResponse)
def accept_invite(token: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invite = db.query(LobbyInvite).filter_by(token=token).first()
    if not invite:
        raise HTTPException(404, "Invite not found")
    lobby = db.get(Lobby, invite.lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    if lobby.status != "waiting":
        raise HTTPException(409, "Game already started")
    _add_player(lobby, current_user.id, db)
    db.commit()
    return _to_lobby_response(lobby, db, _invite_url(token))


# ── Invite user by ID ──

@router.post("/{lobby_id}/invite-user", response_model=LobbyResponse)
def invite_user(
    lobby_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    is_member = db.query(LobbyPlayer).filter_by(lobby_id=lobby.id, user_id=current_user.id).first()
    if not is_member:
        raise HTTPException(403, "Not a lobby member")
    uid = payload.get("user_id")
    if not uid:
        raise HTTPException(400, "user_id required")
    _add_player(lobby, int(uid), db)
    db.commit()
    invite = db.query(LobbyInvite).filter_by(lobby_id=lobby.id).first()
    return _to_lobby_response(lobby, db, _invite_url(invite.token) if invite else None)


# ── Factions ──

@router.patch("/{lobby_id}/factions/{faction_id}", response_model=LobbyResponse)
def update_faction(
    lobby_id: int,
    faction_id: int,
    payload: UpdateFactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    if lobby.creator_id != current_user.id:
        raise HTTPException(403, "Only creator can edit factions")
    if lobby.status != "waiting":
        raise HTTPException(409, "Game already started")
    if not lobby.faction_mode:
        raise HTTPException(400, "Lobby is not in faction mode")
    if faction_id < 1 or faction_id > lobby.faction_count:
        raise HTTPException(400, "Invalid faction")

    color = payload.color.strip()
    if len(color) != 7 or not color.startswith("#"):
        raise HTTPException(400, "Color must be a hex value")
    if color not in ALLOWED_FACTION_COLORS:
        raise HTTPException(400, "Color is not in the faction palette")

    factions = lobby_factions(lobby)
    for faction in factions:
        if faction["id"] == faction_id:
            faction["name"] = payload.name.strip()[:32] or FACTION_NAMES.get(faction_id, f"Faction {faction_id}")
            faction["color"] = color
            break

    set_lobby_factions(lobby, factions)
    db.commit()
    db.refresh(lobby)
    invite = db.query(LobbyInvite).filter_by(lobby_id=lobby.id).first()
    return _to_lobby_response(lobby, db, _invite_url(invite.token) if invite else None)


@router.patch("/{lobby_id}/players/{user_id}/faction", response_model=LobbyResponse)
def update_player_faction(
    lobby_id: int,
    user_id: int,
    payload: UpdatePlayerFactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    if lobby.creator_id != current_user.id:
        raise HTTPException(403, "Only creator can assign factions")
    if lobby.status != "waiting":
        raise HTTPException(409, "Game already started")
    if not lobby.faction_mode:
        raise HTTPException(400, "Lobby is not in faction mode")
    if payload.faction_id < 1 or payload.faction_id > lobby.faction_count:
        raise HTTPException(400, "Invalid faction")

    player = db.query(LobbyPlayer).filter_by(lobby_id=lobby_id, user_id=user_id).first()
    if not player:
        raise HTTPException(404, "Player not found in lobby")

    player.faction_id = payload.faction_id
    db.commit()
    db.refresh(lobby)
    invite = db.query(LobbyInvite).filter_by(lobby_id=lobby.id).first()
    return _to_lobby_response(lobby, db, _invite_url(invite.token) if invite else None)


@router.delete("/{lobby_id}/leave", status_code=204)
def leave_lobby(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    lp = db.query(LobbyPlayer).filter_by(lobby_id=lobby_id, user_id=current_user.id).first()
    if not lp:
        raise HTTPException(404, "Not in lobby")
    db.delete(lp)
    db.flush()

    remaining_players = (
        db.query(LobbyPlayer)
        .filter_by(lobby_id=lobby_id)
        .order_by(LobbyPlayer.joined_at.asc())
        .all()
    )
    if not remaining_players:
        db.delete(lobby)
    elif lobby.creator_id == current_user.id:
        lobby.creator_id = remaining_players[0].user_id

    db.commit()


# ── Game (dispatched to the mode registry) ──

@router.post("/{lobby_id}/start", response_model=LobbyResponse)
async def start_game(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    if lobby.creator_id != current_user.id:
        raise HTTPException(403, "Only creator can start")
    if lobby.status != "waiting":
        raise HTTPException(409, "Already started")
    players = ordered_players(lobby.id, db)
    if len(players) < 2:
        raise HTTPException(400, "Need at least 2 players")

    await ensure_catalog(db)
    await get_mode(lobby.game_mode).start(lobby, players, db)

    lobby.status = "active"
    lobby.started_at = utcnow()
    db.commit()
    db.refresh(lobby)
    invite = db.query(LobbyInvite).filter_by(lobby_id=lobby.id).first()
    return _to_lobby_response(lobby, db, _invite_url(invite.token) if invite else None)


@router.get("/{lobby_id}/map")
def get_game_state(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    return get_mode(lobby.game_mode).get_state(lobby, ordered_players(lobby.id, db), db)


@router.post("/{lobby_id}/map/sync")
async def sync_game(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    mode = get_mode(lobby.game_mode)
    players = ordered_players(lobby.id, db)
    if lobby.status == "finished":
        return mode.get_state(lobby, players, db)
    return await mode.sync(lobby, players, db)


@router.get("/{lobby_id}/events", response_model=list[LobbyEventResponse])
def get_events(
    lobby_id: int,
    after_id: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    limit = max(1, min(limit, 200))
    return get_lobby_events(lobby_id, after_id, limit, db)

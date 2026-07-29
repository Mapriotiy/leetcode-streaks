import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.lobby import Lobby
from app.models.lobby_player import LobbyPlayer
from app.models.lobby_invite import LobbyInvite
from app.models.lobby_map import LobbyMap
from app.models.lobby_map_province import LobbyMapProvince
from app.models.leetcode_problem import LeetCodeProblem
from app.models.user import User
from app.schemas.lobby import (
    CreateLobbyRequest,
    CreateLobbyResponse,
    InviteLobbyResponse,
    LobbyEventResponse,
    LobbyMapProvinceResponse,
    LobbyMapResponse,
    LobbyMapSyncResponse,
    LobbyPlayerResponse,
    LobbyResponse,
    LobbyScoreEntry,
    FactionResponse,
    UpdateFactionRequest,
    UpdatePlayerFactionRequest,
)
from app.services.capture_engine import CAPTURE, RECAPTURE, apply_capture_pass
from app.services.events import (
    get_lobby_events,
    record_lobby_events,
    region_control_changes,
)
from app.services.leetcode_client import LeetCodeClient
from app.services.problem_catalog import ensure_catalog
from app.services.scoring import TeamScore, compute_team_scores, region_control_by_team
from app.services.user_solved import (
    get_solved_for_slugs,
    get_solved_slugs_with_timestamps,
    normalize_language,
    record_submissions,
)
from app.services.map_config import PROVINCE_REGION, REGION_TOPICS
from app.services.map_generator import _pick_problem

logger = logging.getLogger(__name__)
router = APIRouter()

FACTION_COLORS = {1: "#00c2ff", 2: "#ff4d6d", 3: "#ffb020", 4: "#27d980"}
FACTION_NAMES = {1: "Alpha", 2: "Bravo", 3: "Charlie", 4: "Delta"}
ALLOWED_FACTION_COLORS = {
    "#00c2ff", "#ff4d6d", "#ffb020", "#27d980",
    "#9b7cff", "#4f9cff", "#ff7a59", "#a3e635",
}
ALLOWED_PROGRAMMING_LANGUAGES = {
    "python3", "cpp", "java", "javascript", "typescript", "csharp", "golang", "rust",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _invite_url(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/?lobby={token}"


def _default_factions(count: int) -> list[dict]:
    return [
        {
            "id": faction_id,
            "name": FACTION_NAMES.get(faction_id, f"Faction {faction_id}"),
            "color": FACTION_COLORS.get(faction_id, "#888888"),
        }
        for faction_id in range(1, count + 1)
    ]


def _lobby_factions(lobby: Lobby) -> list[dict]:
    if not lobby.faction_mode or lobby.faction_count <= 0:
        return []

    configured = (lobby.win_condition or {}).get("factions")
    configured_by_id = {
        int(faction.get("id")): faction
        for faction in configured or []
        if isinstance(faction, dict) and faction.get("id")
    }

    factions: list[dict] = []
    for default in _default_factions(lobby.faction_count):
        configured_faction = configured_by_id.get(default["id"], {})
        configured_color = str(configured_faction.get("color") or default["color"])
        factions.append(
            {
                "id": default["id"],
                "name": str(configured_faction.get("name") or default["name"])[:32],
                "color": configured_color if configured_color in ALLOWED_FACTION_COLORS else default["color"],
            }
        )
    return factions


def _set_lobby_factions(lobby: Lobby, factions: list[dict]) -> None:
    win_condition = dict(lobby.win_condition or {})
    win_condition["factions"] = factions
    lobby.win_condition = win_condition


def _lobby_programming_language(lobby: Lobby) -> str:
    language = normalize_language(str((lobby.win_condition or {}).get("programming_language") or "python3"))
    return language if language in ALLOWED_PROGRAMMING_LANGUAGES else "python3"


def _filter_submissions_by_language(submissions, language: str):
    return [
        submission
        for submission in submissions
        if normalize_language(submission.language) == language
    ]


def _to_lobby_response(lobby: Lobby, db: Session, invite_url: str | None = None) -> LobbyResponse:
    rows = (
        db.query(LobbyPlayer, User)
        .join(User, LobbyPlayer.user_id == User.id)
        .filter(LobbyPlayer.lobby_id == lobby.id)
        .all()
    )
    players = [
        LobbyPlayerResponse(
            user_id=u.id,
            leetcode_username=u.leetcode_username,
            faction_id=lp.faction_id,
            status=lp.status,
        )
        for lp, u in rows
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
        factions=[FactionResponse(**faction) for faction in _lobby_factions(lobby)],
        programming_language=_lobby_programming_language(lobby),
        win_condition=lobby.win_condition,
        players=players,
        created_at=lobby.created_at,
        started_at=lobby.started_at,
        finished_at=lobby.finished_at,
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


def _build_province(p: LobbyMapProvince, problems: dict, users: dict) -> LobbyMapProvinceResponse:
    prob = problems.get(p.problem_title_slug)
    return LobbyMapProvinceResponse(
        province_id=p.province_id,
        region_id=p.region_id,
        problem={"title": prob.title, "title_slug": prob.title_slug, "difficulty": prob.difficulty,
                 "url": f"https://leetcode.com/problems/{prob.title_slug}/"} if prob else None,
        captured_by=p.captured_by,
        captured_by_username=users.get(p.captured_by) if p.captured_by else None,
        captured_at=p.captured_at,
        captured_runtime_ms=p.captured_runtime_ms,
        captured_submission_url=p.captured_submission_url,
        capturer_leetcode_username=p.capturer_leetcode_username,
        first_captured_by=p.first_captured_by,
    )


def _ordered_players(lobby_id: int, db: Session) -> list[tuple[LobbyPlayer, User]]:
    """Lobby players with users, in join order (the capture tiebreak order)."""
    return (
        db.query(LobbyPlayer, User)
        .join(User, LobbyPlayer.user_id == User.id)
        .filter(LobbyPlayer.lobby_id == lobby_id)
        .order_by(LobbyPlayer.joined_at.asc(), LobbyPlayer.user_id.asc())
        .all()
    )


def _team_by_user(lobby: Lobby, players: list[tuple[LobbyPlayer, User]]) -> dict[int, int]:
    """Capture/scoring team per player: faction in faction mode, self otherwise."""
    if lobby.faction_mode:
        return {u.id: lp.faction_id for lp, u in players if lp.faction_id}
    return {u.id: u.id for _, u in players}


def _score_entries(
    lobby: Lobby,
    provinces: list[LobbyMapProvince],
    players: list[tuple[LobbyPlayer, User]],
    problems: dict,
) -> list[LobbyScoreEntry]:
    difficulty_by_slug = {
        slug: prob.difficulty for slug, prob in problems.items() if prob.difficulty
    }
    team_scores = compute_team_scores(provinces, _team_by_user(lobby, players), difficulty_by_slug)

    entries: list[LobbyScoreEntry] = []
    if lobby.faction_mode:
        for faction in _lobby_factions(lobby):
            score = team_scores.get(faction["id"], TeamScore())
            entries.append(
                LobbyScoreEntry(
                    team_id=faction["id"],
                    label=faction["name"],
                    color=faction["color"],
                    provinces=score.provinces,
                    base_points=score.base_points,
                    bonus_points=score.bonus_points,
                    region_control_points=score.region_control_points,
                    total_points=score.total_points,
                )
            )
    else:
        for lp, u in players:
            score = team_scores.get(u.id, TeamScore())
            entries.append(
                LobbyScoreEntry(
                    team_id=u.id,
                    label=u.leetcode_username,
                    color=FACTION_COLORS.get(lp.faction_id, "#888888"),
                    provinces=score.provinces,
                    base_points=score.base_points,
                    bonus_points=score.bonus_points,
                    region_control_points=score.region_control_points,
                    total_points=score.total_points,
                )
            )

    entries.sort(key=lambda e: e.total_points, reverse=True)
    return entries


# ── Create ──

@router.post("", response_model=CreateLobbyResponse)
def create_lobby(
    payload: CreateLobbyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    faction_count = min(max(payload.faction_count, 2), 4) if payload.faction_mode else 0
    win_condition = dict(payload.win_condition or {})
    programming_language = payload.programming_language if payload.programming_language in ALLOWED_PROGRAMMING_LANGUAGES else "python3"
    win_condition["programming_language"] = programming_language
    if payload.faction_mode:
        win_condition["factions"] = _default_factions(faction_count)
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
        programming_language=_lobby_programming_language(lobby),
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


# ── Leave lobby ──

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

    factions = _lobby_factions(lobby)
    for faction in factions:
        if faction["id"] == faction_id:
            faction["name"] = payload.name.strip()[:32] or FACTION_NAMES.get(faction_id, f"Faction {faction_id}")
            faction["color"] = color
            break

    _set_lobby_factions(lobby, factions)
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


# ── Start game ──

@router.post("/{lobby_id}/start", response_model=LobbyResponse)
async def start_game(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    if lobby.creator_id != current_user.id:
        raise HTTPException(403, "Only creator can start")
    if lobby.status != "waiting":
        raise HTTPException(409, "Already started")
    count = db.query(LobbyPlayer).filter_by(lobby_id=lobby.id).count()
    if count < 2:
        raise HTTPException(400, "Need at least 2 players")

    await ensure_catalog(db)
    language = _lobby_programming_language(lobby)

    players = (
        db.query(LobbyPlayer, User)
        .join(User, LobbyPlayer.user_id == User.id)
        .filter(LobbyPlayer.lobby_id == lobby.id)
        .all()
    )
    all_solved: set[str] = set()
    for _, u in players:
        all_solved.update(get_solved_slugs_with_timestamps(u.id, db, language=language).keys())

    lmap = LobbyMap(lobby_id=lobby.id, map_size=lobby.map_size)
    db.add(lmap)
    db.flush()

    used: set[str] = set()
    for prov_id, region_id in PROVINCE_REGION.items():
        cfg = REGION_TOPICS.get(region_id, {"tags": [], "difficulty": None})
        prob = _pick_problem(cfg["tags"], cfg["difficulty"], all_solved | used, db)
        if not prob:
            prob = _pick_problem([], None, all_solved | used, db)
        if not prob:
            continue
        used.add(prob.title_slug)
        db.add(LobbyMapProvince(
            lobby_map_id=lmap.id, province_id=prov_id,
            region_id=region_id, problem_title_slug=prob.title_slug,
        ))

    lobby.status = "active"
    lobby.started_at = _utcnow()
    db.commit()
    db.refresh(lobby)
    invite = db.query(LobbyInvite).filter_by(lobby_id=lobby.id).first()
    return _to_lobby_response(lobby, db, _invite_url(invite.token) if invite else None)


# ── Map ──

def _get_lmap(lobby_id: int, db: Session) -> LobbyMap | None:
    return db.query(LobbyMap).filter_by(lobby_id=lobby_id).first()


@router.get("/{lobby_id}/map", response_model=LobbyMapResponse)
def get_map(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    lmap = _get_lmap(lobby_id, db)
    if not lmap:
        return LobbyMapResponse(lobby_id=lobby_id, provinces=[])

    players = _ordered_players(lobby.id, db)
    provinces = db.query(LobbyMapProvince).filter_by(lobby_map_id=lmap.id).all()
    slugs = {p.problem_title_slug for p in provinces}
    problems = {p.title_slug: p for p in db.query(LeetCodeProblem).filter(LeetCodeProblem.title_slug.in_(slugs)).all()}
    uids = {p.captured_by for p in provinces if p.captured_by}
    users = {u.id: u.leetcode_username for u in db.query(User).filter(User.id.in_(uids)).all()} if uids else {}
    return LobbyMapResponse(
        lobby_id=lobby_id,
        provinces=[_build_province(p, problems, users) for p in provinces],
        score=_score_entries(lobby, provinces, players, problems),
    )


@router.post("/{lobby_id}/map/sync", response_model=LobbyMapSyncResponse)
async def sync_map(lobby_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lobby = db.get(Lobby, lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    lmap = _get_lmap(lobby_id, db)
    if not lmap:
        return LobbyMapSyncResponse(captured_count=0, provinces=[])

    players = _ordered_players(lobby.id, db)

    client = LeetCodeClient()
    language = _lobby_programming_language(lobby)
    for _, u in players:
        try:
            subs = await client.get_recent_accepted_submissions(u.leetcode_username, limit=50)
            record_submissions(u.id, _filter_submissions_by_language(subs, language), db)
        except Exception:
            logger.warning("sync failed for %s", u.leetcode_username)

    provinces = db.query(LobbyMapProvince).filter_by(lobby_map_id=lmap.id).all()
    slugs = {p.problem_title_slug for p in provinces}

    solved_by_user = {
        u.id: get_solved_for_slugs(u.id, slugs, db, language=language)
        for _, u in players
    }
    username_by_id = {u.id: u.leetcode_username for _, u in players}

    team_by_user = _team_by_user(lobby, players)
    control_before = region_control_by_team(provinces, team_by_user)

    changes = apply_capture_pass(
        provinces=provinces,
        solved_by_user=solved_by_user,
        username_by_id=username_by_id,
        since=lobby.started_at or lobby.created_at,
        tiebreak_order=[u.id for _, u in players],
        team_by_user=team_by_user,
    )
    if changes:
        db.commit()

    problems = {p.title_slug: p for p in db.query(LeetCodeProblem).filter(LeetCodeProblem.title_slug.in_(slugs)).all()}

    if changes:
        control_after = region_control_by_team(provinces, team_by_user)
        all_changes = changes + region_control_changes(
            provinces, changes, control_before, control_after,
        )
        record_lobby_events(
            all_changes,
            lobby,
            problems,
            username_by_id,
            {u.id: (lp.faction_id if lobby.faction_mode else None) for lp, u in players},
            db,
        )

    uids = {p.captured_by for p in provinces if p.captured_by}
    users = {u.id: u.leetcode_username for u in db.query(User).filter(User.id.in_(uids)).all()} if uids else {}
    return LobbyMapSyncResponse(
        captured_count=sum(1 for c in changes if c.kind == CAPTURE),
        recaptured_count=sum(1 for c in changes if c.kind == RECAPTURE),
        provinces=[_build_province(p, problems, users) for p in provinces],
        score=_score_entries(lobby, provinces, players, problems),
    )


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

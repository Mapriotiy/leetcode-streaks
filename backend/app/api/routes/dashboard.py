from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.daily_activity import DailyActivity
from app.models.leetcode_problem import LeetCodeProblem
from app.models.lobby import Lobby
from app.models.lobby_player import LobbyPlayer
from app.models.user import User
from app.schemas.dashboard import (
    DashboardFactionResponse,
    DashboardLobbyPlayerResponse,
    DashboardLobbyResponse,
    DashboardResponse,
    TodaySubmissionResponse,
)
from app.services.streaks import (
    calculate_longest_streak,
    calculate_personal_streak,
    get_active_dates,
)
from app.services.activity_sync import (
    get_utc_today,
    submission_to_utc_date,
    sync_user_daily_activity,
)

import logging

logger = logging.getLogger(__name__)

router = APIRouter()

FACTION_COLORS = {1: "#00c2ff", 2: "#ff4d6d", 3: "#ffb020", 4: "#27d980"}
FACTION_NAMES = {1: "Alpha", 2: "Bravo", 3: "Charlie", 4: "Delta"}
ALLOWED_FACTION_COLORS = {
    "#00c2ff", "#ff4d6d", "#ffb020", "#27d980",
    "#9b7cff", "#4f9cff", "#ff7a59", "#a3e635",
}


def build_lobby_factions(lobby: Lobby) -> list[DashboardFactionResponse]:
    if not lobby.faction_mode or lobby.faction_count <= 0:
        return []

    configured = (lobby.win_condition or {}).get("factions")
    configured_by_id = {
        int(faction.get("id")): faction
        for faction in configured or []
        if isinstance(faction, dict) and faction.get("id")
    }

    factions: list[DashboardFactionResponse] = []
    for faction_id in range(1, lobby.faction_count + 1):
        configured_faction = configured_by_id.get(faction_id, {})
        configured_color = str(configured_faction.get("color") or FACTION_COLORS.get(faction_id, "#888888"))
        factions.append(
            DashboardFactionResponse(
                id=faction_id,
                name=str(configured_faction.get("name") or FACTION_NAMES.get(faction_id, f"Faction {faction_id}"))[:32],
                color=configured_color if configured_color in ALLOWED_FACTION_COLORS else FACTION_COLORS.get(faction_id, "#888888"),
            )
        )
    return factions


def build_activity_calendar(
        current_user: User,
        db: Session,
        today: date,
        days: int = 366,
) -> list[dict]:
    start_date = today - timedelta(days=days - 1)

    rows = (
        db.query(DailyActivity.date, DailyActivity.submissions_count)
        .filter(
            DailyActivity.user_id == current_user.id,
            DailyActivity.date >= start_date,
            DailyActivity.date <= today,
        )
        .all()
    )

    counts_by_date = {row.date: row.submissions_count for row in rows}

    return [
        {
            "date": (start_date + timedelta(days=offset)).isoformat(),
            "count": counts_by_date.get(start_date + timedelta(days=offset), 0),
        }
        for offset in range(days)
    ]


def build_user_lobbies(current_user: User, db: Session) -> list[DashboardLobbyResponse]:
    memberships = (
        db.query(LobbyPlayer, Lobby)
        .join(Lobby, LobbyPlayer.lobby_id == Lobby.id)
        .filter(
            LobbyPlayer.user_id == current_user.id,
            Lobby.status != "finished",
        )
        .order_by(Lobby.created_at.desc())
        .all()
    )

    responses: list[DashboardLobbyResponse] = []
    for _, lobby in memberships:
        player_rows = (
            db.query(LobbyPlayer, User)
            .join(User, LobbyPlayer.user_id == User.id)
            .filter(LobbyPlayer.lobby_id == lobby.id)
            .all()
        )
        responses.append(
            DashboardLobbyResponse(
                id=lobby.id,
                name=lobby.name,
                status=lobby.status,
                game_mode=lobby.game_mode,
                map_size=lobby.map_size,
                max_players=lobby.max_players,
                faction_mode=lobby.faction_mode,
                faction_count=lobby.faction_count,
                factions=build_lobby_factions(lobby),
                programming_language=str((lobby.win_condition or {}).get("programming_language") or "python3"),
                creator_id=lobby.creator_id,
                players=[
                    DashboardLobbyPlayerResponse(
                        user_id=user.id,
                        leetcode_username=user.leetcode_username,
                        faction_id=player.faction_id,
                        status=player.status,
                    )
                    for player, user in player_rows
                ],
            )
        )
    return responses


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    avatar_url = None
    recent_submissions = []
    today = get_utc_today()

    try:
        profile, recent_submissions = await sync_user_daily_activity(current_user, db)
        avatar_url = profile.avatar_url
    except Exception:
        logger.exception("sync_user_daily_activity failed for user_id=%s", current_user.id)

    seen_problem_slugs: set[str] = set()
    submissions_map: dict[str, TodaySubmissionResponse] = {}

    for submission in recent_submissions:
        submitted_date = submission_to_utc_date(submission.submitted_at)

        if submitted_date != today:
            continue

        if submission.title_slug in seen_problem_slugs:
            continue

        seen_problem_slugs.add(submission.title_slug)
        submissions_map[submission.title_slug] = TodaySubmissionResponse(
            title=submission.title,
            title_slug=submission.title_slug,
            url=submission.url,
            submitted_at=submission.submitted_at,
            language=submission.language,
        )

    if submissions_map:
        problems = {
            p.title_slug: p
            for p in db.query(LeetCodeProblem).filter(
                LeetCodeProblem.title_slug.in_(list(submissions_map.keys()))
            ).all()
        }
        for slug, resp in submissions_map.items():
            prob = problems.get(slug)
            if prob:
                resp.difficulty = prob.difficulty
                resp.topic_tags = (prob.topic_tags or [])[:2]

    today_submissions = list(submissions_map.values())

    active_dates = get_active_dates(current_user, db)
    personal_streak = calculate_personal_streak(active_dates, today=today)

    return DashboardResponse(
        leetcode_username=current_user.leetcode_username,
        avatar_url=avatar_url,
        current_streak=personal_streak.display_count,
        current_streak_state=personal_streak.state,
        today_active=personal_streak.today_active,
        longest_streak=calculate_longest_streak(active_dates),
        active_days_count=len(active_dates),
        today_submissions=today_submissions,
        activity_calendar=build_activity_calendar(current_user, db, today=today),
        lobbies=build_user_lobbies(current_user, db),
    )

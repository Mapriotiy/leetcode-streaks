from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.daily_activity import DailyActivity
from app.models.leetcode_problem import LeetCodeProblem
from app.models.lobby import Lobby
from app.models.lobby_player import LobbyPlayer
from app.models.user import User
from app.models.user_solved import UserSolved
from app.schemas.dashboard import (
    DashboardSyncResponse,
    DashboardFactionResponse,
    DashboardLobbyPlayerResponse,
    DashboardLobbyResponse,
    DashboardResponse,
    SyncMetaResponse,
    TodaySubmissionResponse,
)
from app.services.streaks import (
    calculate_longest_streak,
    calculate_personal_streak,
    get_active_dates,
)
from app.services.activity_sync import (
    get_utc_today,
)
from app.services.leetcode_sync import maybe_sync_user_profile, maybe_sync_user_recent

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


def build_today_submissions(
        current_user: User,
        db: Session,
        today: date,
) -> list[TodaySubmissionResponse]:
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)

    solved_rows = (
        db.query(UserSolved)
        .filter(
            UserSolved.user_id == current_user.id,
            UserSolved.solved_at >= start,
            UserSolved.solved_at < end,
        )
        .order_by(UserSolved.solved_at.desc())
        .all()
    )

    solved_by_slug: dict[str, UserSolved] = {}
    for solved in solved_rows:
        solved_by_slug.setdefault(solved.title_slug, solved)

    if not solved_by_slug:
        return []

    problems = {
        p.title_slug: p
        for p in db.query(LeetCodeProblem).filter(
            LeetCodeProblem.title_slug.in_(list(solved_by_slug.keys()))
        ).all()
    }

    submissions: list[TodaySubmissionResponse] = []
    for slug, solved in solved_by_slug.items():
        problem = problems.get(slug)
        submissions.append(
            TodaySubmissionResponse(
                title=problem.title if problem else slug.replace("-", " ").title(),
                title_slug=slug,
                url=f"https://leetcode.com/problems/{slug}/",
                submitted_at=solved.solved_at.isoformat(),
                language=solved.language,
                difficulty=problem.difficulty if problem else None,
                topic_tags=(problem.topic_tags or [])[:2] if problem else [],
            )
        )

    return submissions


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    today = get_utc_today()

    recent_sync = await maybe_sync_user_recent(current_user, db, limit=30)
    profile_sync = await maybe_sync_user_profile(current_user, db)
    db.refresh(current_user)

    active_dates = get_active_dates(current_user, db)
    personal_streak = calculate_personal_streak(active_dates, today=today)

    return DashboardResponse(
        leetcode_username=current_user.leetcode_username,
        avatar_url=current_user.leetcode_avatar_url,
        current_streak=personal_streak.display_count,
        current_streak_state=personal_streak.state,
        today_active=personal_streak.today_active,
        longest_streak=calculate_longest_streak(active_dates),
        active_days_count=len(active_dates),
        today_submissions=build_today_submissions(current_user, db, today=today),
        activity_calendar=build_activity_calendar(current_user, db, today=today),
        lobbies=build_user_lobbies(current_user, db),
        sync=DashboardSyncResponse(
            recent=SyncMetaResponse(**recent_sync.meta.as_dict()),
            profile=SyncMetaResponse(**profile_sync.meta.as_dict()),
        ),
    )

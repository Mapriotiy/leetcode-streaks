"""Recording and reading map events (captures, recaptures, defenses)."""

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.friendship import Friendship
from app.models.leetcode_problem import LeetCodeProblem
from app.models.map_event import MapEvent
from app.models.user import User
from app.models.weekly_map import WeeklyMap
from app.services.capture_engine import CaptureChange
from app.services.scoring import flag_points


def record_capture_events(
    changes: list[CaptureChange],
    weekly_map: WeeklyMap,
    problems: dict[str, LeetCodeProblem],
    usernames: dict[int, str],
    db: Session,
) -> list[MapEvent]:
    events: list[MapEvent] = []

    for change in changes:
        slug = change.province.problem_title_slug
        problem = problems.get(slug)
        difficulty = problem.difficulty if problem else None

        event = MapEvent(
            friendship_id=weekly_map.friendship_id,
            weekly_map_id=weekly_map.id,
            province_id=change.province.province_id,
            event_type=change.kind,
            actor_user_id=change.actor_user_id,
            actor_username=usernames.get(change.actor_user_id, "?"),
            previous_owner_user_id=change.previous_owner_user_id,
            previous_owner_username=(
                usernames.get(change.previous_owner_user_id)
                if change.previous_owner_user_id is not None
                else None
            ),
            problem_title_slug=slug,
            problem_title=problem.title if problem else None,
            problem_difficulty=difficulty,
            points=flag_points(difficulty),
            runtime_ms=change.runtime_ms,
            previous_runtime_ms=change.previous_runtime_ms,
        )
        db.add(event)
        events.append(event)

    if events:
        db.commit()

    return events


def get_map_events(
    weekly_map_id: int,
    after_id: int,
    limit: int,
    db: Session,
) -> list[MapEvent]:
    return (
        db.query(MapEvent)
        .filter(
            MapEvent.weekly_map_id == weekly_map_id,
            MapEvent.id > after_id,
        )
        .order_by(MapEvent.id.asc())
        .limit(limit)
        .all()
    )


def get_feed(
    user_id: int,
    limit: int,
    db: Session,
) -> list[tuple[MapEvent, Friendship, str]]:
    """Latest events across all the user's friendships, newest first.

    Returns (event, friendship, friend_username) tuples.
    """
    rows = (
        db.query(MapEvent, Friendship)
        .join(Friendship, MapEvent.friendship_id == Friendship.id)
        .filter(
            or_(
                Friendship.user_a_id == user_id,
                Friendship.user_b_id == user_id,
            )
        )
        .order_by(MapEvent.id.desc())
        .limit(limit)
        .all()
    )

    friend_ids = {
        f.user_b_id if f.user_a_id == user_id else f.user_a_id for _, f in rows
    }
    username_by_id: dict[int, str] = {}
    if friend_ids:
        users = db.query(User).filter(User.id.in_(friend_ids)).all()
        username_by_id = {u.id: u.leetcode_username for u in users}

    result = []
    for event, friendship in rows:
        friend_id = (
            friendship.user_b_id
            if friendship.user_a_id == user_id
            else friendship.user_a_id
        )
        result.append((event, friendship, username_by_id.get(friend_id, "?")))
    return result

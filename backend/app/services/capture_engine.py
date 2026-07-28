"""Capture logic: decides province ownership from both players' solves.

Rules:
- Initial capture: earliest in-week solve wins (timestamp tie goes to user_a,
  matching historical behavior).
- Defense: the owner's best runtime is kept up to date on the province, so a
  faster re-solve raises the bar before any steal check in the same pass.
- Recapture: the challenger steals only with a strictly faster runtime.
  Equal runtimes keep the incumbent. A challenger without runtime data can
  never steal; an incumbent without stored runtime is beatable by any timed
  solve.
- Only solves timestamped inside the map's week count, for both capture and
  recapture.
- first_captured_by is never changed once set: the first-capture bonus is
  permanent.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user_solved import UserSolved
from app.models.weekly_map import WeeklyMap
from app.models.weekly_map_province import WeeklyMapProvince
from app.services.leetcode_client import LeetCodeClient
from app.services.map_config import week_start_datetime
from app.services.user_solved import get_solved_for_slugs, record_submissions

logger = logging.getLogger(__name__)

CAPTURE = "capture"
RECAPTURE = "recapture"
DEFENSE = "defense"


@dataclass
class CaptureChange:
    kind: str  # CAPTURE | RECAPTURE | DEFENSE
    province: WeeklyMapProvince
    actor_user_id: int
    previous_owner_user_id: int | None = None
    runtime_ms: int | None = None
    previous_runtime_ms: int | None = None


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def sync_captures(
    weekly_map: WeeklyMap,
    user_a_id: int,
    user_b_id: int,
    leetcode_username_a: str,
    leetcode_username_b: str,
    db: Session,
) -> list[CaptureChange]:
    """Fetch both players' recent solves and apply a capture pass."""
    client = LeetCodeClient()

    subs_a = await client.get_recent_accepted_submissions(leetcode_username_a, limit=50)
    subs_b = await client.get_recent_accepted_submissions(leetcode_username_b, limit=50)

    record_submissions(user_a_id, subs_a, db)
    record_submissions(user_b_id, subs_b, db)

    provinces = (
        db.query(WeeklyMapProvince)
        .filter(WeeklyMapProvince.weekly_map_id == weekly_map.id)
        .all()
    )

    slugs = {p.problem_title_slug for p in provinces}
    solved_a = get_solved_for_slugs(user_a_id, slugs, db)
    solved_b = get_solved_for_slugs(user_b_id, slugs, db)

    changes = apply_capture_pass(
        weekly_map=weekly_map,
        provinces=provinces,
        solved_a=solved_a,
        solved_b=solved_b,
        user_a_id=user_a_id,
        user_b_id=user_b_id,
        leetcode_username_a=leetcode_username_a,
        leetcode_username_b=leetcode_username_b,
    )

    if changes:
        db.commit()

    return changes


def apply_capture_pass(
    weekly_map: WeeklyMap,
    provinces: list[WeeklyMapProvince],
    solved_a: dict[str, UserSolved],
    solved_b: dict[str, UserSolved],
    user_a_id: int,
    user_b_id: int,
    leetcode_username_a: str,
    leetcode_username_b: str,
) -> list[CaptureChange]:
    """Pure capture/defense/recapture pass over province rows.

    Mutates the given provinces in place and returns the changes; committing
    is the caller's job.
    """
    week_start_dt = week_start_datetime(weekly_map.week_start)
    username_by_id = {user_a_id: leetcode_username_a, user_b_id: leetcode_username_b}
    changes: list[CaptureChange] = []

    for province in provinces:
        slug = province.problem_title_slug
        row_a = _eligible(solved_a.get(slug), week_start_dt)
        row_b = _eligible(solved_b.get(slug), week_start_dt)

        if province.captured_by is None:
            winner = _pick_earliest(row_a, row_b)
            if winner is None:
                continue
            winner_id = user_a_id if winner is row_a else user_b_id
            _set_owner(province, winner_id, winner, username_by_id[winner_id])
            province.captured_at = winner.solved_at
            changes.append(
                CaptureChange(
                    kind=CAPTURE,
                    province=province,
                    actor_user_id=winner_id,
                    runtime_ms=winner.best_runtime_ms,
                )
            )
        else:
            owner_id = province.captured_by
            challenger_id = user_b_id if owner_id == user_a_id else user_a_id
            owner_row = row_a if owner_id == user_a_id else row_b
            challenger_row = row_b if owner_id == user_a_id else row_a

            # Defense first, so a faster re-solve in the same sync raises
            # the bar before the steal check.
            if owner_row is not None and owner_row.best_runtime_ms is not None and (
                province.captured_runtime_ms is None
                or owner_row.best_runtime_ms < province.captured_runtime_ms
            ):
                previous_runtime = province.captured_runtime_ms
                province.captured_runtime_ms = owner_row.best_runtime_ms
                province.captured_submission_url = owner_row.best_submission_url
                changes.append(
                    CaptureChange(
                        kind=DEFENSE,
                        province=province,
                        actor_user_id=owner_id,
                        runtime_ms=owner_row.best_runtime_ms,
                        previous_runtime_ms=previous_runtime,
                    )
                )

            if challenger_row is not None and challenger_row.best_runtime_ms is not None:
                incumbent_runtime = province.captured_runtime_ms
                if (
                    incumbent_runtime is None
                    or challenger_row.best_runtime_ms < incumbent_runtime
                ):
                    changes.append(
                        CaptureChange(
                            kind=RECAPTURE,
                            province=province,
                            actor_user_id=challenger_id,
                            previous_owner_user_id=owner_id,
                            runtime_ms=challenger_row.best_runtime_ms,
                            previous_runtime_ms=incumbent_runtime,
                        )
                    )
                    _set_owner(
                        province,
                        challenger_id,
                        challenger_row,
                        username_by_id[challenger_id],
                    )
                    province.captured_at = (
                        challenger_row.best_runtime_at or _utcnow_naive()
                    )

        if province.captured_by is not None and province.first_captured_by is None:
            province.first_captured_by = province.captured_by
            province.first_captured_at = province.captured_at

    return changes


def _eligible(row: UserSolved | None, week_start_dt: datetime) -> UserSolved | None:
    """Only solves inside the map's week count for capture or recapture."""
    if row is None or row.solved_at < week_start_dt:
        return None
    return row


def _pick_earliest(
    row_a: UserSolved | None, row_b: UserSolved | None,
) -> UserSolved | None:
    if row_a is not None and row_b is not None:
        return row_a if row_a.solved_at <= row_b.solved_at else row_b
    return row_a if row_a is not None else row_b


def _set_owner(
    province: WeeklyMapProvince,
    user_id: int,
    row: UserSolved,
    username: str,
) -> None:
    province.captured_by = user_id
    province.captured_runtime_ms = row.best_runtime_ms
    province.captured_submission_url = row.best_submission_url
    province.capturer_leetcode_username = username

import asyncio
import logging
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.friendship import Friendship
from app.models.leetcode_problem import LeetCodeProblem
from app.models.weekly_map import WeeklyMap
from app.models.weekly_map_province import WeeklyMapProvince
from app.services.leetcode_client import LeetCodeClient
from app.services.problem_catalog import (
    ensure_catalog,
    get_any_unsolved,
    get_problems_by_tags,
)
from app.services.user_solved import (
    get_solved_slugs_with_timestamps,
    update_solved,
)

logger = logging.getLogger(__name__)

REGION_TOPICS: dict[str, dict] = {
    "isle1": {"tags": ["tree", "graph"], "difficulty": None},
    "isle2": {"tags": ["binary-search"], "difficulty": None},
    "isle3": {"tags": [], "difficulty": "Hard"},
    "region1": {"tags": ["linked-list"], "difficulty": None},
    "region2": {"tags": ["two-pointers", "sliding-window"], "difficulty": None},
    "region3": {"tags": ["array", "hash-table"], "difficulty": None},
    "region4": {"tags": ["stack"], "difficulty": None},
}

PROVINCE_REGION: dict[str, str] = {
    "path34": "isle1", "path36": "isle1",
    "path44": "isle2", "path48": "isle2", "path49": "isle2",
    "path53": "isle3",
    "path56": "region1", "path57": "region1", "path58": "region1", "path60": "region1",
    "path63": "region2", "path64": "region2", "path65": "region2", "path66": "region2",
    "path68": "region2", "path69": "region2",
    "path72": "region3", "path73": "region3", "path74": "region3", "path75": "region3",
    "path76": "region3", "path79": "region3", "path80": "region3",
    "path83": "region4", "path86": "region4", "path87": "region4",
    "path89": "region4", "path91": "region4",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_utc_today() -> date:
    return _utcnow().date()


def get_week_start(today: date | None = None) -> date:
    if today is None:
        today = get_utc_today()
    monday = today - timedelta(days=today.weekday())
    return monday


async def get_or_create_weekly_map(
    friendship_id: int,
    user_a_id: int,
    user_b_id: int,
    db: Session,
    leetcode_username_a: str | None = None,
    leetcode_username_b: str | None = None,
    reset: bool = False,
) -> WeeklyMap:
    week_start = get_week_start()

    if reset:
        existing_map = (
            db.query(WeeklyMap)
            .filter(
                WeeklyMap.friendship_id == friendship_id,
                WeeklyMap.week_start == week_start,
            )
            .first()
        )
        if existing_map:
            db.query(WeeklyMapProvince).filter(
                WeeklyMapProvince.weekly_map_id == existing_map.id
            ).delete()
            db.delete(existing_map)
            db.flush()

    existing = (
        db.query(WeeklyMap)
        .filter(
            WeeklyMap.friendship_id == friendship_id,
            WeeklyMap.week_start == week_start,
        )
        .first()
    )
    if existing:
        return existing

    await ensure_catalog(db)

    if leetcode_username_a and leetcode_username_b:
        client = LeetCodeClient()
        try:
            subs_a, subs_b = await asyncio.gather(
                client.get_recent_accepted_submissions(leetcode_username_a, limit=100),
                client.get_recent_accepted_submissions(leetcode_username_b, limit=100),
            )
            if subs_a:
                update_solved(user_a_id, [(s.title_slug, s.submitted_at) for s in subs_a], db)
            if subs_b:
                update_solved(user_b_id, [(s.title_slug, s.submitted_at) for s in subs_b], db)
        except Exception:
            logger.warning("Failed to fetch recent submissions for map exclusion", exc_info=True)

    solved_a = get_solved_slugs_with_timestamps(user_a_id, db)
    solved_b = get_solved_slugs_with_timestamps(user_b_id, db)
    exclude = set(solved_a.keys()) | set(solved_b.keys())

    weekly_map = WeeklyMap(
        friendship_id=friendship_id,
        week_start=week_start,
    )
    db.add(weekly_map)
    db.flush()

    used_slugs: set[str] = set()

    for province_id, region_id in PROVINCE_REGION.items():
        config = REGION_TOPICS.get(region_id, {"tags": [], "difficulty": None})
        problem = _pick_problem(
            tags=config["tags"],
            difficulty=config["difficulty"],
            exclude=exclude | used_slugs,
            db=db,
        )

        if problem is None:
            problem = _pick_problem(
                tags=[],
                difficulty=None,
                exclude=exclude | used_slugs,
                db=db,
            )

        if problem is None:
            logger.warning(
                "No problem found for province %s (region %s)",
                province_id, region_id,
            )
            continue

        used_slugs.add(problem.title_slug)

        province = WeeklyMapProvince(
            weekly_map_id=weekly_map.id,
            province_id=province_id,
            region_id=region_id,
            problem_title_slug=problem.title_slug,
        )
        db.add(province)

    db.commit()
    db.refresh(weekly_map)
    return weekly_map


def _pick_problem(
    tags: list[str],
    difficulty: str | None,
    exclude: set[str],
    db: Session,
) -> LeetCodeProblem | None:
    candidates = get_problems_by_tags(tags, difficulty, exclude, db)
    if not candidates:
        candidates = get_any_unsolved(exclude, db)
    if not candidates:
        return None
    return random.choice(candidates)


async def check_captures(
    weekly_map: WeeklyMap,
    user_a_id: int,
    user_b_id: int,
    leetcode_username_a: str,
    leetcode_username_b: str,
    db: Session,
) -> int:
    client = LeetCodeClient()

    subs_a = await client.get_recent_accepted_submissions(leetcode_username_a, limit=50)
    subs_b = await client.get_recent_accepted_submissions(leetcode_username_b, limit=50)

    update_solved(
        user_a_id,
        [(s.title_slug, s.submitted_at) for s in subs_a],
        db,
    )
    update_solved(
        user_b_id,
        [(s.title_slug, s.submitted_at) for s in subs_b],
        db,
    )

    solved_a = get_solved_slugs_with_timestamps(user_a_id, db)
    solved_b = get_solved_slugs_with_timestamps(user_b_id, db)

    provinces = (
        db.query(WeeklyMapProvince)
        .filter(
            WeeklyMapProvince.weekly_map_id == weekly_map.id,
            WeeklyMapProvince.captured_by.is_(None),
        )
        .all()
    )

    captured_count = 0
    for province in provinces:
        ts_a = solved_a.get(province.problem_title_slug)
        ts_b = solved_b.get(province.problem_title_slug)

        if ts_a is not None and ts_b is not None:
            if ts_a <= ts_b:
                province.captured_by = user_a_id
                province.captured_at = ts_a
            else:
                province.captured_by = user_b_id
                province.captured_at = ts_b
            captured_count += 1
        elif ts_a is not None:
            province.captured_by = user_a_id
            province.captured_at = ts_a
            captured_count += 1
        elif ts_b is not None:
            province.captured_by = user_b_id
            province.captured_at = ts_b
            captured_count += 1

    if captured_count > 0:
        db.commit()

    return captured_count
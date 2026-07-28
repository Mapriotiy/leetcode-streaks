"""Capture logic: decides province ownership from both players' solves."""

import logging

from sqlalchemy.orm import Session

from app.models.weekly_map import WeeklyMap
from app.models.weekly_map_province import WeeklyMapProvince
from app.services.leetcode_client import LeetCodeClient
from app.services.user_solved import (
    get_solved_slugs_with_timestamps,
    update_solved,
)

logger = logging.getLogger(__name__)


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

    url_by_slug_a: dict[str, str | None] = {s.title_slug: s.submission_url for s in subs_a}
    url_by_slug_b: dict[str, str | None] = {s.title_slug: s.submission_url for s in subs_b}

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
                province.captured_submission_url = url_by_slug_a.get(province.problem_title_slug)
                province.capturer_leetcode_username = leetcode_username_a
            else:
                province.captured_by = user_b_id
                province.captured_at = ts_b
                province.captured_submission_url = url_by_slug_b.get(province.problem_title_slug)
                province.capturer_leetcode_username = leetcode_username_b
            captured_count += 1
        elif ts_a is not None:
            province.captured_by = user_a_id
            province.captured_at = ts_a
            province.captured_submission_url = url_by_slug_a.get(province.problem_title_slug)
            province.capturer_leetcode_username = leetcode_username_a
            captured_count += 1
        elif ts_b is not None:
            province.captured_by = user_b_id
            province.captured_at = ts_b
            province.captured_submission_url = url_by_slug_b.get(province.problem_title_slug)
            province.capturer_leetcode_username = leetcode_username_b
            captured_count += 1

    if captured_count > 0:
        db.commit()

    return captured_count

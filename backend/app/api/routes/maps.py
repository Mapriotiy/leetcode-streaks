import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.friendship import Friendship
from app.models.user import User
from app.models.weekly_map import WeeklyMap
from app.models.weekly_map_province import WeeklyMapProvince
from app.models.leetcode_problem import LeetCodeProblem
from app.schemas.maps import (
    ProblemResponse,
    ProvinceResponse,
    ScoreResponse,
    SyncResponse,
    WeeklyMapResponse,
)
from app.services.map_generator import PROVINCE_REGION, check_captures, get_or_create_weekly_map
from app.services.leetcode_client import LeetCodeClient

logger = logging.getLogger(__name__)

router = APIRouter()

REGION_NAMES: dict[str, str] = {
    "isle1": "Trees and Graphs",
    "isle2": "Binary Search",
    "isle3": "Hard Problem Land",
    "region1": "Linked Lists",
    "region2": "Two Pointers / Sliding Window",
    "region3": "Arrays and Hashing",
    "region4": "Stacks",
}


def _get_owned_friendship(
    friendship_id: int,
    current_user: User,
    db: Session,
) -> Friendship:
    friendship = db.get(Friendship, friendship_id)
    if friendship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found",
        )
    if current_user.id not in (friendship.user_a_id, friendship.user_b_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your friendship",
        )
    return friendship


def _build_province_response(
    province: WeeklyMapProvince,
    problem: LeetCodeProblem | None,
    capture_username_by_id: dict[int, str] | None = None,
) -> ProvinceResponse:
    problem_resp = None
    if problem:
        problem_resp = ProblemResponse(
            title=problem.title,
            title_slug=problem.title_slug,
            difficulty=problem.difficulty,
            url=f"https://leetcode.com/problems/{problem.title_slug}/",
        )

    captured_by_username = None
    if province.captured_by and capture_username_by_id:
        captured_by_username = capture_username_by_id.get(province.captured_by)

    return ProvinceResponse(
        province_id=province.province_id,
        region_id=province.region_id,
        region_name=REGION_NAMES.get(province.region_id, province.region_id),
        problem=problem_resp,
        captured_by=province.captured_by,
        captured_by_username=captured_by_username,
        captured_at=province.captured_at,
    )


def _compute_score(
    provinces: list[WeeklyMapProvince],
    current_user_id: int,
    friend_id: int,
) -> ScoreResponse:
    total = len(provinces)
    player_provinces = 0
    friend_provinces = 0

    for p in provinces:
        if p.captured_by == current_user_id:
            player_provinces += 1
        elif p.captured_by == friend_id:
            friend_provinces += 1

    total_regions = len(set(p.region_id for p in provinces))

    region_counts: dict[str, dict[str, int]] = {}
    for p in provinces:
        r = region_counts.setdefault(p.region_id, {"player": 0, "friend": 0})
        if p.captured_by == current_user_id:
            r["player"] += 1
        elif p.captured_by == friend_id:
            r["friend"] += 1

    player_regions = 0
    friend_regions = 0
    for r, counts in region_counts.items():
        if counts["player"] > counts["friend"]:
            player_regions += 1
        elif counts["friend"] > counts["player"]:
            friend_regions += 1

    return ScoreResponse(
        player_provinces=player_provinces,
        friend_provinces=friend_provinces,
        neutral_provinces=total - player_provinces - friend_provinces,
        total_provinces=total,
        player_regions=player_regions,
        friend_regions=friend_regions,
        total_regions=total_regions,
    )


async def _fetch_avatars(user_a: User, user_b: User) -> tuple[str | None, str | None]:
    try:
        client = LeetCodeClient()
        results = await asyncio.gather(
            client.get_user_profile(user_a.leetcode_username),
            client.get_user_profile(user_b.leetcode_username),
            return_exceptions=True,
        )
        avatar_a = results[0].avatar_url if not isinstance(results[0], Exception) else None
        avatar_b = results[1].avatar_url if not isinstance(results[1], Exception) else None
        return avatar_a, avatar_b
    except Exception:
        return None, None


def _build_map_response(
    weekly_map: WeeklyMap,
    db: Session,
    current_user_id: int,
    friend_id: int,
    player_avatar_url: str | None = None,
    friend_avatar_url: str | None = None,
) -> WeeklyMapResponse:
    provinces = (
        db.query(WeeklyMapProvince)
        .filter(WeeklyMapProvince.weekly_map_id == weekly_map.id)
        .all()
    )
    if not provinces:
        return WeeklyMapResponse(
            week_start=weekly_map.week_start,
            friendship_id=weekly_map.friendship_id,
            provinces=[],
            score=_compute_score([], current_user_id, friend_id),
        )

    slugs = {p.problem_title_slug for p in provinces}
    problems = {
        p.title_slug: p
        for p in db.query(LeetCodeProblem).filter(
            LeetCodeProblem.title_slug.in_(slugs)
        ).all()
    }

    capture_user_ids = {p.captured_by for p in provinces if p.captured_by is not None}
    capture_username_by_id: dict[int, str] = {}
    if capture_user_ids:
        users = db.query(User).filter(User.id.in_(capture_user_ids)).all()
        capture_username_by_id = {u.id: u.leetcode_username for u in users}

    score = _compute_score(provinces, current_user_id, friend_id)

    return WeeklyMapResponse(
        week_start=weekly_map.week_start,
        friendship_id=weekly_map.friendship_id,
        provinces=[
            _build_province_response(
                p,
                problems.get(p.problem_title_slug),
                capture_username_by_id,
            )
            for p in provinces
        ],
        score=score,
        player_avatar_url=player_avatar_url,
        friend_avatar_url=friend_avatar_url,
    )


@router.get("/{friendship_id}", response_model=WeeklyMapResponse)
async def get_map(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    reset: bool = False,
):
    friendship = _get_owned_friendship(friendship_id, current_user, db)

    friend = db.get(User, friendship.user_b_id) \
        if friendship.user_a_id == current_user.id \
        else db.get(User, friendship.user_a_id)
    if friend is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend user not found")

    weekly_map = await get_or_create_weekly_map(
        friendship_id=friendship.id,
        user_a_id=current_user.id,
        user_b_id=friend.id,
        leetcode_username_a=current_user.leetcode_username,
        leetcode_username_b=friend.leetcode_username,
        db=db,
        reset=reset,
    )

    avatar_a, avatar_b = await _fetch_avatars(current_user, friend)

    return _build_map_response(weekly_map, db, current_user.id, friend.id, avatar_a, avatar_b)


@router.post("/{friendship_id}/sync", response_model=SyncResponse)
async def sync_map(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    friendship = _get_owned_friendship(friendship_id, current_user, db)

    user_a = db.get(User, friendship.user_a_id)
    user_b = db.get(User, friendship.user_b_id)

    if user_a is None or user_b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    from app.services.map_generator import get_week_start
    week_start = get_week_start()

    weekly_map = (
        db.query(WeeklyMap)
        .filter(
            WeeklyMap.friendship_id == friendship.id,
            WeeklyMap.week_start == week_start,
        )
        .first()
    )
    if weekly_map is None:
        weekly_map = await get_or_create_weekly_map(
            friendship_id=friendship.id,
            user_a_id=user_a.id,
            user_b_id=user_b.id,
            leetcode_username_a=user_a.leetcode_username,
            leetcode_username_b=user_b.leetcode_username,
            db=db,
        )

    captured_count = await check_captures(
        weekly_map=weekly_map,
        user_a_id=user_a.id,
        user_b_id=user_b.id,
        leetcode_username_a=user_a.leetcode_username,
        leetcode_username_b=user_b.leetcode_username,
        db=db,
    )

    provinces = (
        db.query(WeeklyMapProvince)
        .filter(WeeklyMapProvince.weekly_map_id == weekly_map.id)
        .all()
    )
    slugs = {p.problem_title_slug for p in provinces}
    problems = {
        p.title_slug: p
        for p in db.query(LeetCodeProblem).filter(
            LeetCodeProblem.title_slug.in_(slugs)
        ).all()
    }
    capture_user_ids = {p.captured_by for p in provinces if p.captured_by is not None}
    capture_username_by_id: dict[int, str] = {}
    if capture_user_ids:
        users = db.query(User).filter(User.id.in_(capture_user_ids)).all()
        capture_username_by_id = {u.id: u.leetcode_username for u in users}

    province_responses = [
        _build_province_response(
            p,
            problems.get(p.problem_title_slug),
            capture_username_by_id,
        )
        for p in provinces
    ]

    score = _compute_score(provinces, current_user.id, friendship.user_a_id if friendship.user_b_id == current_user.id else friendship.user_b_id)

    friend_id = friendship.user_b_id if friendship.user_a_id == current_user.id else friendship.user_a_id
    friend = db.get(User, friend_id)

    avatar_player_raw, avatar_friend_raw = await _fetch_avatars(current_user, friend)

    return SyncResponse(
        captured_count=captured_count,
        provinces=province_responses,
        score=score,
        player_avatar_url=avatar_player_raw,
        friend_avatar_url=avatar_friend_raw,
    )
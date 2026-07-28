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
    SyncResponse,
    WeeklyMapResponse,
)
from app.services.map_generator import check_captures, get_or_create_weekly_map

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


def _build_map_response(
    weekly_map: WeeklyMap,
    db: Session,
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

    from app.services.map_generator import get_week_start
    week_start = get_week_start()

    if reset:
        existing_map = (
            db.query(WeeklyMap)
            .filter(
                WeeklyMap.friendship_id == friendship.id,
                WeeklyMap.week_start == week_start,
            )
            .first()
        )
        if existing_map:
            db.query(WeeklyMapProvince).filter(
                WeeklyMapProvince.weekly_map_id == existing_map.id
            ).delete()
            db.delete(existing_map)
            db.commit()

    weekly_map = await get_or_create_weekly_map(
        friendship_id=friendship.id,
        user_a_id=current_user.id,
        user_b_id=friend.id,
        db=db,
    )
    return _build_map_response(weekly_map, db)


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

    return SyncResponse(
        captured_count=captured_count,
        provinces=province_responses,
    )
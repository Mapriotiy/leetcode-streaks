import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.weekly_map import WeeklyMap
from app.schemas.maps import SyncResponse, WeeklyMapResponse
from app.services.capture_engine import CAPTURE, RECAPTURE, sync_captures
from app.services.events import record_capture_events
from app.services.map_config import get_week_start
from app.services.map_generator import get_or_create_weekly_map
from app.services.map_view import (
    build_map_response,
    build_province_response,
    fetch_avatars,
    get_friend,
    get_last_week_result,
    get_owned_friendship,
    load_map_context,
)
from app.services.scoring import compute_score

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{friendship_id}", response_model=WeeklyMapResponse)
async def get_map(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    reset: bool = False,
):
    friendship = get_owned_friendship(friendship_id, current_user, db)
    friend = get_friend(friendship, current_user.id, db)

    weekly_map = await get_or_create_weekly_map(
        friendship_id=friendship.id,
        user_a_id=current_user.id,
        user_b_id=friend.id,
        leetcode_username_a=current_user.leetcode_username,
        leetcode_username_b=friend.leetcode_username,
        db=db,
        reset=reset,
    )

    avatar_a, avatar_b = await fetch_avatars(current_user, friend)

    last_week_result = get_last_week_result(
        friendship.id, weekly_map.week_start,
        current_user.id, friend.id, db,
    )

    return build_map_response(
        weekly_map, db, current_user.id, friend.id,
        avatar_a, avatar_b, last_week_result,
    )


@router.post("/{friendship_id}/sync", response_model=SyncResponse)
async def sync_map(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    friendship = get_owned_friendship(friendship_id, current_user, db)

    user_a = db.get(User, friendship.user_a_id)
    user_b = db.get(User, friendship.user_b_id)

    if user_a is None or user_b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

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

    changes = await sync_captures(
        weekly_map=weekly_map,
        user_a_id=user_a.id,
        user_b_id=user_b.id,
        leetcode_username_a=user_a.leetcode_username,
        leetcode_username_b=user_b.leetcode_username,
        db=db,
    )
    captured_count = sum(1 for c in changes if c.kind == CAPTURE)
    recaptured_count = sum(1 for c in changes if c.kind == RECAPTURE)

    provinces, problems, capture_username_by_id = load_map_context(weekly_map, db)

    record_capture_events(
        changes=changes,
        weekly_map=weekly_map,
        problems=problems,
        usernames={
            user_a.id: user_a.leetcode_username,
            user_b.id: user_b.leetcode_username,
        },
        db=db,
    )

    province_responses = [
        build_province_response(
            p,
            problems.get(p.problem_title_slug),
            capture_username_by_id,
        )
        for p in provinces
    ]

    friend = user_b if friendship.user_a_id == current_user.id else user_a
    score = compute_score(
        provinces,
        current_user.id,
        friend.id,
        {slug: p.difficulty for slug, p in problems.items()},
    )

    avatar_player_raw, avatar_friend_raw = await fetch_avatars(current_user, friend)

    return SyncResponse(
        captured_count=captured_count,
        recaptured_count=recaptured_count,
        provinces=province_responses,
        score=score,
        player_avatar_url=avatar_player_raw,
        friend_avatar_url=avatar_friend_raw,
    )

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.weekly_map import WeeklyMap
from app.schemas.events import FeedItemResponse, MapEventResponse
from app.services.events import get_feed, get_map_events
from app.services.map_config import get_week_start
from app.services.map_view import get_owned_friendship

router = APIRouter()


@router.get("/feed", response_model=list[FeedItemResponse])
async def feed(
    limit: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = get_feed(current_user.id, limit, db)
    return [
        FeedItemResponse(
            **MapEventResponse.model_validate(event).model_dump(),
            friend_id=(
                friendship.user_b_id
                if friendship.user_a_id == current_user.id
                else friendship.user_a_id
            ),
            friend_username=friend_username,
        )
        for event, friendship, friend_username in items
    ]


@router.get("/map/{friendship_id}", response_model=list[MapEventResponse])
async def map_events(
    friendship_id: int,
    after_id: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    friendship = get_owned_friendship(friendship_id, current_user, db)

    weekly_map = (
        db.query(WeeklyMap)
        .filter(
            WeeklyMap.friendship_id == friendship.id,
            WeeklyMap.week_start == get_week_start(),
        )
        .first()
    )
    if weekly_map is None:
        return []

    return get_map_events(weekly_map.id, after_id, limit, db)

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services.streaks import (
    calculate_longest_streak,
    calculate_personal_streak,
    get_active_dates,
)
from app.services.activity_sync import sync_user_daily_activity

router = APIRouter()


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    avatar_url = None

    try:
        profile = await sync_user_daily_activity(current_user, db)
        avatar_url = profile.avatar_url
    except HTTPException:
        pass

    active_dates = get_active_dates(current_user, db)
    today = date.today()
    personal_streak = calculate_personal_streak(active_dates, today=today)

    return DashboardResponse(
        leetcode_username=current_user.leetcode_username,
        avatar_url=avatar_url,
        current_streak=personal_streak.display_count,
        current_streak_state=personal_streak.state,
        today_active=personal_streak.today_active,
        longest_streak=calculate_longest_streak(active_dates),
        active_days_count=len(active_dates),
    )

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services.streaks import (
    calculate_current_streak,
    calculate_longest_streak,
    get_active_dates,
)
from app.services.activity_sync import sync_user_daily_activity

router = APIRouter()


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    try:
        await sync_user_daily_activity(current_user, db)
    except HTTPException:
        pass

    active_dates = get_active_dates(current_user, db)

    return DashboardResponse(
        leetcode_username=current_user.leetcode_username,
        current_streak=calculate_current_streak(active_dates, today=date.today()),
        longest_streak=calculate_longest_streak(active_dates),
        active_days_count=len(active_dates),
    )

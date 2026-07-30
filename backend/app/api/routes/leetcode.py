from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.leetcode import LeetCodeProfileResponse
from app.services.leetcode_client import LeetCodeClient
from app.services.leetcode_sync import maybe_sync_user_daily_activity

router = APIRouter()


@router.get("/profile/{username}", response_model=LeetCodeProfileResponse)
async def get_leetcode_profile(username: str):
    client = LeetCodeClient()
    return await client.get_user_profile(username)


@router.post("/sync/me")
async def sync_my_leetcode_activity(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    profile, _, sync_meta = await maybe_sync_user_daily_activity(current_user, db)

    return {
        "status": sync_meta["status"],
        "synced_days": len(profile.submission_calendar) if profile else 0,
        "next_sync_after": sync_meta["next_sync_after"],
    }

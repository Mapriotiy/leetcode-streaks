from fastapi import Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.activity_sync import sync_user_daily_activity

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
    synced_count = await sync_user_daily_activity(current_user, db)

    return {
        "synced_days": synced_count,
    }
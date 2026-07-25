from datetime import date

from sqlalchemy.orm import Session

from app.models.daily_activity import DailyActivity
from app.models.user import User
from app.schemas.leetcode import LeetCodeProfileResponse
from app.services.leetcode_client import LeetCodeClient


async def sync_user_daily_activity(user: User, db: Session) -> LeetCodeProfileResponse:
    client = LeetCodeClient()
    profile = await client.get_user_profile(user.leetcode_username)

    for date_string, submissions_count in profile.submission_calendar.items():
        activity_date = date.fromisoformat(date_string)

        existing_activity = (
            db.query(DailyActivity)
            .filter(
                DailyActivity.user_id == user.id,
                DailyActivity.date == activity_date,
                )
            .first()
        )

        if existing_activity:
            existing_activity.submissions_count = submissions_count
        else:
            db.add(
                DailyActivity(
                    user_id=user.id,
                    date=activity_date,
                    submissions_count=submissions_count,
                )
            )

    db.commit()
    return profile

from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.daily_activity import DailyActivity
from app.models.user import User
from app.schemas.leetcode import LeetCodeProfileResponse, RecentAcceptedSubmission
from app.services.leetcode_client import LeetCodeClient


def _dialect_insert(db: Session):
    dialect_name = db.bind.dialect.name
    if dialect_name == "postgresql":
        return pg_insert
    return sqlite_insert


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


async def sync_user_daily_activity(
    user: User, db: Session,
) -> tuple[LeetCodeProfileResponse, list[RecentAcceptedSubmission]]:
    client = LeetCodeClient()
    profile, recent_submissions = await client.fetch_profile_and_submissions(
        user.leetcode_username,
        limit=30,
    )

    counts_by_date: dict[date, int] = {}

    for date_string, submissions_count in profile.submission_calendar.items():
        activity_date = date.fromisoformat(date_string)
        counts_by_date[activity_date] = submissions_count

    if counts_by_date:
        rows = [
            {
                "user_id": user.id,
                "date": activity_date,
                "submissions_count": submissions_count,
            }
            for activity_date, submissions_count in counts_by_date.items()
        ]

        existing = DailyActivity.__table__.c.submissions_count
        insert_fn = _dialect_insert(db)
        excluded = insert_fn(DailyActivity).excluded.submissions_count

        stmt = (
            insert_fn(DailyActivity)
            .values(rows)
            .on_conflict_do_update(
                index_elements=["user_id", "date"],
                set_={
                    "submissions_count": func.greatest(existing, excluded),
                },
            )
        )
        db.execute(stmt)
        db.commit()

    return profile, recent_submissions


def get_utc_today() -> date:
    return _utc_today()


def submission_to_utc_date(submitted_at: str) -> date:
    parsed = datetime.fromisoformat(submitted_at)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).date()
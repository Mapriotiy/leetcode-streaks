from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.daily_activity import DailyActivity
from app.models.user import User


def get_active_dates(user: User, db: Session) -> set[date]:
    rows = (
        db.query(DailyActivity.date)
        .filter(
            DailyActivity.user_id == user.id,
            DailyActivity.submissions_count > 0,
            )
        .all()
    )

    return {row.date for row in rows}


def calculate_current_streak(active_dates: set[date], today: date | None = None) -> int:
    if today is None:
        today = date.today()

    current_date = today
    streak = 0

    while current_date in active_dates:
        streak += 1
        current_date -= timedelta(days=1)

    return streak


def calculate_longest_streak(active_dates: set[date]) -> int:
    if not active_dates:
        return 0

    longest = 0
    current = 0
    previous_date: date | None = None

    for active_date in sorted(active_dates):
        if previous_date is None or active_date == previous_date + timedelta(days=1):
            current += 1
        else:
            current = 1

        longest = max(longest, current)
        previous_date = active_date

    return longest
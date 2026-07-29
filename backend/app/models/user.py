from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    leetcode_username: Mapped[str] = mapped_column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    leetcode_recent_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    leetcode_recent_sync_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    leetcode_recent_sync_error: Mapped[str | None] = mapped_column(String, nullable=True)
    leetcode_profile_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    leetcode_profile_sync_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    leetcode_profile_sync_error: Mapped[str | None] = mapped_column(String, nullable=True)
    leetcode_avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    leetcode_ranking: Mapped[int | None] = mapped_column(Integer, nullable=True)

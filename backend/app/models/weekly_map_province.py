from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WeeklyMapProvince(Base):
    __tablename__ = "weekly_map_provinces"

    __table_args__ = (
        UniqueConstraint("weekly_map_id", "province_id", name="uq_weekly_map_province"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    weekly_map_id: Mapped[int] = mapped_column(
        ForeignKey("weekly_maps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    province_id: Mapped[str] = mapped_column(String, nullable=False)
    region_id: Mapped[str] = mapped_column(String, nullable=False)
    problem_title_slug: Mapped[str] = mapped_column(String, nullable=False)
    captured_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    captured_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
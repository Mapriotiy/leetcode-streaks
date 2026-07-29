from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON
from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Lobby(Base):
    __tablename__ = "lobbies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="waiting")
    game_mode: Mapped[str] = mapped_column(String, nullable=False, default="free_for_all")
    map_size: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    max_players: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    faction_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    faction_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    win_condition: Mapped[dict] = mapped_column(JSON, nullable=False, default={
        "type": "territory_control",
        "threshold": 0.5,
        "duration_hours": 0,
    })
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    winner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
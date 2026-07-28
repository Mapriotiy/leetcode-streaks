from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.user_solved import UserSolved


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def update_solved(
    user_id: int,
    recent_submission_slugs: list[tuple[str, str]],
    db: Session,
) -> None:
    """Upsert solved problems from recent submissions.

    Args:
        user_id: The user's ID.
        recent_submission_slugs: List of (title_slug, submitted_at_iso).
    """
    if not recent_submission_slugs:
        return

    seen: dict[str, datetime] = {}
    for title_slug, submitted_at_str in recent_submission_slugs:
        parsed = datetime.fromisoformat(submitted_at_str)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)

        if title_slug not in seen or parsed < seen[title_slug]:
            seen[title_slug] = parsed

    rows = [
        {
            "user_id": user_id,
            "title_slug": title_slug,
            "solved_at": solved_at,
        }
        for title_slug, solved_at in seen.items()
    ]

    dialect_name = db.bind.dialect.name
    insert_fn = pg_insert if dialect_name == "postgresql" else sqlite_insert

    excluded = insert_fn(UserSolved).excluded

    stmt = (
        insert_fn(UserSolved)
        .values(rows)
        .on_conflict_do_update(
            index_elements=["user_id", "title_slug"],
            set_={
                "solved_at": excluded.solved_at,
            },
        )
    )
    db.execute(stmt)
    db.commit()


def get_solved_slugs(user_id: int, db: Session) -> set[str]:
    rows = (
        db.query(UserSolved.title_slug)
        .filter(UserSolved.user_id == user_id)
        .all()
    )
    return {row[0] for row in rows}


def get_solved_slugs_with_timestamps(
    user_id: int, db: Session,
) -> dict[str, datetime]:
    rows = (
        db.query(UserSolved.title_slug, UserSolved.solved_at)
        .filter(UserSolved.user_id == user_id)
        .all()
    )
    return {row[0]: row[1] for row in rows}
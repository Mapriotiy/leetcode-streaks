from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user_solved import UserSolved
from app.schemas.leetcode import RecentAcceptedSubmission


def _parse_submitted_at(submitted_at_iso: str) -> datetime:
    """Parse an ISO timestamp to naive UTC, matching how the DB stores datetimes."""
    parsed = datetime.fromisoformat(submitted_at_iso)
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


@dataclass
class _BatchEntry:
    solved_at: datetime
    best_runtime_ms: int | None = None
    best_submission_url: str | None = None
    best_runtime_at: datetime | None = None


def _fold_batch(submissions: list[RecentAcceptedSubmission]) -> dict[str, _BatchEntry]:
    """Reduce a submission batch to earliest solve and fastest runtime per slug."""
    batch: dict[str, _BatchEntry] = {}

    for sub in submissions:
        solved_at = _parse_submitted_at(sub.submitted_at)
        entry = batch.get(sub.title_slug)

        if entry is None:
            entry = _BatchEntry(solved_at=solved_at)
            batch[sub.title_slug] = entry
        elif solved_at < entry.solved_at:
            entry.solved_at = solved_at

        if sub.runtime_ms is not None and (
            entry.best_runtime_ms is None or sub.runtime_ms < entry.best_runtime_ms
        ):
            entry.best_runtime_ms = sub.runtime_ms
            entry.best_submission_url = sub.submission_url
            entry.best_runtime_at = solved_at

    return batch


def _apply_batch(user_id: int, batch: dict[str, _BatchEntry], db: Session) -> None:
    existing_rows = {
        row.title_slug: row
        for row in db.query(UserSolved)
        .filter(
            UserSolved.user_id == user_id,
            UserSolved.title_slug.in_(batch.keys()),
        )
        .all()
    }

    for slug, entry in batch.items():
        row = existing_rows.get(slug)

        if row is None:
            db.add(
                UserSolved(
                    user_id=user_id,
                    title_slug=slug,
                    solved_at=entry.solved_at,
                    best_runtime_ms=entry.best_runtime_ms,
                    best_submission_url=entry.best_submission_url,
                    best_runtime_at=entry.best_runtime_at,
                )
            )
            continue

        # A re-solve must never move the first-solve timestamp forward.
        if entry.solved_at < row.solved_at:
            row.solved_at = entry.solved_at

        if entry.best_runtime_ms is not None and (
            row.best_runtime_ms is None or entry.best_runtime_ms < row.best_runtime_ms
        ):
            row.best_runtime_ms = entry.best_runtime_ms
            row.best_submission_url = entry.best_submission_url
            row.best_runtime_at = entry.best_runtime_at


def record_submissions(
    user_id: int,
    submissions: list[RecentAcceptedSubmission],
    db: Session,
) -> None:
    """Merge recent accepted submissions into UserSolved.

    Keeps the earliest solved_at and the fastest runtime (with its submission
    URL and time) per (user, problem).
    """
    if not submissions:
        return

    batch = _fold_batch(submissions)

    _apply_batch(user_id, batch, db)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent sync inserted the same (user, slug) first; the rows
        # exist now, so a second pass reduces to pure updates.
        db.rollback()
        _apply_batch(user_id, batch, db)
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


def get_solved_for_slugs(
    user_id: int, slugs: set[str], db: Session,
) -> dict[str, UserSolved]:
    if not slugs:
        return {}
    rows = (
        db.query(UserSolved)
        .filter(
            UserSolved.user_id == user_id,
            UserSolved.title_slug.in_(slugs),
        )
        .all()
    )
    return {row.title_slug: row for row in rows}

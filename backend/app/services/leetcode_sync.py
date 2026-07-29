import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.leetcode import LeetCodeProfileResponse, RecentAcceptedSubmission
from app.services.activity_sync import upsert_daily_activity
from app.services.leetcode_client import LeetCodeClient
from app.services.leetcode_limiter import LeetCodeRateLimited, run_limited
from app.services.user_solved import record_submissions

logger = logging.getLogger(__name__)

SyncStatus = Literal[
    "synced",
    "recently_synced",
    "in_progress",
    "rate_limited",
    "failed",
    "skipped",
]

RECENT_SYNC_COOLDOWN_SECONDS = 60
PROFILE_SYNC_COOLDOWN_SECONDS = 300
USER_SYNC_STALE_AFTER_SECONDS = 180


@dataclass
class SyncMeta:
    status: SyncStatus
    last_synced_at: datetime | None = None
    next_sync_after: datetime | None = None
    error: str | None = None

    def as_dict(self) -> dict:
        return {
            "status": self.status,
            "last_synced_at": self.last_synced_at,
            "next_sync_after": self.next_sync_after,
            "error": self.error,
        }


@dataclass
class RecentSyncResult:
    meta: SyncMeta
    submissions: list[RecentAcceptedSubmission]


@dataclass
class ProfileSyncResult:
    meta: SyncMeta
    profile: LeetCodeProfileResponse | None = None


def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _next_sync_after(last_synced_at: datetime | None, cooldown_seconds: int) -> datetime | None:
    last_synced_at = _as_naive_utc(last_synced_at)
    if last_synced_at is None:
        return None
    return last_synced_at + timedelta(seconds=cooldown_seconds)


def _is_recent(last_synced_at: datetime | None, cooldown_seconds: int, now: datetime) -> bool:
    last_synced_at = _as_naive_utc(last_synced_at)
    if last_synced_at is None:
        return False
    return now - last_synced_at < timedelta(seconds=cooldown_seconds)


def _is_fresh_in_progress(started_at: datetime | None, stale_after_seconds: int, now: datetime) -> bool:
    started_at = _as_naive_utc(started_at)
    if started_at is None:
        return False
    return now - started_at < timedelta(seconds=stale_after_seconds)


def _error_text(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        return str(exc.detail)[:500]
    return str(exc)[:500] or exc.__class__.__name__


def _locked_user(user_id: int, db: Session) -> User:
    query = db.query(User).filter(User.id == user_id)
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one()


def _recent_meta(user: User, status: SyncStatus, error: str | None = None) -> SyncMeta:
    return SyncMeta(
        status=status,
        last_synced_at=user.leetcode_recent_last_synced_at,
        next_sync_after=_next_sync_after(
            user.leetcode_recent_last_synced_at,
            RECENT_SYNC_COOLDOWN_SECONDS,
        ),
        error=error,
    )


def _profile_meta(user: User, status: SyncStatus, error: str | None = None) -> SyncMeta:
    return SyncMeta(
        status=status,
        last_synced_at=user.leetcode_profile_last_synced_at,
        next_sync_after=_next_sync_after(
            user.leetcode_profile_last_synced_at,
            PROFILE_SYNC_COOLDOWN_SECONDS,
        ),
        error=error,
    )


async def maybe_sync_user_recent(
    user: User,
    db: Session,
    cooldown_seconds: int = RECENT_SYNC_COOLDOWN_SECONDS,
    limit: int = 50,
) -> RecentSyncResult:
    locked = _locked_user(user.id, db)
    now = utcnow_naive()

    if _is_fresh_in_progress(
        locked.leetcode_recent_sync_started_at,
        USER_SYNC_STALE_AFTER_SECONDS,
        now,
    ):
        return RecentSyncResult(meta=_recent_meta(locked, "in_progress"), submissions=[])

    if _is_recent(locked.leetcode_recent_last_synced_at, cooldown_seconds, now):
        return RecentSyncResult(meta=_recent_meta(locked, "recently_synced"), submissions=[])

    username = locked.leetcode_username
    locked.leetcode_recent_sync_started_at = now
    locked.leetcode_recent_sync_error = None
    db.commit()

    client = LeetCodeClient()
    try:
        submissions = await run_limited(
            lambda: client.get_recent_accepted_submissions(username, limit=limit)
        )
    except LeetCodeRateLimited as exc:
        locked = _locked_user(user.id, db)
        locked.leetcode_recent_sync_started_at = None
        locked.leetcode_recent_sync_error = f"rate_limited:{exc.retry_after_seconds}"
        db.commit()
        return RecentSyncResult(
            meta=_recent_meta(locked, "rate_limited", locked.leetcode_recent_sync_error),
            submissions=[],
        )
    except Exception as exc:
        logger.warning("recent LeetCode sync failed for user_id=%s", user.id, exc_info=True)
        locked = _locked_user(user.id, db)
        locked.leetcode_recent_sync_started_at = None
        locked.leetcode_recent_sync_error = _error_text(exc)
        db.commit()
        return RecentSyncResult(
            meta=_recent_meta(locked, "failed", locked.leetcode_recent_sync_error),
            submissions=[],
        )

    if submissions:
        record_submissions(user.id, submissions, db)

    locked = _locked_user(user.id, db)
    locked.leetcode_recent_last_synced_at = utcnow_naive()
    locked.leetcode_recent_sync_started_at = None
    locked.leetcode_recent_sync_error = None
    db.commit()

    return RecentSyncResult(meta=_recent_meta(locked, "synced"), submissions=submissions)


async def maybe_sync_user_profile(
    user: User,
    db: Session,
    cooldown_seconds: int = PROFILE_SYNC_COOLDOWN_SECONDS,
) -> ProfileSyncResult:
    locked = _locked_user(user.id, db)
    now = utcnow_naive()

    if _is_fresh_in_progress(
        locked.leetcode_profile_sync_started_at,
        USER_SYNC_STALE_AFTER_SECONDS,
        now,
    ):
        return ProfileSyncResult(meta=_profile_meta(locked, "in_progress"))

    if _is_recent(locked.leetcode_profile_last_synced_at, cooldown_seconds, now):
        return ProfileSyncResult(meta=_profile_meta(locked, "recently_synced"))

    username = locked.leetcode_username
    locked.leetcode_profile_sync_started_at = now
    locked.leetcode_profile_sync_error = None
    db.commit()

    client = LeetCodeClient()
    try:
        profile = await run_limited(lambda: client.get_user_profile(username))
    except LeetCodeRateLimited as exc:
        locked = _locked_user(user.id, db)
        locked.leetcode_profile_sync_started_at = None
        locked.leetcode_profile_sync_error = f"rate_limited:{exc.retry_after_seconds}"
        db.commit()
        return ProfileSyncResult(
            meta=_profile_meta(locked, "rate_limited", locked.leetcode_profile_sync_error)
        )
    except Exception as exc:
        logger.warning("profile LeetCode sync failed for user_id=%s", user.id, exc_info=True)
        locked = _locked_user(user.id, db)
        locked.leetcode_profile_sync_started_at = None
        locked.leetcode_profile_sync_error = _error_text(exc)
        db.commit()
        return ProfileSyncResult(
            meta=_profile_meta(locked, "failed", locked.leetcode_profile_sync_error)
        )

    upsert_daily_activity(user.id, profile.submission_calendar, db)

    locked = _locked_user(user.id, db)
    locked.leetcode_avatar_url = profile.avatar_url
    locked.leetcode_ranking = profile.ranking
    locked.leetcode_profile_last_synced_at = utcnow_naive()
    locked.leetcode_profile_sync_started_at = None
    locked.leetcode_profile_sync_error = None
    db.commit()

    return ProfileSyncResult(meta=_profile_meta(locked, "synced"), profile=profile)

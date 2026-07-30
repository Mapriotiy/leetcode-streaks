import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.friend_invite import FriendInvite
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.friends import (
    AcceptInviteResponse,
    CreateInviteResponse,
    FriendResponse,
    FriendUserResponse,
    InviteResponse,
    FriendStreakResponse,
    TodayFriendStatusResponse,
)

from app.services.activity_sync import get_utc_today
from app.services.leetcode_sync import sync_user_daily_activity_by_id
from app.services.streaks import calculate_friend_streak, get_active_dates

router = APIRouter()


def normalize_friend_pair(user_id: int, friend_id: int) -> tuple[int, int]:
    return (min(user_id, friend_id), max(user_id, friend_id))


def user_to_friend_response(user: User) -> FriendUserResponse:
    return FriendUserResponse(
        id=user.id,
        leetcode_username=user.leetcode_username,
    )


def build_invite_url(token: str) -> str:
    frontend_url = settings.frontend_url.rstrip("/")
    return f"{frontend_url}/?invite={token}"


@router.post("/invites", response_model=CreateInviteResponse)
def create_invite(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    token = secrets.token_urlsafe(24)

    invite = FriendInvite(
        inviter_user_id=current_user.id,
        token=token,
        status="pending",
    )

    db.add(invite)
    db.commit()
    db.refresh(invite)

    return CreateInviteResponse(
        token=invite.token,
        invite_url=build_invite_url(invite.token),
    )


@router.get("/invites/{token}", response_model=InviteResponse)
def get_invite(
        token: str,
        db: Session = Depends(get_db),
):
    invite = db.query(FriendInvite).filter(FriendInvite.token == token).first()
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    inviter = db.get(User, invite.inviter_user_id)
    if inviter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inviter not found",
        )

    return InviteResponse(
        token=invite.token,
        status=invite.status,
        inviter=user_to_friend_response(inviter),
        created_at=invite.created_at,
    )


@router.post("/invites/{token}/accept", response_model=AcceptInviteResponse)
def accept_invite(
        token: str,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    invite = db.query(FriendInvite).filter(FriendInvite.token == token).first()
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invite is no longer available",
        )

    if invite.inviter_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot accept your own invite",
        )

    user_a_id, user_b_id = normalize_friend_pair(
        invite.inviter_user_id,
        current_user.id,
    )

    existing_friendship = (
        db.query(Friendship)
        .filter(
            Friendship.user_a_id == user_a_id,
            Friendship.user_b_id == user_b_id,
            )
        .first()
    )

    if existing_friendship:
        invite.status = "accepted"
        invite.accepted_by_user_id = current_user.id
        invite.accepted_at = datetime.now(timezone.utc)
        db.commit()

        inviter = db.get(User, invite.inviter_user_id)

        return AcceptInviteResponse(
            friendship_id=existing_friendship.id,
            friend=user_to_friend_response(inviter),
        )

    friendship = Friendship(
        user_a_id=user_a_id,
        user_b_id=user_b_id,
    )

    invite.status = "accepted"
    invite.accepted_by_user_id = current_user.id
    invite.accepted_at = datetime.now(timezone.utc)

    db.add(friendship)
    db.commit()
    db.refresh(friendship)

    inviter = db.get(User, invite.inviter_user_id)

    return AcceptInviteResponse(
        friendship_id=friendship.id,
        friend=user_to_friend_response(inviter),
    )


@router.get("/", response_model=list[FriendResponse])
async def list_friends(
        background_tasks: BackgroundTasks,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    friendships = (
        db.query(Friendship)
        .filter(
            or_(
                Friendship.user_a_id == current_user.id,
                Friendship.user_b_id == current_user.id,
                )
        )
        .all()
    )

    friend_ids = [
        friendship.user_b_id
        if friendship.user_a_id == current_user.id
        else friendship.user_a_id
        for friendship in friendships
    ]

    friends = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(friend_ids)).all()
    }

    background_tasks.add_task(sync_user_daily_activity_by_id, current_user.id)
    for fid in friend_ids:
        if fid in friends:
            background_tasks.add_task(sync_user_daily_activity_by_id, fid)

    current_user_dates = get_active_dates(current_user, db)
    today = get_utc_today()

    result: list[FriendResponse] = []

    for friendship in friendships:
        friend = friends.get(
            friendship.user_b_id
            if friendship.user_a_id == current_user.id
            else friendship.user_a_id
        )

        if friend is None:
            continue

        friend_dates = get_active_dates(friend, db)

        streak = calculate_friend_streak(
            user_dates=current_user_dates,
            friend_dates=friend_dates,
            start_date=friendship.created_at.date(),
            today=today,
        )
        result.append(
            FriendResponse(
                friendship_id=friendship.id,
                friend=user_to_friend_response(friend),
                streak=FriendStreakResponse(
                    display_count=streak.display_count,
                    current_count=streak.current_count,
                    longest_count=streak.longest_count,
                    state=streak.state,
                    last_shared_active_date=streak.last_shared_active_date,
                    started_at=streak.started_at,
                    today=TodayFriendStatusResponse(
                        you_active=streak.today.you_active,
                        friend_active=streak.today.friend_active,
                        shared_active=streak.today.shared_active,
                    ),
                ),
            )
        )

    return result


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_friend(
        friendship_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    friendship = db.get(Friendship, friendship_id)

    if friendship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found",
        )

    if current_user.id not in (friendship.user_a_id, friendship.user_b_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete this friendship",
        )

    db.delete(friendship)
    db.commit()

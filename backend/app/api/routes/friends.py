import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
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
)

router = APIRouter()


def normalize_friend_pair(user_id: int, friend_id: int) -> tuple[int, int]:
    return (min(user_id, friend_id), max(user_id, friend_id))


def user_to_friend_response(user: User) -> FriendUserResponse:
    return FriendUserResponse(
        id=user.id,
        leetcode_username=user.leetcode_username,
    )


def build_invite_url(request: Request, token: str) -> str:
    frontend_origin = request.headers.get("origin") or "http://localhost:5173"
    return f"{frontend_origin}/?invite={token}"


@router.post("/invites", response_model=CreateInviteResponse)
def create_invite(
        request: Request,
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
        invite_url=build_invite_url(request, invite.token),
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
        invite.accepted_at = datetime.utcnow()
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
    invite.accepted_at = datetime.utcnow()

    db.add(friendship)
    db.commit()
    db.refresh(friendship)

    inviter = db.get(User, invite.inviter_user_id)

    return AcceptInviteResponse(
        friendship_id=friendship.id,
        friend=user_to_friend_response(inviter),
    )


@router.get("/", response_model=list[FriendResponse])
def list_friends(
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

    result: list[FriendResponse] = []

    for friendship in friendships:
        friend_id = (
            friendship.user_b_id
            if friendship.user_a_id == current_user.id
            else friendship.user_a_id
        )
        friend = db.get(User, friend_id)

        if friend is None:
            continue

        result.append(
            FriendResponse(
                friendship_id=friendship.id,
                friend=user_to_friend_response(friend),
            )
        )

    return result

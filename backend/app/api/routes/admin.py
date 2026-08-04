from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminUserListResponse,
    AdminUserOut,
    AdminUserUpdate,
)

router = APIRouter()


def _to_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        google_sub=user.google_sub,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        leetcode_username=user.leetcode_username,
        leetcode_verified_at=user.leetcode_verified_at,
        is_admin=user.is_admin,
        is_banned=user.is_banned,
        created_at=user.created_at,
    )


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    q: str | None = Query(default=None, max_length=100),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(User)
    if q:
        term = q.strip()
        like = f"%{term}%"
        filters = [
            User.display_name.ilike(like),
            User.email.ilike(like),
            User.leetcode_username.ilike(like),
            User.google_sub.ilike(like),
        ]
        if term.isdigit():
            filters.append(User.id == int(term))
        query = query.filter(or_(*filters))
    total = query.count()
    users = (
        query.order_by(User.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return AdminUserListResponse(
        total=total,
        offset=offset,
        limit=limit,
        users=[_to_out(u) for u in users],
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot modify your own account")

    if payload.is_admin is False and target.is_admin:
        admin_count = db.query(func.count(User.id)).filter(User.is_admin.is_(True)).scalar()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    if payload.is_admin is not None:
        target.is_admin = payload.is_admin
    if payload.is_banned is not None:
        target.is_banned = payload.is_banned

    db.commit()
    db.refresh(target)
    return _to_out(target)


@router.post("/users/{user_id}/reset-leetcode", response_model=AdminUserOut)
def reset_leetcode(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    target.leetcode_username = None
    target.leetcode_verified_at = None
    db.commit()
    db.refresh(target)
    return _to_out(target)

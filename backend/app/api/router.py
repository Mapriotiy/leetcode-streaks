from fastapi import APIRouter
from app.api.routes import health, auth, leetcode, friends, dashboard

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(leetcode.router, prefix="/leetcode", tags=["leetcode"])
api_router.include_router(friends.router, prefix="/friends", tags=["friends"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
from fastapi import APIRouter

router = APIRouter()


@router.get("/profile/{username}")
def get_leetcode_profile(username: str):
    return {
        "username": username,
        "status": "not_implemented",
    }
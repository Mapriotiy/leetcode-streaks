from fastapi import APIRouter

router = APIRouter()


@router.post("/register")
def register():
    return {"status": "not_implemented"}
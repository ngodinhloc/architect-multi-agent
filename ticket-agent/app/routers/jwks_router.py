from fastapi import APIRouter
from app.auth.jwks_service import jwks_service

router = APIRouter()


@router.get("/.well-known/jwks")
async def jwks():
    return jwks_service.get_jwks()

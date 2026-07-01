from fastapi import APIRouter
from app.container import container

router = APIRouter()


@router.get("/.well-known/jwks")
async def jwks():
    return container.jwt_service.get_jwks()

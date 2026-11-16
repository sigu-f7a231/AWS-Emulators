from fastapi import APIRouter

from app.schemas.common import ERROR_RESPONSES
from app.routers.update import smtp, dynamodb, dynamodb_schema

router = APIRouter(tags=["Update"], responses=ERROR_RESPONSES)
router.include_router(smtp.router)
router.include_router(dynamodb.router)
router.include_router(dynamodb_schema.router)

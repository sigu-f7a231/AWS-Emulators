from fastapi import APIRouter

from app.schemas.common import ERROR_RESPONSES
from app.routers.delete import s3, sqs, sns, mail, pipeline, dynamodb, dynamodb_schema

router = APIRouter(tags=["Delete"], responses=ERROR_RESPONSES)
router.include_router(s3.router)
router.include_router(sqs.router)
router.include_router(sns.router)
router.include_router(mail.router)
router.include_router(pipeline.router)
router.include_router(dynamodb.router)
router.include_router(dynamodb_schema.router)

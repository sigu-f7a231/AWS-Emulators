from fastapi import APIRouter

from app.schemas.common import ERROR_RESPONSES
from app.routers.create import s3, sqs, sns, mail, pipeline, dynamodb

router = APIRouter(tags=["Create"], responses=ERROR_RESPONSES)
router.include_router(s3.router)
router.include_router(sqs.router)
router.include_router(sns.router)
router.include_router(mail.router)
router.include_router(pipeline.router)
router.include_router(dynamodb.router)

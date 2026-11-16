from fastapi import APIRouter

from app.schemas.common import ERROR_RESPONSES
from app.routers.read import system, s3, sqs, sns, mail, pipeline, smtp, dynamodb

router = APIRouter(tags=["Read"], responses=ERROR_RESPONSES)
router.include_router(system.router)
router.include_router(s3.router)
router.include_router(sqs.router)
router.include_router(sns.router)
router.include_router(mail.router)
router.include_router(pipeline.router)
router.include_router(smtp.router)
router.include_router(dynamodb.router)

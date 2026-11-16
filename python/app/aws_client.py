import boto3
import urllib3
from botocore.config import Config
from app import config

# Suppress InsecureRequestWarning when using self-signed certificates locally
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

boto_config = Config(
    region_name=config.AWS_REGION,
    retries={"max_attempts": 3, "mode": "standard"},
)

def get_client(service_name: str):
    """
    Returns a boto3 client configured for the local AWS Emulator.
    """
    verify_cert = config.AWS_CA_BUNDLE if config.AWS_CA_BUNDLE else False
    return boto3.client(
        service_name,
        endpoint_url=config.AWS_ENDPOINT_URL,
        region_name=config.AWS_REGION,
        aws_access_key_id=config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY,
        config=boto_config,
        verify=verify_cert,
    )

def test_connection() -> dict:
    """Tests basic connectivity to AWS Emulator using S3 list_buckets."""
    try:
        s3 = get_client("s3")
        res = s3.list_buckets()
        return {
            "status": "connected",
            "endpoint": config.AWS_ENDPOINT_URL,
            "region": config.AWS_REGION,
            "buckets_count": len(res.get("Buckets", [])),
        }
    except Exception as e:
        return {
            "status": "error",
            "endpoint": config.AWS_ENDPOINT_URL,
            "error": str(e),
        }

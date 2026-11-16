#!/usr/bin/env python3
"""
CLI test script for verifying AWS Emulator functionality using Boto3.
Can be run inside the python container:
    docker compose exec python python test_emulator.py
"""

import sys
import os
import time
import boto3
import urllib3
from botocore.config import Config

# Disable SSL warning for local self-signed cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL", "https://aws-emulator:9297")
REGION = os.getenv("AWS_REGION", "us-east-1")
ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "emulator")
SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "emulator")
CA_BUNDLE = os.getenv("AWS_CA_BUNDLE", None)

print("=" * 60)
print("AWS Emulator Integration Test (Python / Boto3)")
print(f"Target Endpoint: {ENDPOINT_URL}")
print(f"Target Region:   {REGION}")
print("=" * 60)

boto_cfg = Config(region_name=REGION)
verify_val = CA_BUNDLE if CA_BUNDLE else False

def get_client(service_name):
    return boto3.client(
        service_name,
        endpoint_url=ENDPOINT_URL,
        region_name=REGION,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        config=boto_cfg,
        verify=verify_val,
    )

def test_s3():
    print("\n[1] Testing S3...")
    s3 = get_client("s3")
    bucket_name = "test-sample-bucket"

    # List buckets
    buckets = s3.list_buckets().get("Buckets", [])
    print(f"  - Initial Buckets: {[b['Name'] for b in buckets]}")

    # Create bucket
    if bucket_name not in [b['Name'] for b in buckets]:
        print(f"  - Creating bucket: '{bucket_name}'...")
        if REGION == "us-east-1":
            s3.create_bucket(Bucket=bucket_name)
        else:
            s3.create_bucket(Bucket=bucket_name, CreateBucketConfiguration={"LocationConstraint": REGION})
        print(f"  ✔ Bucket '{bucket_name}' created successfully.")

    # Put object
    object_key = "hello.txt"
    s3.put_object(Bucket=bucket_name, Key=object_key, Body=b"Hello from AWS Emulator with Python!")
    print(f"  ✔ Uploaded '{object_key}' to '{bucket_name}'.")

    # Get object
    resp = s3.get_object(Bucket=bucket_name, Key=object_key)
    data = resp["Body"].read().decode("utf-8")
    print(f"  ✔ Read object content: '{data}'")

def test_sqs():
    print("\n[2] Testing SQS...")
    sqs = get_client("sqs")
    queue_name = "test-queue"

    print(f"  - Creating queue '{queue_name}'...")
    create_res = sqs.create_queue(QueueName=queue_name)
    queue_url = create_res.get("QueueUrl")
    print(f"  ✔ Queue URL: {queue_url}")

    # Send message
    msg = "Test message for AWS Emulator"
    send_res = sqs.send_message(QueueUrl=queue_url, MessageBody=msg)
    print(f"  ✔ Sent message (ID: {send_res.get('MessageId')})")

    # Receive message
    rec_res = sqs.receive_message(QueueUrl=queue_url, MaxNumberOfMessages=1, WaitTimeSeconds=1)
    messages = rec_res.get("Messages", [])
    if messages:
        print(f"  ✔ Received message: '{messages[0]['Body']}'")
        # Delete message
        sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=messages[0]["ReceiptHandle"])
        print("  ✔ Deleted message.")
    else:
        print("  - No message received immediately.")

def test_sns():
    print("\n[3] Testing SNS...")
    sns = get_client("sns")
    topic_name = "test-topic"

    print(f"  - Creating SNS topic '{topic_name}'...")
    create_res = sns.create_topic(Name=topic_name)
    topic_arn = create_res.get("TopicArn")
    print(f"  ✔ Topic ARN: {topic_arn}")

    # Subscribe an email
    email = "developer@example.com"
    print(f"  - Subscribing email '{email}' to topic...")
    sub_res = sns.subscribe(
        TopicArn=topic_arn,
        Protocol="email",
        Endpoint=email,
        ReturnSubscriptionArn=True,
    )
    print(f"  ✔ Subscribed! (ARN: {sub_res.get('SubscriptionArn')})")

    # Publish message
    print("  - Publishing message to topic...")
    pub_res = sns.publish(
        TopicArn=topic_arn,
        Subject="Test SNS Subject",
        Message="Hello from AWS Emulator SNS!",
    )
    print(f"  ✔ Published message (ID: {pub_res.get('MessageId')})")

def test_dynamodb():
    print("\n[4] Testing DynamoDB...")
    dynamo = get_client("dynamodb")
    table_name = "Users"

    existing_tables = dynamo.list_tables().get("TableNames", [])
    if table_name not in existing_tables:
        print(f"  - Creating DynamoDB table '{table_name}'...")
        dynamo.create_table(
            TableName=table_name,
            KeySchema=[{"AttributeName": "UserId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "UserId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"  ✔ Table '{table_name}' created.")
    else:
        print(f"  - Table '{table_name}' already exists.")

    tables = dynamo.list_tables().get("TableNames", [])
    print(f"  ✔ Current tables: {tables}")

def wait_for_emulator(max_retries=15, interval=2):
    print("Connecting to AWS Emulator...")
    s3 = get_client("s3")
    for attempt in range(1, max_retries + 1):
        try:
            s3.list_buckets()
            print(f"✔ Successfully connected to AWS Emulator at {ENDPOINT_URL}!\n")
            return True
        except Exception as e:
            print(f"  Attempt {attempt}/{max_retries}: Waiting for emulator to be ready ({e})...")
            time.sleep(interval)
    print("❌ Timed out waiting for AWS Emulator.", file=sys.stderr)
    return False

def main():
    import time
    if not wait_for_emulator():
        sys.exit(1)
    try:
        test_s3()
        test_sqs()
        test_sns()
        test_dynamodb()
        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED! AWS Emulator is working seamlessly.")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ Error during test: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

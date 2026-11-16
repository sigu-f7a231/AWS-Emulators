import os
import json
from typing import Dict, List, Optional
from app.aws_client import get_client
from app.services.mail_service import send_email

def link_sns_to_sqs(topic_arn: str, queue_name: str) -> Dict:
    """
    Subscribes an SQS queue to an SNS topic.
    """
    sns = get_client("sns")
    sqs = get_client("sqs")

    q_url_res = sqs.get_queue_url(QueueName=queue_name)
    queue_url = q_url_res["QueueUrl"]

    attr_res = sqs.get_queue_attributes(QueueUrl=queue_url, AttributeNames=["QueueArn"])
    queue_arn = attr_res["Attributes"]["QueueArn"]

    sub_res = sns.subscribe(
        TopicArn=topic_arn,
        Protocol="sqs",
        Endpoint=queue_arn,
        ReturnSubscriptionArn=True,
    )
    subscription_arn = sub_res.get("SubscriptionArn")

    # Set SQS policy allowing SNS SendMessage
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": f"AllowSNS-{queue_name}",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "sqs:SendMessage",
                "Resource": queue_arn,
                "Condition": {"ArnEquals": {"aws:SourceArn": topic_arn}},
            }
        ],
    }
    try:
        sqs.set_queue_attributes(
            QueueUrl=queue_url,
            Attributes={"Policy": json.dumps(policy)},
        )
    except Exception:
        pass

    return {
        "topic_arn": topic_arn,
        "queue_name": queue_name,
        "queue_arn": queue_arn,
        "subscription_arn": subscription_arn,
    }

def subscribe_email_to_topic(topic_arn: str, email: str) -> Dict:
    """
    Subscribes an email address to an SNS topic.
    """
    sns = get_client("sns")
    res = sns.subscribe(
        TopicArn=topic_arn,
        Protocol="email",
        Endpoint=email,
        ReturnSubscriptionArn=True,
    )
    return {
        "topic_arn": topic_arn,
        "email": email,
        "subscription_arn": res.get("SubscriptionArn"),
    }

def unsubscribe_arn(subscription_arn: str) -> Dict:
    """
    Unsubscribes a subscription by its ARN.
    """
    sns = get_client("sns")
    sns.unsubscribe(SubscriptionArn=subscription_arn)
    return {"message": "サブスクリプションを解除・削除しました", "subscription_arn": subscription_arn}

def get_pipeline_overview() -> Dict:
    """
    Retrieves all SNS topics, SQS queues, and structured subscriptions
    (Email subscribers & SQS subscribers per topic).
    """
    sns = get_client("sns")
    sqs = get_client("sqs")

    # 1. Topics
    topics_raw = sns.list_topics().get("Topics", [])
    topics = []
    for t in topics_raw:
        arn = t["TopicArn"]
        name = arn.split(":")[-1]
        topics.append({"arn": arn, "name": name})

    # 2. Queues
    queues_raw = sqs.list_queues().get("QueueUrls", [])
    queues = []
    for q_url in queues_raw:
        q_name = q_url.split("/")[-1]
        queues.append({"name": q_name, "url": q_url})

    # 3. Topic details with Subscriptions
    pipeline_topics = []
    for t in topics:
        topic_arn = t["arn"]
        email_subs = []
        sqs_subs = []

        try:
            subs_res = sns.list_subscriptions_by_topic(TopicArn=topic_arn)
            for s in subs_res.get("Subscriptions", []):
                proto = s.get("Protocol")
                sub_arn = s.get("SubscriptionArn")
                endpoint = s.get("Endpoint", "")

                if proto == "email":
                    email_subs.append({
                        "subscription_arn": sub_arn,
                        "email": endpoint,
                    })
                elif proto == "sqs":
                    q_name = endpoint.split(":")[-1]
                    sqs_subs.append({
                        "subscription_arn": sub_arn,
                        "queue_name": q_name,
                        "queue_arn": endpoint,
                    })
        except Exception:
            pass

        pipeline_topics.append({
            "topic_arn": topic_arn,
            "topic_name": t["name"],
            "email_subscriptions": email_subs,
            "sqs_subscriptions": sqs_subs,
        })

    return {
        "topics": topics,
        "queues": queues,
        "pipelines": pipeline_topics,
    }

def broadcast_topic_pipeline(topic_arn: str, subject: str, message_body: str, delivery_mode: Optional[str] = None) -> Dict:
    """
    Publishes to the SNS topic and:
    - Delivers email to all email subscriptions registered on this SNS topic.
    - Sends message to all connected SQS queues.
    """
    sns = get_client("sns")
    sqs = get_client("sqs")

    # 1. Publish to SNS
    pub_res = sns.publish(
        TopicArn=topic_arn,
        Subject=subject,
        Message=message_body,
    )
    message_id = pub_res.get("MessageId")

    # 2. Fetch subscriptions on this topic
    subs_res = sns.list_subscriptions_by_topic(TopicArn=topic_arn)
    email_deliveries = []
    sqs_deliveries = []

    for s in subs_res.get("Subscriptions", []):
        proto = s.get("Protocol")
        endpoint = s.get("Endpoint", "")

        if proto == "email" and endpoint:
            # Deliver email
            email_rec = send_email(
                to_address=endpoint,
                subject=f"[{subject}] from SNS:{topic_arn.split(':')[-1]}",
                body=message_body,
                source="sns",
                source_detail=f"Topic: {topic_arn.split(':')[-1]}",
                delivery_mode=delivery_mode,
            )
            email_deliveries.append({
                "email": endpoint,
                "email_id": email_rec["id"],
                "status": email_rec["status"],
                "error": email_rec.get("error"),
            })

        elif proto == "sqs" and endpoint:
            # Forward message to SQS
            q_name = endpoint.split(":")[-1]
            sqs_msg_id = None
            try:
                q_url = sqs.get_queue_url(QueueName=q_name)["QueueUrl"]
                send_res = sqs.send_message(
                    QueueUrl=q_url,
                    MessageBody=json.dumps({
                        "Type": "Notification",
                        "TopicArn": topic_arn,
                        "Subject": subject,
                        "Message": message_body,
                    }),
                )
                sqs_msg_id = send_res.get("MessageId")
            except Exception:
                pass
            sqs_deliveries.append({
                "queue_name": q_name,
                "queue_arn": endpoint,
                "sqs_message_id": sqs_msg_id,
                "status": "delivered_to_sqs",
            })

    return {
        "topic_arn": topic_arn,
        "message_id": message_id,
        "email_deliveries": email_deliveries,
        "sqs_deliveries": sqs_deliveries,
    }

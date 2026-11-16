import { monitoredFetch } from './apiInspector.ts';

// =================== S3 Service ===================
export const s3Service = {
  listBuckets: () => monitoredFetch('S3', 's3:ListBuckets', '/api/s3/buckets'),
  createBucket: (bucket_name: string) =>
    monitoredFetch('S3', 's3:CreateBucket', '/api/s3/buckets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket_name }),
    }),
  deleteBucket: (bucket_name: string) =>
    monitoredFetch('S3', 's3:DeleteBucket', `/api/s3/buckets/${encodeURIComponent(bucket_name)}`, {
      method: 'DELETE',
    }),
  listObjects: (bucket_name: string) =>
    monitoredFetch('S3', 's3:ListObjectsV2', `/api/s3/buckets/${encodeURIComponent(bucket_name)}/objects`),
  getObjectContent: (bucket_name: string, key: string) =>
    monitoredFetch(
      'S3',
      's3:GetObject',
      `/api/s3/buckets/${encodeURIComponent(bucket_name)}/objects/${encodeURIComponent(key)}`
    ),
  putObject: (bucket_name: string, key: string, content: string) =>
    monitoredFetch('S3', 's3:PutObject', `/api/s3/buckets/${encodeURIComponent(bucket_name)}/objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, content }),
    }),
  deleteObject: (bucket_name: string, key: string) =>
    monitoredFetch(
      'S3',
      's3:DeleteObject',
      `/api/s3/buckets/${encodeURIComponent(bucket_name)}/objects/${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    ),
};

// =================== SQS Service ===================
export const sqsService = {
  listQueues: () => monitoredFetch('SQS', 'sqs:ListQueues', '/api/sqs/queues'),
  createQueue: (queue_name: string) =>
    monitoredFetch('SQS', 'sqs:CreateQueue', '/api/sqs/queues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_name }),
    }),
  deleteQueue: (queue_name: string) =>
    monitoredFetch('SQS', 'sqs:DeleteQueue', `/api/sqs/queues/${encodeURIComponent(queue_name)}`, {
      method: 'DELETE',
    }),
  sendMessage: (queue_name: string, message_body: string) =>
    monitoredFetch('SQS', 'sqs:SendMessage', `/api/sqs/queues/${encodeURIComponent(queue_name)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_body }),
    }),
  receiveMessages: (queue_name: string) =>
    monitoredFetch('SQS', 'sqs:ReceiveMessage', `/api/sqs/queues/${encodeURIComponent(queue_name)}/messages`),
};

// =================== SNS Service ===================
export const snsService = {
  listTopics: () => monitoredFetch('SNS', 'sns:ListTopics', '/api/sns/topics'),
  createTopic: (topic_name: string) =>
    monitoredFetch('SNS', 'sns:CreateTopic', '/api/sns/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_name }),
    }),
  deleteTopic: (topic_arn: string) =>
    monitoredFetch('SNS', 'sns:DeleteTopic', `/api/sns/topics/${encodeURIComponent(topic_arn)}`, {
      method: 'DELETE',
    }),
  listSubscriptions: (topic_arn: string) =>
    monitoredFetch(
      'SNS',
      'sns:ListSubscriptionsByTopic',
      `/api/sns/topics/${encodeURIComponent(topic_arn)}/subscriptions`
    ),
  subscribe: (topic_arn: string, protocol: string, endpoint: string) =>
    monitoredFetch(
      'SNS',
      'sns:Subscribe',
      `/api/sns/topics/${encodeURIComponent(topic_arn)}/subscribe`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol, endpoint }),
      }
    ),
  publish: (topic_arn: string, subject: string, message: string) =>
    monitoredFetch('SNS', 'sns:Publish', `/api/sns/topics/${encodeURIComponent(topic_arn)}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message }),
    }),
};

// =================== DynamoDB Service ===================
export interface ItemAttributeDef {
  name: string;
  type: 'S' | 'N' | 'BOOL' | 'L' | 'M' | 'NULL';
  value: any;
}

export const dynamoService = {
  listTables: () => monitoredFetch('DynamoDB', 'dynamodb:ListTables', '/api/dynamodb/tables'),
  createTable: (
    table_name: string,
    partition_key_name: string,
    partition_key_type: string = 'S',
    sort_key_name?: string,
    sort_key_type?: string
  ) =>
    monitoredFetch('DynamoDB', 'dynamodb:CreateTable', '/api/dynamodb/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_name,
        partition_key_name,
        partition_key_type,
        sort_key_name: sort_key_name || null,
        sort_key_type: sort_key_type || null,
      }),
    }),
  deleteTable: (table_name: string) =>
    monitoredFetch('DynamoDB', 'dynamodb:DeleteTable', `/api/dynamodb/tables/${encodeURIComponent(table_name)}`, {
      method: 'DELETE',
    }),
  scanItems: (table_name: string) =>
    monitoredFetch('DynamoDB', 'dynamodb:Scan', `/api/dynamodb/tables/${encodeURIComponent(table_name)}/items`),
  putItem: (table_name: string, attributes: ItemAttributeDef[]) =>
    monitoredFetch('DynamoDB', 'dynamodb:PutItem', `/api/dynamodb/tables/${encodeURIComponent(table_name)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes }),
    }),
  deleteItem: (table_name: string, key: Record<string, any>) =>
    monitoredFetch(
      'DynamoDB',
      'dynamodb:DeleteItem',
      `/api/dynamodb/tables/${encodeURIComponent(table_name)}/delete-item`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      }
    ),
};

// =================== Pipeline Service ===================
export const pipelineService = {
  getOverview: () => monitoredFetch('Pipeline', 'pipeline:GetOverview', '/api/pipeline/overview'),
  subscribeEmail: (topic_arn: string, email: string) =>
    monitoredFetch('Pipeline', 'pipeline:SubscribeEmail', '/api/pipeline/subscribe-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, email }),
    }),
  subscribeSqs: (topic_arn: string, queue_name: string) =>
    monitoredFetch('Pipeline', 'pipeline:SubscribeSqs', '/api/pipeline/subscribe-sqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, queue_name }),
    }),
  unsubscribe: (subscription_arn: string) =>
    monitoredFetch(
      'Pipeline',
      'pipeline:Unsubscribe',
      `/api/pipeline/subscriptions/${encodeURIComponent(subscription_arn)}`,
      { method: 'DELETE' }
    ),
  broadcast: (topic_arn: string, subject: string, message: string) =>
    monitoredFetch('Pipeline', 'pipeline:Broadcast', '/api/pipeline/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, subject, message }),
    }),
};

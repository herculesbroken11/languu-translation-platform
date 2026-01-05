import { TranslateClient } from '@aws-sdk/client-translate';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { PollyClient } from '@aws-sdk/client-polly';
import { ComprehendClient } from '@aws-sdk/client-comprehend';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION || 'us-east-1';
const stage = process.env.STAGE || 'staging';

export const awsConfig = {
  region,
  stage,
};

// AWS Service Clients
export const translateClient = new TranslateClient({ region });
export const transcribeClient = new TranscribeClient({ region });
export const pollyClient = new PollyClient({ region });
export const comprehendClient = new ComprehendClient({ region });
export const s3Client = new S3Client({ region });
export const dynamoDBClient = new DynamoDBClient({ region });
export const dynamoDocClient = DynamoDBDocumentClient.from(dynamoDBClient);

// Resource Names
export const resourceNames = {
  s3Bucket: `languu-${stage}-media`,
  dynamoTable: `languu-${stage}-jobs`,
  translateFunction: `languu-${stage}-translate`,
  transcribeFunction: `languu-${stage}-transcribe`,
  interpretationFunction: `languu-${stage}-interpretation`,
  ttsFunction: `languu-${stage}-tts`,
  hitlFunction: `languu-${stage}-hitl`,
};

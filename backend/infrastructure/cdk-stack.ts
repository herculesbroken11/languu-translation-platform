import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { getLambdaPolicyStatements } from './iam';
import { createApiGateway, ApiGatewayConfig } from './api-gateway';
import { createDynamoDBTable, DynamoDBConfig } from './dynamodb';
import { createS3Bucket, S3Config } from './s3';
import * as path from 'path';

export interface LanguuStackProps extends StackProps {
  stage: string;
}

export class LanguuStack extends Stack {
  constructor(scope: Construct, id: string, props: LanguuStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Create S3 bucket
    const mediaBucket = createS3Bucket(this, { stage });

    // Create DynamoDB table
    const jobsTable = createDynamoDBTable(this, { stage });

    // Translate Lambda
    const translateFunction = new NodejsFunction(this, `TranslateFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/translate/index.ts'),
      functionName: `languu-${stage}-translate`,
      timeout: Duration.minutes(5),
      memorySize: 512,
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        STAGE: stage,
        AWS_REGION: this.region,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    translateFunction.addToRolePolicy(...getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName));

    // Transcribe Lambda
    const transcribeFunction = new NodejsFunction(this, `TranscribeFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/transcribe/index.ts'),
      functionName: `languu-${stage}-transcribe`,
      timeout: Duration.minutes(10),
      memorySize: 512,
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        STAGE: stage,
        AWS_REGION: this.region,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    transcribeFunction.addToRolePolicy(...getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName));
    mediaBucket.grantReadWrite(transcribeFunction);

    // Transcribe Upload Lambda
    const transcribeUploadFunction = new NodejsFunction(
      this,
      `TranscribeUploadFunction-${stage}`,
      {
        runtime: Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambdas/transcribe/upload.ts'),
        functionName: `languu-${stage}-transcribe-upload`,
        timeout: Duration.minutes(5),
        memorySize: 256,
        logRetention: RetentionDays.ONE_WEEK,
        environment: {
          STAGE: stage,
          AWS_REGION: this.region,
          S3_BUCKET: mediaBucket.bucketName,
          DYNAMODB_TABLE: jobsTable.tableName,
        },
      }
    );
    transcribeUploadFunction.addToRolePolicy(...getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName));
    mediaBucket.grantPut(transcribeUploadFunction);

    // Interpretation Lambda
    const interpretationFunction = new NodejsFunction(
      this,
      `InterpretationFunction-${stage}`,
      {
        runtime: Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambdas/interpretation/index.ts'),
        functionName: `languu-${stage}-interpretation`,
        timeout: Duration.minutes(15),
        memorySize: 512,
        logRetention: RetentionDays.ONE_WEEK,
        environment: {
          STAGE: stage,
          AWS_REGION: this.region,
          S3_BUCKET: mediaBucket.bucketName,
          DYNAMODB_TABLE: jobsTable.tableName,
        },
      }
    );
    interpretationFunction.addToRolePolicy(...getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName));

    // TTS Lambda
    const ttsFunction = new NodejsFunction(this, `TTSFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/tts/index.ts'),
      functionName: `languu-${stage}-tts`,
      timeout: Duration.minutes(5),
      memorySize: 512,
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        STAGE: stage,
        AWS_REGION: this.region,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    ttsFunction.addToRolePolicy(...getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName));
    mediaBucket.grantPut(ttsFunction);

    // HITL Lambda
    const hitlFunction = new NodejsFunction(this, `HITLFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/hitl/index.ts'),
      functionName: `languu-${stage}-hitl`,
      timeout: Duration.minutes(5),
      memorySize: 256,
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        STAGE: stage,
        AWS_REGION: this.region,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    hitlFunction.addToRolePolicy(...getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName));
    jobsTable.grantReadWriteData(hitlFunction);

    // Create API Gateway
    const apiGatewayConfig: ApiGatewayConfig = {
      translateFunction,
      transcribeFunction,
      transcribeUploadFunction,
      interpretationFunction,
      ttsFunction,
      hitlFunction,
      stage,
    };

    const api = createApiGateway(this, apiGatewayConfig);

    // Outputs
    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new CfnOutput(this, 'S3Bucket', {
      value: mediaBucket.bucketName,
      description: 'S3 Media Bucket Name',
    });

    new CfnOutput(this, 'DynamoDBTable', {
      value: jobsTable.tableName,
      description: 'DynamoDB Jobs Table Name',
    });
  }
}

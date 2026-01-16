import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { getLambdaPolicyStatements } from './iam';
import { createApiGateway, ApiGatewayConfig } from './api-gateway';
import { createWebSocketApi, WebSocketApiConfig } from './websocket-api';
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
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['aws-sdk'],
      },
      depsLockFilePath: path.join(__dirname, '../package-lock.json'),
      logGroup: new LogGroup(this, `TranslateLogGroup-${stage}`, {
        logGroupName: `/aws/lambda/languu-${stage}-translate`,
        retention: RetentionDays.ONE_WEEK,
      }),
      environment: {
        STAGE: stage,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    const policies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    policies.forEach(policy => translateFunction.addToRolePolicy(policy));

    // Transcribe Lambda
    const transcribeFunction = new NodejsFunction(this, `TranscribeFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/transcribe/index.ts'),
      functionName: `languu-${stage}-transcribe`,
      timeout: Duration.minutes(10),
      memorySize: 512,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['aws-sdk'],
      },
      depsLockFilePath: path.join(__dirname, '../package-lock.json'),
      logGroup: new LogGroup(this, `TranscribeLogGroup-${stage}`, {
        logGroupName: `/aws/lambda/languu-${stage}-transcribe`,
        retention: RetentionDays.ONE_WEEK,
      }),
      environment: {
        STAGE: stage,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    const transcribePolicies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    transcribePolicies.forEach(policy => transcribeFunction.addToRolePolicy(policy));
    mediaBucket.grantReadWrite(transcribeFunction);

    // Transcribe Status Lambda
    const transcribeStatusFunction = new NodejsFunction(this, `TranscribeStatusFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/transcribe/status.ts'),
      functionName: `languu-${stage}-transcribe-status`,
      timeout: Duration.minutes(5),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['aws-sdk'],
      },
      depsLockFilePath: path.join(__dirname, '../package-lock.json'),
      logGroup: new LogGroup(this, `TranscribeStatusLogGroup-${stage}`, {
        logGroupName: `/aws/lambda/languu-${stage}-transcribe-status`,
        retention: RetentionDays.ONE_WEEK,
      }),
      environment: {
        STAGE: stage,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    const statusPolicies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    statusPolicies.forEach(policy => transcribeStatusFunction.addToRolePolicy(policy));
    mediaBucket.grantRead(transcribeStatusFunction);
    jobsTable.grantReadData(transcribeStatusFunction);

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
        bundling: {
          minify: true,
          sourceMap: true,
          target: 'node20',
          externalModules: ['aws-sdk'],
        },
        depsLockFilePath: path.join(__dirname, '../package-lock.json'),
        logGroup: new LogGroup(this, `TranscribeUploadLogGroup-${stage}`, {
          logGroupName: `/aws/lambda/languu-${stage}-transcribe-upload`,
          retention: RetentionDays.ONE_WEEK,
        }),
        environment: {
          STAGE: stage,
          S3_BUCKET: mediaBucket.bucketName,
          DYNAMODB_TABLE: jobsTable.tableName,
        },
      }
    );
    const uploadPolicies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    uploadPolicies.forEach(policy => transcribeUploadFunction.addToRolePolicy(policy));
    mediaBucket.grantPut(transcribeUploadFunction);

    // Interpretation Lambda
    const interpretationFunction = new NodejsFunction(
      this,
      `InterpretationFunction-${stage}`,
      {
        runtime: Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambdas/interpretation/websocket-handler.ts'),
        functionName: `languu-${stage}-interpretation`,
        timeout: Duration.minutes(15),
        memorySize: 512,
        bundling: {
          minify: true,
          sourceMap: true,
          target: 'node20',
          externalModules: ['aws-sdk'],
        },
        depsLockFilePath: path.join(__dirname, '../package-lock.json'),
        logGroup: new LogGroup(this, `InterpretationLogGroup-${stage}`, {
          logGroupName: `/aws/lambda/languu-${stage}-interpretation`,
          retention: RetentionDays.ONE_WEEK,
        }),
        environment: {
          STAGE: stage,
          S3_BUCKET: mediaBucket.bucketName,
          DYNAMODB_TABLE: jobsTable.tableName,
        },
      }
    );
    const interpretationPolicies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    interpretationPolicies.forEach(policy => interpretationFunction.addToRolePolicy(policy));
    mediaBucket.grantPut(interpretationFunction); // Allow TTS audio uploads
    jobsTable.grantReadWriteData(interpretationFunction);

    // TTS Lambda
    const ttsFunction = new NodejsFunction(this, `TTSFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/tts/index.ts'),
      functionName: `languu-${stage}-tts`,
      timeout: Duration.minutes(5),
      memorySize: 512,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['aws-sdk'],
      },
      depsLockFilePath: path.join(__dirname, '../package-lock.json'),
      logGroup: new LogGroup(this, `TTSLogGroup-${stage}`, {
        logGroupName: `/aws/lambda/languu-${stage}-tts`,
        retention: RetentionDays.ONE_WEEK,
      }),
      environment: {
        STAGE: stage,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    const ttsPolicies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    ttsPolicies.forEach(policy => ttsFunction.addToRolePolicy(policy));
    mediaBucket.grantPut(ttsFunction);

    // HITL Lambda
    const hitlFunction = new NodejsFunction(this, `HITLFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/hitl/index.ts'),
      functionName: `languu-${stage}-hitl`,
      timeout: Duration.minutes(5),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['aws-sdk'],
      },
      depsLockFilePath: path.join(__dirname, '../package-lock.json'),
      logGroup: new LogGroup(this, `HITLLogGroup-${stage}`, {
        logGroupName: `/aws/lambda/languu-${stage}-hitl`,
        retention: RetentionDays.ONE_WEEK,
      }),
      environment: {
        STAGE: stage,
        S3_BUCKET: mediaBucket.bucketName,
        DYNAMODB_TABLE: jobsTable.tableName,
      },
    });
    const hitlPolicies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    hitlPolicies.forEach(policy => hitlFunction.addToRolePolicy(policy));
    jobsTable.grantReadWriteData(hitlFunction);

    // Email Lambda
    const emailFunction = new NodejsFunction(this, `EmailFunction-${stage}`, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/email/index.ts'),
      functionName: `languu-${stage}-email`,
      timeout: Duration.seconds(30),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['aws-sdk'],
      },
      depsLockFilePath: path.join(__dirname, '../package-lock.json'),
      logGroup: new LogGroup(this, `EmailLogGroup-${stage}`, {
        logGroupName: `/aws/lambda/languu-${stage}-email`,
        retention: RetentionDays.ONE_WEEK,
      }),
      environment: {
        STAGE: stage,
        TEAM_EMAIL: 'team@languu.com',
        FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@languu.com',
      },
    });
    // Add SES permissions (already included in shared policies, but explicit for clarity)
    const emailPolicies = getLambdaPolicyStatements(mediaBucket.bucketName, jobsTable.tableName);
    emailPolicies.forEach(policy => emailFunction.addToRolePolicy(policy));

    // Create API Gateway
    const apiGatewayConfig: ApiGatewayConfig = {
      translateFunction,
      transcribeFunction,
      transcribeUploadFunction,
      transcribeStatusFunction,
      interpretationFunction,
      ttsFunction,
      hitlFunction,
      emailFunction,
      stage,
    };

    const api = createApiGateway(this, apiGatewayConfig);

    // Create WebSocket API for real-time interpretation
    const websocketApiConfig: WebSocketApiConfig = {
      interpretationFunction,
      stage,
    };
    const websocketApi = createWebSocketApi(this, websocketApiConfig);
    
    // Set WebSocket API endpoint as environment variable for Lambda
    interpretationFunction.addEnvironment(
      'WEBSOCKET_API_ENDPOINT',
      websocketApi.api.apiEndpoint
    );

    // Outputs
    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new CfnOutput(this, 'WebSocketApiUrl', {
      value: websocketApi.url.replace('https://', 'wss://').replace('http://', 'ws://'),
      description: 'WebSocket API URL for real-time interpretation',
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

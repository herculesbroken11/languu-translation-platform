import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

export const getLambdaPolicyStatements = (bucketName: string, tableName: string): PolicyStatement[] => {

  return [
    // Translate permissions
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'translate:TranslateText',
        'translate:DetectDominantLanguage',
      ],
      resources: ['*'],
    }),

    // Transcribe permissions
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'transcribe:StartTranscriptionJob',
        'transcribe:GetTranscriptionJob',
        'transcribe:ListTranscriptionJobs',
        'transcribe:StartStreamTranscription',
      ],
      resources: ['*'],
    }),

    // Polly permissions
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['polly:SynthesizeSpeech'],
      resources: ['*'],
    }),

    // SES permissions (for email function)
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }),

    // Comprehend permissions
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'comprehend:DetectSentiment',
        'comprehend:DetectEntities',
        'comprehend:DetectKeyPhrases',
      ],
      resources: ['*'],
    }),

    // S3 permissions
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: [`arn:aws:s3:::${bucketName}/*`],
    }),

    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [`arn:aws:s3:::${bucketName}`],
    }),

    // DynamoDB permissions
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
      ],
      resources: [
        `arn:aws:dynamodb:*:*:table/${tableName}`,
        `arn:aws:dynamodb:*:*:table/${tableName}/index/*`,
      ],
    }),

    // CloudWatch Logs
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['arn:aws:logs:*:*:*'],
    }),

    // A2I permissions (for human-in-the-loop)
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'sagemaker:CreateHumanTaskUi',
        'sagemaker:DescribeHumanTaskUi',
        'sagemaker:ListHumanTaskUis',
        'sagemaker:DeleteHumanTaskUi',
        'sagemaker:CreateFlowDefinition',
        'sagemaker:DescribeFlowDefinition',
        'sagemaker:ListFlowDefinitions',
        'sagemaker:DeleteFlowDefinition',
        'sagemaker:StartHumanLoop',
        'sagemaker:DescribeHumanLoop',
        'sagemaker:ListHumanLoops',
        'sagemaker:StopHumanLoop',
      ],
      resources: ['*'],
    }),
  ];
};

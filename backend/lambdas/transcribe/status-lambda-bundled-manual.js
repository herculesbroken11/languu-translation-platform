// ============================================================================
// LANGUU Transcribe Status Lambda - Complete Bundled Code
// ============================================================================
// This is a bundled version for manual deployment to AWS Lambda
// Paste this entire file into the Lambda console Code source editor
// Function: languu-staging-transcribe-status
// ============================================================================

const { TranscribeClient, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

// ============================================================================
// Configuration
// ============================================================================
const region = process.env.AWS_REGION || 'us-east-1';
const stage = process.env.STAGE || 'staging';
const s3Bucket = process.env.S3_BUCKET || `languu-${stage}-media`;
const dynamoTable = process.env.DYNAMODB_TABLE || `languu-${stage}-jobs`;

// AWS Clients
const s3Client = new S3Client({ region });
const translateClient = new TranslateClient({ region });
const transcribeClient = new TranscribeClient({ region });
const dynamoDBClient = new DynamoDBClient({ region });
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoDBClient);

// ============================================================================
// Helper Functions
// ============================================================================
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT',
};

function createResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function createSuccessResponse(data) {
  return createResponse(200, { success: true, data });
}

function createErrorResponse(statusCode, message, error) {
  return createResponse(statusCode, {
    success: false,
    message,
    ...(error && { error: error instanceof Error ? error.message : String(error) }),
  });
}

function createCorsResponse() {
  return createResponse(200, {}, {});
}

// Simple logger
const logger = {
  info: (message, data) => console.log(JSON.stringify({ level: 'INFO', message, ...data, timestamp: new Date().toISOString() })),
  warn: (message, data) => console.warn(JSON.stringify({ level: 'WARN', message, ...data, timestamp: new Date().toISOString() })),
  error: (message, error, data) => console.error(JSON.stringify({ 
    level: 'ERROR', 
    message, 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...data, 
    timestamp: new Date().toISOString() 
  })),
};

// ============================================================================
// Main Handler
// ============================================================================
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    const jobId = event.pathParameters?.jobId || event.queryStringParameters?.jobId;

    if (!jobId) {
      return createErrorResponse(400, 'Job ID is required');
    }

    // Get job metadata from DynamoDB
    const getCommand = new GetCommand({
      TableName: dynamoTable,
      Key: {
        jobId, // Partition key - must match table schema
      },
    });

    const dbResult = await dynamoDocClient.send(getCommand);
    const jobMetadata = dbResult.Item;

    if (!jobMetadata) {
      return createErrorResponse(404, 'Transcription job not found');
    }

    const transcriptionJobName = jobMetadata.transcriptionJobName || `languu-${jobId}`;

    // Get transcription job status
    const getJobCommand = new GetTranscriptionJobCommand({
      TranscriptionJobName: transcriptionJobName,
    });

    const jobResult = await transcribeClient.send(getJobCommand);
    const jobStatus = jobResult.TranscriptionJob?.TranscriptionJobStatus || 'UNKNOWN';

    // If completed, get transcript and translate
    if (jobStatus === 'COMPLETED') {
      const outputKey = jobMetadata.outputKey || `transcriptions/${jobId}.json`;
      
      // Get transcript from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: outputKey,
      });

      const transcriptData = await s3Client.send(getObjectCommand);
      const transcriptBody = await transcriptData.Body?.transformToString();
      
      let transcript = '';
      let transcriptWithTimestamps = '';
      if (transcriptBody) {
        const transcriptJson = JSON.parse(transcriptBody);
        transcript = transcriptJson.results.transcripts[0]?.transcript || '';
        
        // If timestamps are requested, format transcript with timestamps
        if (jobMetadata.includeTimestamps && transcriptJson.results.items) {
          const items = transcriptJson.results.items || [];
          const timestampedItems = items.map((item) => {
            const startTime = item.start_time ? parseFloat(item.start_time) : 0;
            const hours = Math.floor(startTime / 3600);
            const minutes = Math.floor((startTime % 3600) / 60);
            const seconds = Math.floor(startTime % 60);
            const milliseconds = Math.floor((startTime % 1) * 1000);
            const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
            return `[${timeStr}] ${item.alternatives[0]?.content || ''}`;
          });
          transcriptWithTimestamps = timestampedItems.join(' ');
        }
      }

      // Translate if target language is provided (only for TRANSLATE page, not TRANSCRIBE page)
      let translatedText;
      if (jobMetadata.targetLanguage && jobMetadata.targetLanguage !== jobMetadata.sourceLanguage && transcript) {
        try {
          const translateCommand = new TranslateTextCommand({
            Text: transcript,
            SourceLanguageCode: jobMetadata.sourceLanguage === 'auto' ? 'en' : jobMetadata.sourceLanguage,
            TargetLanguageCode: jobMetadata.targetLanguage,
          });

          const translateResult = await translateClient.send(translateCommand);
          translatedText = translateResult.TranslatedText;
        } catch (error) {
          logger.warn('Translation failed', { error });
        }
      }
      
      // Use timestamped version if available, otherwise use plain transcript
      const finalTranscript = transcriptWithTimestamps || transcript;

      // Update DynamoDB with completed status
      await dynamoDocClient.send(new UpdateCommand({
        TableName: dynamoTable,
        Key: {
          jobId, // Partition key - must match table schema
        },
        UpdateExpression: 'SET #status = :status, transcript = :transcript, translatedText = :translatedText, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'COMPLETED',
          ':transcript': finalTranscript,
          ':translatedText': translatedText || null,
          ':updatedAt': new Date().toISOString(),
        },
      }));

      return createSuccessResponse({
        jobId,
        status: 'COMPLETED',
        transcript: finalTranscript,
        ...(translatedText && { translatedText }),
      });
    }

    if (jobStatus === 'FAILED') {
      const failureReason = jobResult.TranscriptionJob?.FailureReason || 'Unknown error';
      return createSuccessResponse({
        jobId,
        status: 'FAILED',
        error: failureReason,
      });
    }

    // Still in progress
    return createSuccessResponse({
      jobId,
      status: 'IN_PROGRESS',
      message: 'Transcription is still processing',
    });
  } catch (error) {
    logger.error('Failed to get transcription status', error);
    return createErrorResponse(
      500,
      'Failed to get transcription status. Please try again.',
      error
    );
  }
};

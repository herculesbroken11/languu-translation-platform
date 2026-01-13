// ============================================================================
// LANGUU Transcribe Lambda - Complete Bundled Code
// ============================================================================
// This is a bundled version for manual deployment to AWS Lambda
// Paste this entire file into the Lambda console Code source editor
// Function: languu-staging-transcribe
// ============================================================================

const { S3Client } = require('@aws-sdk/client-s3');
const { TranscribeClient, StartTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// Configuration
// ============================================================================
const region = process.env.AWS_REGION || 'us-east-1';
const stage = process.env.STAGE || 'staging';
const s3Bucket = process.env.S3_BUCKET || `languu-${stage}-media`;
const dynamoTable = process.env.DYNAMODB_TABLE || `languu-${stage}-jobs`;

// AWS Clients
const s3Client = new S3Client({ region });
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
// Language Code Mapping
// ============================================================================
function mapLanguageToTranscribeLocale(langCode) {
  const localeMap = {
    'en': 'en-US',
    'es': 'es-US',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-BR',
    'ru': 'ru-RU',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA',
    'hi': 'hi-IN',
    'nl': 'nl-NL',
    'pl': 'pl-PL',
    'tr': 'tr-TR',
    'sv': 'sv-SE',
    'da': 'da-DK',
    'no': 'no-NO',
    'fi': 'fi-FI',
  };
  
  // If already a locale code (contains '-'), return as is
  if (langCode.includes('-')) {
    return langCode;
  }
  
  // Map to locale or default to en-US
  return localeMap[langCode] || 'en-US';
}

// ============================================================================
// Main Handler
// ============================================================================
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    // Parse JSON request
    let request;
    try {
      request = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    // Validate request
    if (!request.fileKey) {
      return createErrorResponse(400, 'File key is required');
    }

    if (!request.sourceLanguage) {
      return createErrorResponse(400, 'Source language is required');
    }

    logger.info('Transcription request received', {
      fileKey: request.fileKey,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      includeTimestamps: request.includeTimestamps,
    });

    const jobId = uuidv4();
    const outputKey = `transcriptions/${jobId}.json`;

    // Start transcription job
    // Convert file extension to lowercase (Transcribe requires lowercase)
    const fileExtension = (request.fileKey.split('.').pop()?.toLowerCase() || 'mp3');
    
    // Map language code to Transcribe locale format
    const languageCode = request.sourceLanguage === 'auto' 
      ? 'en-US' 
      : mapLanguageToTranscribeLocale(request.sourceLanguage);
    
    const transcriptionCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: `languu-${jobId}`,
      Media: {
        MediaFileUri: `s3://${s3Bucket}/${request.fileKey}`,
      },
      MediaFormat: fileExtension,
      LanguageCode: languageCode,
      OutputBucketName: s3Bucket,
      OutputKey: outputKey,
      Settings: {
        ShowSpeakerLabels: false,
        ShowAlternatives: true, // Required when MaxAlternatives is set
        MaxAlternatives: 2, // Must be >= 2
        // Timestamps are included by default in Transcribe output JSON
      },
    });

    await transcribeClient.send(transcriptionCommand);

    // Store job info in DynamoDB for status tracking
    await dynamoDocClient.send(new PutCommand({
      TableName: dynamoTable,
      Item: {
        jobId, // Partition key - must match table schema
        fileKey: request.fileKey,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        includeTimestamps: request.includeTimestamps || false,
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        transcriptionJobName: `languu-${jobId}`,
        outputKey,
        jobType: 'TRANSCRIBE', // For filtering/querying
      },
    }));

    // Return immediately - transcription is async and will take time
    logger.info('Transcription job started', { jobId, transcriptionJobName: `languu-${jobId}` });

    return createSuccessResponse({
      jobId,
      status: 'IN_PROGRESS',
      message: 'Transcription job started. It may take several minutes to complete.',
    });
  } catch (error) {
    logger.error('Transcription failed', error);
    return createErrorResponse(
      500,
      'Transcription failed. Please try again.',
      error
    );
  }
};

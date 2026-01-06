import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { TranscriptionRequest, TranscriptionResponse } from '../../shared/types';
import { awsConfig, resourceNames, s3Client, translateClient, transcribeClient, dynamoDocClient } from '../../shared/config/aws';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ function: 'transcribe' });

// Map language codes to Transcribe-compatible locale codes
const mapLanguageToTranscribeLocale = (langCode: string): string => {
  const localeMap: Record<string, string> = {
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
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    // Parse multipart form data or JSON
    let request: TranscriptionRequest;
    try {
      request = JSON.parse(event.body);
    } catch {
      // If not JSON, assume it's form data (handled by API Gateway)
      const body = event.body;
      // In production, use a proper multipart parser
      return createErrorResponse(400, 'Multipart form data parsing not implemented in this handler');
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
    });

    const jobId = uuidv4();
    const outputKey = `transcriptions/${jobId}.json`;

    // Start transcription job
    // Convert file extension to lowercase (Transcribe requires lowercase)
    const fileExtension = (request.fileKey.split('.').pop()?.toLowerCase() || 'mp3') as any;
    
    // Map language code to Transcribe locale format
    const languageCode = request.sourceLanguage === 'auto' 
      ? 'en-US' 
      : mapLanguageToTranscribeLocale(request.sourceLanguage);
    
    const transcriptionCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: `languu-${jobId}`,
      Media: {
        MediaFileUri: `s3://${resourceNames.s3Bucket}/${request.fileKey}`,
      },
      MediaFormat: fileExtension,
      LanguageCode: languageCode as any,
      OutputBucketName: resourceNames.s3Bucket,
      OutputKey: outputKey,
      Settings: {
        ShowSpeakerLabels: false,
        ShowAlternatives: true, // Required when MaxAlternatives is set
        MaxAlternatives: 2, // Must be >= 2
      },
    });

    await transcribeClient.send(transcriptionCommand);

    // Store job info in DynamoDB for status tracking
    await dynamoDocClient.send(new PutCommand({
      TableName: resourceNames.dynamoTable,
      Item: {
        jobId, // Partition key - must match table schema
        fileKey: request.fileKey,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        transcriptionJobName: `languu-${jobId}`,
        outputKey,
        jobType: 'TRANSCRIBE', // For filtering/querying
      },
    }));

    // Return immediately - transcription is async and will take time
    // Frontend should poll for status or we can use EventBridge to notify when complete
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

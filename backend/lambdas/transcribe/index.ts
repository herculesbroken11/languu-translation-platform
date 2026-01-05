import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { TranscriptionRequest, TranscriptionResponse } from '../../shared/types';
import { awsConfig, resourceNames, s3Client, translateClient, transcribeClient } from '../../shared/config/aws';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ function: 'transcribe' });

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
    const transcriptionCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: `languu-${jobId}`,
      Media: {
        MediaFileUri: `s3://${resourceNames.s3Bucket}/${request.fileKey}`,
      },
      MediaFormat: request.fileKey.split('.').pop()?.toUpperCase() || 'MP3',
      LanguageCode: request.sourceLanguage === 'auto' ? 'en-US' : request.sourceLanguage,
      OutputBucketName: resourceNames.s3Bucket,
      OutputKey: outputKey,
      Settings: {
        ShowSpeakerLabels: false,
        MaxAlternatives: 1,
      },
    });

    await transcribeClient.send(transcriptionCommand);

    // Poll for completion (in production, use SQS/EventBridge for async processing)
    let jobStatus = 'IN_PROGRESS';
    let transcript = '';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (jobStatus === 'IN_PROGRESS' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const getJobCommand = new GetTranscriptionJobCommand({
        TranscriptionJobName: `languu-${jobId}`,
      });

      const jobResult = await transcribeClient.send(getJobCommand);
      jobStatus = jobResult.TranscriptionJob?.TranscriptionJobStatus || 'FAILED';

      if (jobStatus === 'COMPLETED') {
        // Get transcript from S3
        const getObjectCommand = new GetObjectCommand({
          Bucket: resourceNames.s3Bucket,
          Key: outputKey,
        });

        const transcriptData = await s3Client.send(getObjectCommand);
        const transcriptBody = await transcriptData.Body?.transformToString();
        if (transcriptBody) {
          const transcriptJson = JSON.parse(transcriptBody);
          transcript = transcriptJson.results.transcripts[0]?.transcript || '';
        }
        break;
      }

      if (jobStatus === 'FAILED') {
        throw new Error('Transcription job failed');
      }

      attempts++;
    }

    if (!transcript) {
      throw new Error('Transcription completed but no transcript found');
    }

    // Translate if target language is provided
    let translatedText: string | undefined;
    if (request.targetLanguage && request.targetLanguage !== request.sourceLanguage) {
      try {
        const translateCommand = new TranslateTextCommand({
          Text: transcript,
          SourceLanguageCode: request.sourceLanguage === 'auto' ? 'en' : request.sourceLanguage,
          TargetLanguageCode: request.targetLanguage,
        });

        const translateResult = await translateClient.send(translateCommand);
        translatedText = translateResult.TranslatedText;
      } catch (error) {
        logger.warn('Translation failed', { error });
        // Continue without translation
      }
    }

    const response: TranscriptionResponse = {
      transcript,
      ...(translatedText && { translatedText }),
      jobId,
    };

    logger.info('Transcription completed successfully', { jobId });

    return createSuccessResponse(response);
  } catch (error) {
    logger.error('Transcription failed', error);
    return createErrorResponse(
      500,
      'Transcription failed. Please try again.',
      error
    );
  }
};

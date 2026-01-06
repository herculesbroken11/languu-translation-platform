import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TranscribeClient, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { resourceNames, s3Client, translateClient, transcribeClient, dynamoDocClient } from '../../shared/config/aws';

const logger = new Logger({ function: 'transcribe-status' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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
      TableName: resourceNames.dynamoTable,
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
        Bucket: resourceNames.s3Bucket,
        Key: outputKey,
      });

      const transcriptData = await s3Client.send(getObjectCommand);
      const transcriptBody = await transcriptData.Body?.transformToString();
      
      let transcript = '';
      if (transcriptBody) {
        const transcriptJson = JSON.parse(transcriptBody);
        transcript = transcriptJson.results.transcripts[0]?.transcript || '';
      }

      // Translate if target language is provided
      let translatedText: string | undefined;
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

      // Update DynamoDB with completed status
      await dynamoDocClient.send(new UpdateCommand({
        TableName: resourceNames.dynamoTable,
        Key: {
          jobId, // Partition key - must match table schema
        },
        UpdateExpression: 'SET #status = :status, transcript = :transcript, translatedText = :translatedText, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'COMPLETED',
          ':transcript': transcript,
          ':translatedText': translatedText || null,
          ':updatedAt': new Date().toISOString(),
        },
      }));

      return createSuccessResponse({
        jobId,
        status: 'COMPLETED',
        transcript,
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

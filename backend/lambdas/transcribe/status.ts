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
      let transcriptWithTimestamps = '';
      if (transcriptBody) {
        const transcriptJson = JSON.parse(transcriptBody);
        transcript = transcriptJson.results.transcripts[0]?.transcript || '';
        
        // If timestamps are requested, format transcript with timestamps
        // Group items by sentences/phrases for cleaner output
        if (jobMetadata.includeTimestamps && transcriptJson.results.items) {
          const items = transcriptJson.results.items || [];
          const timestampedSegments: string[] = [];
          let currentSegment = '';
          let segmentStartTime: number | null = null;
          
          for (const item of items) {
            const content = item.alternatives[0]?.content || '';
            const punctuation = content.match(/[.,!?;:]/);
            
            // Start new segment if this is the first item or if we hit punctuation
            if (segmentStartTime === null) {
              segmentStartTime = item.start_time ? parseFloat(item.start_time) : 0;
              currentSegment = content;
            } else {
              currentSegment += ' ' + content;
            }
            
            // If we hit punctuation or end of items, finalize this segment
            if (punctuation || item === items[items.length - 1]) {
              if (segmentStartTime !== null) {
                // Round up to nearest second (no milliseconds)
                const roundedTime = Math.ceil(segmentStartTime);
                const hours = Math.floor(roundedTime / 3600);
                const minutes = Math.floor((roundedTime % 3600) / 60);
                const seconds = Math.floor(roundedTime % 60);
                const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                timestampedSegments.push(`[${timeStr}] ${currentSegment.trim()}`);
              }
              currentSegment = '';
              segmentStartTime = null;
            }
          }
          
          transcriptWithTimestamps = timestampedSegments.join(' ');
        }
      }

      // Translate if target language is provided (only for TRANSLATE page, not TRANSCRIBE page)
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
      
      // Use timestamped version if available, otherwise use plain transcript
      const finalTranscript = transcriptWithTimestamps || transcript;

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

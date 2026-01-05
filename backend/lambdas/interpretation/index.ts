import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { ComprehendClient, DetectSentimentCommand } from '@aws-sdk/client-comprehend';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { InterpretationRequest, InterpretationResponse } from '../../shared/types';
import { awsConfig, translateClient, comprehendClient } from '../../shared/config/aws';

const logger = new Logger({ function: 'interpretation' });

// In production, this would use WebSocket API or EventSource for streaming
// This is a simplified version for HTTP streaming via Server-Sent Events

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    const sourceLanguage = event.queryStringParameters?.sourceLanguage || 'en';
    const targetLanguage = event.queryStringParameters?.targetLanguage || 'es';

    if (!sourceLanguage || !targetLanguage) {
      return createErrorResponse(400, 'Source and target languages are required');
    }

    logger.info('Interpretation stream started', {
      sourceLanguage,
      targetLanguage,
    });

    // Note: This is a simplified handler
    // In production, you would:
    // 1. Use WebSocket API Gateway for bidirectional streaming
    // 2. Use Amazon Transcribe Streaming for real-time transcription
    // 3. Process audio chunks continuously
    // 4. Use Comprehend for NLP classification
    // 5. Trigger A2I for human review when confidence is low

    // For now, return a response indicating the stream should be established
    // The actual streaming would be handled by a WebSocket connection

    return createErrorResponse(
      501,
      'Real-time interpretation streaming requires WebSocket API. This endpoint is for demonstration purposes.'
    );
  } catch (error) {
    logger.error('Interpretation failed', error);
    return createErrorResponse(
      500,
      'Interpretation failed. Please try again.',
      error
    );
  }
};

// Helper function for processing interpretation chunks (would be used in WebSocket handler)
export async function processInterpretationChunk(
  transcript: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<InterpretationResponse> {
  try {
    // Translate
    const translateCommand = new TranslateTextCommand({
      Text: transcript,
      SourceLanguageCode: sourceLanguage,
      TargetLanguageCode: targetLanguage,
    });

    const translateResult = await translateClient.send(translateCommand);
    const translatedText = translateResult.TranslatedText || '';

    // Analyze sentiment/confidence
    const sentimentCommand = new DetectSentimentCommand({
      Text: transcript,
      LanguageCode: sourceLanguage,
    });

    const sentimentResult = await comprehendClient.send(sentimentCommand);
    const confidence = sentimentResult.SentimentScore?.Positive || 0.5;
    const needsHumanReview = confidence < 0.7; // Threshold for human review

    return {
      transcript,
      translatedText,
      confidence,
      needsHumanReview,
    };
  } catch (error) {
    logger.error('Failed to process interpretation chunk', error);
    throw error;
  }
}

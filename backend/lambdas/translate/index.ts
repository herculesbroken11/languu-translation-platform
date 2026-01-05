import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { TranslationRequest, TranslationResponse } from '../../shared/types';
import { awsConfig } from '../../shared/config/aws';

const logger = new Logger({ function: 'translate' });
const translateClient = new TranslateClient({ region: awsConfig.region });

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

    const request: TranslationRequest = JSON.parse(event.body);

    // Validate request
    if (!request.text || !request.text.trim()) {
      return createErrorResponse(400, 'Text is required');
    }

    if (!request.targetLanguage) {
      return createErrorResponse(400, 'Target language is required');
    }

    if (request.sourceLanguage === request.targetLanguage && request.sourceLanguage !== 'auto') {
      return createErrorResponse(400, 'Source and target languages must be different');
    }

    logger.info('Translation request received', {
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      textLength: request.text.length,
    });

    // Detect language if auto
    let sourceLanguage = request.sourceLanguage;
    if (sourceLanguage === 'auto') {
      try {
        // Use Amazon Translate's auto-detection
        const detectCommand = new TranslateTextCommand({
          Text: request.text.substring(0, 100), // Sample for detection
          SourceLanguageCode: 'auto',
          TargetLanguageCode: request.targetLanguage,
        });
        const detectResult = await translateClient.send(detectCommand);
        sourceLanguage = detectResult.SourceLanguageCode || 'en';
        logger.info('Language detected', { detectedLanguage: sourceLanguage });
      } catch (error) {
        logger.warn('Language detection failed, defaulting to English', { error });
        sourceLanguage = 'en';
      }
    }

    // Translate text
    const translateCommand = new TranslateTextCommand({
      Text: request.text,
      SourceLanguageCode: sourceLanguage,
      TargetLanguageCode: request.targetLanguage,
    });

    const result = await translateClient.send(translateCommand);

    const response: TranslationResponse = {
      translatedText: result.TranslatedText || '',
      ...(request.sourceLanguage === 'auto' && { detectedLanguage: sourceLanguage }),
    };

    logger.info('Translation completed successfully', {
      sourceLanguage,
      targetLanguage: request.targetLanguage,
    });

    return createSuccessResponse(response);
  } catch (error) {
    logger.error('Translation failed', error);
    return createErrorResponse(
      500,
      'Translation failed. Please try again.',
      error
    );
  }
};

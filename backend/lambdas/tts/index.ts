import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PollyClient, SynthesizeSpeechCommand, LanguageCode } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { TTSRequest, TTSResponse } from '../../shared/types';
import { awsConfig, resourceNames, pollyClient, s3Client } from '../../shared/config/aws';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ function: 'tts' });

// Helper to map short language codes to Polly's full locale codes
const mapToPollyLanguageCode = (langCode: string): LanguageCode => {
  const mapping: Record<string, LanguageCode> = {
    'en': LanguageCode.EN_US, // Default to US English
    'es': LanguageCode.ES_ES, // Default to Spain Spanish
    'fr': LanguageCode.FR_FR, // Default to France French
    'de': LanguageCode.DE_DE, // Default to Germany German
    'it': LanguageCode.IT_IT,
    'pt': LanguageCode.PT_BR, // Default to Brazilian Portuguese
    'ru': LanguageCode.RU_RU,
    'ja': LanguageCode.JA_JP,
    'ko': LanguageCode.KO_KR,
    'zh': LanguageCode.CMN_CN, // Chinese (Mandarin) - Simplified
    'ar': LanguageCode.ARB, // Arabic (arb is the code for Arabic)
    'hi': LanguageCode.HI_IN,
    'nl': LanguageCode.NL_NL,
    'pl': LanguageCode.PL_PL,
    'tr': LanguageCode.TR_TR,
    'sv': LanguageCode.SV_SE,
    'da': LanguageCode.DA_DK,
    'no': LanguageCode.NB_NO, // Norwegian Bokmål
    'fi': LanguageCode.FI_FI,
    // Add more mappings as needed
  };
  return mapping[langCode] || LanguageCode.EN_US; // Default to en-US
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

    const request: TTSRequest = JSON.parse(event.body);

    // Validate request
    if (!request.text || !request.text.trim()) {
      return createErrorResponse(400, 'Text is required');
    }

    if (!request.language) {
      return createErrorResponse(400, 'Language is required');
    }

    if (!request.voiceId) {
      return createErrorResponse(400, 'Voice ID is required');
    }

    logger.info('TTS request received', {
      language: request.language,
      voiceId: request.voiceId,
      textLength: request.text.length,
    });

    // Map short language code to Polly's full locale code
    const pollyLanguageCode = mapToPollyLanguageCode(request.language);

    // Synthesize speech
    const synthesizeCommand = new SynthesizeSpeechCommand({
      Text: request.text,
      OutputFormat: 'mp3',
      VoiceId: request.voiceId as any, // Type assertion for voice ID
      LanguageCode: pollyLanguageCode, // Use mapped language code
      Engine: 'neural', // Use neural engine for better quality
    });

    const synthesizeResult = await pollyClient.send(synthesizeCommand);

    if (!synthesizeResult.AudioStream) {
      throw new Error('No audio stream returned from Polly');
    }

    // Convert stream to buffer
    const audioBuffer = await synthesizeResult.AudioStream.transformToByteArray();

    // Upload to S3
    const jobId = uuidv4();
    const audioKey = `tts/${jobId}.mp3`;

    const putObjectCommand = new PutObjectCommand({
      Bucket: resourceNames.s3Bucket,
      Key: audioKey,
      Body: Buffer.from(audioBuffer),
      ContentType: 'audio/mpeg',
    });

    await s3Client.send(putObjectCommand);

    // Generate presigned URL for access (expires in 1 hour)
    const getObjectCommand = new GetObjectCommand({
      Bucket: resourceNames.s3Bucket,
      Key: audioKey,
    });

    const expiresIn = 3600; // 1 hour
    const audioUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn });

    const response: TTSResponse = {
      audioUrl,
      jobId,
    };

    logger.info('TTS completed successfully', { jobId });

    return createSuccessResponse(response);
  } catch (error) {
    logger.error('TTS failed', error);
    return createErrorResponse(
      500,
      'Text-to-speech synthesis failed. Please try again.',
      error
    );
  }
};

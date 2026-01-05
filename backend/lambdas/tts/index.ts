import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { TTSRequest, TTSResponse } from '../../shared/types';
import { awsConfig, resourceNames, pollyClient, s3Client } from '../../shared/config/aws';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ function: 'tts' });

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

    // Synthesize speech
    const synthesizeCommand = new SynthesizeSpeechCommand({
      Text: request.text,
      OutputFormat: 'mp3',
      VoiceId: request.voiceId,
      LanguageCode: request.language,
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

    // Generate presigned URL for access
    const audioUrl = `https://${resourceNames.s3Bucket}.s3.${awsConfig.region}.amazonaws.com/${audioKey}`;

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

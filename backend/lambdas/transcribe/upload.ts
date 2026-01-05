import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { awsConfig, resourceNames, s3Client } from '../../shared/config/aws';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ function: 'transcribe-upload' });

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

    const { fileName, contentType } = JSON.parse(event.body);

    if (!fileName) {
      return createErrorResponse(400, 'File name is required');
    }

    const fileKey = `uploads/${uuidv4()}-${fileName}`;
    const expiresIn = 3600; // 1 hour

    const putObjectCommand = new PutObjectCommand({
      Bucket: resourceNames.s3Bucket,
      Key: fileKey,
      ContentType: contentType || 'application/octet-stream',
    });

    const presignedUrl = await getSignedUrl(s3Client, putObjectCommand, { expiresIn });

    logger.info('Presigned URL generated', { fileKey });

    return createSuccessResponse({
      uploadUrl: presignedUrl,
      fileKey,
      expiresIn,
    });
  } catch (error) {
    logger.error('Failed to generate presigned URL', error);
    return createErrorResponse(
      500,
      'Failed to generate upload URL. Please try again.',
      error
    );
  }
};

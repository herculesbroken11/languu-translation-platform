import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { awsConfig, resourceNames, s3Client, translateClient } from '../../shared/config/aws';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDocClient } from '../../shared/config/aws';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ function: 'document-translation' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    const path = event.path || '';
    const method = event.httpMethod;

    // Upload document
    if (method === 'POST' && path.includes('/upload')) {
      return await uploadDocument(event);
    }

    // Start translation
    if (method === 'POST' && path.includes('/translate')) {
      return await startTranslation(event);
    }

    // Get translation status
    if (method === 'GET' && path.includes('/status/')) {
      const jobId = path.split('/status/')[1];
      return await getTranslationStatus(jobId);
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    logger.error('Document translation handler failed', error);
    return createErrorResponse(500, 'Internal server error', error);
  }
};

async function uploadDocument(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const { fileName, contentType, fileKey } = JSON.parse(event.body);

    if (!fileName || !fileKey) {
      return createErrorResponse(400, 'File name and key are required');
    }

    const jobId = uuidv4();
    const documentKey = `documents/${jobId}/${fileName}`;

    // Create translation job record
    await dynamoDocClient.send(new PutCommand({
      TableName: resourceNames.dynamoTable,
      Item: {
        pk: `DOCUMENT#${jobId}`,
        sk: 'METADATA',
        jobId,
        fileName,
        fileKey: documentKey,
        contentType: contentType || 'application/pdf',
        status: 'uploaded',
        createdAt: new Date().toISOString(),
      },
    }));

    return createSuccessResponse({
      jobId,
      documentKey,
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    logger.error('Failed to upload document', error);
    return createErrorResponse(500, 'Failed to upload document', error);
  }
}

async function startTranslation(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const { jobId, sourceLanguage, targetLanguage } = JSON.parse(event.body);

    if (!jobId || !sourceLanguage || !targetLanguage) {
      return createErrorResponse(400, 'Job ID, source language, and target language are required');
    }

    // Get document metadata
    const getCommand = new QueryCommand({
      TableName: resourceNames.dynamoTable,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `DOCUMENT#${jobId}`,
        ':sk': 'METADATA',
      },
    });

    const docResult = await dynamoDocClient.send(getCommand);
    if (!docResult.Items || docResult.Items.length === 0) {
      return createErrorResponse(404, 'Document not found');
    }

    const document = docResult.Items[0];
    const fileKey = document.fileKey;

    // Extract text from document
    let extractedText = '';
    
    if (document.contentType?.includes('pdf') || document.contentType?.includes('image')) {
      // Use Textract for PDF/image text extraction
      const textractClient = new TextractClient({ region: awsConfig.region });
      const textractCommand = new DetectDocumentTextCommand({
        Document: {
          S3Object: {
            Bucket: resourceNames.s3Bucket,
            Name: fileKey,
          },
        },
      });

      const textractResult = await textractClient.send(textractCommand);
      extractedText = textractResult.Blocks
        ?.filter((block) => block.BlockType === 'LINE')
        .map((block) => block.Text)
        .join('\n') || '';
    } else {
      // For text files, read directly from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: resourceNames.s3Bucket,
        Key: fileKey,
      });

      const s3Object = await s3Client.send(getObjectCommand);
      extractedText = await s3Object.Body?.transformToString() || '';
    }

    if (!extractedText) {
      return createErrorResponse(400, 'Could not extract text from document');
    }

    // Translate text
    const translateCommand = new TranslateTextCommand({
      Text: extractedText,
      SourceLanguageCode: sourceLanguage,
      TargetLanguageCode: targetLanguage,
    });

    const translateResult = await translateClient.send(translateCommand);
    const translatedText = translateResult.TranslatedText || '';

    // Store translation
    const translationKey = `translations/${jobId}/translated.txt`;
    await s3Client.send(new PutObjectCommand({
      Bucket: resourceNames.s3Bucket,
      Key: translationKey,
      Body: translatedText,
      ContentType: 'text/plain',
    }));

    // Update job status and trigger A2I review
    await dynamoDocClient.send(new UpdateCommand({
      TableName: resourceNames.dynamoTable,
      Key: {
        pk: `DOCUMENT#${jobId}`,
        sk: 'METADATA',
      },
      UpdateExpression: 'SET #status = :status, #translatedTextKey = :translatedTextKey, #translatedAt = :translatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#translatedTextKey': 'translatedTextKey',
        '#translatedAt': 'translatedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'pending_review',
        ':translatedTextKey': translationKey,
        ':translatedAt': new Date().toISOString(),
      },
    }));

    // Trigger A2I workflow for human review
    await triggerA2IReview(jobId, extractedText, translatedText, sourceLanguage, targetLanguage);

    return createSuccessResponse({
      jobId,
      status: 'pending_review',
      message: 'Translation completed, pending human review',
      translatedTextKey: translationKey,
    });
  } catch (error) {
    logger.error('Failed to start translation', error);
    return createErrorResponse(500, 'Failed to translate document', error);
  }
}

async function triggerA2IReview(
  jobId: string,
  originalText: string,
  translatedText: string,
  sourceLanguage: string,
  targetLanguage: string
) {
  try {
    // Create A2I task in DynamoDB
    await dynamoDocClient.send(new PutCommand({
      TableName: resourceNames.dynamoTable,
      Item: {
        pk: `A2I#${jobId}`,
        sk: 'TASK',
        jobId,
        originalText: originalText.substring(0, 5000), // Limit for DynamoDB
        translatedText: translatedText.substring(0, 5000),
        sourceLanguage,
        targetLanguage,
        status: 'pending',
        createdAt: new Date().toISOString(),
        type: 'document_translation',
      },
    }));

    // In production, this would:
    // 1. Create Amazon A2I human loop
    // 2. Send notification to reviewers
    // 3. Set up review workflow

    logger.info('A2I review triggered', { jobId });
  } catch (error) {
    logger.error('Failed to trigger A2I review', error);
  }
}

async function getTranslationStatus(jobId: string): Promise<APIGatewayProxyResult> {
  try {
    const queryCommand = new QueryCommand({
      TableName: resourceNames.dynamoTable,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `DOCUMENT#${jobId}`,
        ':sk': 'METADATA',
      },
    });

    const result = await dynamoDocClient.send(queryCommand);

    if (!result.Items || result.Items.length === 0) {
      return createErrorResponse(404, 'Translation job not found');
    }

    return createSuccessResponse(result.Items[0]);
  } catch (error) {
    logger.error('Failed to get translation status', error);
    return createErrorResponse(500, 'Failed to fetch translation status', error);
  }
}

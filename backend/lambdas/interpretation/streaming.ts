import { APIGatewayProxyWebsocketEventV2, Context } from 'aws-lambda';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { ComprehendClient, DetectSentimentCommand, ClassifyDocumentCommand } from '@aws-sdk/client-comprehend';
import { Logger } from '../../shared/utils/logger';
import { awsConfig, translateClient, comprehendClient } from '../../shared/config/aws';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDocClient, resourceNames } from '../../shared/config/aws';

const logger = new Logger({ function: 'interpretation-streaming' });

// Store active connections
const activeConnections = new Map<string, {
  sourceLanguage: string;
  targetLanguage: string;
  sessionId: string;
}>();

export const connectHandler = async (
  event: APIGatewayProxyWebsocketEventV2,
  context: Context
): Promise<{ statusCode: number }> => {
  const connectionId = event.requestContext.connectionId!;
  
  // Parse query string from event (WebSocket V2 may have queryString in requestContext)
  const queryString = (event as any).queryStringParameters || {};
  
  const sourceLanguage = (queryString.sourceLanguage as string) || 'en';
  const targetLanguage = (queryString.targetLanguage as string) || 'es';
  const sessionId = (queryString.sessionId as string) || `session-${Date.now()}`;

  activeConnections.set(connectionId, {
    sourceLanguage,
    targetLanguage,
    sessionId,
  });

  // Store session in DynamoDB
  try {
    await dynamoDocClient.send(new PutCommand({
      TableName: resourceNames.dynamoTable,
      Item: {
        pk: `SESSION#${sessionId}`,
        sk: `CONNECTION#${connectionId}`,
        connectionId,
        sourceLanguage,
        targetLanguage,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    }));
  } catch (error) {
    logger.error('Failed to store session', error);
  }

  logger.info('WebSocket connection established', { connectionId, sessionId });
  
  return { statusCode: 200 };
};

export const disconnectHandler = async (
  event: APIGatewayProxyWebsocketEventV2,
  context: Context
): Promise<{ statusCode: number }> => {
  const connectionId = event.requestContext.connectionId!;
  
  const connection = activeConnections.get(connectionId);
  if (connection) {
    // Update session status
    try {
      await dynamoDocClient.send(new PutCommand({
        TableName: resourceNames.dynamoTable,
        Item: {
          pk: `SESSION#${connection.sessionId}`,
          sk: `CONNECTION#${connectionId}`,
          connectionId,
          status: 'disconnected',
          disconnectedAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      logger.error('Failed to update session status', error);
    }
    
    activeConnections.delete(connectionId);
  }

  logger.info('WebSocket connection disconnected', { connectionId });
  
  return { statusCode: 200 };
};

export const messageHandler = async (
  event: APIGatewayProxyWebsocketEventV2,
  context: Context
): Promise<{ statusCode: number; body?: string }> => {
  const connectionId = event.requestContext.connectionId!;
  const connection = activeConnections.get(connectionId);

  if (!connection) {
    logger.warn('Message from unknown connection', { connectionId });
    return { statusCode: 400, body: JSON.stringify({ error: 'Connection not found' }) };
  }

  try {
    const message = JSON.parse(event.body || '{}');
    
    if (message.type === 'audio-chunk') {
      // Process audio chunk (in production, this would use Transcribe Streaming)
      // For now, we'll process text directly if provided
      if (message.text) {
        await processTextSegment(
          connectionId,
          connection.sessionId,
          message.text,
          connection.sourceLanguage,
          connection.targetLanguage
        );
      }
    } else if (message.type === 'transcript') {
      // Direct transcript processing
      await processTextSegment(
        connectionId,
        connection.sessionId,
        message.text,
        connection.sourceLanguage,
        connection.targetLanguage
      );
    }
  } catch (error) {
    logger.error('Error processing message', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Processing failed' }) };
  }

  return { statusCode: 200 };
};

async function processTextSegment(
  connectionId: string,
  sessionId: string,
  text: string,
  sourceLanguage: string,
  targetLanguage: string
) {
  try {
    // 1. Translate text
    const translateCommand = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLanguage,
      TargetLanguageCode: targetLanguage,
    });

    const translateResult = await translateClient.send(translateCommand);
    const translatedText = translateResult.TranslatedText || '';

    // 2. Classify text using Comprehend
    let classification = null;
    let confidence = 1.0;
    let needsHumanReview = false;

    try {
      // Try custom classifier first, fallback to sentiment
      const classifyCommand = new ClassifyDocumentCommand({
        Text: text,
        EndpointArn: process.env.COMPREHEND_ENDPOINT_ARN, // Set in environment
      });

      const classifyResult = await comprehendClient.send(classifyCommand);
      if (classifyResult.Classes && classifyResult.Classes.length > 0) {
        classification = classifyResult.Classes[0].Name;
        confidence = classifyResult.Classes[0].Score || 0.5;
      }
    } catch (error) {
      // Fallback to sentiment analysis
      logger.debug('Custom classifier not available, using sentiment', { error });
      const sentimentCommand = new DetectSentimentCommand({
        Text: text,
        LanguageCode: sourceLanguage as any, // Type assertion for language code
      });

      const sentimentResult = await comprehendClient.send(sentimentCommand);
      classification = sentimentResult.Sentiment || 'NEUTRAL';
      confidence = sentimentResult.SentimentScore?.Positive || 0.5;
    }

    // 3. Determine if human review is needed
    const confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7');
    needsHumanReview = confidence < confidenceThreshold;

    // 4. Store segment in DynamoDB
    const segmentId = `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await dynamoDocClient.send(new PutCommand({
      TableName: resourceNames.dynamoTable,
      Item: {
        pk: `SESSION#${sessionId}`,
        sk: `SEGMENT#${segmentId}`,
        segmentId,
        text,
        translatedText,
        classification,
        confidence,
        needsHumanReview,
        status: needsHumanReview ? 'pending_review' : 'approved',
        timestamp: new Date().toISOString(),
      },
    }));

    // 5. Send result back to client (via API Gateway WebSocket)
    // Note: In production, you'd use API Gateway Management API to send messages
    const result = {
      type: 'interpretation',
      segmentId,
      text,
      translatedText,
      classification,
      confidence,
      needsHumanReview,
      timestamp: new Date().toISOString(),
    };

    // If needs human review, trigger HITL workflow
    if (needsHumanReview) {
      await triggerHITLReview(segmentId, sessionId, text, translatedText);
    }

    // Return result (in production, send via WebSocket)
    return result;
  } catch (error) {
    logger.error('Error processing text segment', error);
    throw error;
  }
}

async function triggerHITLReview(
  segmentId: string,
  sessionId: string,
  originalText: string,
  translatedText: string
) {
  try {
    // Create HITL task in DynamoDB
    await dynamoDocClient.send(new PutCommand({
      TableName: resourceNames.dynamoTable,
      Item: {
        pk: `HITL#${segmentId}`,
        sk: 'TASK',
        segmentId,
        sessionId,
        originalText,
        translatedText,
        status: 'pending',
        createdAt: new Date().toISOString(),
        priority: 'high', // Real-time interpretation
      },
    }));

    // In production, this would trigger:
    // 1. SNS notification to reviewers
    // 2. Amazon A2I workflow
    // 3. Reviewer dashboard update

    logger.info('HITL review triggered', { segmentId, sessionId });
  } catch (error) {
    logger.error('Failed to trigger HITL review', error);
  }
}

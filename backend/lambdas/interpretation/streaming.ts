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
  console.log('=== Connect Handler Started ===');
  const connectionId = event.requestContext.connectionId!;
  console.log('Connection ID:', connectionId);
  
  // Parse query string from event (WebSocket V2 may have queryString in requestContext)
  // For WebSocket V2, query parameters are in event.requestContext or event.queryStringParameters
  const queryString = event.queryStringParameters || (event as any).requestContext?.queryStringParameters || {};
  console.log('Query String:', JSON.stringify(queryString));
  
  const sourceLanguage = (queryString.sourceLanguage as string) || 'en';
  const targetLanguage = (queryString.targetLanguage as string) || 'es';
  const sessionId = (queryString.sessionId as string) || `session-${Date.now()}`;
  
  console.log('Languages:', { sourceLanguage, targetLanguage, sessionId });

  activeConnections.set(connectionId, {
    sourceLanguage,
    targetLanguage,
    sessionId,
  });

  // Store session in DynamoDB
  // Note: Using sessionId as jobId since the table requires jobId as partition key
  try {
    await dynamoDocClient.send(new PutCommand({
      TableName: resourceNames.dynamoTable,
      Item: {
        jobId: sessionId, // Use sessionId as jobId (required partition key)
        connectionId,
        sourceLanguage,
        targetLanguage,
        sessionId,
        status: 'connected',
        createdAt: new Date().toISOString(),
        itemType: 'SESSION', // Add type to distinguish from other items
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
    // Stop Transcribe Streaming
    try {
      const { stopStreamHandler } = await import('./transcribe-streaming');
      stopStreamHandler(connectionId);
    } catch (error) {
      logger.error('Failed to stop streaming', error);
    }

    // Update session status
    try {
      await dynamoDocClient.send(new PutCommand({
        TableName: resourceNames.dynamoTable,
        Item: {
          jobId: connection.sessionId, // Use sessionId as jobId (required partition key)
          connectionId,
          sessionId: connection.sessionId,
          status: 'disconnected',
          disconnectedAt: new Date().toISOString(),
          itemType: 'SESSION',
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
  console.log('=== Message Handler Started ===');
  const connectionId = event.requestContext.connectionId!;
  console.log('Connection ID:', connectionId);
  console.log('Event Body:', event.body);
  
  let connection = activeConnections.get(connectionId);
  console.log('Active Connection:', connection ? 'Found' : 'Not Found');
  console.log('Active Connections Map Size:', activeConnections.size);

  // If not in memory, create with defaults (fallback for when $connect wasn't called)
  // NOTE: This is a workaround. The proper fix is to ensure $connect route is configured in API Gateway
  if (!connection) {
    console.warn('⚠️ Connection not found in memory - $connect handler may not have been called');
    console.warn('⚠️ Creating default connection as fallback');
    
    // Create default connection
    // In production, these should come from $connect query parameters
    const sessionId = `session-${Date.now()}`;
    connection = {
      sourceLanguage: 'en', // Default - should come from $connect
      targetLanguage: 'es', // Default - should come from $connect  
      sessionId,
    };
    
    // Store in memory
    activeConnections.set(connectionId, connection);
    console.log('Created default connection:', connection);
    
    // Store in DynamoDB for persistence
    try {
      await dynamoDocClient.send(new PutCommand({
        TableName: resourceNames.dynamoTable,
        Item: {
          jobId: sessionId,
          connectionId,
          sourceLanguage: connection.sourceLanguage,
          targetLanguage: connection.targetLanguage,
          sessionId,
          status: 'active',
          createdAt: new Date().toISOString(),
          itemType: 'SESSION',
        },
      }));
      console.log('Stored connection in DynamoDB');
    } catch (dbError) {
      console.error('Failed to store connection in DynamoDB:', dbError);
      // Continue anyway - we have the connection in memory
    }
  }

  if (!connection) {
    console.warn('Message from unknown connection:', connectionId);
    logger.warn('Message from unknown connection', { connectionId });
    return { statusCode: 400, body: JSON.stringify({ error: 'Connection not found' }) };
  }

  try {
    const message = JSON.parse(event.body || '{}');
    console.log('Parsed Message:', JSON.stringify(message, null, 2));
    
    if (message.type === 'audio-chunk') {
      // Process audio chunk with Transcribe Streaming
      console.log('=== Processing Audio Chunk ===');
      console.log('Connection ID:', connectionId);
      console.log('Audio Data Length:', message.audioData?.length || 0);
      console.log('Has Audio Data:', !!message.audioData);
      
      logger.info('Audio chunk received', { 
        connectionId, 
        audioDataLength: message.audioData?.length || 0,
        hasAudioData: !!message.audioData
      });
      
      if (!message.audioData) {
        console.warn('Audio chunk missing audioData');
        logger.warn('Audio chunk missing audioData', { connectionId });
        return { statusCode: 400, body: JSON.stringify({ error: 'Audio data is required' }) };
      }

      try {
        console.log('Getting or creating Transcribe Streaming handler...');
        // Get or create Transcribe Streaming handler
        const { sendToConnection } = await import('./websocket-handler');
        const { getOrCreateStreamHandler } = await import('./transcribe-streaming');
        
        console.log('Creating handler with:', {
          connectionId,
          sourceLanguage: connection.sourceLanguage,
          targetLanguage: connection.targetLanguage,
          sessionId: connection.sessionId,
        });
        
        const streamHandler = getOrCreateStreamHandler(
          connectionId,
          connection.sourceLanguage,
          connection.targetLanguage,
          connection.sessionId,
          sendToConnection
        );

        console.log('Adding audio chunk to stream...');
        // Add audio chunk to stream
        streamHandler.addAudioChunk(message.audioData);
        
        console.log('Audio chunk added successfully');
        logger.debug('Audio chunk added to stream', { connectionId });
      } catch (error: any) {
        console.error('=== Failed to process audio chunk ===');
        console.error('Error:', error);
        console.error('Error Message:', error.message);
        console.error('Stack:', error.stack);
        logger.error('Failed to process audio chunk', { connectionId, error: error.message, stack: error.stack });
        const { sendToConnection } = await import('./websocket-handler');
        await sendToConnection(connectionId, {
          type: 'transcription-error',
          error: `Failed to process audio: ${error.message}`,
        });
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process audio chunk' }) };
      }
      
    } else if (message.type === 'transcription') {
      // Handle transcription result from Transcribe Streaming
      // This is called by the stream handler when transcription results arrive
      if (message.text && !message.isPartial) {
        // Only process complete transcripts (not partial)
        await processTextSegment(
          connectionId,
          connection.sessionId,
          message.text,
          connection.sourceLanguage,
          connection.targetLanguage
        );
      } else if (message.text && message.isPartial) {
        // Send partial transcript to frontend for real-time display
        // Partial transcripts are already sent by transcribe-streaming handler
        // This is just a fallback
        const { sendToConnection } = await import('./websocket-handler');
        await sendToConnection(connectionId, {
          type: 'transcription',
          text: message.text,
          isPartial: true,
        });
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
    } else if (message.text) {
      // Fallback: if text is provided directly, process it
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

export async function processTextSegment(
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
            jobId: `${sessionId}-${segmentId}`, // Use sessionId-segmentId as jobId (required partition key)
            segmentId,
            sessionId,
            text,
            translatedText,
            classification,
            confidence,
            needsHumanReview,
            status: needsHumanReview ? 'pending_review' : 'approved',
            timestamp: new Date().toISOString(),
            itemType: 'SEGMENT',
          },
        }));

    // 5. Send result back to client (via API Gateway WebSocket)
    const { sendToConnection } = await import('./websocket-handler');
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

    // Send result back to client via WebSocket
    await sendToConnection(connectionId, result);

    // If needs human review, trigger HITL workflow
    if (needsHumanReview) {
      await triggerHITLReview(segmentId, sessionId, text, translatedText);
    }

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

// ============================================================================
// LANGUU WebSocket Interpretation Lambda - Complete Bundled Code
// ============================================================================
// This is a bundled version for manual deployment to AWS Lambda
// Paste this entire file into the Lambda console Code source editor
// ============================================================================

// Note: aws-lambda is a TypeScript types package, not needed in JavaScript runtime
// The event object is provided by Lambda runtime automatically
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { ComprehendClient, DetectSentimentCommand, ClassifyDocumentCommand } = require('@aws-sdk/client-comprehend');
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

// ============================================================================
// Configuration
// ============================================================================
const region = process.env.AWS_REGION || 'us-east-1';
const stage = process.env.STAGE || 'staging';
const dynamoTable = process.env.DYNAMODB_TABLE || `languu-${stage}-jobs`;
const websocketEndpoint = process.env.WEBSOCKET_API_ENDPOINT || '';

// AWS Clients
const translateClient = new TranslateClient({ region });
const comprehendClient = new ComprehendClient({ region });
const transcribeStreamingClient = new TranscribeStreamingClient({ region });
const dynamoDBClient = new DynamoDBClient({ region });
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoDBClient);
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: websocketEndpoint.replace('wss://', 'https://').replace('ws://', 'http://'),
});

// ============================================================================
// Language Code Mapping
// ============================================================================
const LanguageCode = {
  EN_US: 'en-US',
  ES_US: 'es-US',
  FR_FR: 'fr-FR',
  DE_DE: 'de-DE',
  IT_IT: 'it-IT',
  PT_BR: 'pt-BR',
  RU_RU: 'ru-RU',
  JA_JP: 'ja-JP',
  KO_KR: 'ko-KR',
  ZH_CN: 'zh-CN',
  AR_SA: 'ar-SA',
  HI_IN: 'hi-IN',
  NL_NL: 'nl-NL',
  PL_PL: 'pl-PL',
  TR_TR: 'tr-TR',
  SV_SE: 'sv-SE',
  DA_DK: 'da-DK',
  NO_NO: 'no-NO',
  FI_FI: 'fi-FI',
};

const mapToTranscribeLanguageCode = (langCode) => {
  const mapping = {
    'en': LanguageCode.EN_US,
    'es': LanguageCode.ES_US,
    'fr': LanguageCode.FR_FR,
    'de': LanguageCode.DE_DE,
    'it': LanguageCode.IT_IT,
    'pt': LanguageCode.PT_BR,
    'ru': LanguageCode.RU_RU,
    'ja': LanguageCode.JA_JP,
    'ko': LanguageCode.KO_KR,
    'zh': LanguageCode.ZH_CN,
    'ar': LanguageCode.AR_SA,
    'hi': LanguageCode.HI_IN,
    'nl': LanguageCode.NL_NL,
    'pl': LanguageCode.PL_PL,
    'tr': LanguageCode.TR_TR,
    'sv': LanguageCode.SV_SE,
    'da': LanguageCode.DA_DK,
    'no': LanguageCode.NO_NO,
    'fi': LanguageCode.FI_FI,
  };
  return mapping[langCode] || LanguageCode.EN_US;
};

// ============================================================================
// Connection Management
// ============================================================================
const activeConnections = new Map();
const activeStreams = new Map();

// ============================================================================
// Helper Functions
// ============================================================================
function base64ToPCM(base64Audio) {
  try {
    const buffer = Buffer.from(base64Audio, 'base64');
    return new Uint8Array(buffer);
  } catch (error) {
    console.error('Failed to decode base64 audio', error);
    return new Uint8Array(0);
  }
}

async function sendToConnection(connectionId, data) {
  try {
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));
  } catch (error) {
    console.error('Failed to send message to connection', error);
    throw error;
  }
}

// ============================================================================
// Transcribe Streaming Handler
// ============================================================================
class TranscribeStreamingHandler {
  constructor(connectionId, sourceLanguage, targetLanguage, sessionId, sendToConnectionFn) {
    this.connectionId = connectionId;
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.sessionId = sessionId;
    this.sendToConnection = sendToConnectionFn;
    this.audioQueue = [];
    this.isStreaming = false;
    this.streamController = null;
    this.streamPromise = null;
  }

  async startStreaming() {
    console.log('=== TranscribeStreamingHandler.startStreaming() ===');
    console.log('Connection ID:', this.connectionId);
    
    if (this.isStreaming) {
      console.warn('Streaming already started');
      return;
    }

    this.isStreaming = true;
    this.streamController = new AbortController();

    this.streamPromise = this.runStreaming().catch((error) => {
      console.error('=== Streaming error ===', error);
      this.isStreaming = false;
    });
  }

  async runStreaming() {
    console.log('=== runStreaming() started ===');
    const languageCode = mapToTranscribeLanguageCode(this.sourceLanguage);
    console.log('Language Code:', languageCode);

    try {
      const command = new StartStreamTranscriptionCommand({
        LanguageCode: languageCode,
        MediaSampleRateHertz: 16000,
        MediaEncoding: 'pcm',
        AudioStream: this.createAudioStreamGenerator(),
      });

      console.log('Sending Transcribe Streaming command...');
      const response = await transcribeStreamingClient.send(command, {
        abortSignal: this.streamController?.signal,
      });

      if (response.TranscriptResultStream) {
        for await (const event of response.TranscriptResultStream) {
          if (event.TranscriptEvent?.Transcript) {
            const results = event.TranscriptEvent.Transcript.Results || [];
            
            for (const result of results) {
              if (result.Alternatives && result.Alternatives.length > 0) {
                const transcript = result.Alternatives[0].Transcript || '';
                const isPartial = result.IsPartial || false;

                console.log('Transcription result:', { transcript, isPartial });

                if (transcript) {
                  await this.sendToConnection(this.connectionId, {
                    type: 'transcription',
                    text: transcript,
                    isPartial,
                  });

                  if (!isPartial) {
                    try {
                      await processTextSegment(
                        this.connectionId,
                        this.sessionId,
                        transcript,
                        this.sourceLanguage,
                        this.targetLanguage
                      );
                    } catch (error) {
                      console.error('Failed to process complete transcript', error);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Transcribe Streaming error', error);
        await this.sendToConnection(this.connectionId, {
          type: 'transcription-error',
          error: error.message || 'Transcription failed',
        });
      }
    } finally {
      this.isStreaming = false;
    }
  }

  addAudioChunk(base64Audio) {
    console.log('=== addAudioChunk() called ===');
    this.audioQueue.push(base64Audio);
  }

  async* createAudioStreamGenerator() {
    while (this.isStreaming || this.audioQueue.length > 0) {
      if (this.audioQueue.length > 0) {
        const chunk = this.audioQueue.shift();
        if (chunk) {
          const pcmData = base64ToPCM(chunk);
          if (pcmData.length > 0) {
            yield {
              AudioEvent: {
                AudioChunk: pcmData,
              },
            };
          }
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  async stopStreaming() {
    this.isStreaming = false;
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = null;
    }
    this.audioQueue = [];
    
    if (this.streamPromise) {
      try {
        await this.streamPromise;
      } catch (error) {
        // Ignore errors when stopping
      }
    }
  }
}

function getOrCreateStreamHandler(connectionId, sourceLanguage, targetLanguage, sessionId, sendToConnectionFn) {
  if (!activeStreams.has(connectionId)) {
    const handler = new TranscribeStreamingHandler(
      connectionId,
      sourceLanguage,
      targetLanguage,
      sessionId,
      sendToConnectionFn
    );
    activeStreams.set(connectionId, handler);
    handler.startStreaming().catch((error) => {
      console.error('Failed to start streaming', error);
      activeStreams.delete(connectionId);
    });
  }
  return activeStreams.get(connectionId);
}

function stopStreamHandler(connectionId) {
  const handler = activeStreams.get(connectionId);
  if (handler) {
    handler.stopStreaming().catch((error) => {
      console.error('Error stopping stream', error);
    });
    activeStreams.delete(connectionId);
  }
}

// ============================================================================
// Text Processing
// ============================================================================
async function processTextSegment(connectionId, sessionId, text, sourceLanguage, targetLanguage) {
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
      const sentimentCommand = new DetectSentimentCommand({
        Text: text,
        LanguageCode: sourceLanguage,
      });

      const sentimentResult = await comprehendClient.send(sentimentCommand);
      classification = sentimentResult.Sentiment || 'NEUTRAL';
      confidence = sentimentResult.SentimentScore?.Positive || 0.5;
    } catch (error) {
      console.error('Sentiment analysis failed', error);
    }

    // 3. Determine if human review is needed
    const confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7');
    needsHumanReview = confidence < confidenceThreshold;

    // 4. Store segment in DynamoDB
    const segmentId = `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await dynamoDocClient.send(new PutCommand({
      TableName: dynamoTable,
      Item: {
        jobId: `${sessionId}-${segmentId}`,
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

    // 5. Send result back to client
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

    await sendToConnection(connectionId, result);

    return result;
  } catch (error) {
    console.error('Error processing text segment', error);
    throw error;
  }
}

// ============================================================================
// WebSocket Handlers
// ============================================================================
async function connectHandler(event, context) {
  console.log('=== Connect Handler Started ===');
  const connectionId = event.requestContext.connectionId;
  console.log('Connection ID:', connectionId);
  
  const queryString = event.queryStringParameters || event.requestContext?.queryStringParameters || {};
  console.log('Query String:', JSON.stringify(queryString));
  
  const sourceLanguage = queryString.sourceLanguage || 'en';
  const targetLanguage = queryString.targetLanguage || 'es';
  const sessionId = queryString.sessionId || `session-${Date.now()}`;
  
  console.log('Languages:', { sourceLanguage, targetLanguage, sessionId });

  activeConnections.set(connectionId, {
    sourceLanguage,
    targetLanguage,
    sessionId,
  });

  // Store session in DynamoDB
  try {
    await dynamoDocClient.send(new PutCommand({
      TableName: dynamoTable,
      Item: {
        jobId: sessionId,
        connectionId,
        sourceLanguage,
        targetLanguage,
        sessionId,
        status: 'connected',
        createdAt: new Date().toISOString(),
        itemType: 'SESSION',
      },
    }));
  } catch (error) {
    console.error('Failed to store session', error);
  }

  console.log('WebSocket connection established', { connectionId, sessionId });
  
  return { statusCode: 200 };
}

async function disconnectHandler(event, context) {
  const connectionId = event.requestContext.connectionId;
  
  const connection = activeConnections.get(connectionId);
  if (connection) {
    // Stop Transcribe Streaming
    try {
      stopStreamHandler(connectionId);
    } catch (error) {
      console.error('Failed to stop streaming', error);
    }

    // Update session status
    try {
      await dynamoDocClient.send(new PutCommand({
        TableName: dynamoTable,
        Item: {
          jobId: connection.sessionId,
          connectionId,
          sessionId: connection.sessionId,
          status: 'disconnected',
          disconnectedAt: new Date().toISOString(),
          itemType: 'SESSION',
        },
      }));
    } catch (error) {
      console.error('Failed to update session status', error);
    }
    
    activeConnections.delete(connectionId);
  }

  console.log('WebSocket connection disconnected', { connectionId });
  
  return { statusCode: 200 };
}

async function messageHandler(event, context) {
  console.log('=== Message Handler Started ===');
  const connectionId = event.requestContext.connectionId;
  console.log('Connection ID:', connectionId);
  console.log('Event Body:', event.body);
  
  let connection = activeConnections.get(connectionId);
  console.log('Active Connection:', connection ? 'Found' : 'Not Found');
  console.log('Active Connections Map Size:', activeConnections.size);

  // If not in memory, create with defaults (fallback for when $connect wasn't called)
  if (!connection) {
    console.warn('⚠️ Connection not found in memory - $connect handler may not have been called');
    console.warn('⚠️ Creating default connection as fallback');
    
    const sessionId = `session-${Date.now()}`;
    connection = {
      sourceLanguage: 'en',
      targetLanguage: 'es',
      sessionId,
    };
    
    activeConnections.set(connectionId, connection);
    console.log('Created default connection:', connection);
    
    // Store in DynamoDB for persistence
    try {
      await dynamoDocClient.send(new PutCommand({
        TableName: dynamoTable,
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
    }
  }

  if (!connection) {
    console.warn('Message from unknown connection:', connectionId);
    return { statusCode: 400, body: JSON.stringify({ error: 'Connection not found' }) };
  }

  try {
    const message = JSON.parse(event.body || '{}');
    console.log('Parsed Message:', JSON.stringify(message, null, 2));
    
    if (message.type === 'audio-chunk') {
      console.log('=== Processing Audio Chunk ===');
      console.log('Audio Data Length:', message.audioData?.length || 0);
      
      if (!message.audioData) {
        console.warn('Audio chunk missing audioData');
        return { statusCode: 400, body: JSON.stringify({ error: 'Audio data is required' }) };
      }

      try {
        console.log('Getting or creating Transcribe Streaming handler...');
        
        const streamHandler = getOrCreateStreamHandler(
          connectionId,
          connection.sourceLanguage,
          connection.targetLanguage,
          connection.sessionId,
          sendToConnection
        );

        console.log('Adding audio chunk to stream...');
        streamHandler.addAudioChunk(message.audioData);
        
        console.log('Audio chunk added successfully');
      } catch (error) {
        console.error('=== Failed to process audio chunk ===', error);
        await sendToConnection(connectionId, {
          type: 'transcription-error',
          error: `Failed to process audio: ${error.message}`,
        });
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process audio chunk' }) };
      }
      
    } else if (message.type === 'transcript') {
      await processTextSegment(
        connectionId,
        connection.sessionId,
        message.text,
        connection.sourceLanguage,
        connection.targetLanguage
      );
    } else if (message.text) {
      await processTextSegment(
        connectionId,
        connection.sessionId,
        message.text,
        connection.sourceLanguage,
        connection.targetLanguage
      );
    }
  } catch (error) {
    console.error('Error processing message', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Processing failed' }) };
  }

  return { statusCode: 200 };
}

// ============================================================================
// Main Lambda Handler
// ============================================================================
exports.handler = async (event, context) => {
  console.log('=== WebSocket Handler Invoked ===');
  console.log('Route Key:', event.requestContext.routeKey);
  console.log('Connection ID:', event.requestContext.connectionId);
  console.log('Request ID:', context.requestId);
  
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;

  try {
    console.log(`Processing route: ${routeKey} for connection: ${connectionId}`);
    
    switch (routeKey) {
      case '$connect':
        console.log('Handling $connect');
        return await connectHandler(event, context);
      
      case '$disconnect':
        console.log('Handling $disconnect');
        return await disconnectHandler(event, context);
      
      case '$default':
        console.log('Handling $default (message)');
        return await messageHandler(event, context);
      
      default:
        console.log(`Unknown route: ${routeKey}`);
        return { statusCode: 404, body: JSON.stringify({ error: 'Route not found' }) };
    }
  } catch (error) {
    console.error('=== WebSocket handler error ===', error);
    console.error('Stack:', error.stack);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

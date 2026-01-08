import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';
import { Logger } from '../../shared/utils/logger';
import { awsConfig } from '../../shared/config/aws';
import { LanguageCode as TranscribeLanguageCode } from '@aws-sdk/client-transcribe-streaming';

const logger = new Logger({ function: 'transcribe-streaming' });

// Create Transcribe Streaming client
const transcribeStreamingClient = new TranscribeStreamingClient({
  region: awsConfig.region,
});

// Map short language codes to Transcribe Streaming locale codes
const mapToTranscribeLanguageCode = (langCode: string): TranscribeLanguageCode => {
  const mapping: Record<string, TranscribeLanguageCode> = {
    'en': TranscribeLanguageCode.EN_US,
    'es': TranscribeLanguageCode.ES_US,
    'fr': TranscribeLanguageCode.FR_FR,
    'de': TranscribeLanguageCode.DE_DE,
    'it': TranscribeLanguageCode.IT_IT,
    'pt': TranscribeLanguageCode.PT_BR,
    'ru': TranscribeLanguageCode.RU_RU,
    'ja': TranscribeLanguageCode.JA_JP,
    'ko': TranscribeLanguageCode.KO_KR,
    'zh': TranscribeLanguageCode.ZH_CN,
    'ar': TranscribeLanguageCode.AR_SA,
    'hi': TranscribeLanguageCode.HI_IN,
    'nl': TranscribeLanguageCode.NL_NL,
    'pl': TranscribeLanguageCode.PL_PL,
    'tr': TranscribeLanguageCode.TR_TR,
    'sv': TranscribeLanguageCode.SV_SE,
    'da': TranscribeLanguageCode.DA_DK,
    'no': TranscribeLanguageCode.NO_NO,
    'fi': TranscribeLanguageCode.FI_FI,
  };
  return mapping[langCode] || TranscribeLanguageCode.EN_US;
};

// Convert base64 audio to PCM buffer (Node.js compatible)
function base64ToPCM(base64Audio: string): Uint8Array {
  try {
    // Use Buffer for Node.js (Lambda environment)
    const buffer = Buffer.from(base64Audio, 'base64');
    return new Uint8Array(buffer);
  } catch (error) {
    logger.error('Failed to decode base64 audio', error);
    return new Uint8Array(0);
  }
}

// Store active streaming sessions
// Note: In production, consider using DynamoDB or ElastiCache for persistence
const activeStreams = new Map<string, {
  handler: TranscribeStreamingHandler;
  audioQueue: string[];
}>();

export class TranscribeStreamingHandler {
  private connectionId: string;
  private sourceLanguage: string;
  private targetLanguage: string;
  private sessionId: string;
  private sendToConnection: (connectionId: string, data: any) => Promise<void>;
  private audioQueue: string[] = [];
  private isStreaming = false;
  private streamController: AbortController | null = null;
  private streamPromise: Promise<void> | null = null;

  constructor(
    connectionId: string,
    sourceLanguage: string,
    targetLanguage: string,
    sessionId: string,
    sendToConnection: (connectionId: string, data: any) => Promise<void>
  ) {
    this.connectionId = connectionId;
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.sessionId = sessionId;
    this.sendToConnection = sendToConnection;
  }

  async startStreaming(): Promise<void> {
    console.log('=== TranscribeStreamingHandler.startStreaming() ===');
    console.log('Connection ID:', this.connectionId);
    console.log('Is Streaming:', this.isStreaming);
    
    if (this.isStreaming) {
      console.warn('Streaming already started');
      logger.warn('Streaming already started', { connectionId: this.connectionId });
      return;
    }

    console.log('Starting streaming...');
    this.isStreaming = true;
    this.streamController = new AbortController();

    // Start streaming in background
    this.streamPromise = this.runStreaming().catch((error) => {
      console.error('=== Streaming error ===');
      console.error('Error:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
      logger.error('Streaming error', { connectionId: this.connectionId, error });
      this.isStreaming = false;
    });
    
    console.log('Streaming promise created');
  }

  private async runStreaming(): Promise<void> {
    console.log('=== runStreaming() started ===');
    console.log('Connection ID:', this.connectionId);
    console.log('Source Language:', this.sourceLanguage);
    
    const languageCode = mapToTranscribeLanguageCode(this.sourceLanguage);
    console.log('Mapped Language Code:', languageCode);

    logger.info('Starting Transcribe Streaming', {
      connectionId: this.connectionId,
      languageCode,
      sourceLanguage: this.sourceLanguage,
    });

    try {
      console.log('Creating StartStreamTranscriptionCommand...');
      const command = new StartStreamTranscriptionCommand({
        LanguageCode: languageCode,
        MediaSampleRateHertz: 16000, // Standard sample rate - must match frontend
        MediaEncoding: 'pcm',
        AudioStream: this.createAudioStreamGenerator(),
      });

      console.log('Sending Transcribe Streaming command to AWS...');
      logger.info('Sending Transcribe Streaming command', { connectionId: this.connectionId });
      
      const response = await transcribeStreamingClient.send(command, {
        abortSignal: this.streamController?.signal,
      });

      logger.info('Transcribe Streaming response received', { 
        connectionId: this.connectionId,
        hasTranscriptStream: !!response.TranscriptResultStream 
      });

      // Process transcription results
      if (response.TranscriptResultStream) {
        logger.info('Processing transcript result stream', { connectionId: this.connectionId });
        for await (const event of response.TranscriptResultStream) {
          logger.debug('Transcript event received', { 
            connectionId: this.connectionId,
            eventType: event.TranscriptEvent ? 'TranscriptEvent' : 'Other',
            hasTranscript: !!event.TranscriptEvent?.Transcript
          });
          
          if (event.TranscriptEvent?.Transcript) {
            const results = event.TranscriptEvent.Transcript.Results || [];
            logger.debug('Processing transcript results', { 
              connectionId: this.connectionId,
              resultCount: results.length 
            });
            
            for (const result of results) {
              if (result.Alternatives && result.Alternatives.length > 0) {
                const transcript = result.Alternatives[0].Transcript || '';
                const isPartial = result.IsPartial || false;

                logger.info('Transcription result', { 
                  connectionId: this.connectionId,
                  transcript,
                  isPartial,
                  transcriptLength: transcript.length
                });

                if (transcript) {
                  // Send transcription result to frontend
                  await this.sendToConnection(this.connectionId, {
                    type: 'transcription',
                    text: transcript,
                    isPartial,
                  });

                  // For complete transcripts, also trigger translation and processing
                  if (!isPartial) {
                    try {
                      // Import processTextSegment to handle translation
                      const { processTextSegment } = await import('./streaming');
                      await processTextSegment(
                        this.connectionId,
                        this.sessionId,
                        transcript,
                        this.sourceLanguage,
                        this.targetLanguage
                      );
                    } catch (error: any) {
                      logger.error('Failed to process complete transcript', { 
                        connectionId: this.connectionId, 
                        error: error.message 
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        logger.warn('No TranscriptResultStream in response', { connectionId: this.connectionId });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        logger.error('Transcribe Streaming error', { 
          connectionId: this.connectionId, 
          error: error.message,
          errorName: error.name,
          errorStack: error.stack,
          errorCode: error.Code,
          errorMessage: error.Message
        });
        try {
          await this.sendToConnection(this.connectionId, {
            type: 'transcription-error',
            error: error.message || error.Message || 'Transcription failed',
            errorCode: error.Code || error.name,
          });
        } catch (sendError) {
          logger.error('Failed to send error to connection', { connectionId: this.connectionId, sendError });
        }
      }
    } finally {
      this.isStreaming = false;
    }
  }

  addAudioChunk(base64Audio: string): void {
    console.log('=== addAudioChunk() called ===');
    console.log('Connection ID:', this.connectionId);
    console.log('Is Streaming:', this.isStreaming);
    console.log('Base64 Audio Length:', base64Audio?.length || 0);
    console.log('Queue Length Before:', this.audioQueue.length);
    
    this.audioQueue.push(base64Audio);
    
    console.log('Queue Length After:', this.audioQueue.length);
    console.log('Audio chunk added to queue');
  }

  private async* createAudioStreamGenerator(): AsyncIterable<{ AudioEvent: { AudioChunk: Uint8Array } }> {
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
        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  async stopStreaming(): Promise<void> {
    this.isStreaming = false;
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = null;
    }
    this.audioQueue = [];
    
    // Wait for streaming to finish
    if (this.streamPromise) {
      try {
        await this.streamPromise;
      } catch (error) {
        // Ignore errors when stopping
      }
    }
  }
}

export function getOrCreateStreamHandler(
  connectionId: string,
  sourceLanguage: string,
  targetLanguage: string,
  sessionId: string,
  sendToConnection: (connectionId: string, data: any) => Promise<void>
): TranscribeStreamingHandler {
  if (!activeStreams.has(connectionId)) {
    const handler = new TranscribeStreamingHandler(
      connectionId, 
      sourceLanguage, 
      targetLanguage,
      sessionId,
      sendToConnection
    );
    activeStreams.set(connectionId, {
      handler,
      audioQueue: [],
    });
    // Start streaming in background
    handler.startStreaming().catch((error) => {
      logger.error('Failed to start streaming', { connectionId, error });
      activeStreams.delete(connectionId);
    });
  }
  return activeStreams.get(connectionId)!.handler;
}

export function stopStreamHandler(connectionId: string): void {
  const streamData = activeStreams.get(connectionId);
  if (streamData) {
    streamData.handler.stopStreaming().catch((error) => {
      logger.error('Error stopping stream', { connectionId, error });
    });
    activeStreams.delete(connectionId);
  }
}

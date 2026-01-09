export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export class InterpretationWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  connect(sourceLanguage: string, targetLanguage: string, sessionId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const params = new URLSearchParams({
          sourceLanguage,
          targetLanguage,
          ...(sessionId && { sessionId }),
        });

        // Remove trailing slash from base URL if present
        const baseUrl = this.url.endsWith('/') ? this.url.slice(0, -1) : this.url;
        const wsUrl = `${baseUrl}?${params.toString()}`;
        console.log('=== Creating WebSocket ===');
        console.log('Full URL:', wsUrl);
        console.log('Base URL:', baseUrl);
        console.log('Query Params:', params.toString());
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket OPENED successfully');
          console.log('Ready State:', this.ws?.readyState);
          console.log('URL:', this.ws?.url);
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          console.log('📨 WebSocket message received:', event.data);
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('Parsed message:', message);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
            console.error('Raw data:', event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket ERROR event');
          console.error('Error:', error);
          console.error('Ready State:', this.ws?.readyState);
          console.error('URL:', this.ws?.url);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket CLOSED');
          console.log('Close Code:', event.code);
          console.log('Close Reason:', event.reason || '(no reason provided)');
          console.log('Was Clean:', event.wasClean);
          console.log('Ready State:', this.ws?.readyState);
          
          // Close Code 1006 = Abnormal Closure (connection closed without proper handshake)
          if (event.code === 1006) {
            console.error('❌ Close Code 1006: Connection closed abnormally');
            console.error('Possible causes:');
            console.error('1. Lambda function returned an error in $connect handler');
            console.error('2. Lambda function is not deployed or has syntax errors');
            console.error('3. IAM permissions issue');
            console.error('4. Check CloudWatch logs: /aws/lambda/languu-staging-interpretation');
            reject(new Error(`WebSocket connection failed (Code: ${event.code}). Check Lambda function logs in CloudWatch.`));
            return;
          }
          
          this.attemptReconnect(sourceLanguage, targetLanguage, sessionId);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(sourceLanguage: string, targetLanguage: string, sessionId?: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(sourceLanguage, targetLanguage, sessionId).catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const listeners = this.listeners.get(message.type) || [];
    listeners.forEach((listener) => listener(message));
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    // Check if callback already exists to prevent duplicates
    const existingCallbacks = this.listeners.get(event)!;
    if (!existingCallbacks.includes(callback)) {
      existingCallbacks.push(callback);
    }
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  sendAudioChunk(audioData: ArrayBuffer) {
    if (!this.isConnected()) {
      console.warn('Cannot send audio chunk: WebSocket not connected');
      console.warn('Ready State:', this.ws?.readyState);
      return;
    }
    
    // Convert audio to base64 for transmission
    const base64 = btoa(
      new Uint8Array(audioData)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    console.log('Sending audio chunk:', {
      audioDataSize: audioData.byteLength,
      base64Length: base64.length,
      isConnected: this.isConnected(),
    });
    
    this.send({
      type: 'audio-chunk',
      audioData: base64,
    });
  }

  sendTranscript(text: string) {
    this.send({
      type: 'transcript',
      text,
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getReadyState(): number | null {
    return this.ws?.readyState ?? null;
  }

  getUrl(): string | null {
    return this.ws?.url ?? this.url;
  }
}

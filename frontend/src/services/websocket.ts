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

        const wsUrl = `${this.url}?${params.toString()}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
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
    this.listeners.get(event)!.push(callback);
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
    // Convert audio to base64 for transmission
    const base64 = btoa(
      new Uint8Array(audioData)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
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
}

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LANGUAGES } from '@/utils/constants';
import { InterpretationWebSocket } from '@/services/websocket';

const InterpretationPanel: React.FC = () => {
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [classification, setClassification] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [needsHumanReview, setNeedsHumanReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<InterpretationWebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);

  useEffect(() => {
    return () => {
      handleStop();
    };
  }, []);

  const handleStart = async () => {
    try {
      setError(null);
      setTranscript('');
      setTranslatedText('');
      setClassification(null);
      setConfidence(null);
      setNeedsHumanReview(false);

      // Ensure we're in the browser environment
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('This feature requires a browser environment.');
      }

      // Debug: Log browser capabilities
      console.log('Browser capabilities:', {
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
        hasLegacyGetUserMedia: !!(navigator as any).getUserMedia,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        userAgent: navigator.userAgent.substring(0, 50) + '...',
      });

      let stream: MediaStream;

      // Try modern API first (navigator.mediaDevices.getUserMedia)
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } 
          });
          mediaStreamRef.current = stream;
        } catch (err) {
          // If modern API fails, try legacy fallback
          throw err; // Re-throw to be caught by outer catch
        }
      } else {
        // Fallback for older browsers or browsers without mediaDevices
        const getUserMedia = 
          (navigator as any).getUserMedia ||
          (navigator as any).webkitGetUserMedia ||
          (navigator as any).mozGetUserMedia ||
          (navigator as any).msGetUserMedia;

        if (!getUserMedia) {
          // Provide more detailed error information
          const browserInfo = {
            userAgent: navigator.userAgent,
            hasMediaDevices: !!navigator.mediaDevices,
            hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
            protocol: window.location.protocol,
            hostname: window.location.hostname,
          };
          
          console.error('Microphone API not available:', browserInfo);
          
          // Check if the issue is due to HTTP/IP address access
          const isIPAddress = /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname);
          const isHTTP = window.location.protocol === 'http:';
          const isNotLocalhost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          
          let errorMessage = 'Microphone access is not available.\n\n';
          
          if (isHTTP && (isIPAddress || isNotLocalhost)) {
            errorMessage += '⚠️ IMPORTANT: Browsers require HTTPS (or localhost) for microphone access.\n\n';
            errorMessage += 'You are currently accessing the site via:\n';
            errorMessage += `• Protocol: ${window.location.protocol}\n`;
            errorMessage += `• Hostname: ${window.location.hostname}\n\n`;
            errorMessage += 'SOLUTIONS:\n';
            errorMessage += '1. Access via localhost: http://localhost:3000\n';
            errorMessage += '2. Access via 127.0.0.1: http://127.0.0.1:3000\n';
            errorMessage += '3. Set up HTTPS for your development server\n\n';
            errorMessage += 'After changing to localhost, refresh the page and try again.';
          } else {
            errorMessage += 'Please try:\n';
            errorMessage += '1. Use a modern browser (Chrome, Firefox, Edge, Safari)\n';
            errorMessage += '2. Ensure you are accessing the site over HTTPS or localhost\n';
            errorMessage += '3. Check browser permissions for microphone access\n';
            errorMessage += '4. Try accessing via http://localhost:3000 instead of an IP address';
          }
          
          throw new Error(errorMessage);
        }

        // Use legacy API with Promise wrapper
        stream = await new Promise<MediaStream>((resolve, reject) => {
          getUserMedia.call(
            navigator,
            { audio: true },
            resolve,
            reject
          );
        });
        mediaStreamRef.current = stream;
      }

      // Set up WebSocket connection
      // IMPORTANT: Use the deployed WebSocket URL from CDK output
      // Default to the staging WebSocket URL from CDK deployment
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://hipq484as4.execute-api.us-east-1.amazonaws.com/dev';
      console.log('=== WebSocket Connection Debug ===');
      console.log('WebSocket URL:', wsUrl);
      console.log('NEXT_PUBLIC_WEBSOCKET_URL env var:', process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'NOT SET (using default)');
      console.log('Source Language:', sourceLanguage);
      console.log('Target Language:', targetLanguage);
      console.log('Session ID:', sessionIdRef.current);
      
      const ws = new InterpretationWebSocket(wsUrl);
      wsRef.current = ws;

      // Set up event listeners
      ws.on('interpretation', (data) => {
        console.log('Received interpretation:', data);
        if (data.text) {
          if (data.isPartial) {
            // Partial transcript - update in real-time
            setTranscript(data.text);
          } else {
            // Complete transcript - append
            setTranscript((prev) => {
              // Remove any partial text and add complete text
              const cleanPrev = prev.replace(/\.\.\.$/, '').trim();
              return cleanPrev ? `${cleanPrev} ${data.text}` : data.text;
            });
          }
        }
        if (data.translatedText) setTranslatedText((prev) => prev + ' ' + data.translatedText);
        if (data.classification) setClassification(data.classification);
        if (data.confidence !== undefined) setConfidence(data.confidence);
        if (data.needsHumanReview !== undefined) setNeedsHumanReview(data.needsHumanReview);
      });

      ws.on('transcription', (data) => {
        console.log('Received transcription:', data);
        if (data.text) {
          if (data.isPartial) {
            // Show partial transcript with ellipsis
            setTranscript(data.text + '...');
          } else {
            // Complete transcript
            setTranscript((prev) => {
              // Remove partial text and add complete
              const cleanPrev = prev.replace(/\.\.\.$/, '').trim();
              return cleanPrev ? `${cleanPrev} ${data.text}` : data.text;
            });
          }
        }
      });

      ws.on('error', (data) => {
        console.error('WebSocket error:', data);
        setError(data.message || 'Interpretation error');
      });

      ws.on('transcription-error', (data) => {
        console.error('Transcription error:', data);
        setError(`Transcription error: ${data.error || 'Unknown error'}`);
      });

      // Connect WebSocket
      console.log('Connecting WebSocket...');
      await ws.connect(sourceLanguage, targetLanguage, sessionIdRef.current);
      console.log('WebSocket connected successfully');

      // Set up audio processing for continuous capture
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Resample to 16kHz if needed (Transcribe Streaming requires 16kHz)
      const targetSampleRate = 16000;
      let audioWorkletNode: AudioWorkletNode | null = null;
      let scriptProcessor: ScriptProcessorNode | null = null;

      // Try to use AudioWorklet (modern API) first, fallback to ScriptProcessor
      try {
        // For now, use ScriptProcessor (AudioWorklet requires separate file)
        // Note: ScriptProcessor is deprecated but works for this use case
        scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = scriptProcessor;

        scriptProcessor.onaudioprocess = (e) => {
          if (ws.isConnected()) {
            const inputData = e.inputBuffer.getChannelData(0);
            const sampleRate = audioContext.sampleRate;
            
            // Resample to 16kHz if needed
            let processedData = inputData;
            if (sampleRate !== targetSampleRate) {
              const ratio = sampleRate / targetSampleRate;
              const newLength = Math.floor(inputData.length / ratio);
              processedData = new Float32Array(newLength);
              for (let i = 0; i < newLength; i++) {
                processedData[i] = inputData[Math.floor(i * ratio)];
              }
            }

            // Convert to PCM 16-bit
            const buffer = new ArrayBuffer(processedData.length * 2);
            const view = new DataView(buffer);
            
            for (let i = 0; i < processedData.length; i++) {
              const s = Math.max(-1, Math.min(1, processedData[i]));
              view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }

            // Send audio chunk via WebSocket
            if (ws.isConnected()) {
              console.log('Sending audio chunk', { 
                size: buffer.byteLength, 
                sampleRate: audioContext.sampleRate,
                processedLength: processedData.length,
                isConnected: true
              });
              ws.sendAudioChunk(buffer);
            } else {
              console.warn('⚠️ Cannot send audio chunk: WebSocket not connected');
              console.warn('WebSocket ready state:', wsRef.current?.getReadyState());
              console.warn('WebSocket URL:', wsRef.current?.getUrl());
            }
          }
        };
      } catch (error) {
        console.error('Failed to set up audio processing:', error);
        setError('Failed to set up audio processing. Please try again.');
        return;
      }

      const source = audioContext.createMediaStreamSource(stream);
      if (scriptProcessor) {
        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
      }

      setIsActive(true);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please allow microphone access and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to start interpretation');
      }
    }
  };

  const handleStop = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    setIsActive(false);
  };

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source language
          </label>
          <select
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            disabled={isActive}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
          >
            {LANGUAGES.filter((lang) => lang.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target language
          </label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={isActive}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
          >
            {LANGUAGES.filter((lang) => lang.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {needsHumanReview && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg">
          <p className="font-medium">Human review recommended</p>
          <p className="text-sm mt-1">
            Low confidence detected. A human interpreter has been notified and will review this segment.
          </p>
        </div>
      )}

      <div className="mb-6 flex items-center gap-4">
        {!isActive ? (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            Start Interpretation
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
            Stop Interpretation
          </button>
        )}
        
        {isActive && (
          <div className="flex items-center gap-2 text-green-600">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium">Listening...</span>
          </div>
        )}
      </div>

      {isActive && !transcript && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
          <p className="font-medium mb-2">🎤 Listening...</p>
          <p className="text-sm">
            <strong>Status:</strong> WebSocket connected ✓ | Audio capture active ✓ | Transcribing...
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Live Transcript
            </label>
            {classification && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {classification}
              </span>
            )}
            {confidence !== null && (
              <span className="text-xs text-gray-500">
                Confidence: {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          <textarea
            value={transcript || ''}
            readOnly
            placeholder={isActive ? 'Listening... Transcript will appear here as you speak...' : "Click 'Start Interpretation' to begin..."}
            className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Live Translation
          </label>
          <textarea
            value={translatedText}
            readOnly
            placeholder="Translation will appear here..."
            className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none"
          />
        </div>
      </div>
    </div>
  );
};

export default InterpretationPanel;

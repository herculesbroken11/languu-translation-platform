export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
}

export interface TranscriptionRequest {
  file: File;
  sourceLanguage: string;
  targetLanguage?: string;
}

export interface TranscriptionResponse {
  transcript: string;
  translatedText?: string;
  jobId: string;
}

export interface InterpretationRequest {
  audioStream: MediaStream;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface InterpretationResponse {
  transcript: string;
  translatedText: string;
  confidence: number;
  needsHumanReview: boolean;
}

export interface TTSRequest {
  text: string;
  language: string;
  voiceId: string;
}

export interface TTSResponse {
  audioUrl: string;
  jobId: string;
}

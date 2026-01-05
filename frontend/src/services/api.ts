import axios from 'axios';
import {
  TranslationRequest,
  TranslationResponse,
  TranscriptionRequest,
  TranscriptionResponse,
  InterpretationRequest,
  InterpretationResponse,
  TTSRequest,
  TTSResponse,
} from '@/utils/types';
import { API_ENDPOINTS } from '@/utils/constants';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.languu.com',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes for large file uploads
});

// Error handler
const handleError = (error: unknown, defaultMessage: string): Error => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message || error.message || defaultMessage;
    return new Error(message);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(defaultMessage);
};

// Translation API
export const translateText = async (
  request: TranslationRequest
): Promise<TranslationResponse> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: TranslationResponse }>(
      API_ENDPOINTS.TRANSLATE,
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error('Invalid response from translation service');
    }
    return response.data.data;
  } catch (error) {
    throw handleError(error, 'Translation failed. Please try again.');
  }
};

// Transcription API
export const transcribeAudio = async (
  request: TranscriptionRequest
): Promise<TranscriptionResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('sourceLanguage', request.sourceLanguage);
    if (request.targetLanguage) {
      formData.append('targetLanguage', request.targetLanguage);
    }

    const response = await apiClient.post<{ success: boolean; data: TranscriptionResponse }>(
      API_ENDPOINTS.TRANSCRIBE,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes for large files
      }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error('Invalid response from transcription service');
    }
    return response.data.data;
  } catch (error) {
    throw handleError(error, 'Transcription failed. Please try again.');
  }
};

// Interpretation API (streaming)
export const startInterpretation = async (
  request: InterpretationRequest
): Promise<EventSource> => {
  try {
    const params = new URLSearchParams({
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    });

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.languu.com';
    return new EventSource(
      `${baseUrl}${API_ENDPOINTS.INTERPRETATION}?${params.toString()}`
    );
  } catch (error) {
    throw handleError(error, 'Failed to start interpretation stream.');
  }
};

// Text-to-Speech API
export const synthesizeSpeech = async (
  request: TTSRequest
): Promise<TTSResponse> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: TTSResponse }>(
      API_ENDPOINTS.TTS,
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error('Invalid response from TTS service');
    }
    return response.data.data;
  } catch (error) {
    throw handleError(error, 'Speech synthesis failed. Please try again.');
  }
};

// Human-in-the-Loop API
export const submitForReview = async (
  jobId: string,
  feedback: string
): Promise<void> => {
  try {
    const response = await apiClient.post<{ success: boolean }>(
      API_ENDPOINTS.HITL,
      {
        jobId,
        feedback,
      }
    );
    if (!response.data.success) {
      throw new Error('Failed to submit for review');
    }
  } catch (error) {
    throw handleError(error, 'Failed to submit for review.');
  }
};

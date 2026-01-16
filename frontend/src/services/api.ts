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

// Get presigned URL for file upload
export const getPresignedUploadUrl = async (
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; fileKey: string; expiresIn: number }> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: { uploadUrl: string; fileKey: string; expiresIn: number } }>(
      API_ENDPOINTS.TRANSCRIBE_UPLOAD,
      { fileName, contentType }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error('Failed to get upload URL');
    }
    return response.data.data;
  } catch (error) {
    throw handleError(error, 'Failed to get upload URL. Please try again.');
  }
};

// Upload file directly to S3
export const uploadFileToS3 = async (
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> => {
  try {
    await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      timeout: 300000, // 5 minutes for large files
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
  } catch (error) {
    throw new Error('Failed to upload file to S3. Please try again.');
  }
};

// Get transcription status
export const getTranscriptionStatus = async (
  jobId: string
): Promise<{ status: string; transcript?: string; translatedText?: string; error?: string }> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: any }>(
      `${API_ENDPOINTS.TRANSCRIBE}/status/${jobId}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error('Invalid response from transcription status service');
    }
    return response.data.data;
  } catch (error) {
    throw handleError(error, 'Failed to get transcription status. Please try again.');
  }
};

// Transcription API - always uses S3 presigned URL for all files
export const transcribeAudio = async (
  request: TranscriptionRequest,
  onUploadProgress?: (progress: number) => void,
  onStatusUpdate?: (status: string) => void
): Promise<TranscriptionResponse> => {
  try {
    // Always use S3 presigned URL approach for all files
    // This avoids API Gateway 10MB limit and is more consistent
    
    // Step 1: Get presigned URL
    const { uploadUrl, fileKey } = await getPresignedUploadUrl(
      request.file.name,
      request.file.type
    );

    // Step 2: Upload file directly to S3
    await uploadFileToS3(uploadUrl, request.file, onUploadProgress);

    // Step 3: Call transcribe with fileKey (returns job ID immediately)
    const response = await apiClient.post<{ 
      success: boolean; 
      data: { 
        jobId: string; 
        status: string; 
        message?: string;
        transcript?: string;
        translatedText?: string;
      } 
    }>(
      API_ENDPOINTS.TRANSCRIBE,
      {
        fileKey,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        includeTimestamps: request.includeTimestamps,
      }
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error('Invalid response from transcription service');
    }

    const { jobId, status, transcript, translatedText } = response.data.data;

    // If job is already completed (unlikely but possible), return immediately
    if (status === 'COMPLETED' && transcript) {
      return {
        transcript,
        translatedText,
        jobId,
      };
    }

    // Poll for status (transcription is async)
    if (onStatusUpdate) {
      onStatusUpdate('Processing transcription...');
    }

    const maxPollAttempts = 120; // 10 minutes max (120 * 5 seconds)
    let attempts = 0;

    while (attempts < maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResult = await getTranscriptionStatus(jobId);

      if (statusResult.status === 'COMPLETED') {
        return {
          transcript: statusResult.transcript || '',
          translatedText: statusResult.translatedText,
          jobId,
        };
      }

      if (statusResult.status === 'FAILED') {
        throw new Error(statusResult.error || 'Transcription failed');
      }

      if (onStatusUpdate) {
        onStatusUpdate(`Processing... (${attempts + 1}/${maxPollAttempts})`);
      }

      attempts++;
    }

    throw new Error('Transcription timed out. Please check status later.');
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

// Email API
export interface EmailRequest {
  to?: string;
  subject: string;
  body: string;
  originalFile?: string;
  transcript?: string;
  translation?: string;
  fileUrl?: string;
}

export const sendEmail = async (request: EmailRequest): Promise<void> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: { messageId: string } }>(
      API_ENDPOINTS.EMAIL,
      request
    );
    if (!response.data.success) {
      throw new Error('Failed to send email');
    }
  } catch (error) {
    throw handleError(error, 'Failed to send email. Please try again.');
  }
};

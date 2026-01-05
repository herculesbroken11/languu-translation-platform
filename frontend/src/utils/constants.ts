export const LANGUAGES = [
  { code: 'auto', name: 'Detect language' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
] as const;

export const API_ENDPOINTS = {
  TRANSLATE: '/translate',
  TRANSCRIBE: '/transcribe',
  INTERPRETATION: '/interpretation',
  TTS: '/tts',
  HITL: '/hitl',
} as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'ogg', 'm4a'];
export const SUPPORTED_VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'avi'];
export const SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

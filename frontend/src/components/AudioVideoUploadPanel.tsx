'use client';

import React, { useState, useRef } from 'react';
import { transcribeAudio } from '@/services/api';
import { LANGUAGES, SUPPORTED_AUDIO_FORMATS, SUPPORTED_VIDEO_FORMATS, MAX_FILE_SIZE } from '@/utils/constants';

const AudioVideoUploadPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      // Validate file type
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      const supportedFormats = [...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS];
      
      if (!fileExtension || !supportedFormats.includes(fileExtension)) {
        setError(`Unsupported file format. Supported formats: ${supportedFormats.join(', ')}`);
        return;
      }

      // Validate file size
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return;
      }

      setFile(selectedFile);
      setError(null);
      setTranscript('');
      setTranslatedText('');
    } catch (err) {
      setError('Error selecting file. Please try again.');
      console.error('File selection error:', err);
    }
  };

  const handleTranscribe = async () => {
    if (!file) {
      setError('Please select an audio or video file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTranscript('');
    setTranslatedText('');

    try {
      const result = await transcribeAudio({
        file,
        sourceLanguage: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
        targetLanguage,
      });

      setTranscript(result.transcript);
      if (result.translatedText) {
        setTranslatedText(result.translatedText);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      setError(errorMessage);
      console.error('Transcription error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From language
          </label>
          <select
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To language
          </label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {LANGUAGES.filter((lang) => lang.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={[...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS].map((f) => `.${f}`).join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {file ? file.name : 'Choose File'}
        </button>
        {file && (
          <span className="ml-2 text-sm text-gray-600">
            {file.name}
          </span>
        )}
        {file && (
          <button
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="ml-2 px-4 py-2 text-red-600 hover:text-red-700 transition-colors text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={handleTranscribe}
          disabled={isProcessing || !file}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isProcessing ? 'Processing...' : 'Transcribe & Translate'}
        </button>
      </div>

      {(transcript || translatedText) && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcript
            </label>
            <textarea
              value={transcript}
              readOnly
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Translation
            </label>
            <textarea
              value={translatedText}
              readOnly
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioVideoUploadPanel;

'use client';

import React, { useState, useRef } from 'react';
import { transcribeAudio } from '@/services/api';
import { LANGUAGES, SUPPORTED_AUDIO_FORMATS, SUPPORTED_VIDEO_FORMATS, MAX_FILE_SIZE } from '@/utils/constants';

const TranscriptionPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const supportedFormats = [...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS];

    if (!fileExtension || !supportedFormats.includes(fileExtension)) {
      setError(`Unsupported file format. Supported formats: ${supportedFormats.join(', ')}`);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setTranscript('');
    setTranslatedText('');
  };

  const handleTranscribe = async () => {
    if (!file) {
      setError('Please select a file');
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
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source language
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
            Translate to
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

      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept={[...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS].map((f) => `.${f}`).join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            {file ? `Selected: ${file.name}` : 'Select Audio or Video File'}
          </button>
          {file && (
            <button
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="ml-4 px-4 py-3 text-red-600 hover:text-red-700 transition-colors"
            >
              Clear
            </button>
          )}
          <p className="mt-4 text-sm text-gray-500">
            Supported formats: {[...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS].join(', ')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Max file size: {MAX_FILE_SIZE / 1024 / 1024}MB
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={handleTranscribe}
          disabled={isProcessing || !file}
          className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg"
        >
          {isProcessing ? 'Processing...' : 'Transcribe & Translate'}
        </button>
      </div>

      {(transcript || translatedText) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcript
            </label>
            <textarea
              value={transcript}
              readOnly
              className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Translation
            </label>
            <textarea
              value={translatedText}
              readOnly
              className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptionPanel;

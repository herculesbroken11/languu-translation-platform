'use client';

import React, { useState, useRef } from 'react';
import { transcribeAudio } from '@/services/api';
import { LANGUAGES, SUPPORTED_AUDIO_FORMATS, SUPPORTED_VIDEO_FORMATS, MAX_FILE_SIZE } from '@/utils/constants';

const TranscriptionPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useHumanBacked, setUseHumanBacked] = useState(false);
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
  };


  const handleTranscribeWithTimestamp = async () => {
    await handleTranscribe(true);
  };

  const handleTranscribeWithoutTimestamp = async () => {
    await handleTranscribe(false);
  };

  const handleTranscribe = async (withTimestamp: boolean) => {
    if (!file) {
      setError('Please select a video file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTranscript('');

    try {
      const result = await transcribeAudio({
        file,
        sourceLanguage: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
        includeTimestamps: withTimestamp,
      });

      setTranscript(result.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSRT = async (withTimestamp: boolean) => {
    if (!transcript) {
      setError('No transcript available to export');
      return;
    }

    // Generate SRT content
    const srtContent = generateSRT(transcript, withTimestamp);
    
    // Create download link
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${withTimestamp ? 'with' : 'without'}_timestamp.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateSRT = (transcript: string, withTimestamp: boolean): string => {
    if (!withTimestamp) {
      // Simple SRT without timestamps
      return `1\n00:00:00,000 --> 00:00:00,000\n${transcript}\n\n`;
    }
    
    // For now, return a basic SRT format
    // In production, this would parse timestamps from the transcript
    return `1\n00:00:00,000 --> 00:00:10,000\n${transcript}\n\n`;
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
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useHumanBackedTranscribe"
            checked={useHumanBacked}
            onChange={(e) => setUseHumanBacked(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <label htmlFor="useHumanBackedTranscribe" className="text-sm font-medium text-gray-700">
            Human Backed
          </label>
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
            {file ? `Selected: ${file.name}` : 'Select Video File'}
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

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => handleTranscribeWithTimestamp()}
          disabled={isProcessing || !file}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isProcessing ? 'Processing...' : 'Transcribe with Timestamp'}
        </button>
        <button
          onClick={() => handleTranscribeWithoutTimestamp()}
          disabled={isProcessing || !file}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isProcessing ? 'Processing...' : 'Transcribe without Timestamp'}
        </button>
        {transcript && (
          <>
            <button
              onClick={() => handleExportSRT(true)}
              disabled={!transcript}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Export SRT file with Timestamp
            </button>
            <button
              onClick={() => handleExportSRT(false)}
              disabled={!transcript}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Export SRT file without Timestamp
            </button>
          </>
        )}
      </div>

      {transcript && (
        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transcript
          </label>
          <textarea
            value={transcript}
            readOnly
            className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none"
          />
        </div>
      )}
    </div>
  );
};

export default TranscriptionPanel;

'use client';

import React, { useState, useRef } from 'react';
import { transcribeAudio, sendEmail } from '@/services/api';
import { LANGUAGES, SUPPORTED_AUDIO_FORMATS, SUPPORTED_VIDEO_FORMATS, MAX_FILE_SIZE } from '@/utils/constants';
import EditableTranslation from './EditableTranslation';

const AudioVideoUploadPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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

  const handleTranscribe = async (withTimestamp: boolean) => {
    if (!file) {
      setError('Please select an audio or video file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTranscript('');
    setTranslatedText('');

    try {
      setUploadProgress(0);
      setStatusMessage(null);
      const result = await transcribeAudio(
        {
          file,
          sourceLanguage: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
          targetLanguage,
          includeTimestamps: withTimestamp,
        },
        (progress) => {
          setUploadProgress(progress);
          setStatusMessage(`Uploading: ${progress}%`);
        },
        (status) => {
          setStatusMessage(status);
        }
      );

      setUploadProgress(100);
      setStatusMessage('Completed!');
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

      {statusMessage && !error && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
          {statusMessage}
        </div>
      )}


      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => handleTranscribe(true)}
          disabled={isProcessing || !file}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isProcessing ? 'Processing...' : 'Transcribe & Translate'}
        </button>
        <button
          onClick={() => handleTranscribe(true)}
          disabled={isProcessing || !file}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          With Timestamp
        </button>
        <button
          onClick={() => handleTranscribe(false)}
          disabled={isProcessing || !file}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Without Timestamp
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-bold text-orange-600">HUMAN REVIEW</span>
        </div>
      </div>
        {isProcessing && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">Uploading: {uploadProgress}%</p>
          </div>
        )}
      </div>

      {(transcript || translatedText) && (
        <>
          <div className="mb-4">
            <button
              onClick={async () => {
                try {
                  setIsProcessing(true);
                  await sendEmail({
                    subject: 'Translation Review Request',
                    body: `Please review the following translation:\n\nFile: ${file?.name || 'Unknown'}\nSource Language: ${LANGUAGES.find(l => l.code === sourceLanguage)?.name || sourceLanguage}\nTarget Language: ${LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage}`,
                    originalFile: file?.name,
                    transcript: transcript,
                    translation: translatedText,
                  });
                  setError(null);
                  alert('Email sent successfully to team@languu.com');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to send email. Please try again.');
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Forward to an approved native translator for review
            </button>
          </div>
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
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Translation
                </label>
                {translatedText && (
                  <button
                    onClick={() => {
                      const srtContent = `1\n00:00:00,000 --> 00:00:10,000\n${translatedText}\n\n`;
                      const blob = new Blob([srtContent], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `translation_${Date.now()}.srt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Export SRT
                  </button>
                )}
              </div>
              <EditableTranslation
                value={translatedText}
                onChange={setTranslatedText}
                placeholder="Translation will appear here. Click on words to edit them."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AudioVideoUploadPanel;

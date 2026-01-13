'use client';

import React, { useState } from 'react';
import { LANGUAGES } from '@/utils/constants';
import { translateText } from '@/services/api';

interface TranslationPanelProps {
  initialSourceLanguage?: string;
  initialTargetLanguage?: string;
}

const TranslationPanel: React.FC<TranslationPanelProps> = ({
  initialSourceLanguage = 'auto',
  initialTargetLanguage = 'en',
}) => {
  const [sourceLanguage, setSourceLanguage] = useState(initialSourceLanguage);
  const [targetLanguage, setTargetLanguage] = useState(initialTargetLanguage);
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useHumanBacked, setUseHumanBacked] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('Please enter text to translate');
      return;
    }

    if (sourceLanguage === targetLanguage && sourceLanguage !== 'auto') {
      setError('Source and target languages must be different');
      return;
    }

    setIsTranslating(true);
    setError(null);
    setTranslatedText('');

    try {
      const result = await translateText({
        text: inputText,
        sourceLanguage: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
        targetLanguage,
      });

      setTranslatedText(result.translatedText);
      if (result.detectedLanguage) {
        setDetectedLanguage(result.detectedLanguage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From
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
            <p className="text-xs text-red-600 mt-1">Detect language may be in the dropdown menu</p>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To
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
          <div className="flex-shrink-0 flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-2 h-[20px]">
              &nbsp;
            </label>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleTranslate}
                disabled={isTranslating || !inputText.trim()}
                className="px-6 py-2 text-white rounded-lg hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                style={{ backgroundColor: '#9333ea' }}
              >
                {isTranslating ? 'Translating...' : 'Translate'}
              </button>
              <div className="flex items-center gap-2 justify-center">
                <input
                  type="checkbox"
                  id="useHumanBackedTranslate"
                  checked={useHumanBacked}
                  onChange={(e) => setUseHumanBacked(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="useHumanBackedTranslate" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Human Backed
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {detectedLanguage && sourceLanguage === 'auto' && (
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
          Detected language: {LANGUAGES.find((l) => l.code === detectedLanguage)?.name || detectedLanguage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Input
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste your text"
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.type.startsWith('text/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setInputText(event.target?.result as string);
                    };
                    reader.readAsText(file);
                  } else {
                    setError('Please select a text file');
                  }
                }
              }}
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
            >
              Choose File
            </label>
            <span className="text-sm text-gray-500">No file chosen</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Translation
          </label>
          <div className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg bg-white">
            {translatedText ? (
              <textarea
                value={translatedText}
                readOnly
                className="w-full h-full border-none resize-none focus:outline-none"
              />
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-gray-400">
                <p className="font-medium mb-2">Your translation will appear here</p>
                <p className="text-sm text-center px-4">
                  Choose languages and enter your text, then click Translate.
                </p>
                <div className="mt-4 w-full">
                  <div className="h-px bg-gray-200 mb-2"></div>
                  <div className="h-px bg-gray-200"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslationPanel;

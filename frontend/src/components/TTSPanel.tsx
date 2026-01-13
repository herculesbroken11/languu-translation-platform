'use client';

import React, { useState } from 'react';
import { synthesizeSpeech } from '@/services/api';
import { LANGUAGES } from '@/utils/constants';

// Amazon Polly voice IDs by language
const VOICES: Record<string, { id: string; name: string }[]> = {
  en: [
    { id: 'Joanna', name: 'Joanna (Neural)' },
    { id: 'Matthew', name: 'Matthew (Neural)' },
    { id: 'Amy', name: 'Amy (Neural)' },
    { id: 'Brian', name: 'Brian (Neural)' },
  ],
  es: [
    { id: 'Lupe', name: 'Lupe (Neural)' },
    { id: 'Conchita', name: 'Conchita (Standard)' },
  ],
  fr: [
    { id: 'Lea', name: 'Lea (Neural)' },
    { id: 'Celine', name: 'Celine (Neural)' },
  ],
  de: [
    { id: 'Vicki', name: 'Vicki (Neural)' },
    { id: 'Hans', name: 'Hans (Neural)' },
  ],
  it: [
    { id: 'Bianca', name: 'Bianca (Neural)' },
    { id: 'Giorgio', name: 'Giorgio (Neural)' },
  ],
  pt: [
    { id: 'Camila', name: 'Camila (Neural)' },
    { id: 'Vitoria', name: 'Vitoria (Neural)' },
  ],
  ja: [
    { id: 'Mizuki', name: 'Mizuki (Neural)' },
    { id: 'Takumi', name: 'Takumi (Neural)' },
  ],
  ko: [
    { id: 'Seoyeon', name: 'Seoyeon (Neural)' },
  ],
  zh: [
    { id: 'Zhiyu', name: 'Zhiyu (Neural)' },
  ],
  ar: [
    { id: 'Zeina', name: 'Zeina (Neural)' },
  ],
  hi: [
    { id: 'Aditi', name: 'Aditi (Neural)' },
  ],
};

const TTSPanel: React.FC = () => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [voiceId, setVoiceId] = useState('Joanna');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useHumanBacked, setUseHumanBacked] = useState(false);

  const availableVoices = VOICES[language] || VOICES.en;

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    const voices = VOICES[newLanguage] || VOICES.en;
    setVoiceId(voices[0].id);
  };

  const handleSynthesize = async () => {
    if (!text.trim()) {
      setError('Please enter text to synthesize');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setAudioUrl(null);

    try {
      const result = await synthesizeSpeech({
        text: text.trim(),
        language,
        voiceId,
      });

      setAudioUrl(result.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speech synthesis failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left column - Input controls */}
        <div className="col-span-12 lg:col-span-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {LANGUAGES.filter((lang) => lang.code !== 'auto' && VOICES[lang.code]).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice
              </label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {availableVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="useHumanBackedTTS"
                checked={useHumanBacked}
                onChange={(e) => setUseHumanBacked(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="useHumanBackedTTS" className="text-sm font-medium text-gray-700">
                Human Backed
              </label>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text to Synthesize
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to convert to speech..."
              className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-6">
            <button
              onClick={handleSynthesize}
              disabled={isProcessing || !text.trim()}
              className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg"
            >
              {isProcessing ? 'Synthesizing...' : 'Synthesize Speech'}
            </button>
          </div>
        </div>

        {/* Right column - Results */}
        <div className="col-span-12 lg:col-span-5">
          <div className="lg:sticky lg:top-20">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Preview
            </label>
            {audioUrl ? (
              <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Generated Audio</h3>
                </div>
                <div className="bg-white rounded-lg p-6 mb-6 shadow-md">
                  <audio controls className="w-full" src={audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
                <a
                  href={audioUrl}
                  download="speech.mp3"
                  className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold text-base shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Audio
                </a>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 h-48 flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="mb-4 flex justify-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Your generated audio will appear here after synthesis
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TTSPanel;

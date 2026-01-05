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
    <div className="w-full max-w-4xl">
      <div className="mb-6">
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

      <div className="mb-6">
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

      {audioUrl && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Generated Audio</h3>
          <audio controls className="w-full" src={audioUrl}>
            Your browser does not support the audio element.
          </audio>
          <div className="mt-4">
            <a
              href={audioUrl}
              download="speech.mp3"
              className="text-primary-600 hover:text-primary-700 underline text-sm"
            >
              Download Audio
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default TTSPanel;

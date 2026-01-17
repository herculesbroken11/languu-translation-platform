'use client';

import React, { useState, useRef, useEffect } from 'react';

interface EditableTranslationProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const EditableTranslation: React.FC<EditableTranslationProps> = ({
  value,
  onChange,
  placeholder = 'Translation will appear here. You can edit it.',
  className = '',
}) => {
  const [selectedWord, setSelectedWord] = useState<{ word: string; index: number } | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleWordClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end) {
      // Find the word at cursor position
      const text = value;
      let wordStart = start;
      let wordEnd = start;
      
      // Find word boundaries
      while (wordStart > 0 && /\w/.test(text[wordStart - 1])) {
        wordStart--;
      }
      while (wordEnd < text.length && /\w/.test(text[wordEnd])) {
        wordEnd++;
      }
      
      const word = text.substring(wordStart, wordEnd);
      if (word.trim().length > 0) {
        setSelectedWord({ word, index: wordStart });
        setShowAlternatives(true);
        textarea.setSelectionRange(wordStart, wordEnd);
      }
    } else {
      // Word is already selected
      const word = value.substring(start, end);
      if (word.trim().length > 0) {
        setSelectedWord({ word, index: start });
        setShowAlternatives(true);
      }
    }
  };

  const handleReplaceWord = (replacement: string) => {
    if (selectedWord) {
      const text = value;
      const wordStart = selectedWord.index;
      const wordEnd = wordStart + selectedWord.word.length;
      
      // Replace the word at the specific index
      const newValue = text.substring(0, wordStart) + replacement + text.substring(wordEnd);
      onChange(newValue);
      setShowAlternatives(false);
      setSelectedWord(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowAlternatives(false);
        setSelectedWord(null);
      }
    };

    if (showAlternatives) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAlternatives]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseUp={handleWordClick}
        onDoubleClick={handleWordClick}
        placeholder={placeholder}
        className={`w-full h-64 px-4 py-3 border border-gray-300 rounded-lg bg-white resize-none ${className}`}
      />
      {showAlternatives && selectedWord && (
        <div className="absolute z-10 mt-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Selected: "{selectedWord.word}"</p>
          <p className="text-xs text-gray-500 mb-2">Alternative translations feature coming soon</p>
          <button
            onClick={() => {
              const newWord = prompt(`Replace "${selectedWord.word}" with:`, selectedWord.word);
              if (newWord !== null) {
                handleReplaceWord(newWord);
              }
            }}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Edit Word
          </button>
          <button
            onClick={() => {
              setShowAlternatives(false);
              setSelectedWord(null);
            }}
            className="ml-2 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default EditableTranslation;

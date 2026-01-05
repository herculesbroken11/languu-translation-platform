'use client';

import React, { useState } from 'react';

const ImageUploadPanel: React.FC = () => {
  const [isPlaceholder, setIsPlaceholder] = useState(true);

  return (
    <div className="w-full">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <p className="text-gray-500 text-lg mb-4">
          Image translation feature coming soon
        </p>
        <p className="text-gray-400 text-sm">
          This feature will allow you to translate text from images using OCR and translation services.
        </p>
      </div>
    </div>
  );
};

export default ImageUploadPanel;

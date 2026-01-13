import React from 'react';
import MainLayout from '@/layouts/MainLayout';
import TTSPanel from '@/components/TTSPanel';

const TTSPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Main content area */}
          <div className="col-span-12 lg:col-span-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Text to Speech</h1>
            <TTSPanel />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TTSPage;

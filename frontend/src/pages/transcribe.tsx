import React from 'react';
import MainLayout from '@/layouts/MainLayout';
import TranscriptionPanel from '@/components/TranscriptionPanel';

const TranscribePage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Transcribe</h1>
        <TranscriptionPanel />
      </div>
    </MainLayout>
  );
};

export default TranscribePage;

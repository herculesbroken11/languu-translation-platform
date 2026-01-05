import React from 'react';
import MainLayout from '@/layouts/MainLayout';
import InterpretationPanel from '@/components/InterpretationPanel';

const InterpretationPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          AI Interpretation – Human Backed
        </h1>
        <InterpretationPanel />
      </div>
    </MainLayout>
  );
};

export default InterpretationPage;

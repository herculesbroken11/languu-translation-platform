import React from 'react';
import MainLayout from '@/layouts/MainLayout';
import TranscriptionPanel from '@/components/TranscriptionPanel';

const TranscribePage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Main content area - 7.8/10 width (78%) */}
          <div className="flex-1" style={{ width: '78%', maxWidth: '78%' }}>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Transcribe</h1>
            <TranscriptionPanel />
          </div>

          {/* Right sidebar - 2.2/10 width (22%) */}
          <div className="hidden lg:block" style={{ width: '22%', maxWidth: '22%', flexShrink: 0 }}>
            <div className="sticky" style={{ top: '80px', maxHeight: 'calc(100vh - 120px)' }}>
              {/* Reserved for future content */}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TranscribePage;

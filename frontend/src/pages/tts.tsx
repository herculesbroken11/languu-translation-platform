import React from 'react';
import MainLayout from '@/layouts/MainLayout';
import TTSPanel from '@/components/TTSPanel';

const TTSPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Main content area - 9.8/12 width */}
          <div className="col-span-12 lg:col-span-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Text to Speech</h1>
            <TTSPanel />
          </div>

          {/* Right sidebar - 2.2/12 width for results */}
          <div className="hidden lg:block col-span-2">
            <div className="sticky top-20">
              {/* Results will be shown here */}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TTSPage;

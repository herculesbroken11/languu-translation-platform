import React from 'react';
import MainLayout from '@/layouts/MainLayout';
import TranslationTabs from '@/components/TranslationTabs';

const HomePage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Main content area - 9.8/12 width (approximately 7.8/10) */}
          <div className="col-span-12 lg:col-span-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Translate</h1>
            <TranslationTabs />
          </div>

          {/* Right sidebar - 2.2/12 width (approximately 2.2/10) */}
          <div className="hidden lg:block col-span-2">
            <div className="sticky top-20">
              {/* Reserved for future content */}
            </div>
          </div>
        </div>

        {/* Content section below */}
        <div className="mt-12 pt-12 border-t border-gray-200">
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">This section is for website contents.</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default HomePage;

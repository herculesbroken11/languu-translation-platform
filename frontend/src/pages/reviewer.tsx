import React from 'react';
import MainLayout from '@/layouts/MainLayout';
import ReviewerConsole from '@/components/ReviewerConsole';

const ReviewerPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Reviewer Console</h1>
        <ReviewerConsole />
      </div>
    </MainLayout>
  );
};

export default ReviewerPage;

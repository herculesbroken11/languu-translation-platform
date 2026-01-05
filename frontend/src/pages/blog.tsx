import React from 'react';
import MainLayout from '@/layouts/MainLayout';

const BlogPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">Blog</h1>
        <div className="text-center text-gray-600">
          <p className="text-lg">Blog posts coming soon.</p>
          <p className="mt-2">Stay tuned for updates, tips, and insights about translation and interpretation.</p>
        </div>
      </div>
    </MainLayout>
  );
};

export default BlogPage;

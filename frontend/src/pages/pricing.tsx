import React from 'react';
import MainLayout from '@/layouts/MainLayout';

const PricingPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">Pricing</h1>
        <div className="text-center text-gray-600">
          <p className="text-lg">Pricing information coming soon.</p>
          <p className="mt-2">We're working on flexible pricing plans to suit your needs.</p>
        </div>
      </div>
    </MainLayout>
  );
};

export default PricingPage;

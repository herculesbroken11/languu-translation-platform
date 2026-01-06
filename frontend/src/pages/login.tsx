import React from 'react';
import MainLayout from '@/layouts/MainLayout';

const LoginPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Log In</h1>
        <div className="bg-white shadow-md rounded-lg px-8 pt-6 pb-8">
          <div className="text-center text-gray-600">
            <p className="text-lg">Authentication coming soon.</p>
            <p className="mt-2 text-sm">We&apos;re setting up secure authentication using AWS Cognito.</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LoginPage;

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Header: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Translate' },
    { href: '/transcribe', label: 'Transcribe' },
    { href: '/interpretation', label: 'AI Interpretation – Human Backed' },
    { href: '/tts', label: 'Text to Speech' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/blog', label: 'Blog' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold" style={{ color: '#9333ea' }}>
              LANGUU
            </Link>
          </div>
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm font-medium transition-colors border ${
                  isActive(item.href)
                    ? 'text-primary-600 border-primary-600'
                    : 'text-gray-700 border-gray-300 hover:text-primary-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

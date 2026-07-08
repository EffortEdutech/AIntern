/**
 * WorkLedger - Auth Layout Component
 * 
 * Simple centered layout for authentication pages (login, register, forgot password).
 * Includes branding and footer.
 * 
 * @module components/layout/AuthLayout
 * @created January 29, 2026
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

export function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <Link to={ROUTES.LOGIN} className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              WorkLedger
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-gray-200">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          <p>
            © {new Date().getFullYear()} WorkLedger by KL. All rights reserved.
          </p>
          <div className="mt-2 space-x-4">
            <a href="#" className="hover:text-gray-900">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-900">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-900">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AuthLayout;

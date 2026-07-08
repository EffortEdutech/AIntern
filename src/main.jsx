/**
 * WorkLedger - Main Entry Point
 *
 * SESSION 18 UPDATE: Wrapped app in <OfflineProvider>.
 * Raw online/offline listeners removed — OfflineContext manages these now.
 * VitePWA handles service worker registration automatically (no manual register).
 *
 * SESSION 16 UPDATE: ToastProvider wraps OfflineProvider so toast() is available
 * everywhere in the tree (replaces native alert() calls).
 *
 * @file src/main.jsx
 * @created January 29, 2026
 * @updated March 4, 2026 - Session 18: OfflineProvider
 * @updated May 16, 2026 - Session 16: ToastProvider
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OfflineProvider } from './context/OfflineContext';
import { ToastProvider } from './context/ToastContext';

// Import styles
import './styles/index.css';
import './styles/custom.css';

// Get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element. Check your index.html file.');
}

// Log app initialization
console.log('\u{1F680} WorkLedger initializing...');
console.log(`\u{1F4E6} Version: ${import.meta.env.VITE_APP_VERSION || '1.0.0'}`);
console.log(`\u{1F30D} Environment: ${import.meta.env.VITE_APP_ENV || 'development'}`);
console.log(`\u{1F527} Node Environment: ${import.meta.env.MODE}`);

// Create React root
const root = ReactDOM.createRoot(rootElement);

// Render application — ToastProvider -> OfflineProvider -> App
root.render(
  <React.StrictMode>
    <ToastProvider>
      <OfflineProvider>
        <App />
      </OfflineProvider>
    </ToastProvider>
  </React.StrictMode>
);

// Log successful mount
console.log('\u2705 WorkLedger mounted successfully');

// Service worker is managed by VitePWA plugin (vite.config.js)
// registerType: 'autoUpdate' handles registration - do NOT manually register.

// Log initial online status
console.log(`\u{1F310} Initial online status: ${navigator.onLine ? 'Online' : 'Offline'}`);

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('\u274C Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('\u274C Unhandled promise rejection:', event.reason);
});

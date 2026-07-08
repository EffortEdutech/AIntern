/**
 * WorkLedger — PWA Install Button
 *
 * Handles PWA installation across Android and iOS with appropriate UX
 * for each platform's limitations.
 *
 * ── ANDROID (Chrome) ────────────────────────────────────────────────────────
 *   Browser fires `beforeinstallprompt`. We capture it globally in index.html
 *   before React mounts (fixes timing race). Button shows → user clicks →
 *   native Android install dialog appears → done.
 *
 * ── iOS (Safari) ────────────────────────────────────────────────────────────
 *   Apple does NOT fire `beforeinstallprompt`. There is no API to trigger
 *   the install dialog programmatically. The only path is:
 *     Safari → Share button → Add to Home Screen
 *
 *   Our solution:
 *   - Detect iOS Safari + not already installed
 *   - Show "Install App" button in header
 *   - On click → modal with animated step-by-step instructions
 *   - Modal shows the exact iOS Share icon so users know what to tap
 *   - Dismissal is remembered in localStorage for 7 days
 *   - After 7 days it shows again (in case they forgot / got a new phone)
 *
 * ── ALREADY INSTALLED ───────────────────────────────────────────────────────
 *   Detected via display-mode: standalone. Button hidden entirely.
 *
 * ── APP STORE ───────────────────────────────────────────────────────────────
 *   WorkLedger is a PWA — NO App Store needed. iOS Safari + Android Chrome
 *   can install it directly from the browser. Free, no review, no fees.
 *
 * @file src/components/common/PWAInstallButton.jsx
 * @created March 4, 2026 - Session 18
 * @updated April 8, 2026 - Session 19: iOS instruction modal + platform detection
 */

import React, { useEffect, useState, useCallback } from 'react';

// ── Platform Detection ─────────────────────────────────────────────────────

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isInStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isSafariBrowser = () =>
  /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

// ── iOS Dismissal Memory ───────────────────────────────────────────────────

const IOS_DISMISSED_KEY = 'pwa_ios_install_dismissed_at';
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  try {
    const ts = localStorage.getItem(IOS_DISMISSED_KEY);
    if (!ts) {
      return false;
    }
    const days = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(IOS_DISMISSED_KEY, Date.now().toString());
  } catch { /* ignore */ }
}

// ── iOS Install Modal ──────────────────────────────────────────────────────

function IOSInstallModal({ onClose }) {
  // Animated step highlight
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep(s => (s + 1) % 3);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    {
      num: 1,
      instruction: 'Tap the Share button at the bottom of Safari',
      icon: (
        // iOS Share icon — exact shape users will see
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )
    },
    {
      num: 2,
      instruction: 'Scroll down and tap "Add to Home Screen"',
      icon: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    {
      num: 3,
      instruction: 'Tap "Add" in the top right corner',
      icon: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M5 13l4 4L19 7" />
        </svg>
      )
    }
  ];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* App icon preview */}
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-bold text-lg">W</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">Install WorkLedger</p>
              <p className="text-primary-200 text-xs">Add to your home screen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Why install */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-gray-500 text-center">
            Get the full app experience — works offline, faster access, no browser bar.
          </p>
        </div>

        {/* Steps */}
        <div className="px-5 py-3 space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-500 ${
                activeStep === i
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-gray-50 border border-transparent'
              }`}
            >
              {/* Step number */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                activeStep === i ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step.num}
              </div>

              {/* Instruction */}
              <p className={`text-sm flex-1 transition-colors ${
                activeStep === i ? 'text-blue-900 font-medium' : 'text-gray-600'
              }`}>
                {step.instruction}
              </p>

              {/* Icon */}
              <div className="flex-shrink-0">
                {step.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom arrow hint — shows where Share button is */}
        <div className="px-5 pb-5 pt-2">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>Share button is at the bottom of your Safari browser</span>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PWAInstallButton() {
  const [platform, setPlatform]   = useState(null); // 'android' | 'ios' | null
  const [showModal, setShowModal] = useState(false);
  const [androidPrompt, setAndroidPrompt] = useState(
    () => window.__pwaInstallPrompt ?? null
  );

  useEffect(() => {
    // Already installed — show nothing
    if (isInStandaloneMode()) {
      setPlatform(null);
      return;
    }

    if (isIOS() && isSafariBrowser()) {
      // iOS Safari — show button unless dismissed recently
      if (!wasRecentlyDismissed()) {
        setPlatform('ios');
      }
      return;
    }

    // Android / Chrome — check for deferred prompt
    if (window.__pwaInstallPrompt) {
      setPlatform('android');
    }

    // Also listen for it in case it fires after mount
    const onPrompt = (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      setAndroidPrompt(e);
      setPlatform('android');
    };

    const onInstalled = () => {
      window.__pwaInstallPrompt = null;
      setAndroidPrompt(null);
      setPlatform(null);
      setShowModal(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Re-check after 500ms (timing safety net)
    const timer = setTimeout(() => {
      if (window.__pwaInstallPrompt && !androidPrompt) {
        setAndroidPrompt(window.__pwaInstallPrompt);
        setPlatform('android');
      }
    }, 500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = useCallback(async () => {
    if (platform === 'ios') {
      setShowModal(true);
      return;
    }

    if (platform === 'android' && androidPrompt) {
      try {
        androidPrompt.prompt();
        const { outcome } = await androidPrompt.userChoice;
        console.log(outcome === 'accepted' ? '✅ PWA installed' : 'ℹ️ Install dismissed');
        window.__pwaInstallPrompt = null;
        setAndroidPrompt(null);
        setPlatform(null);
      } catch (err) {
        console.error('❌ Install failed:', err);
      }
    }
  }, [platform, androidPrompt]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    markDismissed(); // Remember for 7 days
  }, []);

  // Nothing to show
  if (!platform) {
    return null;
  }

  return (
    <>
      {/* Install button — visible in header */}
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors"
        title={platform === 'ios' ? 'Install WorkLedger on your iPhone' : 'Install WorkLedger app'}
      >
        {/* Download icon */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="hidden xs:inline">Install App</span>
      </button>

      {/* iOS instruction modal */}
      {showModal && platform === 'ios' && (
        <IOSInstallModal onClose={handleCloseModal} />
      )}
    </>
  );
}

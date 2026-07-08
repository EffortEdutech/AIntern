/**
 * WorkLedger - Toast Notification Context
 *
 * Provides a non-blocking, auto-dismissing toast notification system.
 * Replaces native alert() calls across the application.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Failed to save.');
 *   toast.warning('Please select a contract.');
 *   toast.info('Loading…');
 *
 * @module context/ToastContext
 * @created May 16, 2026
 */

import { createContext, useContext, useState, useCallback } from 'react';
import ToastContainer from '../components/common/Toast';

const ToastContext = createContext(null);

const DURATIONS = { success: 4000, error: 6000, warning: 5000, info: 4000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message, type = 'info', duration) => {
    const id = Date.now() + Math.random();
    const ms = duration ?? DURATIONS[type] ?? 4000;
    setToasts(prev => [...prev, { id, message, type }]);
    if (ms > 0) {
      setTimeout(() => dismiss(id), ms);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, opts) => add(msg, 'success', opts?.duration),
    error:   (msg, opts) => add(msg, 'error',   opts?.duration),
    warning: (msg, opts) => add(msg, 'warning',  opts?.duration),
    info:    (msg, opts) => add(msg, 'info',     opts?.duration)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast methods inside any component.
 * Must be used within <ToastProvider>.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be called inside <ToastProvider>');
  }
  return ctx;
}

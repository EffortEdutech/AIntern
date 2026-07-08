/**
 * WorkLedger - Toast Container Component
 *
 * Renders a stack of toast notifications fixed to the bottom-right corner.
 * Consumed by ToastContext — do not use directly.
 *
 * @module components/common/Toast
 * @created May 16, 2026
 */

import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const CONFIGS = {
  success: {
    Icon:        CheckCircle,
    container:   'bg-green-50 border-green-200',
    iconColor:   'text-green-500',
    textColor:   'text-green-800'
  },
  error: {
    Icon:        XCircle,
    container:   'bg-red-50 border-red-200',
    iconColor:   'text-red-500',
    textColor:   'text-red-800'
  },
  warning: {
    Icon:        AlertTriangle,
    container:   'bg-amber-50 border-amber-200',
    iconColor:   'text-amber-500',
    textColor:   'text-amber-800'
  },
  info: {
    Icon:        Info,
    container:   'bg-blue-50 border-blue-200',
    iconColor:   'text-blue-500',
    textColor:   'text-blue-800'
  }
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      {toasts.map(({ id, message, type }) => {
        const cfg  = CONFIGS[type] || CONFIGS.info;
        const Icon = cfg.Icon;
        return (
          <div
            key={id}
            role="alert"
            className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg
                        animate-fade-in ${cfg.container}`}
          >
            <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
            <p className={`flex-1 text-sm font-medium leading-snug ${cfg.textColor}`}>
              {message}
            </p>
            <button
              onClick={() => onDismiss(id)}
              aria-label="Dismiss notification"
              className={`flex-shrink-0 rounded hover:opacity-70 focus:outline-none ${cfg.iconColor}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

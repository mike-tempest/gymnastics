'use client';

import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'warning';
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  // Handle Escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, isLoading, onOpenChange]);

  // Focus trap
  useEffect(() => {
    if (!open) return;

    const dialog = document.getElementById('confirm-dialog-content');
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element on open
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [open]);

  if (!open) return null;

  const getConfirmButtonClasses = () => {
    const baseClasses = 'px-6 py-3 min-h-[44px] rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
    
    switch (variant) {
      case 'danger':
        return `${baseClasses} bg-red-500 text-white hover:bg-red-600`;
      case 'warning':
        return `${baseClasses} bg-yellow-500 text-dark-primary hover:bg-yellow-400`;
      case 'default':
      default:
        return `${baseClasses} bg-brand text-dark-primary hover:bg-brand-light`;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => !isLoading && onOpenChange(false)}
    >
      <div
        id="confirm-dialog-content"
        className="w-full max-w-md mx-auto bg-dark-primary rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 
          id="confirm-dialog-title" 
          className="font-serif text-2xl md:text-3xl text-white mb-3"
        >
          {title}
        </h2>
        <p 
          id="confirm-dialog-description" 
          className="text-white/70 text-base leading-relaxed mb-8"
        >
          {description}
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
            className="px-6 py-3 min-h-[44px] rounded-xl font-semibold text-white/80 bg-dark-primary hover:text-white hover:bg-white/10 transition-all border border-white/10 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={async () => {
              await onConfirm();
            }}
            className={getConfirmButtonClasses()}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Please wait...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

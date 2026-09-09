'use client';

import { useEffect, useRef } from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  familyName: string;
  isDeleting: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  familyName,
  isDeleting,
}: DeleteConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isDeleting, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current && !isDeleting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-md mx-4">
        <div className="p-4 sm:p-8">
          {/* Warning Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          <h2
            id="family-delete-modal-title"
            className="text-2xl font-bold text-white text-center mb-2"
          >
            Remove Family
          </h2>
          <p className="text-text-secondary text-center mb-8">
            Are you sure you want to remove{' '}
            <span className="text-white font-semibold">{familyName}</span>? This action cannot be
            undone and will remove all associated records.
          </p>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-center gap-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="w-full sm:w-auto px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/10 transition-all disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-h-[44px]"
            >
              {isDeleting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Removing...</span>
                </>
              ) : (
                <span>Remove Family</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

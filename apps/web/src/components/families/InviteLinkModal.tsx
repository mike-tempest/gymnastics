'use client';

import { useState } from 'react';

interface InviteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteUrl: string;
  familyName: string;
}

export default function InviteLinkModal({
  isOpen,
  onClose,
  inviteUrl,
  familyName,
}: InviteLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // clipboard copy failed silently
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="invite-link-modal-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-dark-primary rounded-3xl shadow-lg border border-white/10 p-8">
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 text-text-tertiary hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand rounded-full mb-4 shadow-sm">
              <svg
                className="w-8 h-8 text-dark-primary"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h2 id="invite-link-modal-title" className="text-3xl font-bold text-white">Parent Invitation Link</h2>
            <p className="text-text-secondary text-lg mt-2">
              Share this link with parents of {familyName}
            </p>
          </div>

          {/* Link Display */}
          <div className="mb-6">
            <label htmlFor="invite-url" className="block text-sm font-bold text-white mb-2">
              Invitation URL
            </label>
            <div className="flex items-center space-x-3">
              <input
                id="invite-url"
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-4 py-3 bg-white/10 border-2 border-white/10 rounded-button text-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                onClick={handleCopy}
                className={`px-6 py-3 rounded-button font-bold transition-all flex items-center space-x-2 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-brand text-dark-primary hover:bg-brand-light'
                } shadow-sm`}
              >
                {copied ? (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-dark-primary/80 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-3">How to use this link</h3>
            <ul className="space-y-2 text-text-secondary">
              <li className="flex items-start space-x-2">
                <svg
                  className="w-5 h-5 text-brand mt-0.5 flex-shrink-0"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span>Send this link via email, text, or any messaging platform</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg
                  className="w-5 h-5 text-brand mt-0.5 flex-shrink-0"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span>Parents can register a new account or link their existing account</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg
                  className="w-5 h-5 text-brand mt-0.5 flex-shrink-0"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span>Once accepted, they will have access to their family portal</span>
              </li>
            </ul>
          </div>

          {/* Close Button */}
          <div className="mt-8">
            <button
              onClick={onClose}
              className="w-full px-8 py-4 bg-dark-primary/80 text-white rounded-button font-bold hover:bg-white/10 transition-all border border-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

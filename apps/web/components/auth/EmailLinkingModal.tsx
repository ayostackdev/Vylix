'use client';

import React, { useState, useCallback } from 'react';
import { useEmailLinking } from '@/hooks/useEmailLinking';

export interface EmailLinkingModalProps {
  isOpen: boolean;
  userId: string;
  currentEmail: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Progressive onboarding modal for email linking.
 * Presented to students after they authenticate with institutional email.
 * Allows them to optionally link a personal email (Gmail) for post-graduation access.
 */
export function EmailLinkingModal({
  isOpen,
  userId,
  currentEmail,
  onClose,
  onSuccess,
}: EmailLinkingModalProps) {
  const { linkIdentity, setPrimaryEmail } = useEmailLinking();
  const [personalEmail, setPersonalEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLinkEmail = useCallback(async () => {
    if (!personalEmail || !personalEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Link the personal email to the user account
      const result = await linkIdentity({
        userId,
        email: personalEmail,
        provider: personalEmail.includes('@gmail') ? 'google' : 'email',
      });

      if (result.success) {
        setSuccessMessage(
          `${personalEmail} has been successfully linked to your account. You'll keep access to your Private Vault even after graduation!`
        );
        setPersonalEmail('');

        // Auto-close after 3 seconds
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link email';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [personalEmail, userId, linkIdentity, onClose, onSuccess]);

  const handleDismiss = useCallback(() => {
    setPersonalEmail('');
    setError(null);
    setSuccessMessage(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-900">Secure Your Private Vault</h2>
        <p className="mt-2 text-sm text-gray-600">
          Link a personal email to keep access to your Private Vault after you graduate from FUNAAB.
        </p>

        {/* Current Email Display */}
        <div className="mt-4 rounded-md bg-blue-50 p-3">
          <p className="text-xs font-medium text-gray-500">CURRENT EMAIL</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{currentEmail}</p>
          <p className="mt-1 text-xs text-gray-600">Your institutional email (verified)</p>
        </div>

        {/* Email Input or Success Message */}
        {successMessage ? (
          <div className="mt-4 rounded-md bg-green-50 p-3">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Email Input */}
            <div className="mt-4">
              <label htmlFor="personalEmail" className="block text-sm font-medium text-gray-700">
                Personal Email (Gmail, Yahoo, etc.)
              </label>
              <input
                id="personalEmail"
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                We'll never share this with anyone. Your vault will remain private.
              </p>
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          {!successMessage && (
            <>
              <button
                onClick={handleDismiss}
                disabled={isLoading}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isLoading ? 'Linking...' : 'Skip for Now'}
              </button>
              <button
                onClick={handleLinkEmail}
                disabled={isLoading || !personalEmail}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Linking...' : 'Link Email'}
              </button>
            </>
          )}

          {successMessage && (
            <button
              onClick={handleDismiss}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Continue to Dashboard
            </button>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-4 rounded-md bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-600">WHY THIS MATTERS</p>
          <p className="mt-2 text-xs text-gray-600">
            When you graduate, your institutional email will expire. By linking a personal email now, you'll maintain permanent access to all your study materials and Private Vault contents.
          </p>
        </div>
      </div>
    </div>
  );
}

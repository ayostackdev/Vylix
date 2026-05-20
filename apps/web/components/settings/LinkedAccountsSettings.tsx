'use client';

import React, { useEffect, useState } from 'react';
import { useEmailLinking } from '@/hooks/useEmailLinking';

export interface LinkedAccountsSettingsProps {
  userId: string;
}

/**
 * Linked Accounts Settings Component
 * Allows users to manage their primary and fallback emails
 */
export function LinkedAccountsSettings({ userId }: LinkedAccountsSettingsProps) {
  const { getUserEmails } = useEmailLinking();
  const [emails, setEmails] = useState<Array<{ id: string; email: string; isPrimary: boolean; isVerified: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [isAddingEmail, setIsAddingEmail] = useState(false);

  useEffect(() => {
    const loadEmails = async () => {
      try {
        const data = await getUserEmails(userId);
        setEmails(data.emails || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load emails');
      } finally {
        setIsLoading(false);
      }
    };

    loadEmails();
  }, [userId, getUserEmails]);

  const handleAddEmail = async () => {
    if (!newEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsAddingEmail(true);
    setError(null);

    try {
      // This would call the email linking function
      setNewEmail('');
      // Reload emails
      const data = await getUserEmails(userId);
      setEmails(data.emails || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add email');
    } finally {
      setIsAddingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Linked Accounts</h2>
        <p className="text-gray-600">Manage your email addresses and account identities</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Current Linked Emails */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Your Emails</h3>
            {emails.length === 0 ? (
              <p className="text-gray-600 text-sm">No emails linked yet</p>
            ) : (
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{email.email}</p>
                      <div className="flex gap-2 mt-1">
                        {email.isPrimary && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Primary
                          </span>
                        )}
                        {email.isVerified && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Verified
                          </span>
                        )}
                        {!email.isVerified && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending Verification
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!email.isPrimary && (
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                          Make Primary
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Email */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Add Another Email</h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter your personal email"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddEmail}
                disabled={isAddingEmail || !newEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {isAddingEmail ? 'Adding...' : 'Add Email'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              This email will be linked to your account via Google OAuth or manual verification
            </p>
          </div>

          {/* Why Link Multiple Emails */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">Why link multiple emails?</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Keep access to your Private Vault after graduation</li>
              <li>• Use either email to log in seamlessly</li>
              <li>• Your vault and materials stay with your account ID, not your email</li>
              <li>• Personal emails persist, institutional emails expire</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

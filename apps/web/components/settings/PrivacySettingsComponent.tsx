'use client';

import React, { useEffect, useState } from 'react';
import { usePrivacySettings, PrivacySettings } from '@/hooks/usePrivacySettings';

export interface PrivacySettingsComponentProps {
  userId: string;
}

/**
 * Privacy Settings Component
 * Allows users to control their privacy and enable stealth mode
 */
export function PrivacySettingsComponent({ userId }: PrivacySettingsComponentProps) {
  const { getPrivacySettings, updatePrivacySettings, toggleStealthMode, isLoading } =
    usePrivacySettings();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTogglingStealthMode, setIsTogglingStealthMode] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const data = await getPrivacySettings(userId);
      setSettings(data);
    };

    loadSettings();
  }, [userId, getPrivacySettings]);

  const handleToggleSetting = async (
    key: keyof PrivacySettings,
    value: boolean
  ) => {
    const updated = await updatePrivacySettings(userId, { [key]: value });
    if (updated) {
      setSettings(updated);
      setSuccessMessage('Privacy settings updated');
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setError('Failed to update settings');
    }
  };

  const handleToggleStealthMode = async () => {
    setIsTogglingStealthMode(true);
    const result = await toggleStealthMode(userId);
    if (result && typeof result === 'object' && 'isStealthMode' in result) {
      setSettings((prev) =>
        prev ? { ...prev, isStealthMode: result.isStealthMode } : null
      );
      setSuccessMessage((result as any).message || 'Stealth mode updated');
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setError('Failed to toggle stealth mode');
    }
    setIsTogglingStealthMode(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Privacy Settings</h2>
        <p className="text-gray-600">Control your visibility and how your profile appears to others</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          ✓ {successMessage}
        </div>
      )}

      {isLoading || !settings ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Stealth Mode */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  🕵️ Stealth Mode
                </h3>
                <p className="text-gray-700 mt-2">
                  When enabled, your posts in the Public Pulse will appear as "Anonymous Student"
                  instead of showing your name and profile.
                </p>
                <div className="mt-3 space-y-2 text-sm text-gray-700 bg-white bg-opacity-50 p-3 rounded">
                  <p>✓ Ask questions without embarrassment</p>
                  <p>✓ Share content anonymously</p>
                  <p>✓ Participate freely without judgment</p>
                  <p>✓ Your profile still shows all your badges and contributions</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleToggleStealthMode}
                disabled={isTogglingStealthMode}
                title={`Toggle stealth mode ${settings.isStealthMode ? 'off' : 'on'}`}
                className={`ml-4 flex-shrink-0 relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
                  settings.isStealthMode
                    ? 'bg-purple-600'
                    : 'bg-gray-300'
                } ${isTogglingStealthMode ? 'opacity-50' : ''}`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    settings.isStealthMode ? 'translate-x-9' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.isStealthMode && (
              <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded text-purple-900 text-sm">
                ✓ Stealth mode is currently <strong>ENABLED</strong>
              </div>
            )}
          </div>

          {/* Profile Visibility Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Profile Visibility</h3>

            <div className="space-y-3">
              {/* Show Contributions */}
              <label className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showContributions}
                  onChange={(e) =>
                    handleToggleSetting('showContributions', e.target.checked)
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="ml-3">
                  <p className="font-medium text-gray-900">Show Badges & Contributions</p>
                  <p className="text-sm text-gray-600">
                    Allow others to see your contribution score and badges on your profile
                  </p>
                </span>
              </label>

              {/* Show Department */}
              <label className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showDepartment}
                  onChange={(e) =>
                    handleToggleSetting('showDepartment', e.target.checked)
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="ml-3">
                  <p className="font-medium text-gray-900">Show College & Department</p>
                  <p className="text-sm text-gray-600">
                    Display your college and department information publicly
                  </p>
                </span>
              </label>

              {/* Show Email */}
              <label className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showEmail}
                  onChange={(e) =>
                    handleToggleSetting('showEmail', e.target.checked)
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="ml-3">
                  <p className="font-medium text-gray-900">Show Email on Profile</p>
                  <p className="text-sm text-gray-600">
                    Allow others to see your email address (not recommended)
                  </p>
                </span>
              </label>
            </div>
          </div>

          {/* Privacy Guidelines */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-3">🔒 Privacy Best Practices</p>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Keep your email hidden unless sharing with trusted contacts</li>
              <li>• Use stealth mode if you feel uncomfortable using your real name</li>
              <li>• Your data is never sold or shared with third parties</li>
              <li>• All vault contents are encrypted end-to-end</li>
              <li>• You can change these settings anytime</li>
            </ul>
          </div>

          {/* Profile Preview */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Public Profile Preview</h3>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              {settings.isStealthMode ? (
                <p className="text-gray-600">
                  <strong>Anonymous Student</strong>
                  <span className="text-xs ml-2 text-gray-500">(posts appear anonymously)</span>
                </p>
              ) : (
                <p className="text-gray-900">Your real name will be visible on your profile</p>
              )}

              {settings.showContributions && (
                <p className="text-gray-600 text-sm mt-2">
                  ✓ Badges and contribution score will be visible
                </p>
              )}

              {settings.showDepartment && (
                <p className="text-gray-600 text-sm">
                  ✓ College and department information will be visible
                </p>
              )}

              {settings.showEmail && (
                <p className="text-sm text-orange-700">
                  ⚠️ Email will be publicly visible (not recommended)
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

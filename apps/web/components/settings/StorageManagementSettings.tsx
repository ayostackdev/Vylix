'use client';

import React, { useState } from 'react';
import { useStorageManagement } from '@/hooks/useStorageManagement';

/**
 * Storage Management Settings Component
 * Shows local device storage usage for cached PDFs and allows clearing cache
 */
export function StorageManagementSettings() {
  const {
    storageStats,
    isLoading,
    error,
    clearLocalCache,
    removeVaultItem,
    formatStorageSize,
    getExpiryDate,
  } = useStorageManagement();

  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClearCache = async () => {
    const result = await clearLocalCache();
    if (result.success) {
      setSuccessMessage(result.message);
      setShowConfirmClear(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const result = await removeVaultItem(itemId);
    if (result.success) {
      setSuccessMessage(result.message);
      setItemToRemove(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const storagePercentage = () => {
    // Assuming 50MB limit for local storage
    const limitMB = 50;
    const usedMB = storageStats.totalSize / (1024 * 1024);
    return Math.min(100, (usedMB / limitMB) * 100);
  };

  const getStorageWidthClass = () => {
    const percentage = storagePercentage();

    if (percentage <= 0) return 'w-0';
    if (percentage <= 8) return 'w-1/12';
    if (percentage <= 16) return 'w-1/6';
    if (percentage <= 25) return 'w-1/4';
    if (percentage <= 33) return 'w-1/3';
    if (percentage <= 50) return 'w-1/2';
    if (percentage <= 67) return 'w-2/3';
    if (percentage <= 75) return 'w-3/4';
    if (percentage <= 84) return 'w-5/6';
    if (percentage <= 92) return 'w-11/12';
    return 'w-full';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Storage Management</h2>
        <p className="text-gray-600">Manage your local device storage for offline access to PDFs</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-emerald-50/35 border border-blue-100 rounded-lg text-green-800 text-sm">
          ✓ {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Storage Overview */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
            <div className="mb-4">
              <div className="flex justify-between items-baseline mb-2">
                <p className="font-semibold text-gray-900">Local Storage Usage</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatStorageSize(storageStats.totalSize)}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                {/* eslint-disable jsx-a11y/no-static-element-interactions */}
                <div
                  className={`h-full transition-all ${getStorageWidthClass()} ${
                    storagePercentage() > 80 ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                ></div>
              </div>

              <div className="flex justify-between text-xs text-gray-600 mt-2">
                <span>{storagePercentage().toFixed(0)}% used</span>
                <span>~50 MB limit</span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <p>📁 <strong>{storageStats.itemCount}</strong> saved PDFs</p>
              {storagePercentage() > 80 && (
                <p className="text-orange-700 font-medium">⚠️ Storage running low. Consider clearing cache.</p>
              )}
            </div>
          </div>

          {/* Saved Items */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Saved PDFs ({storageStats.itemCount})</h3>

            {storageStats.items.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-600">
                <p>No PDFs saved locally yet</p>
                <p className="text-sm mt-1">Save PDFs from your Private Vault for offline access</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {storageStats.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.title}</p>
                      <div className="flex gap-2 text-xs text-gray-600 mt-1">
                        <span>{formatStorageSize(item.size)}</span>
                        <span>•</span>
                        <span>
                          Saved:{' '}
                          {item.savedAt.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span className="text-orange-600 font-semibold">
                          Expires:{' '}
                          {getExpiryDate(item.savedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setItemToRemove(item.id)}
                      className="text-red-600 hover:text-red-800 font-medium text-sm ml-2"
                    >
                      Remove
                    </button>

                    {/* Remove Confirmation */}
                    {itemToRemove === item.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
                        <p className="text-sm font-medium text-gray-900 mb-2">Remove this PDF?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setItemToRemove(null)}
                            className="px-3 py-1 bg-gray-200 text-gray-900 text-sm rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear All Button */}
          {storageStats.itemCount > 0 && (
            <div className="border-t pt-6">
              <button
                onClick={() => setShowConfirmClear(true)}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Clear All Cached PDFs
              </button>

              {/* Clear Confirmation */}
              {showConfirmClear && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-semibold text-red-900 mb-3">Clear all cached PDFs?</p>
                  <p className="text-sm text-red-800 mb-4">
                    This will remove all {storageStats.itemCount} saved PDFs from your device.
                    You'll need to re-download them to read offline.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearCache}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium text-sm"
                    >
                      Clear Cache
                    </button>
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 font-medium text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">💾 About Local Storage</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• PDFs are stored on your device only (end-to-end encrypted)</li>
              <li>• ⏰ PDFs auto-delete after 1 year to free up space</li>
              <li>• You can manually remove any PDF before expiry</li>
              <li>• Storage is cleared when you uninstall or clear app data</li>
              <li>• Larger files take up more device storage</li>
              <li>• Each device has its own storage limit (~50 MB)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

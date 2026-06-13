'use client';

import { useCallback, useState, useEffect } from 'react';

export interface StorageStats {
  totalSize: number;
  itemCount: number;
  items: {
    id: string;
    title: string;
    size: number;
    savedAt: Date;
  }[];
}

/**
 * Hook to manage offline storage (IndexedDB) for Private Vault PDFs
 * Provides storage stats and cache clearing functionality
 */
export function useStorageManagement() {
  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalSize: 0,
    itemCount: 0,
    items: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculates storage used by all IndexedDB databases
   */
  const calculateStorageUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try using Storage API first (modern browsers)
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage ?? 0) / (1024 * 1024);
        const quotaMB = (estimate.quota ?? 0) / (1024 * 1024);

        // Query IndexedDB for specific vault items
        const vaultItems = await getVaultItemsFromIndexedDB();

        setStorageStats({
          totalSize: estimate.usage ?? 0,
          itemCount: vaultItems.length,
          items: vaultItems,
        });
      } else {
        // Fallback: manually count IndexedDB items
        const vaultItems = await getVaultItemsFromIndexedDB();
        const totalSize = vaultItems.reduce((sum, item) => sum + item.size, 0);

        setStorageStats({
          totalSize,
          itemCount: vaultItems.length,
          items: vaultItems,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to calculate storage';
      setError(errorMsg);
      console.error('Storage calculation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Retrieves all vault items from IndexedDB
   */
  const getVaultItemsFromIndexedDB = useCallback(async () => {
    try {
      const db = await openVaultDatabase();
      const transaction = db.transaction(['vaultItems'], 'readonly');
      const store = transaction.objectStore('vaultItems');
      const allItems = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return allItems.map((item) => ({
        id: item.id,
        title: item.title,
        size: item.blob?.size || item.file?.size || 0,
        savedAt: new Date(item.savedAt),
      }));
    } catch (err) {
      console.error('Error reading from IndexedDB:', err);
      return [];
    }
  }, []);

  /**
   * Opens or creates the vault database
   */
  const openVaultDatabase = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('vylix-vault', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('vaultItems')) {
          db.createObjectStore('vaultItems', { keyPath: 'id' });
        }
      };
    });
  }, []);

  /**
   * Clears all cached vault items from IndexedDB
   */
  const clearLocalCache = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const db = await openVaultDatabase();
      const transaction = db.transaction(['vaultItems'], 'readwrite');
      const store = transaction.objectStore('vaultItems');

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      setStorageStats({
        totalSize: 0,
        itemCount: 0,
        items: [],
      });

      return {
        success: true,
        message: 'Local cache cleared successfully',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear cache';
      setError(errorMsg);
      console.error('Error clearing cache:', err);
      return {
        success: false,
        message: errorMsg,
      };
    } finally {
      setIsLoading(false);
    }
  }, [openVaultDatabase]);

  /**
   * Removes a specific vault item
   */
  const removeVaultItem = useCallback(
    async (itemId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const db = await openVaultDatabase();
        const transaction = db.transaction(['vaultItems'], 'readwrite');
        const store = transaction.objectStore('vaultItems');

        await new Promise<void>((resolve, reject) => {
          const request = store.delete(itemId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Recalculate storage
        await calculateStorageUsage();

        return {
          success: true,
          message: 'Item removed successfully',
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to remove item';
        setError(errorMsg);
        console.error('Error removing item:', err);
        return {
          success: false,
          message: errorMsg,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [openVaultDatabase, calculateStorageUsage]
  );

  /**
   * Formats bytes to human-readable storage size
   */
  const formatStorageSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  /**
   * Calculates expiry date for a saved item (1 year from savedAt)
   */
  const getExpiryDate = useCallback((savedAt: Date): Date => {
    const expiryDate = new Date(savedAt);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    return expiryDate;
  }, []);

  /**
   * Checks if an item has expired (older than 1 year)
   */
  const isExpired = useCallback((savedAt: Date): boolean => {
    const now = new Date();
    const expiryDate = getExpiryDate(savedAt);
    return now > expiryDate;
  }, [getExpiryDate]);

  /**
   * Automatically removes PDFs older than 1 year (365 days)
   * Runs on app load to clean up expired items
   */
  const cleanupExpiredItems = useCallback(async (): Promise<{ removed: number; message: string }> => {
    try {
      const db = await openVaultDatabase();
      const transaction = db.transaction(['vaultItems'], 'readonly');
      const store = transaction.objectStore('vaultItems');

      const allItems = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Find expired items
      const expiredItems = allItems.filter((item) => isExpired(new Date(item.savedAt)));

      if (expiredItems.length > 0) {
        // Delete expired items
        const deleteTransaction = db.transaction(['vaultItems'], 'readwrite');
        const deleteStore = deleteTransaction.objectStore('vaultItems');

        for (const item of expiredItems) {
          await new Promise<void>((resolve, reject) => {
            const request = deleteStore.delete(item.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }

        console.log(`Cleaned up ${expiredItems.length} expired PDF(s) older than 1 year`);

        // Recalculate storage after cleanup
        await calculateStorageUsage();

        return {
          removed: expiredItems.length,
          message: `Cleaned up ${expiredItems.length} expired PDF(s) older than 1 year`,
        };
      }

      return {
        removed: 0,
        message: 'No expired items to clean up',
      };
    } catch (err) {
      console.error('Error during cleanup:', err);
      return {
        removed: 0,
        message: 'Cleanup process encountered an error',
      };
    }
  }, [openVaultDatabase, isExpired, calculateStorageUsage]);

  // Load storage stats on mount and cleanup expired items
  useEffect(() => {
    calculateStorageUsage();
    cleanupExpiredItems();
  }, [calculateStorageUsage, cleanupExpiredItems]);

  return {
    storageStats,
    isLoading,
    error,
    calculateStorageUsage,
    clearLocalCache,
    removeVaultItem,
    formatStorageSize,
    getExpiryDate,
    isExpired,
    cleanupExpiredItems,
  };
}

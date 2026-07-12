'use client';

import { get, set, del, keys, createStore } from 'idb-keyval'

const chatStore = createStore('vylix-chat', 'messages')
const docStore = createStore('vylix-docs', 'documents')
const cacheStore = createStore('vylix-cache', 'cache')

export const offlineStore = {
  // Chat messages
  async saveChatMessage(courseId: string, message: any) {
    const existing = await get<any[]>(courseId, chatStore) || []
    existing.push({ ...message, cachedAt: Date.now() })
    await set(courseId, existing, chatStore)
  },

  async getChatHistory(courseId: string): Promise<any[]> {
    return (await get<any[]>(courseId, chatStore)) || []
  },

  async clearChatHistory(courseId: string) {
    await del(courseId, chatStore)
  },

  // Document cache
  async cacheDocument(docId: string, data: any) {
    await set(docId, { ...data, cachedAt: Date.now() }, docStore)
  },

  async getCachedDocument(docId: string): Promise<any | null> {
    return (await get(docId, docStore)) || null
  },

  async clearDocumentCache() {
    const allKeys = await keys(docStore)
    await Promise.all(allKeys.map((k) => del(k, docStore)))
  },

  // Generic cache
  async setCache(key: string, value: any, ttlMs = 3600000) {
    await set(key, { value, expiresAt: Date.now() + ttlMs }, cacheStore)
  },

  async getCache<T>(key: string): Promise<T | null> {
    const entry = await get<{ value: T; expiresAt: number }>(key, cacheStore)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      await del(key, cacheStore)
      return null
    }
    return entry.value
  },

  async clearCache() {
    const allKeys = await keys(cacheStore)
    await Promise.all(allKeys.map((k) => del(k, cacheStore)))
  },

  // Storage usage
  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate()
    }
    return { usage: 0, quota: 0 }
  },
}

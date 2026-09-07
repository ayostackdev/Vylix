'use client';

import { createStore, del, get, set, keys } from 'idb-keyval';

/**
 * Client-side LRU cache for AI Q&A responses (study plans + document chat).
 *
 * Why this exists: the service worker runs NetworkOnly for /api/* and
 * react-query only persists *queries* — never mutation results — so re-asking
 * the same question (common exam questions, follow-up chips tapped again after
 * a reload) always hit the network and the backend quota. This store keeps a
 * few MB of answers in IndexedDB: identical questions render instantly, work
 * offline, and replay cost-free locally.
 *
 * Keys are derived from the *inputs* of the answer (course+prompt+tier or
 * document+query), so nothing is shared between users; a user who re-asks gets
 * their own cached answer. General (multi-turn) chat is intentionally not
 * cached because turn history makes the key ambiguous.
 */

export const QA_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB
const INDEX_KEY = 'index';

interface CachedEntry<V> {
  value: V;
  savedAt: number;
  expiresAt: number;
}

type QaCacheIndex = Record<string, { size: number; savedAt: number }>;

let qaStore: ReturnType<typeof createStore> | null = null;
let indexMemo: QaCacheIndex | null = null;

function getStore() {
  // Lazy init so the module can be imported in non-browser tests
  // (jsdom does not provide a global `indexedDB`).
  if (!qaStore) qaStore = createStore('vylix-qa-cache', 'entries');
  return qaStore;
}

// ── key derivation (pure, unit-testable) ─────────────────────────────

/** Deterministic 64-bit (two 32-bit seeds) hash of free text. */
export function hashText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h2 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** Cache key for a study-agent run (identical prompt + course + tier). */
export function studyAgentCacheKey(courseCode: string, prompt: string, taskTier: string): string {
  return `qa:study:${courseCode}:${taskTier}:${hashText(prompt)}`;
}

/** Cache key for a document-scoped chat turn (identical document + query). */
export function documentChatCacheKey(documentId: string, query: string): string {
  return `qa:chat:${documentId}:${hashText(query)}`;
}

/** Approximate serialized size of a cache payload, for the LRU budget. */
export function estimatedJsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

export interface DocumentChatResult {
  answer: string;
  context_chunks?: string[];
  follow_up_questions?: string[];
}

// ── LRU eviction over a byte budget ──────────────────────────────────

async function readIndex(): Promise<QaCacheIndex> {
  if (indexMemo) return indexMemo;
  indexMemo = (await get<QaCacheIndex>(INDEX_KEY, getStore())) ?? {};
  return indexMemo;
}

async function writeIndex(index: QaCacheIndex): Promise<void> {
  indexMemo = index;
  await set(INDEX_KEY, index, getStore());
}

async function evictOldest(preserveKeys: string[]): Promise<void> {
  const index = await readIndex();
  const preserve = new Set(preserveKeys);
  let total = Object.values(index).reduce((acc, entry) => acc + entry.size, 0);
  if (total <= MAX_TOTAL_BYTES) return;

  const oldestFirst = Object.entries(index)
    .filter(([key]) => !preserve.has(key))
    .sort((a, b) => a[1].savedAt - b[1].savedAt);

  for (const [key, meta] of oldestFirst) {
    if (total <= MAX_TOTAL_BYTES) break;
    await del(key, getStore());
    delete index[key];
    total -= meta.size;
  }
  await writeIndex(index);
}

// ── public API ───────────────────────────────────────────────────────

export async function getQaCached<V>(key: string): Promise<V | null> {
  const entry = await get<CachedEntry<V> | undefined>(key, getStore());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    await del(key, getStore());
    const index = await readIndex();
    delete index[key];
    await writeIndex(index);
    return null;
  }
  // Refresh recency so hot entries survive eviction.
  const index = await readIndex();
  if (index[key]) {
    index[key].savedAt = Date.now();
    await writeIndex(index);
  }
  return entry.value;
}

export async function putQaCached<V>(
  key: string,
  value: V,
  ttlMs: number = QA_TTL_MS,
): Promise<void> {
  const savedAt = Date.now();
  const entry: CachedEntry<V> = { value, savedAt, expiresAt: savedAt + ttlMs };
  let size = estimatedJsonBytes(value);
  try {
    await set(key, entry, getStore());
  } catch (error) {
    console.warn('[qa-cache] Could not persist entry:', error);
    return;
  }
  if (size === 0) size = 8;
  const index = await readIndex();
  index[key] = { size, savedAt };
  await writeIndex(index);
  await evictOldest([key]);
}

export async function clearQaCache(): Promise<void> {
  const allKeys = await keys(getStore());
  await Promise.all(allKeys.map((key) => del(key, getStore())));
  indexMemo = {};
  await writeIndex(indexMemo);
}

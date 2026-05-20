import { del, get, set } from 'idb-keyval';
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client';

const PERSIST_KEY = 'campulse-react-query-cache-v1';

export const indexedDBPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await set(PERSIST_KEY, JSON.stringify(client));
  },
  restoreClient: async () => {
    const cached = await get<string>(PERSIST_KEY);
    if (!cached) {
      return undefined;
    }

    try {
      return JSON.parse(cached) as PersistedClient;
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    await del(PERSIST_KEY);
  }
};

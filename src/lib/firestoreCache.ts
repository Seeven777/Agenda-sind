import { getDocs, Query } from 'firebase/firestore';

type CachedQuery<T> = {
  expiresAt: number;
  data: Array<{ id: string; data: T }>;
};

const queryCache = new Map<string, CachedQuery<unknown>>();
const inFlightQueries = new Map<string, Promise<Array<{ id: string; data: unknown }>>>();

export async function getCachedDocs<T>(
  cacheKey: string,
  firestoreQuery: Query,
  ttlMs = 2 * 60 * 1000
): Promise<Array<{ id: string; data: T }>> {
  const now = Date.now();
  const cached = queryCache.get(cacheKey) as CachedQuery<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inFlight = inFlightQueries.get(cacheKey) as Promise<Array<{ id: string; data: T }>> | undefined;
  if (inFlight) {
    return inFlight;
  }

  const request = getDocs(firestoreQuery)
    .then((snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as T }));
      queryCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        data,
      });
      return data;
    })
    .finally(() => {
      inFlightQueries.delete(cacheKey);
    });

  inFlightQueries.set(cacheKey, request);
  return request;
}

export function invalidateFirestoreCache(prefix?: string) {
  if (!prefix) {
    queryCache.clear();
    inFlightQueries.clear();
    return;
  }

  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) queryCache.delete(key);
  }

  for (const key of inFlightQueries.keys()) {
    if (key.startsWith(prefix)) inFlightQueries.delete(key);
  }
}

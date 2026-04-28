import {
  addDoc,
  updateDoc,
  setDoc,
  DocumentReference,
  DocumentData,
  CollectionReference,
  UpdateData
} from 'firebase/firestore';
import { invalidateFirestoreCache } from './firestoreCache';

const writeCache = new Map<string, number>();
const THROTTLE_MS = 2000;

function isThrottled(key: string): boolean {
  const now = Date.now();
  const lastWrite = writeCache.get(key) || 0;

  if (now - lastWrite < THROTTLE_MS) {
    console.warn(`[Firestore Guard] Operacao bloqueada por excesso de frequencia: ${key}`);
    return true;
  }

  writeCache.set(key, now);
  return false;
}

export async function safeAddDoc<T extends DocumentData>(
  colRef: CollectionReference<T>,
  data: T
) {
  const key = `add_${colRef.path}`;
  if (isThrottled(key)) return null;

  if (import.meta.env.DEV) {
    console.log(`[Firestore Write] addDoc na colecao: ${colRef.path}`, data);
  }

  const result = await addDoc(colRef, data);
  invalidateFirestoreCache();
  return result;
}

export async function safeUpdateDoc<T extends DocumentData>(
  docRef: DocumentReference<T>,
  data: UpdateData<T>
) {
  const key = `update_${docRef.path}`;
  if (isThrottled(key)) return;

  if (import.meta.env.DEV) {
    console.log(`[Firestore Write] updateDoc no documento: ${docRef.path}`, data);
  }

  const result = await updateDoc(docRef, data);
  invalidateFirestoreCache();
  return result;
}

export async function safeSetDoc<T extends DocumentData>(
  docRef: DocumentReference<T>,
  data: T,
  options?: { merge?: boolean }
) {
  const key = `set_${docRef.path}`;
  if (isThrottled(key)) return;

  if (import.meta.env.DEV) {
    console.log(`[Firestore Write] setDoc no documento: ${docRef.path}`, data);
  }

  const result = await setDoc(docRef, data, options || {});
  invalidateFirestoreCache();
  return result;
}

export function clearWriteCache() {
  writeCache.clear();
}

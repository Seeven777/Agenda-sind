import {
    collection,
    addDoc,
    updateDoc,
    setDoc,
    DocumentReference,
    DocumentData,
    CollectionReference,
    UpdateData
} from 'firebase/firestore';

// Trava de memória para evitar escritas idênticas em curto intervalo (anti-debounce/loop)
const writeCache = new Map<string, number>();
const THROTTLE_MS = 2000;

/**
 * Impede que a mesma operação de escrita ocorra repetidamente em um curto espaço de tempo.
 */
function isThrottled(key: string): boolean {
    const now = Date.now();
    const lastWrite = writeCache.get(key) || 0;
    if (now - lastWrite < THROTTLE_MS) {
        console.warn(`[Firestore Guard] Operação bloqueada por excesso de frequência: ${key}`);
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
        console.log(`[Firestore Write] addDoc na coleção: ${colRef.path}`, data);
    }

    return addDoc(colRef, data);
}

export async function safeUpdateDoc<T extends DocumentData>(
    docRef: DocumentReference<T>,
    data: UpdateData<T>
) {
    const key = `update_${docRef.path}`;
    // Para updates, permitimos mais frequência se os dados forem diferentes, 
    // mas aqui bloqueamos repetições globais para simplificar a trava de segurança.
    if (isThrottled(key)) return;

    if (import.meta.env.DEV) {
        console.log(`[Firestore Write] updateDoc no documento: ${docRef.path}`, data);
    }

    return updateDoc(docRef, data);
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

    return setDoc(docRef, data, options || {});
}

/**
 * Limpa o cache de travas (útil para testes ou logout)
 */
export function clearWriteCache() {
    writeCache.clear();
}
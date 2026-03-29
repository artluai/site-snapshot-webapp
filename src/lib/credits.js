import { doc, getDoc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase.js';

const GUEST_FREE_KEY = 'snapshot-free-used-date';

/**
 * Load user doc from Firestore. Create if new user.
 * Returns { credits, freeUsedToday }
 */
export async function loadOrCreateUser(uid, email) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    return {
      credits: data.credits || 0,
      freeUsedToday: data.freeUsedToday || null,
    };
  }

  // New user — create doc
  const newUser = {
    email: email || '',
    credits: 0,
    freeUsedToday: null,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, newUser);
  return { credits: 0, freeUsedToday: null };
}

/**
 * Check if user has used their free snapshot today.
 * Returns true if they can still use it.
 */
export function canUseFreeToday(freeUsedToday) {
  if (!freeUsedToday) return true;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return freeUsedToday !== today;
}

export function getGuestFreeUsedToday() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(GUEST_FREE_KEY) || null;
  } catch {
    return null;
  }
}

export function markGuestFreeUsed() {
  if (typeof window === 'undefined') return null;

  const today = new Date().toISOString().slice(0, 10);
  try {
    window.localStorage.setItem(GUEST_FREE_KEY, today);
  } catch {
    // Ignore storage errors and still return the current date for UI state.
  }
  return today;
}

/**
 * Mark free snapshot as used today.
 */
export async function markFreeUsed(uid) {
  const ref = doc(db, 'users', uid);
  const today = new Date().toISOString().slice(0, 10);
  await updateDoc(ref, { freeUsedToday: today });
}

/**
 * Subscribe to the current user's account record so credits stay live.
 */
export function subscribeToUser(uid, callback) {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback({ credits: 0, freeUsedToday: null });
      return;
    }

    const data = snap.data();
    callback({
      credits: data.credits || 0,
      freeUsedToday: data.freeUsedToday || null,
    });
  });
}

/**
 * Deduct 1 AI credit. Returns new credit count.
 * Throws if not enough credits.
 */
export async function deductCredit(uid, currentCredits) {
  if (currentCredits < 1) throw new Error('No credits');
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { credits: increment(-1) });
  return currentCredits - 1;
}

import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase.js';

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

/**
 * Mark free snapshot as used today.
 */
export async function markFreeUsed(uid) {
  const ref = doc(db, 'users', uid);
  const today = new Date().toISOString().slice(0, 10);
  await updateDoc(ref, { freeUsedToday: today });
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

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${error.message}`);
  }
}

function ensureAdminApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = getServiceAccount();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(bucketName ? { storageBucket: bucketName } : {}),
  });
}

const app = ensureAdminApp();

export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
export { FieldValue };

export function getJobRef(uid, jobId) {
  return adminDb.collection('users').doc(uid).collection('jobs').doc(jobId);
}

export function getUserRef(uid) {
  return adminDb.collection('users').doc(uid);
}

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const JSON_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

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

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
export { FieldValue, JSON_HEADERS };

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function getJobRef(uid, jobId = null) {
  const collectionRef = adminDb.collection('users').doc(uid).collection('jobs');
  return jobId ? collectionRef.doc(jobId) : collectionRef.doc();
}

export function normalizeUrl(rawUrl) {
  let fullUrl = `${rawUrl || ''}`.trim();
  if (!fullUrl) throw new Error('Missing URL');
  if (!/^https?:\/\//i.test(fullUrl)) fullUrl = `https://${fullUrl}`;

  const parsed = new URL(fullUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  if (fullUrl.length > 2000) throw new Error('URL too long');

  return {
    fullUrl,
    host: parsed.hostname,
  };
}

export async function verifyUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    throw Object.assign(new Error('Not authenticated'), { statusCode: 401 });
  }

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw Object.assign(new Error('Invalid token'), { statusCode: 401 });
  }
}

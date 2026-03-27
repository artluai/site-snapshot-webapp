import { auth, db } from '../firebase.js';
import { doc, onSnapshot } from 'firebase/firestore';

async function callAuthedFunction(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required');

  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export async function createJob(payload) {
  return callAuthedFunction('/.netlify/functions/create-job', {
    body: payload,
  });
}

export async function startJob(payload) {
  return callAuthedFunction('/.netlify/functions/start-job', {
    body: payload,
  });
}

export async function getArtifactUrl(jobId, disposition = 'inline') {
  const data = await callAuthedFunction('/.netlify/functions/get-artifact-url', {
    body: { jobId, disposition },
  });

  return data;
}

export function subscribeToJob(uid, jobId, callback) {
  const ref = doc(db, 'users', uid, 'jobs', jobId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }

    callback({ id: snap.id, ...snap.data() });
  });
}

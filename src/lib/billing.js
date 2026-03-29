import { auth } from '../firebase.js';

async function callAuthedFunction(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required');

  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const rawText = await res.text();
  let data = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }
  }

  if (!res.ok || !data.ok) {
    throw new Error(
      data.error
        || data.rawText
        || `Request failed (${res.status})`,
    );
  }

  return data;
}

export async function createCheckoutSession(pack) {
  return callAuthedFunction('/.netlify/functions/create-checkout', {
    body: { pack },
  });
}

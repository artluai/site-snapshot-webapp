import crypto from 'node:crypto';
import { FieldValue, adminDb, json } from './_lib/admin.js';

function parseStripeSignature(header) {
  const parts = `${header || ''}`.split(',').map((part) => part.trim()).filter(Boolean);
  const parsed = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    if (!parsed[key]) parsed[key] = [];
    parsed[key].push(value);
  }

  return parsed;
}

function verifyStripeWebhook(rawBody, signatureHeader, secret) {
  if (!signatureHeader) {
    throw Object.assign(new Error('Missing Stripe signature'), { statusCode: 400 });
  }

  if (!secret) {
    throw Object.assign(new Error('Missing Stripe webhook secret'), { statusCode: 500 });
  }

  const parsed = parseStripeSignature(signatureHeader);
  const timestamp = parsed.t?.[0];
  const signatures = parsed.v1 || [];

  if (!timestamp || signatures.length === 0) {
    throw Object.assign(new Error('Invalid Stripe signature header'), { statusCode: 400 });
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const matched = signatures.some((signature) => {
    const signatureBuf = Buffer.from(signature, 'utf8');
    return signatureBuf.length === expectedBuf.length && crypto.timingSafeEqual(signatureBuf, expectedBuf);
  });

  if (!matched) {
    throw Object.assign(new Error('Stripe signature verification failed'), { statusCode: 400 });
  }

  return JSON.parse(rawBody);
}

async function applyCompletedCheckout(event) {
  const session = event.data?.object || {};
  if (session.payment_status !== 'paid') return { applied: false, reason: 'payment_not_paid' };

  const uid = session.metadata?.uid || session.client_reference_id || '';
  const credits = Number(session.metadata?.credits || 0);
  const pack = session.metadata?.pack || '';

  if (!uid || !Number.isFinite(credits) || credits <= 0) {
    return { applied: false, reason: 'missing_metadata' };
  }

  const eventRef = adminDb.collection('stripeEvents').doc(event.id);
  const userRef = adminDb.collection('users').doc(uid);

  let applied = false;

  await adminDb.runTransaction(async (tx) => {
    const existingEvent = await tx.get(eventRef);
    if (existingEvent.exists) return;

    tx.set(eventRef, {
      type: event.type,
      uid,
      credits,
      pack,
      stripeSessionId: session.id || '',
      createdAt: new Date().toISOString(),
    });

    tx.set(userRef, {
      credits: FieldValue.increment(credits),
      updatedAt: new Date().toISOString(),
      lastCreditPurchaseAt: new Date().toISOString(),
    }, { merge: true });

    applied = true;
  });

  return { applied };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'POST only' }, 405);
  }

  try {
    const rawBody = await req.text();
    const event = verifyStripeWebhook(
      rawBody,
      req.headers.get('stripe-signature'),
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === 'checkout.session.completed') {
      const result = await applyCompletedCheckout(event);
      return json({ ok: true, received: true, ...result });
    }

    return json({ ok: true, received: true, ignored: true });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Stripe webhook failed' }, error.statusCode || 500);
  }
}

export const config = {
  path: '/.netlify/functions/stripe-webhook',
};

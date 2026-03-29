import { json, verifyUser } from './_lib/admin.js';

const PACKS = {
  starter: {
    credits: 4,
    priceId: process.env.STRIPE_PRICE_STARTER,
  },
  pro: {
    credits: 15,
    priceId: process.env.STRIPE_PRICE_PRO,
  },
};

function getSiteBaseUrl(req) {
  const origin = req.headers.get('origin');
  const fallback = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || process.env.SITE_URL;
  const base = origin || fallback;

  if (!base) {
    throw Object.assign(new Error('Missing site URL for Stripe redirect'), { statusCode: 500 });
  }

  return base.replace(/\/$/, '');
}

async function createStripeCheckoutSession({ secretKey, priceId, uid, email, pack, credits, baseUrl }) {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${baseUrl}/?checkout=success&pack=${encodeURIComponent(pack)}&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${baseUrl}/?checkout=cancelled&pack=${encodeURIComponent(pack)}#pricing`);
  form.set('client_reference_id', uid);
  form.set('line_items[0][price]', priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('metadata[uid]', uid);
  form.set('metadata[pack]', pack);
  form.set('metadata[credits]', `${credits}`);
  form.set('allow_promotion_codes', 'true');

  if (email) {
    form.set('customer_email', email);
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw Object.assign(new Error(data.error?.message || 'Failed to create Stripe checkout session'), { statusCode: 500 });
  }

  return data;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'POST only' }, 405);
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw Object.assign(new Error('Stripe is not configured yet'), { statusCode: 500 });
    }

    const decoded = await verifyUser(req);
    const body = await req.json().catch(() => ({}));
    const pack = `${body.pack || ''}`.trim().toLowerCase();
    const config = PACKS[pack];

    if (!config) {
      throw Object.assign(new Error('Unknown credit pack'), { statusCode: 400 });
    }

    if (!config.priceId) {
      throw Object.assign(new Error(`Missing Stripe price id for pack: ${pack}`), { statusCode: 500 });
    }

    const session = await createStripeCheckoutSession({
      secretKey,
      priceId: config.priceId,
      uid: decoded.uid,
      email: decoded.email || '',
      pack,
      credits: config.credits,
      baseUrl: getSiteBaseUrl(req),
    });

    return json({
      ok: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Failed to start checkout' }, error.statusCode || 500);
  }
}

export const config = {
  path: '/.netlify/functions/create-checkout',
};

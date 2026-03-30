const DEFAULT_GOOGLE_TAG_ID = 'AW-18051354592';
const DEFAULT_CHECKOUT_LABEL = 'H-upCO2FppIcEOCfx59D';
const DEFAULT_PURCHASE_LABEL = 'OkJwCOm2opIcEOCfx59D';

const GOOGLE_TAG_ID =
  import.meta.env.VITE_GOOGLE_TAG_ID ||
  import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID ||
  DEFAULT_GOOGLE_TAG_ID;
const GOOGLE_ADS_CONVERSION_ID = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID || GOOGLE_TAG_ID || DEFAULT_GOOGLE_TAG_ID;
const CHECKOUT_LABEL = import.meta.env.VITE_GOOGLE_ADS_CHECKOUT_LABEL || DEFAULT_CHECKOUT_LABEL;
const PURCHASE_LABEL = import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL || DEFAULT_PURCHASE_LABEL;

const PACK_VALUES = {
  starter: 9.99,
  pro: 29.99,
};

let initialized = false;

function canTrack() {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && !!GOOGLE_TAG_ID;
}

function getGtag() {
  return typeof window !== 'undefined' ? window.gtag : null;
}

function trackAdsConversion(label, params = {}) {
  const gtag = getGtag();
  if (!gtag || !GOOGLE_ADS_CONVERSION_ID || !label) return;
  gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_CONVERSION_ID}/${label}`,
    ...params,
  });
}

export function initGoogleTag() {
  if (!canTrack() || initialized) return;
  initialized = true;

  if (!window.dataLayer) window.dataLayer = [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_TAG_ID)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_TAG_ID);
}

export function trackCheckoutStarted(pack) {
  const gtag = getGtag();
  if (!gtag) return;

  const value = PACK_VALUES[pack] || 0;
  gtag('event', 'begin_checkout', {
    currency: 'USD',
    value,
    items: [{ item_name: pack, price: value, quantity: 1 }],
  });
  trackAdsConversion(CHECKOUT_LABEL, { value, currency: 'USD' });
}

export function trackPurchaseCompleted({ pack, transactionId }) {
  const gtag = getGtag();
  if (!gtag) return;

  const value = PACK_VALUES[pack] || 0;
  gtag('event', 'purchase', {
    transaction_id: transactionId || '',
    value,
    currency: 'USD',
    items: [{ item_name: pack, price: value, quantity: 1 }],
  });
  trackAdsConversion(PURCHASE_LABEL, {
    transaction_id: transactionId || '',
    value,
    currency: 'USD',
  });
}

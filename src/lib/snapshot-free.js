/**
 * Fetch a URL via the Netlify proxy and clean the HTML client-side.
 * Returns cleaned HTML string ready for srcdoc / download.
 */
export async function fetchAndClean(url) {
  // Normalize URL
  let fullUrl = url.trim();
  if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;

  // Cap length per best-practices.md
  if (fullUrl.length > 2000) throw new Error('URL too long');

  const res = await fetch(`/.netlify/functions/fetch-proxy?url=${encodeURIComponent(fullUrl)}`);
  const data = await res.json();

  if (!data.ok) throw new Error(data.error || 'Fetch failed');

  const html = cleanHTML(data.html, fullUrl);
  const size = new Blob([html]).size;

  return { html, sizeKB: Math.round(size / 1024) };
}

/**
 * Client-side HTML cleaning:
 * - Strip <script> tags
 * - Strip <noscript> tags
 * - Strip tracking pixels (1x1 images, known trackers)
 * - Convert relative URLs to absolute
 * - Keep <style> and inline styles
 * - Keep <link rel="stylesheet"> (leave external CSS refs — browser will fetch in preview)
 */
function cleanHTML(raw, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  // Inject <base> so relative URLs resolve correctly
  const existingBase = doc.querySelector('base');
  if (!existingBase) {
    const base = doc.createElement('base');
    base.href = baseUrl;
    doc.head.prepend(base);
  }

  // Strip all <script> tags
  doc.querySelectorAll('script').forEach(el => el.remove());

  // Strip <noscript> tags
  doc.querySelectorAll('noscript').forEach(el => el.remove());

  // Strip tracking pixels — 1x1 images and known tracker domains
  const TRACKER_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'facebook.net',
    'doubleclick.net', 'hotjar.com', 'segment.com', 'mixpanel.com',
    'amplitude.com', 'clarity.ms', 'newrelic.com', 'sentry.io',
  ];
  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    const w = img.getAttribute('width');
    const h = img.getAttribute('height');
    // Remove 1x1 tracking pixels
    if ((w === '1' || w === '0') && (h === '1' || h === '0')) {
      img.remove();
      return;
    }
    // Remove known tracker images
    if (TRACKER_DOMAINS.some(d => src.includes(d))) {
      img.remove();
    }
  });

  // Strip tracking iframes (0x0 or known trackers)
  doc.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.getAttribute('src') || '';
    const w = iframe.getAttribute('width');
    const h = iframe.getAttribute('height');
    if ((w === '0' || h === '0') || TRACKER_DOMAINS.some(d => src.includes(d))) {
      iframe.remove();
    }
  });

  // Strip link preloads / prefetches (not stylesheets)
  doc.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="dns-prefetch"], link[rel="preconnect"]').forEach(el => el.remove());

  // Strip meta refresh redirects
  doc.querySelectorAll('meta[http-equiv="refresh"]').forEach(el => el.remove());

  // Add a comment noting this is a snapshot
  const comment = doc.createComment(' Snapshot captured by snapshot — artlu.ai ');
  doc.head.prepend(comment);

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'snapshot.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// netlify/functions/fetch-proxy.js
// CORS proxy for free-mode snapshots. Fetches a URL server-side to bypass browser CORS.

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB cap

function stripControlChars(value) {
  let cleaned = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if ((code >= 0 && code <= 31) || code === 127) continue;
    cleaned += char;
  }
  return cleaned;
}

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS });
  }

  try {
    const url = new URL(req.url, 'http://localhost').searchParams.get('url');

    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing url parameter' }), {
        status: 400, headers: HEADERS,
      });
    }

    // Validate URL format
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid URL' }), {
        status: 400, headers: HEADERS,
      });
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ ok: false, error: 'Only HTTP/HTTPS URLs allowed' }), {
        status: 400, headers: HEADERS,
      });
    }

    // Block private/internal IPs
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
      return new Response(JSON.stringify({ ok: false, error: 'Internal URLs not allowed' }), {
        status: 400, headers: HEADERS,
      });
    }

    // Sanitize — strip control chars from URL per best-practices.md
    const cleanUrl = stripControlChars(url);

    // Fetch the page
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteSnapshotBot/1.0; +https://sitesnapshot.org)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000), // 8s timeout (Netlify free = 10s limit)
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Site returned ${res.status}` }), {
        status: 502, headers: HEADERS,
      });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return new Response(JSON.stringify({ ok: false, error: 'URL did not return HTML' }), {
        status: 400, headers: HEADERS,
      });
    }

    // Read with size cap
    const reader = res.body.getReader();
    const chunks = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_SIZE) {
        reader.cancel();
        return new Response(JSON.stringify({ ok: false, error: 'Page too large (>2MB)' }), {
          status: 413, headers: HEADERS,
        });
      }
      chunks.push(value);
    }

    const html = new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))));

    return new Response(JSON.stringify({ ok: true, html, sizeBytes: totalSize }), {
      status: 200, headers: HEADERS,
    });

  } catch (err) {
    console.error('[fetch-proxy] details:', err);

    const msg = err.name === 'TimeoutError' || err.name === 'AbortError'
      ? 'Site took too long to respond'
      : 'Failed to fetch the page — try again';

    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: HEADERS,
    });
  }
}

export const config = {
  path: '/.netlify/functions/fetch-proxy',
};

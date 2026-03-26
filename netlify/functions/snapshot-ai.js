// netlify/functions/snapshot-ai.js
// AI snapshot generation with streaming to prevent Netlify inactivity timeout.
// Server-side: auth verify, credit check/deduct, fetch URL, Claude streaming API.

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fetch from 'node-fetch';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  initializeApp({ credential: cert(sa) });
}
const adminAuth = getAuth();
const adminDb = getFirestore();

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_HTML = 150 * 1024; // 150KB cap on source HTML

const SYSTEM_PROMPT = `You are a website snapshot generator. Rebuild the provided HTML as a single frozen file.

RULES:
1. Single HTML file. All CSS in one <style> block. No external CSS/JS.
2. Only external deps: Google Fonts CDN.
3. Use actual content from source. Realistic placeholders for dynamic content.
4. Match the source theme (dark/light), colors, fonts, spacing exactly.
5. Include responsive Desktop/Mobile toggle widget (code below).
6. If multiple pages/tabs exist, include all with JS show/hide.
7. iframe-safe. No target="_top".
8. ALL interactive elements must work: dropdowns, accordions, modals, hamburger nav, toggles, tabs.
9. EVERY repeated element must be interactive — all rows expand, not just the first.
10. Write responsive rules TWICE: @media queries AND .mobile class rules for the toggle.

INTERACTIVE PATTERNS (use vanilla JS, no frameworks):
- Tabs: .pg{display:none}.pg.a{display:block} with go(id,el) toggling .a class
- Dropdowns: click to open (.dd.open), click outside to close via document listener
- Accordions: .acc.open toggles .acc-body visibility, rotate chevron
- Modals: .modal-bg.open with close on X, backdrop click, Escape key
- Hamburger: .mob-menu.open toggle, hidden on desktop, visible on mobile
- Tooltips: pure CSS with ::after and :hover
- Sortable tables: onclick on th, sort tbody rows
- Filters: .pill.a toggles, show/hide .item by data-tags

RESPONSIVE TOGGLE — always include:
<div id="snap-toggle" style="position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:4px;background:rgba(0,0,0,0.7);padding:4px;border-radius:6px;font-family:system-ui;font-size:11px;"><button onclick="setView('desktop')" id="snap-dt" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:#fff;color:#000;font-size:11px;">Desktop</button><button onclick="setView('mobile')" id="snap-mb" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:#999;font-size:11px;">Mobile</button></div>
<script>function setView(m){var w=document.getElementById('snap-wrapper'),dt=document.getElementById('snap-dt'),mb=document.getElementById('snap-mb');if(m==='mobile'){w.classList.add('mobile');w.style.maxWidth='390px';w.style.margin='0 auto';mb.style.background='#fff';mb.style.color='#000';dt.style.background='transparent';dt.style.color='#999';}else{w.classList.remove('mobile');w.style.maxWidth='';w.style.margin='';dt.style.background='#fff';dt.style.color='#000';mb.style.background='transparent';mb.style.color='#999';}}</script>

Wrap all content in <div id="snap-wrapper">.

RESPOND WITH ONLY HTML. No explanation, no markdown fences. Start with <!DOCTYPE html>, end with </html>.`;

const SCREENSHOT_ADDITION = `
SCREENSHOT MODE: You are rebuilding from images, not HTML.
1. Identify layout, colors (estimate hex), fonts (family/size/weight), all visible text, spacing.
2. Detect interactive elements from visual cues: chevrons=accordions, hamburger=mobile nav, ...menus=dropdowns, tab bars, sort arrows.
3. Build ALL detected interactions as working elements.
4. For monospace on dark: try IBM Plex Mono, Fira Code, JetBrains Mono.
5. Dark theme backgrounds: #000, #0a0b0c, #111, #1a1a1a.`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), {
      status: 405, headers: { ...HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
        status: 401, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token); }
    catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid token' }), {
      status: 401, headers: { ...HEADERS, 'Content-Type': 'application/json' },
    }); }
    const uid = decoded.uid;

    // 2. Credits
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return new Response(JSON.stringify({ ok: false, error: 'User not found' }), {
        status: 404, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const userData = userSnap.data();
    if ((userData.credits || 0) < 1) {
      return new Response(JSON.stringify({ ok: false, error: 'No credits — purchase more to use AI mode' }), {
        status: 402, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 3. Parse body
    const body = await req.json();
    const { url, mode, images } = body;

    let messages;
    let systemPrompt = SYSTEM_PROMPT;

    if (mode === 'upload' && images && images.length > 0) {
      systemPrompt = SYSTEM_PROMPT + SCREENSHOT_ADDITION;
      const content = images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType || 'image/png', data: img.data },
      }));
      content.push({
        type: 'text',
        text: 'Rebuild this website from these screenshots. Working interactions for everything clickable. Responsive toggle. ONLY HTML output.',
      });
      messages = [{ role: 'user', content }];

    } else if (url) {
      let fullUrl = url.trim();
      if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;
      if (fullUrl.length > 2000) {
        return new Response(JSON.stringify({ ok: false, error: 'URL too long' }), {
          status: 400, headers: { ...HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Fetch URL
      let fetchedHtml;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          return new Response(JSON.stringify({ ok: false, error: `Site returned ${res.status}` }), {
            status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
          });
        }
        fetchedHtml = await res.text();
      } catch (fetchErr) {
        console.error('[snapshot-ai] fetch error:', fetchErr.name, fetchErr.message);
        return new Response(JSON.stringify({ ok: false, error: `Failed to fetch: ${fetchErr.message}` }), {
          status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (fetchedHtml.length > MAX_HTML) {
        fetchedHtml = fetchedHtml.substring(0, MAX_HTML) + '\n<!-- truncated -->';
      }

      messages = [{
        role: 'user',
        content: `Rebuild this page as a frozen HTML snapshot: ${fullUrl}\n\n${fetchedHtml}`,
      }];

    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Missing url or images' }), {
        status: 400, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 4. Deduct credit NOW (after fetch succeeded, before Claude call)
    await userRef.update({ credits: FieldValue.increment(-1) });
    const newCredits = (userData.credits || 0) - 1;

    // 5. Call Claude with streaming
    let claudeRes;
    try {
      claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 12000,
          stream: true,
          system: systemPrompt,
          messages,
        }),
      });
    } catch (apiErr) {
      console.error('[snapshot-ai] Claude API error:', apiErr.message);
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'AI service unavailable — credit refunded' }), {
        status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('[snapshot-ai] Claude API status:', claudeRes.status, errText);
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'AI generation failed — credit refunded' }), {
        status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 6. Stream the response to client
    // We use a custom protocol: first line is JSON metadata, rest is HTML chunks
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process stream in background
    (async () => {
      try {
        // Send metadata first
        await writer.write(encoder.encode(JSON.stringify({
          event: 'start',
          creditsRemaining: newCredits,
        }) + '\n'));

        let fullHtml = '';
        const decoder = new TextDecoder();

        // Read SSE stream from Claude
        for await (const chunk of claudeRes.body) {
          const text = decoder.decode(chunk, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const t = parsed.delta.text;
                fullHtml += t;
                await writer.write(encoder.encode(t));
              }
            } catch { /* skip non-JSON lines */ }
          }
        }

        // Send end marker
        const sizeKB = Math.round(new TextEncoder().encode(fullHtml).length / 1024);
        await writer.write(encoder.encode('\n' + JSON.stringify({
          event: 'done',
          sizeKB,
        })));

        await writer.close();
      } catch (streamErr) {
        console.error('[snapshot-ai] stream error:', streamErr.message);
        try {
          await writer.write(encoder.encode('\n' + JSON.stringify({ event: 'error', error: 'Stream interrupted' })));
          await writer.close();
        } catch { /* writer may already be closed */ }
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        ...HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (err) {
    console.error('[snapshot-ai] details:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Something went wrong — try again' }), {
      status: 500, headers: { ...HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: '/.netlify/functions/snapshot-ai',
};

// netlify/functions/snapshot-ai.js
// URL mode: Browserless headless Chrome captures complete page as self-contained HTML.
// Screenshot mode: Claude vision rebuilds from images (streaming).
// Server-side: auth verify, credit check, then either browser capture or Claude vision.

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

// Browserless function code — runs inside real Chrome, captures entire page
const BROWSER_CAPTURE_CODE = `
export default async ({ page, context }) => {
  await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 20000 });

  // Scroll to bottom to trigger lazy loading
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(timer); window.scrollTo(0, 0); resolve(); }, 8000);
    });
  });

  await new Promise(r => setTimeout(r, 1500));

  // Build self-contained HTML inside the page context
  const result = await page.evaluate(async () => {
    // Inline external stylesheets
    const styleSheets = [];
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      try {
        const href = link.href;
        if (!href) continue;
        const res = await fetch(href);
        const css = await res.text();
        styleSheets.push(css);
        link.remove();
      } catch (e) {}
    }

    // Collect existing style tags
    const existingStyles = [];
    document.querySelectorAll('style').forEach(s => {
      existingStyles.push(s.textContent);
      s.remove();
    });

    // Remove non-visual elements
    document.querySelectorAll('script, noscript, iframe[src*="analytics"], iframe[src*="tracking"], iframe[width="0"], iframe[height="0"]').forEach(el => el.remove());

    // Remove framework data attributes
    document.querySelectorAll('*').forEach(el => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const name = attrs[i].name;
        if (name.startsWith('on') || name.startsWith('data-react') || name.startsWith('data-v-') || name.startsWith('ng-') || name.startsWith('data-gtm') || name.startsWith('data-analytics')) {
          el.removeAttribute(name);
        }
      }
    });

    const allCSS = [...styleSheets, ...existingStyles].join('\\n');
    const bodyHTML = document.body.innerHTML;
    const title = document.title || 'Snapshot';
    const bodyStyle = window.getComputedStyle(document.body);
    const bgColor = bodyStyle.backgroundColor || '#fff';
    const fontLinks = [];
    document.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').forEach(l => {
      fontLinks.push(l.outerHTML);
    });

    return { title, css: allCSS, body: bodyHTML, bgColor, fontLinks: fontLinks.join('\\n') };
  });

  const snapshot = '<!DOCTYPE html>\\n<html lang="en">\\n<head>\\n<meta charset="UTF-8">\\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n<title>' + result.title + ' — Snapshot</title>\\n' + result.fontLinks + '\\n<style>\\nbody { background: ' + result.bgColor + '; }\\n' + result.css + '\\n.mobile #snap-wrapper { max-width: 390px !important; margin: 0 auto !important; }\\n</style>\\n</head>\\n<body>\\n<div id="snap-wrapper">\\n' + result.body + '\\n</div>\\n<div id="snap-toggle" style="position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:4px;background:rgba(0,0,0,0.7);padding:4px;border-radius:6px;font-family:system-ui;font-size:11px"><button onclick="setView(\\'desktop\\')" id="snap-dt" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:#fff;color:#000;font-size:11px">Desktop</button><button onclick="setView(\\'mobile\\')" id="snap-mb" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:#999;font-size:11px">Mobile</button></div>\\n<script>function setView(m){var w=document.getElementById("snap-wrapper"),d=document.getElementById("snap-dt"),b=document.getElementById("snap-mb");if(m==="mobile"){w.classList.add("mobile");w.style.maxWidth="390px";w.style.margin="0 auto";b.style.background="#fff";b.style.color="#000";d.style.background="transparent";d.style.color="#999"}else{w.classList.remove("mobile");w.style.maxWidth="";w.style.margin="";d.style.background="#fff";d.style.color="#000";b.style.background="transparent";b.style.color="#999"}}</script>\\n</body>\\n</html>';

  return { data: snapshot, type: 'text/html' };
};
`;

// Claude prompt for screenshot mode only
const SCREENSHOT_PROMPT = `Website snapshot generator. Rebuild from screenshots as ONE frozen HTML file.

RULES:
1. Single file. All CSS in one <style>. No external CSS/JS. Google Fonts CDN only.
2. Match source EXACTLY: colors, fonts, sizes, spacing, layout.
3. Include ALL visible content. Every heading, paragraph, link, nav item.
4. Include responsive toggle widget. Write responsive rules TWICE: @media AND .mobile class.
5. Wire ALL interactive elements: dropdowns, accordions, modals, hamburger nav, tabs.
6. EVERY repeated interactive element must work — all rows, not just the first.
7. Replace images with simple SVG placeholders. NEVER copy long SVG paths.
8. You MUST complete the ENTIRE page including footer. Never stop mid-page.
9. Be efficient — reuse CSS classes, short selectors. Condense 50-link footers to key categories with 3-4 links each.

SMART APPROXIMATIONS: merge colors within 5%, round spacing to 4px, snap fonts to standard scale, max 3 shadow levels, reuse classes aggressively.

TOGGLE WIDGET — wrap content in <div id="snap-wrapper">:
<div id="snap-toggle" style="position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:4px;background:rgba(0,0,0,.7);padding:4px;border-radius:6px;font-family:system-ui;font-size:11px"><button onclick="setView('desktop')" id="snap-dt" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:#fff;color:#000;font-size:11px">Desktop</button><button onclick="setView('mobile')" id="snap-mb" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:#999;font-size:11px">Mobile</button></div>
<script>function setView(m){var w=document.getElementById('snap-wrapper'),d=document.getElementById('snap-dt'),b=document.getElementById('snap-mb');if(m==='mobile'){w.classList.add('mobile');w.style.maxWidth='390px';w.style.margin='0 auto';b.style.background='#fff';b.style.color='#000';d.style.background='transparent';d.style.color='#999'}else{w.classList.remove('mobile');w.style.maxWidth='';w.style.margin='';d.style.background='#fff';d.style.color='#000';b.style.background='transparent';b.style.color='#999'}}</script>

OUTPUT: Only HTML. No explanation. No markdown. Start <!DOCTYPE html>, end </html>.`;

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

    const body = await req.json();
    const { url, mode, images } = body;

    // ═══════════════════════════════════════════
    // SCREENSHOT MODE — Claude vision (streaming)
    // ═══════════════════════════════════════════
    if (mode === 'upload' && images && images.length > 0) {
      await userRef.update({ credits: FieldValue.increment(-1) });
      const newCredits = (userData.credits || 0) - 1;

      const content = images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType || 'image/png', data: img.data },
      }));
      content.push({
        type: 'text',
        text: 'Rebuild this website from these screenshots. Working interactions for everything clickable. Responsive toggle. ONLY HTML output.',
      });

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
            max_tokens: 64000,
            stream: true,
            system: SCREENSHOT_PROMPT,
            messages: [{ role: 'user', content }],
          }),
        });
      } catch (apiErr) {
        console.error('[snapshot-ai] Claude error:', apiErr.message);
        await userRef.update({ credits: FieldValue.increment(1) });
        return new Response(JSON.stringify({ ok: false, error: 'AI unavailable — credit refunded' }), {
          status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        console.error('[snapshot-ai] Claude status:', claudeRes.status, errText);
        await userRef.update({ credits: FieldValue.increment(1) });
        const msg = claudeRes.status === 429 ? 'AI busy — wait 30s. Credit refunded.' : 'AI failed — credit refunded';
        return new Response(JSON.stringify({ ok: false, error: msg }), {
          status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Stream Claude response
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const enc = new TextEncoder();
      (async () => {
        try {
          await writer.write(enc.encode(JSON.stringify({ event: 'start', creditsRemaining: newCredits }) + '\n'));
          let fullHtml = '';
          const dec = new TextDecoder();
          for await (const chunk of claudeRes.body) {
            const text = dec.decode(chunk, { stream: true });
            for (const line of text.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const d = line.slice(6);
              if (d === '[DONE]') continue;
              try {
                const p = JSON.parse(d);
                if (p.type === 'content_block_delta' && p.delta?.text) {
                  fullHtml += p.delta.text;
                  await writer.write(enc.encode(p.delta.text));
                }
              } catch {}
            }
          }
          const sizeKB = Math.round(new TextEncoder().encode(fullHtml).length / 1024);
          await writer.write(enc.encode('\n' + JSON.stringify({ event: 'done', sizeKB })));
          await writer.close();
        } catch (err) {
          console.error('[snapshot-ai] stream error:', err.message);
          try { await writer.close(); } catch {}
        }
      })();

      return new Response(readable, {
        status: 200,
        headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
      });
    }

    // ═══════════════════════════════════════════
    // URL MODE — Browserless headless Chrome
    // ═══════════════════════════════════════════
    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing url or images' }), {
        status: 400, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let fullUrl = url.trim();
    if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;
    if (fullUrl.length > 2000) {
      return new Response(JSON.stringify({ ok: false, error: 'URL too long' }), {
        status: 400, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Deduct credit
    await userRef.update({ credits: FieldValue.increment(-1) });
    const newCredits = (userData.credits || 0) - 1;

    const browserlessToken = process.env.BROWSERLESS_API_KEY;
    if (!browserlessToken) {
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'Browser capture not configured — credit refunded' }), {
        status: 500, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let capturedHtml;
    try {
      const browserRes = await fetch(`https://production-sfo.browserless.io/function?token=${browserlessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: BROWSER_CAPTURE_CODE,
          context: { url: fullUrl },
        }),
      });

      if (!browserRes.ok) {
        const errText = await browserRes.text();
        console.error('[snapshot-ai] Browserless error:', browserRes.status, errText);
        await userRef.update({ credits: FieldValue.increment(1) });
        const msg = browserRes.status === 429
          ? 'Browser busy — try again. Credit refunded.'
          : `Capture failed (${browserRes.status}) — credit refunded`;
        return new Response(JSON.stringify({ ok: false, error: msg }), {
          status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
        });
      }

      capturedHtml = await browserRes.text();
    } catch (browserErr) {
      console.error('[snapshot-ai] Browserless error:', browserErr.message);
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'Capture failed — credit refunded' }), {
        status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!capturedHtml || capturedHtml.length < 100) {
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'Capture returned empty — credit refunded' }), {
        status: 502, headers: { ...HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const sizeKB = Math.round(Buffer.byteLength(capturedHtml, 'utf8') / 1024);

    return new Response(JSON.stringify({
      ok: true,
      html: capturedHtml,
      sizeKB,
      creditsRemaining: newCredits,
    }), {
      status: 200,
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
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

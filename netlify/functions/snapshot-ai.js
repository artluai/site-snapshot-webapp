// netlify/functions/snapshot-ai.js
// AI snapshot generation. Server-side: auth verify, credit check/deduct, fetch URL, Claude API call.
// Per rules.md: server-side credit check before any AI call — never trust the client.

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fetch from 'node-fetch';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (once)
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
  'Content-Type': 'application/json',
};

const MAX_HTML_SIZE = 200 * 1024; // 200KB cap on fetched HTML sent to Claude

// The site-snapshot skill system prompt (condensed for API one-shot use)
const SYSTEM_PROMPT = `You are a website snapshot generator. You receive HTML from a fetched webpage and rebuild it as a single frozen HTML file.

## Output rules — follow ALL of these:

1. **Single HTML file.** No external CSS or JS files.
2. **Styles inlined.** All CSS in a single <style> block.
3. **No external dependencies** except CDN fonts (Google Fonts) and icon libraries.
4. **Static content.** Use actual content from the source. Replace dynamic/API content with realistic placeholders.
5. **Responsive toggle.** Include the floating Desktop/Mobile switcher widget.
6. **Multi-view navigation.** If there are tabs/pages, include all views with JS show/hide.
7. **iframe-safe.** No target="_top", no frame-busting.
8. **Dark/light aware.** Match the source theme.
9. **ALL interactions must work.** Every dropdown, accordion, modal, hamburger menu, toggle — wire them all up.

## How to rebuild from fetched HTML:

1. Extract the design system: colors from CSS variables/inline styles, fonts, spacing.
2. Rewrite hashed class names (.css-1a2b3c) as clean semantic classes.
3. Strip all framework artifacts (data-react-*, data-v-*, ng-*), scripts, noscript, tracking pixels, analytics, chat widgets.
4. Remove empty wrapper divs. Simplify deeply nested structures.
5. Replace external image URLs with placeholder SVGs if they'll break.
6. Rebuild as clean HTML with all styles in one <style> block.

## Interactive element patterns — use these exact patterns:

### Page/tab switching
.pg{display:none}.pg.a{display:block}
function go(id,el){document.querySelectorAll('.pg').forEach(p=>p.classList.remove('a'));document.querySelectorAll('.tab').forEach(t=>t.classList.remove('a'));document.getElementById(id).classList.add('a');el.classList.add('a');}

### Dropdown menus
Click to open, click outside to close. Every dropdown must work independently.
function togDD(el,e){e.stopPropagation();var w=el.classList.contains('open');document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open'));if(!w)el.classList.add('open');}
document.addEventListener('click',()=>document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open')));

### Accordion/collapsible
function togAcc(hd){hd.parentElement.classList.toggle('open');}
CSS: .acc-body{display:none} .acc.open .acc-body{display:block} .acc.open .acc-arrow{transform:rotate(90deg)}

### Modal/dialog
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-bg.open').forEach(m=>m.classList.remove('open'));});

### Hamburger mobile nav
function togNav(){document.getElementById('mob-menu').classList.toggle('open');}
CSS: .hamburger{display:none} @media(max-width:639px){.nav-links{display:none}.hamburger{display:block}}
.mobile .nav-links{display:none} .mobile .hamburger{display:block}

### Sidebar collapse
function togSidebar(){document.querySelector('.sidebar').classList.toggle('collapsed');}

### Tooltip (pure CSS)
.tip{position:relative;cursor:help}
.tip::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 10px;border-radius:6px;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s}
.tip:hover::after{opacity:1}

### Sortable table headers
function sortTable(th,col){var tb=th.closest('table').querySelector('tbody'),rows=Array.from(tb.querySelectorAll('tr')),asc=!th.classList.contains('asc');th.closest('tr').querySelectorAll('th').forEach(h=>{h.classList.remove('asc','desc')});th.classList.add(asc?'asc':'desc');rows.sort((a,b)=>{var av=a.cells[col].textContent.trim(),bv=b.cells[col].textContent.trim(),an=parseFloat(av),bn=parseFloat(bv);if(!isNaN(an)&&!isNaN(bn))return asc?an-bn:bn-an;return asc?av.localeCompare(bv):bv.localeCompare(av);});rows.forEach(r=>tb.appendChild(r));}

### Filters
function filt(tag,el){document.querySelectorAll('.pill').forEach(p=>p.classList.remove('a'));el.classList.add('a');document.querySelectorAll('.item').forEach(item=>{item.style.display=(tag==='all'||item.dataset.tags.includes(tag))?'':'none';});}

### Search/filter input
function searchFilter(input,containerSel,itemSel){var q=input.value.toLowerCase();document.querySelectorAll(containerSel+' '+itemSel).forEach(item=>{item.style.display=item.textContent.toLowerCase().includes(q)?'':'none';});}

## Responsive toggle widget — ALWAYS include this:

Wrap all content in <div id="snap-wrapper">.

<div id="snap-toggle" style="position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:4px;background:rgba(0,0,0,0.7);padding:4px;border-radius:6px;font-family:system-ui;font-size:11px;">
<button onclick="setView('desktop')" id="snap-dt" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:#fff;color:#000;font-size:11px;">Desktop</button>
<button onclick="setView('mobile')" id="snap-mb" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:#999;font-size:11px;">Mobile</button>
</div>

function setView(mode){var w=document.getElementById('snap-wrapper'),dt=document.getElementById('snap-dt'),mb=document.getElementById('snap-mb');if(mode==='mobile'){w.classList.add('mobile');w.style.maxWidth='390px';w.style.margin='0 auto';mb.style.background='#fff';mb.style.color='#000';dt.style.background='transparent';dt.style.color='#999';}else{w.classList.remove('mobile');w.style.maxWidth='';w.style.margin='';dt.style.background='#fff';dt.style.color='#000';mb.style.background='transparent';mb.style.color='#999';}}

Write responsive rules TWICE: @media queries for standalone AND .mobile class rules for the toggle.

## CRITICAL RULES:

- EVERY repeated element must be interactive (all 5 rows expand, not just the first)
- If it looks clickable, it MUST work
- Do an interaction audit before finishing: check every dropdown, accordion, tab, hamburger, modal
- Keep total output under 100KB
- Respond with ONLY the HTML. No explanation, no markdown fences. Start with <!DOCTYPE html> and end with </html>.`;

const SCREENSHOT_SYSTEM_PROMPT = SYSTEM_PROMPT.replace(
  '## How to rebuild from fetched HTML:',
  `## How to rebuild from screenshots:

1. Analyze the screenshots to identify: layout structure, colors (estimate hex values), typography (family, size, weight), all visible text content, component patterns, spacing.
2. Detect interactive elements from visual cues: chevrons (accordions), hamburger icons (mobile nav), "..." menus (dropdowns), toggle switches, tab bars, search fields, close buttons (modals), sort arrows on table headers.
3. Build ALL detected interactions as working elements — not static images.
4. For monospace fonts on dark backgrounds, try: IBM Plex Mono, Fira Code, JetBrains Mono, SF Mono.
5. For dark themes, common backgrounds: #000, #0a0b0c, #111, #1a1a1a.

## How to rebuild from fetched HTML:`
);

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), { status: 405, headers: HEADERS });
  }

  try {
    // 1. Verify Firebase auth token
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), { status: 401, headers: HEADERS });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid token' }), { status: 401, headers: HEADERS });
    }
    const uid = decoded.uid;

    // 2. Check credits server-side
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return new Response(JSON.stringify({ ok: false, error: 'User not found' }), { status: 404, headers: HEADERS });
    }
    const userData = userSnap.data();
    if ((userData.credits || 0) < 1) {
      return new Response(JSON.stringify({ ok: false, error: 'No credits — purchase more to use AI mode' }), { status: 402, headers: HEADERS });
    }

    // 3. Deduct 1 credit BEFORE calling Claude (prevents double-spend on retry)
    await userRef.update({ credits: FieldValue.increment(-1) });
    const newCredits = (userData.credits || 0) - 1;

    // 4. Parse request body
    const body = await req.json();
    const { url, mode, images } = body;

    let messages;
    let systemPrompt;

    if (mode === 'upload' && images && images.length > 0) {
      // Screenshot mode — send images to Claude
      systemPrompt = SCREENSHOT_SYSTEM_PROMPT;
      const content = [];
      images.forEach((img, i) => {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType || 'image/png',
            data: img.data,
          },
        });
      });
      content.push({
        type: 'text',
        text: 'Rebuild this website as a single frozen HTML file from these screenshots. Include working interactions for everything that looks clickable. Include the responsive desktop/mobile toggle widget. Respond with ONLY the HTML — no explanation.',
      });
      messages = [{ role: 'user', content }];

    } else if (url) {
      // AI URL mode — fetch the page first
      systemPrompt = SYSTEM_PROMPT;

      // Validate URL
      let fullUrl = url.trim();
      if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;
      if (fullUrl.length > 2000) {
        // Refund credit
        await userRef.update({ credits: FieldValue.increment(1) });
        return new Response(JSON.stringify({ ok: false, error: 'URL too long' }), { status: 400, headers: HEADERS });
      }

      // Fetch the URL
      let fetchedHtml;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          await userRef.update({ credits: FieldValue.increment(1) });
          return new Response(JSON.stringify({ ok: false, error: `Site returned ${res.status}` }), { status: 502, headers: HEADERS });
        }
        fetchedHtml = await res.text();
      } catch (fetchErr) {
        console.error('[snapshot-ai] fetch error:', fetchErr.name, fetchErr.message);
        await userRef.update({ credits: FieldValue.increment(1) });
        const msg = fetchErr.name === 'AbortError' ? 'Site took too long to respond' : `Failed to fetch the page: ${fetchErr.message}`;
        return new Response(JSON.stringify({ ok: false, error: msg }), { status: 502, headers: HEADERS });
      }

      // Cap HTML size
      if (fetchedHtml.length > MAX_HTML_SIZE) {
        fetchedHtml = fetchedHtml.substring(0, MAX_HTML_SIZE) + '\n<!-- truncated -->';
      }

      messages = [{
        role: 'user',
        content: `Here is the fetched HTML from ${fullUrl}. Rebuild it as a single frozen HTML file with all styles inlined, working interactions, and the responsive toggle widget. Respond with ONLY the HTML — no explanation.\n\n${fetchedHtml}`,
      }];

    } else {
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'Missing url or images' }), { status: 400, headers: HEADERS });
    }

    // 5. Call Claude API
    // Per best-practices.md: x-api-key header (NOT Bearer), anthropic-version required, system is top-level
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('[snapshot-ai] Claude API error:', errText);
      // Refund the credit on API failure
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'AI generation failed — try again' }), { status: 502, headers: HEADERS });
    }

    const claudeData = await claudeRes.json();
    let html = claudeData.content?.[0]?.text || '';

    // Clean up — strip markdown fences if Claude added them despite instructions
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Validate we got actual HTML
    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      await userRef.update({ credits: FieldValue.increment(1) });
      return new Response(JSON.stringify({ ok: false, error: 'AI did not return valid HTML — try again' }), { status: 502, headers: HEADERS });
    }

    const sizeKB = Math.round(new TextEncoder().encode(html).length / 1024);

    return new Response(JSON.stringify({
      ok: true,
      html,
      sizeKB,
      creditsRemaining: newCredits,
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('[snapshot-ai] details:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Something went wrong — try again' }), { status: 500, headers: HEADERS });
  }
}

export const config = {
  path: '/.netlify/functions/snapshot-ai',
};

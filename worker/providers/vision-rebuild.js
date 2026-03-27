import fetch from 'node-fetch';
import { adminStorage } from '../lib/firebase-admin.js';

const SCREENSHOT_PROMPT = `Website snapshot generator. Rebuild from screenshots as ONE frozen HTML file.

RULES:
1. Single file. All CSS in one <style>. No external CSS/JS. Google Fonts CDN only.
2. Reconstruct the screenshot literally. Do NOT invent a generic marketing site, portfolio, SaaS template, fake sections, fake testimonials, fake pricing, or fake projects unless they are clearly visible in the screenshot.
3. Match source closely: colors, fonts, sizes, spacing, layout, borders, radii, shadows, alignment, and overall composition.
4. Include all visible content that can be read from the screenshots. Preserve exact visible wording whenever readable.
5. If text is too small or unclear, use short neutral placeholders only for the unreadable parts. Never replace the whole page with a made-up design.
6. Keep the same information architecture visible in the screenshots. If the screenshot mainly shows a hero plus feature cards, output that. If it shows navigation, repeated cards, or pricing blocks, keep those same structures.
7. Use simple placeholder boxes for images/illustrations/logos you cannot reproduce exactly, but keep their size and placement similar.
8. Include a desktop/mobile toggle widget.
9. Wire simple interactive elements where visually obvious.
10. Output only HTML. No markdown. Start with <!DOCTYPE html> and end with </html>.
11. You must finish the visible page. Do not stop halfway through the screenshot.
12. Prefer fidelity over creativity.

TOGGLE WIDGET:
Wrap content in <div id="snap-wrapper"> and include:
<div id="snap-toggle" style="position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:4px;background:rgba(0,0,0,.7);padding:4px;border-radius:6px;font-family:system-ui;font-size:11px"><button onclick="setView('desktop')" id="snap-dt" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:#fff;color:#000;font-size:11px">Desktop</button><button onclick="setView('mobile')" id="snap-mb" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:#999;font-size:11px">Mobile</button></div>
<script>function setView(m){var w=document.getElementById('snap-wrapper'),d=document.getElementById('snap-dt'),b=document.getElementById('snap-mb');if(m==='mobile'){w.classList.add('mobile');w.style.maxWidth='390px';w.style.margin='0 auto';b.style.background='#fff';b.style.color='#000';d.style.background='transparent';d.style.color='#999'}else{w.classList.remove('mobile');w.style.maxWidth='';w.style.margin='';d.style.background='#fff';d.style.color='#000';b.style.background='transparent';b.style.color='#999'}}</script>`;

async function loadImageAsContent(file) {
  const bucket = adminStorage.bucket();
  const storageFile = bucket.file(file.storagePath);
  const [buffer] = await storageFile.download();

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: file.contentType || 'image/png',
      data: buffer.toString('base64'),
    },
  };
}

function sortScreenshotFiles(files) {
  const slotOrder = { desktop: 0, mobile: 1 };

  return [...files].sort((left, right) => {
    const leftSlot = slotOrder[left.slot] ?? 99;
    const rightSlot = slotOrder[right.slot] ?? 99;
    if (leftSlot !== rightSlot) return leftSlot - rightSlot;

    const leftSegment = Number(left.segmentIndex || 0);
    const rightSegment = Number(right.segmentIndex || 0);
    return leftSegment - rightSegment;
  });
}

export async function rebuildFromScreenshots(files) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const imageContent = [];
  for (const file of sortScreenshotFiles(files)) {
    const segmentCount = Number(file.segmentCount || 1);
    const segmentIndex = Number(file.segmentIndex || 0);
    const slotLabel = file.slot === 'mobile' ? 'mobile' : 'desktop';

    imageContent.push({
      type: 'text',
      text: segmentCount > 1
        ? `${slotLabel} screenshot section ${segmentIndex + 1} of ${segmentCount}, ordered from top to bottom on the same page.`
        : `${slotLabel} screenshot.`,
    });

    imageContent.push(await loadImageAsContent(file));
  }

  imageContent.push({
    type: 'text',
    text: 'Rebuild this website from the uploaded screenshots as one frozen HTML file. Treat multiple sections from the same slot as one continuous page from top to bottom. Copy the visible structure and wording as literally as possible. Do not invent a generic template.',
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 32000,
      system: SCREENSHOT_PROMPT,
      messages: [{ role: 'user', content: imageContent }],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Vision rebuild failed (${response.status}): ${message}`);
  }

  const data = await response.json();
  const html = (data.content || [])
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('');

  if (!html || !html.includes('<html')) {
    throw new Error('Vision rebuild returned invalid HTML');
  }

  return html;
}

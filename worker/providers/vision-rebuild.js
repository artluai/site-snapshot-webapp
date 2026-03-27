import fetch from 'node-fetch';
import { adminStorage } from '../lib/firebase-admin.js';

const SCREENSHOT_PROMPT = `Website snapshot generator. Rebuild from screenshots as ONE frozen HTML file.

RULES:
1. Single file. All CSS in one <style>. No external CSS/JS. Google Fonts CDN only.
2. Match source closely: colors, fonts, sizes, spacing, layout.
3. Include all visible content that can be read from the screenshots.
4. Include a desktop/mobile toggle widget.
5. Wire simple interactive elements where visually obvious.
6. Replace unknown images with simple placeholders rather than broken links.
7. Output only HTML. No markdown. Start with <!DOCTYPE html> and end with </html>.

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

export async function rebuildFromScreenshots(files) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const imageContent = [];
  for (const file of files) {
    imageContent.push(await loadImageAsContent(file));
  }

  imageContent.push({
    type: 'text',
    text: 'Rebuild this website from the uploaded screenshots as one frozen HTML file.',
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

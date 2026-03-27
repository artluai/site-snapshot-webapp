import fetch from 'node-fetch';

const BROWSER_CAPTURE_CODE = `
export default async ({ page, context }) => {
  await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 20000 });

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

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const result = await page.evaluate(async () => {
    const styleSheets = [];
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      try {
        const res = await fetch(link.href);
        styleSheets.push(await res.text());
        link.remove();
      } catch {}
    }

    const existingStyles = [];
    document.querySelectorAll('style').forEach((style) => {
      existingStyles.push(style.textContent);
      style.remove();
    });

    document.querySelectorAll('script, noscript, iframe[src*="analytics"], iframe[src*="tracking"], iframe[width="0"], iframe[height="0"]').forEach((el) => el.remove());

    document.querySelectorAll('*').forEach((el) => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const name = attrs[i].name;
        if (name.startsWith('on') || name.startsWith('data-react') || name.startsWith('data-v-') || name.startsWith('ng-') || name.startsWith('data-gtm') || name.startsWith('data-analytics')) {
          el.removeAttribute(name);
        }
      }
    });

    const allCss = [...styleSheets, ...existingStyles].join('\\n');
    const bodyHtml = document.body.innerHTML;
    const title = document.title || 'Snapshot';
    const bgColor = window.getComputedStyle(document.body).backgroundColor || '#fff';

    return { title, css: allCss, body: bodyHtml, bgColor };
  });

  const snapshot = '<!DOCTYPE html>\\n<html lang="en">\\n<head>\\n<meta charset="UTF-8">\\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n<title>' + result.title + ' — Snapshot</title>\\n<style>\\nbody { background: ' + result.bgColor + '; }\\n' + result.css + '\\n.mobile #snap-wrapper { max-width: 390px !important; margin: 0 auto !important; }\\n</style>\\n</head>\\n<body>\\n<div id="snap-wrapper">\\n' + result.body + '\\n</div>\\n<div id="snap-toggle" style="position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;gap:4px;background:rgba(0,0,0,0.7);padding:4px;border-radius:6px;font-family:system-ui;font-size:11px"><button onclick="setView(\\'desktop\\')" id="snap-dt" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:#fff;color:#000;font-size:11px">Desktop</button><button onclick="setView(\\'mobile\\')" id="snap-mb" style="padding:4px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:#999;font-size:11px">Mobile</button></div>\\n<script>function setView(m){var w=document.getElementById("snap-wrapper"),d=document.getElementById("snap-dt"),b=document.getElementById("snap-mb");if(m==="mobile"){w.classList.add("mobile");w.style.maxWidth="390px";w.style.margin="0 auto";b.style.background="#fff";b.style.color="#000";d.style.background="transparent";d.style.color="#999"}else{w.classList.remove("mobile");w.style.maxWidth="";w.style.margin="";d.style.background="#fff";d.style.color="#000";b.style.background="transparent";b.style.color="#999"}}</script>\\n</body>\\n</html>';

  return { data: snapshot, type: 'text/html' };
};
`;

export async function captureBrowserHtml(url) {
  const browserlessToken = process.env.BROWSERLESS_API_KEY;
  if (!browserlessToken) {
    throw new Error('BROWSERLESS_API_KEY is not configured');
  }

  const response = await fetch(`https://production-sfo.browserless.io/function?token=${browserlessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: BROWSER_CAPTURE_CODE,
      context: { url },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Browser capture failed (${response.status}): ${message}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let html = '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    html = payload?.data || '';
  } else {
    html = await response.text();
  }

  if (!html || html.length < 100) {
    throw new Error('Browser capture returned empty output');
  }

  return html;
}

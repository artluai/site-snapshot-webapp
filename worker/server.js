import http from 'node:http';
import { runJob } from './job-runner.js';

const PORT = Number(process.env.PORT || 8080);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });

    req.on('error', reject);
  });
}

function isAuthorized(req) {
  const expected = process.env.WORKER_SHARED_SECRET;
  if (!expected) return true;
  return req.headers['x-worker-secret'] === expected;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/jobs/run') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized worker request' });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const uid = `${body.uid || ''}`.trim();
      const jobId = `${body.jobId || ''}`.trim();

      if (!uid || !jobId) {
        sendJson(res, 400, { ok: false, error: 'Missing uid or jobId' });
        return;
      }

      const result = await runJob({ uid, jobId });
      sendJson(res, 200, result);
    } catch (error) {
      console.error('[worker] job failed:', error);
      sendJson(res, 500, { ok: false, error: error.message || 'Worker failed' });
    }

    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[worker] listening on :${PORT}`);
});

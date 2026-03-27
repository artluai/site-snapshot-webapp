import { JSON_HEADERS, adminStorage, getJobRef, json, verifyUser } from './_lib/admin.js';

function getDisposition(fileName, mode) {
  const safeName = fileName || 'snapshot.html';
  if (mode === 'attachment') {
    return `attachment; filename="${safeName}"`;
  }

  return `inline; filename="${safeName}"`;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: JSON_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'POST only' }, 405);
  }

  try {
    const decoded = await verifyUser(req);
    const uid = decoded.uid;
    const body = await req.json().catch(() => ({}));
    const jobId = `${body.jobId || ''}`.trim();
    const disposition = body.disposition === 'attachment' ? 'attachment' : 'inline';

    if (!jobId) {
      return json({ ok: false, error: 'Missing jobId' }, 400);
    }

    const jobRef = getJobRef(uid, jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return json({ ok: false, error: 'Job not found' }, 404);
    }

    const job = jobSnap.data();
    if (job.status !== 'succeeded' || !job.result?.storagePath) {
      return json({ ok: false, error: 'Artifact is not ready yet' }, 409);
    }

    const bucket = adminStorage.bucket();
    const file = bucket.file(job.result.storagePath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (15 * 60 * 1000),
      responseDisposition: getDisposition(job.result.fileName, disposition),
      responseType: job.result.contentType || 'text/html',
    });

    return json({
      ok: true,
      url,
      fileName: job.result.fileName,
      bytes: job.result.bytes,
      contentType: job.result.contentType,
    });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Failed to create artifact URL' }, error.statusCode || 500);
  }
}

export const config = {
  path: '/.netlify/functions/get-artifact-url',
};

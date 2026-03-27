import { JSON_HEADERS, getJobRef, json, verifyUser } from './_lib/admin.js';
import { dispatchWorkerJob } from './_lib/worker-dispatch.js';

function isAllowedUploadPath(uid, jobId, storagePath) {
  return storagePath.startsWith(`users/${uid}/jobs/${jobId}/inputs/`);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: JSON_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'POST only' }, 405);
  }

  let uid = '';
  let jobId = '';

  try {
    const decoded = await verifyUser(req);
    uid = decoded.uid;
    const body = await req.json().catch(() => ({}));
    jobId = `${body.jobId || ''}`.trim();
    const files = Array.isArray(body.files) ? body.files : [];

    if (!jobId) {
      return json({ ok: false, error: 'Missing jobId' }, 400);
    }

    if (!files.length) {
      return json({ ok: false, error: 'Upload files are required' }, 400);
    }

    if (!files.every((file) => file.storagePath && isAllowedUploadPath(uid, jobId, file.storagePath))) {
      return json({ ok: false, error: 'Invalid upload file path' }, 400);
    }

    const jobRef = getJobRef(uid, jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      return json({ ok: false, error: 'Job not found' }, 404);
    }

    const job = jobSnap.data();
    if (job.status !== 'awaiting_upload') {
      return json({ ok: false, error: 'Job is not waiting for uploads' }, 409);
    }

    await jobRef.update({
      status: 'queued',
      updatedAt: new Date().toISOString(),
      source: {
        type: 'uploaded_files',
        host: job.source?.host || 'uploaded screenshots',
        files,
      },
      progress: {
        phase: 'queued',
        percent: 5,
        message: 'Uploads received and queued for processing',
      },
      error: null,
    });

    await dispatchWorkerJob({ uid, jobId });

    return json({ ok: true, jobId, status: 'queued' });
  } catch (error) {
    if (uid && jobId) {
      await getJobRef(uid, jobId).update({
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: { message: error.message || 'Failed to start job' },
        progress: {
          phase: 'failed',
          percent: 100,
          message: error.message || 'Failed to start job',
        },
      }).catch(() => null);
    }

    return json({ ok: false, error: error.message || 'Failed to start job' }, error.statusCode || 500);
  }
}

export const config = {
  path: '/.netlify/functions/start-job',
};

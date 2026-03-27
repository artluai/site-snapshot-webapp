import { FieldValue, JSON_HEADERS, adminDb, getJobRef, json, normalizeUrl, verifyUser } from './_lib/admin.js';
import { dispatchWorkerJob } from './_lib/worker-dispatch.js';

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
    const requestedMode = body.mode === 'vision_rebuild' ? 'vision_rebuild' : 'browser_html';

    let source = { type: 'uploaded_files', host: 'uploaded screenshots', files: [] };
    if (requestedMode === 'browser_html') {
      source = { type: 'url', ...normalizeUrl(body.url) };
    }

    const userRef = adminDb.collection('users').doc(uid);
    const jobRef = getJobRef(uid);
    let creditsRemaining = 0;

    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() : null;
      const currentCredits = userData?.credits || 0;

      if (!userSnap.exists) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }

      if (currentCredits < 1) {
        throw Object.assign(new Error('No credits available'), { statusCode: 402 });
      }

      creditsRemaining = currentCredits - 1;
      tx.update(userRef, { credits: FieldValue.increment(-1) });
      tx.set(jobRef, {
        mode: requestedMode,
        status: requestedMode === 'browser_html' ? 'queued' : 'awaiting_upload',
        source,
        progress: {
          phase: requestedMode === 'browser_html' ? 'queued' : 'awaiting_upload',
          percent: requestedMode === 'browser_html' ? 5 : 0,
          message: requestedMode === 'browser_html'
            ? 'Job created and waiting for a worker'
            : 'Upload source images before starting the job',
        },
        billing: {
          creditCost: 1,
          state: 'reserved',
        },
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    if (requestedMode === 'browser_html') {
      try {
        await dispatchWorkerJob({ uid, jobId: jobRef.id });
      } catch {
        await adminDb.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          const jobSnap = await tx.get(jobRef);

          if (jobSnap.exists) {
            tx.update(jobRef, {
              status: 'failed',
              updatedAt: new Date().toISOString(),
              error: { message: 'Failed to queue worker job' },
            });
          }

          if (userSnap.exists) {
            tx.update(userRef, { credits: FieldValue.increment(1) });
          }
        });

        throw Object.assign(new Error('Failed to queue the worker job'), { statusCode: 500 });
      }
    }

    return json({
      ok: true,
      jobId: jobRef.id,
      status: requestedMode === 'browser_html' ? 'queued' : 'awaiting_upload',
      creditsRemaining,
      source,
    });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Failed to create job' }, error.statusCode || 500);
  }
}

export const config = {
  path: '/.netlify/functions/create-job',
};

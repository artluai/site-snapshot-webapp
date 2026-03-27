import { captureBrowserHtml } from './providers/browser-html.js';
import { rebuildFromScreenshots } from './providers/vision-rebuild.js';
import { FieldValue, adminDb, getJobRef, getUserRef } from './lib/firebase-admin.js';
import { saveHtmlArtifact } from './lib/storage.js';

function getSnapshotFileName(host) {
  const safeHost = (host || 'snapshot').replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
  return `${safeHost}.html`;
}

async function updateJob(jobRef, patch) {
  await jobRef.update({
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

async function failJob(uid, jobId, message) {
  const jobRef = getJobRef(uid, jobId);
  const userRef = getUserRef(uid);

  await adminDb.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) return;

    const job = jobSnap.data();
    const shouldRefund = job.billing?.state === 'reserved';

    tx.update(jobRef, {
      status: 'failed',
      updatedAt: new Date().toISOString(),
      error: { message },
      progress: {
        phase: 'failed',
        percent: 100,
        message,
      },
      ...(shouldRefund
        ? { billing: { ...job.billing, state: 'refunded', refundedAt: new Date().toISOString() } }
        : {}),
    });

    if (shouldRefund) {
      tx.update(userRef, { credits: FieldValue.increment(1) });
    }
  });
}

export async function runJob({ uid, jobId }) {
  const jobRef = getJobRef(uid, jobId);
  const jobSnap = await jobRef.get();

  if (!jobSnap.exists) {
    throw new Error('Job not found');
  }

  const existingJob = jobSnap.data();
  if (existingJob.status === 'succeeded') {
    return { ok: true, skipped: true };
  }

  if (existingJob.status !== 'queued') {
    throw new Error(`Job is not ready to run (status: ${existingJob.status})`);
  }

  await updateJob(jobRef, {
    status: 'running',
    startedAt: existingJob.startedAt || new Date().toISOString(),
    error: null,
    progress: {
      phase: 'starting',
      percent: 10,
      message: 'Worker picked up the job',
    },
  });

  try {
    let html;

    if (existingJob.mode === 'browser_html') {
      await updateJob(jobRef, {
        progress: {
          phase: 'capturing',
          percent: 35,
          message: 'Loading the site in a real browser',
        },
      });

      html = await captureBrowserHtml(existingJob.source.fullUrl);
    } else if (existingJob.mode === 'vision_rebuild') {
      await updateJob(jobRef, {
        progress: {
          phase: 'analyzing_images',
          percent: 30,
          message: 'Reading uploaded screenshots',
        },
      });

      html = await rebuildFromScreenshots(existingJob.source.files || []);
    } else {
      throw new Error(`Unsupported job mode: ${existingJob.mode}`);
    }

    await updateJob(jobRef, {
      progress: {
        phase: 'uploading',
        percent: 80,
        message: 'Saving the finished snapshot',
      },
    });

    const artifact = await saveHtmlArtifact(
      uid,
      jobId,
      html,
      getSnapshotFileName(existingJob.source.host || 'snapshot'),
    );

    await updateJob(jobRef, {
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      progress: {
        phase: 'done',
        percent: 100,
        message: 'Snapshot ready to preview and download',
      },
      billing: {
        ...existingJob.billing,
        state: 'charged',
        chargedAt: new Date().toISOString(),
      },
      result: {
        ...artifact,
      },
    });

    return { ok: true, artifact };
  } catch (error) {
    await failJob(uid, jobId, error.message || 'Job failed');
    throw error;
  }
}

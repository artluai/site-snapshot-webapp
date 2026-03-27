import { GoogleAuth } from 'google-auth-library';

function getGoogleCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${error.message}`);
  }
}

function getWorkerUrl() {
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    throw new Error('WORKER_URL is not configured');
  }
  return workerUrl.replace(/\/$/, '');
}

function getWorkerHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.WORKER_SHARED_SECRET) {
    headers['x-worker-secret'] = process.env.WORKER_SHARED_SECRET;
  }
  return headers;
}

function shouldUseDirectDispatch() {
  return process.env.ALLOW_DIRECT_WORKER_DISPATCH === 'true';
}

async function createCloudTask(payload) {
  const projectId = process.env.CLOUD_TASKS_PROJECT_ID;
  const location = process.env.CLOUD_TASKS_LOCATION;
  const queue = process.env.CLOUD_TASKS_QUEUE;

  if (!projectId || !location || !queue) {
    return false;
  }

  const credentials = getGoogleCredentials();
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    ...(credentials ? { credentials } : {}),
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const workerUrl = `${getWorkerUrl()}/jobs/run`;
  const taskUrl = `https://cloudtasks.googleapis.com/v2/projects/${projectId}/locations/${location}/queues/${queue}/tasks`;

  const response = await fetch(taskUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.token || accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: workerUrl,
          headers: getWorkerHeaders(),
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Cloud Tasks enqueue failed (${response.status}): ${message}`);
  }

  return true;
}

async function dispatchDirectly(payload) {
  const response = await fetch(`${getWorkerUrl()}/jobs/run`, {
    method: 'POST',
    headers: getWorkerHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Worker dispatch failed (${response.status}): ${message}`);
  }

  return true;
}

export async function dispatchWorkerJob(payload) {
  if (shouldUseDirectDispatch()) {
    await dispatchDirectly(payload);
    return { queuedViaCloudTasks: false };
  }

  const queued = await createCloudTask(payload).catch(async (error) => {
    if (shouldUseDirectDispatch()) {
      await dispatchDirectly(payload);
      return false;
    }

    throw error;
  });

  return { queuedViaCloudTasks: queued };
}

import { adminStorage } from './firebase-admin.js';

export async function saveHtmlArtifact(uid, jobId, html, fileName) {
  const bucket = adminStorage.bucket();
  const safeName = fileName || 'snapshot.html';
  const storagePath = `artifacts/${uid}/${jobId}/${safeName}`;
  const file = bucket.file(storagePath);

  await file.save(html, {
    resumable: false,
    contentType: 'text/html; charset=utf-8',
    metadata: {
      cacheControl: 'private, max-age=0, no-transform',
      metadata: {
        uid,
        jobId,
      },
    },
  });

  return {
    storagePath,
    fileName: safeName,
    contentType: 'text/html; charset=utf-8',
    bytes: Buffer.byteLength(html, 'utf8'),
  };
}

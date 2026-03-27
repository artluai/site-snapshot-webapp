import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase.js';

function sanitizeName(name) {
  return (name || 'upload.bin').replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
}

export async function uploadJobSourceFiles(uid, jobId, files) {
  const uploads = [];

  for (const file of files) {
    if (!file?.blob || !file?.slot) continue;

    const safeName = sanitizeName(file.blob.name);
    const storagePath = `users/${uid}/jobs/${jobId}/inputs/${file.slot}-${Date.now()}-${safeName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file.blob, {
      contentType: file.blob.type || 'application/octet-stream',
      customMetadata: {
        jobId,
        slot: file.slot,
      },
    });

    uploads.push({
      slot: file.slot,
      storagePath,
      contentType: file.blob.type || 'application/octet-stream',
      bytes: file.blob.size,
      originalName: file.blob.name || safeName,
    });
  }

  return uploads;
}

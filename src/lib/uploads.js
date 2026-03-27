import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase.js';

const MAX_VISION_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const MAX_SLICE_HEIGHT = 1600;
const SLICE_TRIGGER_HEIGHT = 2200;
const SLICE_TRIGGER_RATIO = 1.6;

function sanitizeName(name) {
  return (name || 'upload.bin').replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
}

function getBaseName(name) {
  return (name || 'upload').replace(/\.[^.]+$/, '') || 'upload';
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to read image: ${file.name || 'upload'}`));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to compress image'));
    }, type, quality);
  });
}

async function optimizeScreenshot(file) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return file;
  }

  if (file.size <= MAX_VISION_UPLOAD_BYTES) {
    return file;
  }

  const image = await loadImage(file);
  let width = image.width;
  let height = image.height;
  let quality = 0.82;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.size <= MAX_VISION_UPLOAD_BYTES) {
      const nextName = (file.name || 'upload').replace(/\.[^.]+$/, '') || 'upload';
      return new File([blob], `${nextName}.jpg`, { type: 'image/jpeg' });
    }

    width = Math.max(600, Math.round(canvas.width * 0.82));
    height = Math.max(600, Math.round(canvas.height * 0.82));
    quality = Math.max(0.4, quality - 0.1);
  }

  throw new Error(`Screenshot is too large to process automatically: ${file.name || 'upload'}`);
}

async function optimizeCanvas(canvas, baseName, suffix = '') {
  let width = canvas.width;
  let height = canvas.height;
  let quality = 0.86;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.max(1, Math.round(width * scale));
    exportCanvas.height = Math.max(1, Math.round(height * scale));

    const context = exportCanvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to prepare screenshot segment');
    }

    context.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

    const blob = await canvasToBlob(exportCanvas, 'image/jpeg', quality);
    if (blob.size <= MAX_VISION_UPLOAD_BYTES) {
      return new File([blob], `${baseName}${suffix}.jpg`, { type: 'image/jpeg' });
    }

    width = Math.max(500, Math.round(exportCanvas.width * 0.84));
    height = Math.max(500, Math.round(exportCanvas.height * 0.84));
    quality = Math.max(0.42, quality - 0.08);
  }

  throw new Error(`Screenshot is too large to process automatically: ${baseName}`);
}

async function prepareScreenshotParts(file) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return [{ file, segmentIndex: 0, segmentCount: 1 }];
  }

  const image = await loadImage(file);
  const isTallScreenshot = image.height > SLICE_TRIGGER_HEIGHT || (image.height / image.width) > SLICE_TRIGGER_RATIO;
  if (!isTallScreenshot) {
    const optimized = await optimizeScreenshot(file);
    return [{ file: optimized, segmentIndex: 0, segmentCount: 1 }];
  }

  const baseName = getBaseName(file.name);
  const sliceHeight = Math.min(image.height, Math.max(900, Math.round(Math.min(MAX_SLICE_HEIGHT, image.width * 1.15))));
  const sliceCount = Math.ceil(image.height / sliceHeight);
  const parts = [];

  for (let index = 0; index < sliceCount; index += 1) {
    const sourceY = index * sliceHeight;
    const sourceHeight = Math.min(sliceHeight, image.height - sourceY);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = sourceHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to prepare screenshot slices');
    }

    context.drawImage(
      image,
      0,
      sourceY,
      image.width,
      sourceHeight,
      0,
      0,
      image.width,
      sourceHeight,
    );

    const optimized = await optimizeCanvas(canvas, baseName, `-part-${index + 1}`);
    parts.push({
      file: optimized,
      segmentIndex: index,
      segmentCount: sliceCount,
    });
  }

  return parts;
}

export async function uploadJobSourceFiles(uid, jobId, files) {
  const uploads = [];

  for (const file of files) {
    if (!file?.blob || !file?.slot) continue;

    const preparedFiles = await prepareScreenshotParts(file.blob);

    for (const prepared of preparedFiles) {
      const optimizedBlob = prepared.file;
      const safeName = sanitizeName(optimizedBlob.name || file.blob.name);
      const storagePath = `users/${uid}/jobs/${jobId}/inputs/${file.slot}-${Date.now()}-${safeName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, optimizedBlob, {
        contentType: optimizedBlob.type || file.blob.type || 'application/octet-stream',
        customMetadata: {
          jobId,
          slot: file.slot,
          segmentIndex: `${prepared.segmentIndex}`,
          segmentCount: `${prepared.segmentCount}`,
        },
      });

      uploads.push({
        slot: file.slot,
        storagePath,
        contentType: optimizedBlob.type || file.blob.type || 'application/octet-stream',
        bytes: optimizedBlob.size || file.blob.size,
        originalName: optimizedBlob.name || file.blob.name || safeName,
        segmentIndex: prepared.segmentIndex,
        segmentCount: prepared.segmentCount,
      });
    }
  }

  return uploads;
}

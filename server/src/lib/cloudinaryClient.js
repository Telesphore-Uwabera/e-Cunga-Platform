import { v2 as cloudinary } from 'cloudinary';

/** Default max upload size (10MB) — override via MEDIA_UPLOAD_MAX_BYTES. */
export const MEDIA_UPLOAD_MAX_BYTES = Number(
  process.env.MEDIA_UPLOAD_MAX_BYTES || 10 * 1024 * 1024
);

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

export function configureCloudinary() {
  if (!isCloudinaryConfigured()) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
}

/**
 * @param {Buffer} buffer
 * @param {{ folder?: string; resourceType?: string }} [opts]
 */
export function uploadBufferToCloudinary(buffer, opts = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { ...opts, resource_type: opts.resourceType || opts.resource_type || 'auto' },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

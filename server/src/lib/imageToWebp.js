import sharp from 'sharp';

/** Vector / special types: upload as-is (Cloudinary), no raster WebP conversion. */
const SKIP_WEBP_MIMES = new Set(['image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);

/**
 * Raster images are converted to WebP before Cloudinary upload.
 * SVG, ICO, and failed conversions keep the original buffer.
 *
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<{ buffer: Buffer; converted: boolean; format: 'webp' | 'original' }>}
 */
export async function rasterImageToWebpIfNeeded(buffer, mimetype) {
  const mime = String(mimetype || '').toLowerCase();
  if (!mime.startsWith('image/')) {
    return { buffer, converted: false, format: 'original' };
  }
  if (SKIP_WEBP_MIMES.has(mime)) {
    return { buffer, converted: false, format: 'original' };
  }

  try {
    const pipeline = sharp(buffer).rotate();
    const out = await pipeline.webp({ quality: 85, effort: 4, smartSubsample: true }).toBuffer();
    return { buffer: out, converted: true, format: 'webp' };
  } catch (err) {
    console.warn('[imageToWebp] conversion failed, storing original:', err?.message || err);
    return { buffer, converted: false, format: 'original' };
  }
}

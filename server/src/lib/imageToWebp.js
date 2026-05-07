import sharp from 'sharp';

/** Vector / special types: upload as-is (Cloudinary), no raster WebP conversion. */
const SKIP_WEBP_MIMES = new Set(['image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);
const MAX_CONVERT_BYTES = Number(process.env.WEBP_MAX_CONVERT_BYTES || 4 * 1024 * 1024);
const SHARP_MAX_INPUT_PIXELS = Number(process.env.SHARP_MAX_INPUT_PIXELS || 16_000_000);

// Keep Sharp memory footprint low on small Render instances.
sharp.cache(false);
sharp.concurrency(1);

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
  if (!buffer || buffer.length > MAX_CONVERT_BYTES) {
    // Skip conversion for large files to avoid memory spikes on free instances.
    return { buffer, converted: false, format: 'original' };
  }

  try {
    const pipeline = sharp(buffer, { limitInputPixels: SHARP_MAX_INPUT_PIXELS, sequentialRead: true }).rotate();
    const out = await pipeline.webp({ quality: 85, effort: 4, smartSubsample: true }).toBuffer();
    return { buffer: out, converted: true, format: 'webp' };
  } catch (err) {
    console.warn('[imageToWebp] conversion failed, storing original:', err?.message || err);
    return { buffer, converted: false, format: 'original' };
  }
}

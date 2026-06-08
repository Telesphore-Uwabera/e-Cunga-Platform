/** Client-side PDF upload limits (aligned with server MEDIA_UPLOAD_MAX_BYTES default). */
export const PDF_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * @param {File | null | undefined} file
 * @param {(message: string, tone?: string) => void} showFlash
 * @returns {boolean}
 */
export function validatePdfUpload(file, showFlash) {
  if (!file) return false;
  if (file.type !== 'application/pdf') {
    showFlash('Please upload a PDF file only.', 'error');
    return false;
  }
  if (file.size > PDF_UPLOAD_MAX_BYTES) {
    showFlash('File size must be less than 10MB. Please compress your PDF and try again.', 'error');
    return false;
  }
  return true;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

/** Returns an error message for disallowed/oversized upload files, or null when OK. */
export function validateUploadFile(file: File, label: string): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `${label}: only PDF, PNG, JPG or WEBP files are allowed.`;
  }
  if (file.size === 0) {
    return `${label}: the selected file is empty.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${label}: file is too large (max 10 MB).`;
  }
  return null;
}

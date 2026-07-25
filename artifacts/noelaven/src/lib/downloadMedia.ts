/**
 * downloadImage — fetch an image from any URL (including cross-origin Firebase
 * Storage / Cloudinary) as a Blob and trigger a real browser download.
 *
 * Why <a download> alone fails:
 *   The HTML `download` attribute is ignored by every browser for cross-origin
 *   URLs. Firebase Storage and Cloudinary URLs are on different origins, so
 *   clicking <a href="https://firebasestorage.googleapis.com/…" download>
 *   just navigates to the URL in a new tab instead of saving the file.
 *
 * Fix:
 *   Fetch the image → get a Blob → create a blob: URL (same-origin) →
 *   click a temporary <a download> against that blob: URL → revoke.
 *   Blob URLs are always same-origin so the download attribute is respected.
 *
 * Android Chrome:
 *   blob: URL downloads save directly to the Downloads folder on Android 74+.
 *   If the browser supports the Web Share API with files (Android 75+) and the
 *   blob download fails, we fall back to navigator.share so the user can save
 *   via the native share sheet.
 *
 * Security:
 *   The URL is never logged — Firebase Storage URLs contain auth tokens in the
 *   query string that must not appear in plain-text logs.
 */

function datestamp(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0') +
    '-' + String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0')
  );
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg':  'jpg',
    'image/jpg':   'jpg',
    'image/png':   'png',
    'image/webp':  'webp',
    'image/gif':   'gif',
    'image/heic':  'heic',
    'image/heif':  'heif',
    'image/avif':  'avif',
  };
  return map[mime.split(';')[0].trim().toLowerCase()] ?? 'jpg';
}

export async function downloadImage(url: string): Promise<void> {
  // Fetch cross-origin image as Blob.
  // mode:'cors' + cache:'no-store' avoids stale opaque responses.
  const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!res.ok) {
    // Intentionally not including the URL in the error — it may contain tokens.
    throw new Error(`Download failed: server returned ${res.status}`);
  }

  const blob = await res.blob();
  const mime  = blob.type || 'image/jpeg';
  const ext   = mimeToExt(mime);
  const filename = `noelaven-photo-${datestamp()}.${ext}`;

  // ── Primary: blob URL anchor click (works on desktop + Android 74+) ────────
  const objectUrl = URL.createObjectURL(blob);
  let blobDownloadAttempted = false;
  try {
    const a = document.createElement('a');
    a.href     = objectUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    blobDownloadAttempted = true;
  } catch {
    // Ignore — fall through to Web Share fallback
  }

  // Give the browser a moment to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

  if (blobDownloadAttempted) return;

  // ── Fallback: Web Share API (Android Chrome when blob download is blocked) ──
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Save photo' });
      return;
    }
  }

  throw new Error('Download not supported on this browser');
}

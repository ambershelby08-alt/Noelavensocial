/**
 * Cloudinary upload utility — uses an unsigned upload preset so no backend
 * is needed. The cloud name and preset are read from VITE_ env vars.
 */

export const isCloudinaryConfigured = Boolean(
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME &&
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
);

export type UploadFolder = 'avatars' | 'posts' | 'covers' | 'stories';
export type MediaType = 'image' | 'video';

/**
 * Upload a single File to Cloudinary and return its secure_url.
 * Throws on network errors or non-2xx responses.
 */
export async function uploadImage(file: File, folder: UploadFolder = 'posts'): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset    = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    throw new Error('Cloudinary is not configured — add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your secrets.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  form.append('folder', `noelaven/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Upload failed (${res.status})`);
  }

  const data = await res.json() as { secure_url: string; public_id: string };
  return data.secure_url;
}

export type UploadResult = { url: string; publicId: string };

/**
 * Same as uploadImage but also returns the Cloudinary public_id for future
 * image management (transforms, deletion, etc.).
 */
export async function uploadImageFull(file: File, folder: UploadFolder = 'posts'): Promise<UploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset    = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    throw new Error('Cloudinary is not configured — add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your secrets.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  form.append('folder', `noelaven/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Upload failed (${res.status})`);
  }

  const data = await res.json() as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id };
}

/**
 * Upload an image or video file for stories.
 * Auto-detects the resource type and routes to the correct Cloudinary endpoint.
 */
export async function uploadStoryMedia(
  file: File,
): Promise<{ url: string; mediaType: MediaType }> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
  const preset    = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

  if (!cloudName || !preset) {
    throw new Error('Cloudinary is not configured.');
  }

  const isVideo = file.type.startsWith('video/');
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  form.append('folder', 'noelaven/stories');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`,
    { method: 'POST', body: form },
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { secure_url: string };
  return { url: data.secure_url, mediaType: isVideo ? 'video' : 'image' };
}

/** Pick a file from disk and immediately upload it. Returns the secure URL. */
export function pickAndUpload(folder: UploadFolder = 'posts'): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('No file selected')); return; }
      try { resolve(await uploadImage(file, folder)); }
      catch (e) { reject(e); }
    };
    input.click();
  });
}

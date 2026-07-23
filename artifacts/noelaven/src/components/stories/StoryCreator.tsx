import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ImagePlus, Video, Loader2 } from 'lucide-react';
import { isCloudinaryConfigured } from '@/lib/cloudinary';
import type { StoryMediaType } from '@/lib/stories';

interface StoryCreatorProps {
  onClose: () => void;
  onPublish: (mediaUrl: string, mediaType: StoryMediaType, caption: string) => Promise<void>;
}

/**
 * Upload a file to Cloudinary — images via /image/upload, videos via /video/upload.
 * Returns the secure URL and the resolved media type.
 */
async function uploadStoryMedia(
  file: File,
): Promise<{ url: string; mediaType: StoryMediaType }> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
  const preset   = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

  if (!cloudName || !preset) {
    throw new Error(
      'Cloudinary is not configured — add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.',
    );
  }

  const isVideo   = file.type.startsWith('video/');
  const mediaType: StoryMediaType = isVideo ? 'video' : 'image';
  const endpoint  = isVideo ? 'video' : 'image';

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  form.append('folder', 'noelaven/stories');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}/upload`,
    { method: 'POST', body: form },
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { secure_url: string };
  return { url: data.secure_url, mediaType };
}

export function StoryCreator({ onClose, onPublish }: StoryCreatorProps) {
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<StoryMediaType>('image');
  const [caption, setCaption]   = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function pickMedia(type: 'image' | 'video') {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept =
      type === 'image'
        ? 'image/jpeg,image/png,image/webp,image/gif'
        : 'video/mp4,video/quicktime,video/webm';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      setFile(f);
      setMediaType(type);
      setPreview(URL.createObjectURL(f));
      setError(null);
    };
    input.click();
  }

  function clearMedia() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  async function handlePublish() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      if (!isCloudinaryConfigured) {
        // Demo mode — pretend to publish with the object-URL preview
        await onPublish(preview!, mediaType, caption.trim());
        onClose();
        return;
      }
      const { url, mediaType: mt } = await uploadStoryMedia(file);
      await onPublish(url, mt, caption.trim());
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[55]"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-3xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-lg font-bold text-gray-900">New Story</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {!preview ? (
          /* ── Step 1: pick media ── */
          <div className="px-5 pb-6 flex flex-col gap-3">
            <p className="text-sm text-gray-500 mb-1">
              Share a photo or video — it disappears after 24 hours.
            </p>

            <button
              onClick={() => pickMedia('image')}
              className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 active:bg-purple-50 transition-colors text-left"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB)' }}
              >
                <ImagePlus size={18} className="text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Add a photo</div>
                <div className="text-xs text-gray-400">JPEG · PNG · WebP · GIF</div>
              </div>
            </button>

            <button
              onClick={() => pickMedia('video')}
              className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 active:bg-purple-50 transition-colors text-left"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6)' }}
              >
                <Video size={18} className="text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">Add a video</div>
                <div className="text-xs text-gray-400">MP4 · MOV · WebM</div>
              </div>
            </button>
          </div>
        ) : (
          /* ── Step 2: preview + caption ── */
          <div className="px-5 pb-4 flex flex-col gap-4">
            {/* Media preview */}
            <div
              className="rounded-2xl overflow-hidden bg-black relative w-full"
              style={{ aspectRatio: '9/16', maxHeight: '38vh' }}
            >
              {mediaType === 'image' ? (
                <img src={preview} className="w-full h-full object-cover" alt="story preview" />
              ) : (
                <video
                  src={preview}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              )}
              <button
                onClick={clearMedia}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
              >
                <X size={14} className="text-white" />
              </button>
            </div>

            {/* Caption */}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              rows={2}
              maxLength={200}
              className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm text-gray-800 placeholder-gray-400 border border-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
            />

            {error && <p className="text-xs text-red-500 px-1">{error}</p>}

            {/* Publish button */}
            <button
              onClick={handlePublish}
              disabled={uploading}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB, #6B73FF)' }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                'Share Story ✨'
              )}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

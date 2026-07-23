/**
 * StoryCreator — media picker sheet.
 *
 * Responsibility: let the user pick a photo or video, then hand it off to
 * the full StoryEditor. All editing, uploading, and publishing are handled
 * by the editor — this component only picks the file.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X, ImagePlus, Video } from 'lucide-react';
import type { StoryMediaType } from '@/lib/stories';

interface StoryCreatorProps {
  onClose: () => void;
  onMediaReady: (file: File, previewUrl: string, mediaType: StoryMediaType) => void;
}

export function StoryCreator({ onClose, onMediaReady }: StoryCreatorProps) {
  function pick(type: 'image' | 'video') {
    const input      = document.createElement('input');
    input.type       = 'file';
    input.accept     =
      type === 'image'
        ? 'image/jpeg,image/png,image/webp,image/gif'
        : 'video/mp4,video/quicktime,video/webm';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      onMediaReady(file, URL.createObjectURL(file), type);
    };
    input.click();
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

        {/* Pickers */}
        <div className="px-5 pb-4 flex flex-col gap-3">
          <p className="text-sm text-gray-500 mb-1">
            Share a photo or video — it disappears after 24 hours.
          </p>

          <button
            onClick={() => pick('image')}
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
            onClick={() => pick('video')}
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
      </motion.div>
    </>
  );
}

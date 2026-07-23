/**
 * StoryCreator — media picker sheet with an internal queue.
 *
 * Flow
 * ────
 *   1. User taps "Add Photos" (multi-select) or "Add Video" one or more times.
 *   2. Every picked file is appended to a local queue shown as thumbnails.
 *   3. Individual items can be removed with the × badge on each thumbnail.
 *   4. "Continue" hands the full queue to the parent; parent queues them
 *      through StoryEditor one-by-one.
 *
 * This means photos and videos can be mixed in a single session.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImagePlus, Video, Plus } from 'lucide-react';
import type { StoryMediaType } from '@/lib/stories';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StoryPickItem {
  /** Stable key for React lists — assigned on pick, never changes. */
  id: string;
  file: File;
  previewUrl: string;
  mediaType: StoryMediaType;
}

interface StoryCreatorProps {
  onClose: () => void;
  /** Called with the full queue when the user taps Continue. */
  onMediaReady: (items: StoryPickItem[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0;
function uid() { return String(++_uid); }

// ─── Component ────────────────────────────────────────────────────────────────

export function StoryCreator({ onClose, onMediaReady }: StoryCreatorProps) {
  const [queue, setQueue] = useState<StoryPickItem[]>([]);
  // Track blob URLs so we can revoke them when an item is removed or the sheet closes.
  const blobUrls = useRef(new Set<string>());

  function addFiles(type: 'image' | 'video', multiple: boolean) {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.multiple = multiple;
    input.accept   =
      type === 'image'
        ? 'image/jpeg,image/png,image/webp,image/gif'
        : 'video/mp4,video/quicktime,video/webm';

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;

      const newItems: StoryPickItem[] = files.map(f => {
        const url = URL.createObjectURL(f);
        blobUrls.current.add(url);
        return { id: uid(), file: f, previewUrl: url, mediaType: type };
      });

      setQueue(prev => [...prev, ...newItems]);
    };

    input.click();
  }

  function removeItem(id: string) {
    setQueue(prev => {
      const next = prev.filter(it => {
        if (it.id === id) {
          URL.revokeObjectURL(it.previewUrl);
          blobUrls.current.delete(it.previewUrl);
          return false;
        }
        return true;
      });
      return next;
    });
  }

  function handleClose() {
    // Revoke all blob URLs before closing.
    blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    blobUrls.current.clear();
    onClose();
  }

  function handleContinue() {
    if (!queue.length) return;
    // Ownership of blob URLs passes to the parent — do NOT revoke here.
    blobUrls.current.clear();
    onMediaReady(queue);
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[55]"
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-3xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="text-lg font-bold text-gray-900">New Story</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* ── Queue thumbnail strip ── */}
        <AnimatePresence initial={false}>
          {queue.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {queue.length} {queue.length === 1 ? 'item' : 'items'} selected
                </p>
                <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                  {queue.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100"
                    >
                      {item.mediaType === 'image' ? (
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <video
                          src={item.previewUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      )}

                      {/* Video badge */}
                      {item.mediaType === 'video' && (
                        <div className="absolute bottom-1 left-1 bg-black/60 rounded-full p-0.5">
                          <Video size={9} className="text-white" />
                        </div>
                      )}

                      {/* Remove × */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center active:bg-black transition-colors"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Picker buttons ── */}
        <div className="px-5 pb-3 flex flex-col gap-2.5">
          {queue.length === 0 && (
            <p className="text-sm text-gray-400 mb-0.5">
              Mix photos and videos — each becomes its own story segment.
            </p>
          )}

          {/* Photos (multiple) */}
          <button
            onClick={() => addFiles('image', true)}
            className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 active:bg-purple-50 transition-colors text-left"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB)' }}
            >
              {queue.some(i => i.mediaType === 'image') ? (
                <Plus size={16} className="text-white" />
              ) : (
                <ImagePlus size={16} className="text-white" />
              )}
            </div>
            <div>
              <div className="font-semibold text-gray-800 text-sm">
                {queue.some(i => i.mediaType === 'image') ? 'Add more photos' : 'Add photos'}
              </div>
              <div className="text-xs text-gray-400">Select multiple — each becomes a segment</div>
            </div>
          </button>

          {/* Video */}
          <button
            onClick={() => addFiles('video', false)}
            className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 active:bg-purple-50 transition-colors text-left"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6)' }}
            >
              <Video size={16} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-800 text-sm">
                {queue.some(i => i.mediaType === 'video') ? 'Add another video' : 'Add a video'}
              </div>
              <div className="text-xs text-gray-400">MP4 · MOV · WebM</div>
            </div>
          </button>
        </div>

        {/* ── Continue button (shown when queue has items) ── */}
        <AnimatePresence>
          {queue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="px-5 pt-1"
            >
              <button
                onClick={handleContinue}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB, #6B73FF)' }}
              >
                Continue with {queue.length} {queue.length === 1 ? 'item' : 'items'} →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

/**
 * StoryCreator — media picker with a visible queue and inline + tile.
 *
 * UX flow
 * ───────
 * 1. Empty state: big upload area with "Add Photos & Videos" button.
 * 2. After picking, items appear as square thumbnails in a horizontal strip.
 *    The LAST tile in the strip is always a ＋ tile — tap it to add more.
 * 3. Each thumbnail has a ✕ remove badge.
 * 4. "Share N Stories →" primary CTA appears once the queue is non-empty.
 * 5. Tapping ＋ or "Add more" opens the system picker accepting images AND
 *    videos in one session (multi-select). Files are categorised by MIME type.
 * 6. "Continue" calls onMediaReady; the parent walks StoryEditor over each item.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Video, ImagePlus } from 'lucide-react';
import type { StoryMediaType } from '@/lib/stories';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StoryPickItem {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: StoryMediaType;
}

interface StoryCreatorProps {
  onClose: () => void;
  onMediaReady: (items: StoryPickItem[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0;
function uid() { return String(++_uid); }

// ─── Component ────────────────────────────────────────────────────────────────

export function StoryCreator({ onClose, onMediaReady }: StoryCreatorProps) {
  const [queue, setQueue] = useState<StoryPickItem[]>([]);
  const blobUrls = useRef(new Set<string>());

  // ── Picker ────────────────────────────────────────────────────────────────

  function openPicker() {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.multiple = true;
    // Accept both images and videos — the system picker handles the UI.
    input.accept   = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;

      const newItems: StoryPickItem[] = files.map(f => {
        const url = URL.createObjectURL(f);
        blobUrls.current.add(url);
        const mediaType: StoryMediaType = f.type.startsWith('video/') ? 'video' : 'image';
        return { id: uid(), file: f, previewUrl: url, mediaType };
      });

      setQueue(prev => [...prev, ...newItems]);
    };

    input.click();
  }

  function removeItem(id: string) {
    setQueue(prev => prev.filter(it => {
      if (it.id !== id) return true;
      URL.revokeObjectURL(it.previewUrl);
      blobUrls.current.delete(it.previewUrl);
      return false;
    }));
  }

  function handleClose() {
    blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    blobUrls.current.clear();
    onClose();
  }

  function handleContinue() {
    if (!queue.length) return;
    blobUrls.current.clear(); // ownership passes to parent
    onMediaReady(queue);
  }

  const hasItems = queue.length > 0;

  // ── Styles ────────────────────────────────────────────────────────────────

  const GRAD = 'linear-gradient(135deg, #FF6B9D, #C44FDB, #6B73FF)';

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55]"
        style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-3xl overflow-hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">New Story</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Photos and videos — each becomes a segment
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors flex-shrink-0"
          >
            <X size={17} className="text-gray-500" />
          </button>
        </div>

        {/* ── Thumbnail queue strip (visible when queue has items) ── */}
        <AnimatePresence initial={false}>
          {hasItems && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4">
                {/* Section label */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {queue.length} {queue.length === 1 ? 'item' : 'items'} queued
                  </span>
                  <span className="text-xs text-gray-400">Each publishes separately</span>
                </div>

                {/* Horizontal scroll area */}
                <div
                  className="flex gap-3 overflow-x-auto pb-1"
                  style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
                >
                  {/* Thumbnail tiles */}
                  <AnimatePresence initial={false}>
                    {queue.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="relative flex-shrink-0"
                        style={{ width: 80, height: 80 }}
                      >
                        <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 relative">
                          {item.mediaType === 'image' ? (
                            <img
                              src={item.previewUrl}
                              alt={`Story ${idx + 1}`}
                              className="w-full h-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <video
                              src={item.previewUrl}
                              className="w-full h-full object-cover"
                              muted playsInline preload="metadata"
                            />
                          )}

                          {/* Order badge */}
                          <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                               style={{ background: 'rgba(0,0,0,0.55)' }}>
                            <span className="text-white text-[10px] font-bold leading-none">{idx + 1}</span>
                          </div>

                          {/* Video badge */}
                          {item.mediaType === 'video' && (
                            <div className="absolute bottom-1.5 left-1.5 rounded-full p-1"
                                 style={{ background: 'rgba(0,0,0,0.55)' }}>
                              <Video size={8} className="text-white" />
                            </div>
                          )}
                        </div>

                        {/* Remove ✕ badge */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center z-10 active:scale-90 transition-transform shadow-md"
                          style={{ background: '#1F2937' }}
                        >
                          <X size={11} className="text-white" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* ＋ Add more tile — always the last tile */}
                  <motion.button
                    layout
                    onClick={openPicker}
                    whileTap={{ scale: 0.92 }}
                    className="flex-shrink-0 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 active:border-purple-400 active:bg-purple-50 transition-colors"
                    style={{ width: 80, height: 80, minWidth: 80 }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: GRAD }}
                    >
                      <Plus size={16} className="text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 leading-tight text-center">
                      Add more
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty state / primary add button ── */}
        {!hasItems ? (
          /* Large upload area shown when queue is empty */
          <div className="px-5 pb-5">
            <button
              onClick={openPicker}
              className="w-full rounded-3xl flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform"
              style={{
                height: 160,
                background: 'linear-gradient(135deg, rgba(107,115,255,0.08), rgba(255,107,157,0.08))',
                border: '2px dashed rgba(107,115,255,0.35)',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: GRAD }}
              >
                <ImagePlus size={26} className="text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-800 text-base">Add Photos or Videos</div>
                <div className="text-xs text-gray-400 mt-0.5">Select multiple — each becomes its own story</div>
              </div>
            </button>
          </div>
        ) : (
          /* Secondary "Add more" row button shown below the strip */
          <div className="px-5 pb-4">
            <button
              onClick={openPicker}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl active:bg-gray-100 transition-colors"
              style={{ border: '1.5px solid #E5E7EB' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: GRAD }}
              >
                <Plus size={14} className="text-white" />
              </div>
              <span className="font-semibold text-gray-700 text-sm">Add another photo or video</span>
            </button>
          </div>
        )}

        {/* ── Continue / Share CTA ── */}
        <div className="px-5 pt-1 flex flex-col gap-2.5">
          <AnimatePresence>
            {hasItems && (
              <motion.button
                key="cta"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                onClick={handleContinue}
                whileTap={{ scale: 0.97 }}
                className="w-full font-bold text-white flex items-center justify-center gap-2"
                style={{
                  background: GRAD,
                  borderRadius: 16, border: 'none', cursor: 'pointer',
                  padding: '17px 0', fontSize: 16, letterSpacing: '-0.01em',
                }}
              >
                Share {queue.length} {queue.length === 1 ? 'Story' : 'Stories'} →
              </motion.button>
            )}
          </AnimatePresence>

          {/* Cancel text button */}
          <button
            onClick={handleClose}
            className="w-full py-3 text-sm font-semibold text-gray-400 active:text-gray-600 transition-colors text-center"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}

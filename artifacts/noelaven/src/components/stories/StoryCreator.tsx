/**
 * StoryCreator — story composer with a visible queue.
 *
 * Empty state  → large upload tile, tap to open picker.
 * Queue state  → thumbnail strip + always-visible "+ Add Another" button
 *                + counter + reorder arrows + Publish All CTA.
 *
 * The "+ Add Another" button is OUTSIDE the scroll strip so it is always
 * visible regardless of how many items are queued.
 *
 * Each item is published as a separate story segment in order.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Video, ChevronLeft, ChevronRight, ImagePlus, Layers } from 'lucide-react';
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
  /** Called with the ordered queue; parent drives each item through StoryEditor. */
  onMediaReady: (items: StoryPickItem[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0;
const nextId = () => `sc-${++_seq}`;

const GRAD = 'linear-gradient(135deg, #FF6B9D, #C44FDB, #6B73FF)';

// ─── Thumbnail tile ───────────────────────────────────────────────────────────

interface TileProps {
  item:     StoryPickItem;
  idx:      number;
  total:    number;
  onRemove: (id: string) => void;
  onMove:   (id: string, dir: -1 | 1) => void;
}

function Tile({ item, idx, total, onRemove, onMove }: TileProps) {
  const isFirst = idx === 0;
  const isLast  = idx === total - 1;

  return (
    <motion.div
      layout
      key={item.id}
      initial={{ scale: 0.75, opacity: 0 }}
      animate={{ scale: 1,    opacity: 1 }}
      exit={{    scale: 0.75, opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ position: 'relative', flexShrink: 0, width: 96, height: 128 }}
    >
      {/* Thumbnail */}
      <div style={{
        width: '100%', height: '100%',
        borderRadius: 14, overflow: 'hidden',
        background: '#E5E7EB', position: 'relative',
      }}>
        {item.mediaType === 'image' ? (
          <img
            src={item.previewUrl}
            alt={`Story ${idx + 1}`}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <video
            src={item.previewUrl}
            muted playsInline preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Number badge */}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          width: 22, height: 22, borderRadius: 99,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'white', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
            {idx + 1}
          </span>
        </div>

        {/* Video badge */}
        {item.mediaType === 'video' && (
          <div style={{
            position: 'absolute', bottom: 28, left: 6,
            background: 'rgba(0,0,0,0.6)', borderRadius: 99, padding: '3px 5px',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Video size={9} color="white" />
            <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>VID</span>
          </div>
        )}

        {/* Reorder arrows — bottom strip */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 26,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px',
        }}>
          <button
            onClick={() => onMove(item.id, -1)}
            disabled={isFirst}
            style={{
              width: 22, height: 22, borderRadius: 99,
              background: isFirst ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)',
              border: 'none', cursor: isFirst ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isFirst ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={13} color="white" />
          </button>
          <button
            onClick={() => onMove(item.id, 1)}
            disabled={isLast}
            style={{
              width: 22, height: 22, borderRadius: 99,
              background: isLast ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)',
              border: 'none', cursor: isLast ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isLast ? 0.3 : 1,
            }}
          >
            <ChevronRight size={13} color="white" />
          </button>
        </div>
      </div>

      {/* Remove ✕ — top-right, outside the tile */}
      <button
        onClick={() => onRemove(item.id)}
        style={{
          position: 'absolute', top: -7, right: -7, zIndex: 10,
          width: 24, height: 24, borderRadius: 99,
          background: '#111827', border: '2px solid white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        <X size={11} color="white" />
      </button>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoryCreator({ onClose, onMediaReady }: StoryCreatorProps) {
  const [queue, setQueue] = useState<StoryPickItem[]>([]);
  const blobUrls = useRef(new Set<string>());

  // ── Picker ────────────────────────────────────────────────────────────────

  function openPicker() {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.multiple = true;                        // multi-select enabled
    input.accept   = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm',
    ].join(',');

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;

      const items: StoryPickItem[] = files.map(f => {
        const url = URL.createObjectURL(f);
        blobUrls.current.add(url);
        return {
          id:         nextId(),
          file:       f,
          previewUrl: url,
          mediaType:  f.type.startsWith('video/') ? 'video' : 'image',
        };
      });

      // APPEND — never replace existing items.
      setQueue(prev => [...prev, ...items]);
    };

    input.click();
  }

  // ── Queue mutations ───────────────────────────────────────────────────────

  function removeItem(id: string) {
    setQueue(prev => prev.filter(it => {
      if (it.id !== id) return true;
      URL.revokeObjectURL(it.previewUrl);
      blobUrls.current.delete(it.previewUrl);
      return false;
    }));
  }

  function moveItem(id: string, dir: -1 | 1) {
    setQueue(prev => {
      const idx = prev.findIndex(it => it.id === id);
      if (idx === -1) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleClose() {
    blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    blobUrls.current.clear();
    onClose();
  }

  function handlePublishAll() {
    if (!queue.length) return;
    blobUrls.current.clear();   // ownership transfers to parent
    onMediaReady([...queue]);   // pass a copy so parent owns the array
  }

  // ─────────────────────────────────────────────────────────────────────────

  const hasItems = queue.length > 0;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 55,
          background: 'rgba(0,0,0,0.65)',
        }}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
          background: 'white', borderRadius: '24px 24px 0 0',
          display: 'flex', flexDirection: 'column',
          maxHeight: hasItems ? '88vh' : '70vh',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E7EB' }} />
        </div>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px 14px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
                New Story
              </h2>
              {/* Queue count badge */}
              <AnimatePresence>
                {hasItems && (
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    style={{
                      background: GRAD, color: 'white',
                      fontSize: 12, fontWeight: 800,
                      borderRadius: 99, padding: '2px 9px',
                    }}
                  >
                    {queue.length}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
              {hasItems
                ? `${queue.length} ${queue.length === 1 ? 'story' : 'stories'} · each publishes separately`
                : 'Photos and videos — each becomes a segment'}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 34, height: 34, borderRadius: 99,
              background: '#F3F4F6', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={16} color="#6B7280" />
          </button>
        </div>

        {/* ── BODY (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* ── Empty state ── */}
          {!hasItems && (
            <div style={{ padding: '0 20px 20px' }}>
              <button
                onClick={openPicker}
                style={{
                  width: '100%', height: 180, borderRadius: 20,
                  border: '2px dashed rgba(107,115,255,0.4)',
                  background: 'linear-gradient(135deg, rgba(107,115,255,0.06), rgba(255,107,157,0.06))',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 14,
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 60, height: 60, borderRadius: 18,
                  background: GRAD,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ImagePlus size={28} color="white" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
                    Add Photos or Videos
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
                    Select multiple — each becomes its own story
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── Queue ── */}
          {hasItems && (
            <>
              {/* Counter row */}
              <div style={{
                padding: '0 20px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} color="#6B73FF" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                    {queue.length === 1
                      ? '1 story queued'
                      : `${queue.length} stories queued`}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Tap ◀ ▶ to reorder
                </span>
              </div>

              {/* Horizontal thumbnail strip */}
              <div
                style={{
                  padding: '0 20px 4px',
                  overflowX: 'auto', overflowY: 'visible',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div
                  style={{
                    display: 'flex', gap: 12, paddingBottom: 12,
                    // Extra right padding so last tile doesn't butt up against the edge
                    paddingRight: 4,
                  }}
                >
                  <AnimatePresence initial={false}>
                    {queue.map((item, idx) => (
                      <Tile
                        key={item.id}
                        item={item}
                        idx={idx}
                        total={queue.length}
                        onRemove={removeItem}
                        onMove={moveItem}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── + Add Another — ALWAYS VISIBLE, outside the scroll ── */}
              <div style={{ padding: '8px 20px 4px' }}>
                <button
                  onClick={openPicker}
                  style={{
                    width: '100%', padding: '14px 0',
                    borderRadius: 16, cursor: 'pointer',
                    border: '2px dashed #D1D5DB',
                    background: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 99,
                    background: GRAD,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Plus size={16} color="white" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                      + Add Another Photo or Video
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                      Added to your queue — won't replace existing items
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Footer: Publish All + Cancel ── */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          {hasItems ? (
            <>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePublishAll}
                style={{
                  width: '100%', padding: '17px 0',
                  borderRadius: 16, border: 'none', cursor: 'pointer',
                  background: GRAD,
                  color: 'white', fontSize: 17, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  letterSpacing: '-0.01em',
                }}
              >
                <Layers size={18} color="white" />
                Publish All ({queue.length}) →
              </motion.button>
              <button
                onClick={handleClose}
                style={{
                  width: '100%', padding: '13px 0',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600, color: '#9CA3AF',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              style={{
                width: '100%', padding: '13px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: '#9CA3AF',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}

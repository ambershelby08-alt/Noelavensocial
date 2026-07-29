/**
 * StoryCreator — story composer with a permanent media tray.
 *
 * LAYOUT
 * ──────
 * The sheet has two visible states:
 *
 * EMPTY STATE (no files yet)
 *   [Handle]
 *   [Header: "New Story"  X]
 *   [Large upload tile — tap to open picker]
 *   [Cancel]
 *
 * LOADED STATE (≥1 file selected)
 *   [Handle]
 *   [Header: "New Story  N"  X]
 *   ── PERMANENT BOTTOM TRAY (flexShrink:0, never scrolled away) ──
 *   [Horizontal strip: [thumb][thumb][+ Add more]]   ← scrollable x
 *   [N selected]
 *   [Publish All (N) →]
 *   [Cancel]
 *
 * The "PERMANENT BOTTOM TRAY" is rendered OUTSIDE any overflowY:auto
 * container so it can never be clipped or scrolled off-screen.
 *
 * The "+ Add more" tile is always the last element of the scroll strip
 * and therefore always visible after scrolling right (or immediately
 * when there are only a few items).
 *
 * PHANTOM-CLICK GUARD
 * ───────────────────
 * Native file-picker dialogs fire a synthetic click on the document when
 * they close, which otherwise hits the backdrop's onClick={handleClose}
 * and unmounts the sheet.  pickerGuardRef blocks the backdrop for 1 500 ms
 * after openPicker() is called; the real onChange clears it immediately.
 */

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Video, ImagePlus, Layers } from 'lucide-react';
import type { StoryMediaType } from '@/lib/stories';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StoryPickItem {
  id:         string;
  file:       File;
  previewUrl: string;
  mediaType:  StoryMediaType;
}

interface StoryCreatorProps {
  onClose:      () => void;
  /** Called with the ordered queue only when the user taps "Publish All". */
  onMediaReady: (items: StoryPickItem[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0;
const nextId = () => `sc-${++_seq}`;

const GRAD = 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' // rainbow ring accent;
const ACCEPT = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
].join(',');

// ─── Thumbnail chip ───────────────────────────────────────────────────────────
// Compact 72 × 90 portrait chip used inside the horizontal scroll tray.

interface ChipProps {
  item:     StoryPickItem;
  idx:      number;
  onRemove: (id: string) => void;
}

function ThumbChip({ item, idx, onRemove }: ChipProps) {
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: 72, height: 90 }}>
      {/* Thumbnail */}
      <div style={{
        width: '100%', height: '100%',
        borderRadius: 12, overflow: 'hidden',
        background: '#E5E7EB', position: 'relative',
        border: '2px solid rgba(107,115,255,0.25)',
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
          position: 'absolute', top: 4, left: 4,
          minWidth: 18, height: 18, borderRadius: 99,
          background: 'rgba(0,0,0,0.7)', padding: '0 4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'white', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>
            {idx + 1}
          </span>
        </div>

        {/* Video indicator */}
        {item.mediaType === 'video' && (
          <div style={{
            position: 'absolute', bottom: 4, left: 4,
            background: 'rgba(0,0,0,0.65)', borderRadius: 99, padding: '2px 5px',
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <Video size={8} color="white" />
            <span style={{ color: 'white', fontSize: 8, fontWeight: 700 }}>VID</span>
          </div>
        )}
      </div>

      {/* Remove ✕ */}
      <button
        onClick={() => onRemove(item.id)}
        style={{
          position: 'absolute', top: -5, right: -5, zIndex: 10,
          width: 20, height: 20, borderRadius: 99,
          background: '#111827', border: '1.5px solid white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          padding: 0,
        }}
      >
        <X size={9} color="white" />
      </button>
    </div>
  );
}

// ─── "+ Add more" tile ────────────────────────────────────────────────────────
// Same dimensions as ThumbChip — lives at the END of the scroll strip.

function AddMoreTile({ onTap }: { onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      style={{
        flexShrink: 0, width: 72, height: 90,
        borderRadius: 12, cursor: 'pointer',
        border: '2px dashed #D1D5DB',
        background: 'linear-gradient(135deg, rgba(107,115,255,0.05), rgba(255,107,157,0.05))',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: 0,
        // No transition or animation — we want it to feel always-present
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 99,
        background: GRAD,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Plus size={14} color="white" />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#F5C542', lineHeight: 1.2, textAlign: 'center' }}>
        Add{'\n'}more
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoryCreator({ onClose, onMediaReady }: StoryCreatorProps) {
  const [queue, setQueue] = useState<StoryPickItem[]>([]);
  const blobUrls       = useRef(new Set<string>());
  const fileInputRef   = useRef<HTMLInputElement>(null);
  // Guards backdrop from phantom click when native file dialog closes.
  const pickerGuardRef = useRef(0);

  // ── Open picker ──────────────────────────────────────────────────────────

  function openPicker() {
    pickerGuardRef.current = Date.now() + 1500;
    const el = fileInputRef.current;
    if (!el) return;
    el.value = '';
    el.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    pickerGuardRef.current = 0;   // real change fired — clear guard immediately
    const files = Array.from(e.target.files ?? []);
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

    setQueue(prev => [...prev, ...items]);   // APPEND — never replace
    e.target.value = '';
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

  // ── Sheet actions ─────────────────────────────────────────────────────────

  function handleClose() {
    if (Date.now() < pickerGuardRef.current) return;   // ignore phantom click
    blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    blobUrls.current.clear();
    onClose();
  }

  function handlePublishAll() {
    if (!queue.length) return;
    blobUrls.current.clear();   // ownership passes to parent
    onMediaReady([...queue]);   // parent closes the composer
  }

  const hasItems = queue.length > 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/*
        Hidden file input.  Lives in JSX (not created dynamically) so it is
        reliably attached to the DOM before the picker is triggered.
      */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Backdrop ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 55,
          background: 'rgba(0,0,0,0.65)',
        }}
      />

      {/* ── Bottom sheet ── */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 60,
          background: 'white', borderRadius: '24px 24px 0 0',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
          // Sheet height: tall enough to show the tray; short enough to feel like a sheet.
          maxHeight: hasItems ? '80vh' : '65vh',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E7EB' }} />
        </div>

        {/* ── Header ── */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
              New Story
            </h2>
            {hasItems && (
              <div style={{
                background: GRAD, color: 'white',
                fontSize: 12, fontWeight: 800,
                borderRadius: 99, padding: '2px 9px',
              }}>
                {queue.length}
              </div>
            )}
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

        {/* ── EMPTY STATE ─────────────────────────────────────────────────── */}
        {!hasItems && (
          <div style={{ flex: 1, padding: '0 20px 8px', display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={openPicker}
              style={{
                flex: 1, borderRadius: 20,
                border: '2px dashed rgba(107,115,255,0.4)',
                background: 'linear-gradient(135deg, rgba(107,115,255,0.06), rgba(255,107,157,0.06))',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14,
                cursor: 'pointer', minHeight: 140,
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

        {/* ── LOADED STATE ────────────────────────────────────────────────── */}
        {/*
          This entire section is flexShrink:0 — it is NOT inside any
          overflowY:auto container.  It cannot be scrolled off screen.
        */}
        {hasItems && (
          <div style={{ flexShrink: 0, padding: '0 0 0 0' }}>

            {/* Horizontal media tray */}
            <div style={{
              overflowX: 'auto',
              overflowY: 'visible',
              WebkitOverflowScrolling: 'touch',
              // Hide scrollbar but keep scroll functionality
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}>
              <div style={{
                display: 'flex',
                gap: 10,
                padding: '4px 20px 16px',
                // Ensure the row never wraps — all chips stay on one line
                flexWrap: 'nowrap',
              }}>
                {/* Thumbnails */}
                {queue.map((item, idx) => (
                  <ThumbChip
                    key={item.id}
                    item={item}
                    idx={idx}
                    onRemove={removeItem}
                  />
                ))}

                {/*
                  + ADD MORE — last element in the strip.
                  Always rendered. Never conditional.
                  Scrolls into view if the strip is long.
                */}
                <AddMoreTile onTap={openPicker} />
              </div>
            </div>

            {/* Count */}
            <div style={{
              padding: '0 20px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Layers size={13} color="#6B73FF" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                {queue.length} {queue.length === 1 ? 'photo/video' : 'photos/videos'} selected
              </span>
              <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>
                · each publishes as its own story
              </span>
            </div>
          </div>
        )}

        {/* ── Footer: primary actions ── */}
        <div style={{ padding: '0 20px', flexShrink: 0 }}>
          {hasItems ? (
            <>
              {/* Divider */}
              <div style={{ height: 1, background: '#F3F4F6', marginBottom: 14 }} />

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

/**
 * StoryComposer — curation screen between the OS file picker and publishing.
 *
 * Flow (managed by Home.tsx):
 *   1. User taps "Add Story" → Home fires the hidden <input type="file">.
 *   2. Files selected → Home sets composerItems → StoryComposer mounts.
 *   3. User adds more, removes, reorders.
 *   4. Tap "Publish All" → per-item upload + Firestore write via onPublishItem.
 *   5. All succeed → onAllPublished() → Home opens StoryViewer.
 *
 * Design notes:
 *   • The picker in Home fires BEFORE StoryComposer mounts, so no backdrop
 *     exists during file selection — phantom-click dismissal is impossible.
 *   • The internal "+ Add More" picker uses its own persistent <input ref>
 *     (same technique), also immune to phantom clicks.
 *   • z-index: backdrop 55, sheet 60 — same slot as the retired StoryCreator.
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Plus, ChevronUp, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, Layers,
} from 'lucide-react';
import type { StoryMediaType } from '@/lib/stories';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

const GRAD = 'linear-gradient(135deg,#FF6B9D,#C44FDB,#6B73FF)';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComposerItem {
  id:         string;
  file:       File;
  previewUrl: string;
  mediaType:  StoryMediaType;
}

type ItemStatus = 'idle' | 'uploading' | 'done' | 'error';

export interface StoryComposerProps {
  initialItems:   ComposerItem[];
  onCancel:       () => void;
  /** Upload + write ONE story. Throw to signal failure. */
  onPublishItem:  (item: ComposerItem) => Promise<void>;
  /** Called after every item succeeds. */
  onAllPublished: () => void;
}

// ─── ID helper (exported for Home.tsx) ───────────────────────────────────────

let _seq = 0;
export function makeComposerId(): string {
  return `sc-${Date.now()}-${++_seq}`;
}

// ─── Thumbnail sub-component ─────────────────────────────────────────────────

function Thumb({
  item,
  status,
}: {
  item:   ComposerItem;
  status: ItemStatus;
}) {
  const overlay: Record<ItemStatus, React.ReactNode> = {
    idle:      null,
    uploading: <Loader2 size={22} color="white" className="animate-spin" />,
    done:      <CheckCircle2 size={22} color="#4ADE80" />,
    error:     <AlertCircle size={22} color="#F87171" />,
  };

  return (
    <div
      style={{
        position: 'relative',
        width: 72, height: 72,
        borderRadius: 12,
        overflow: 'hidden',
        flexShrink: 0,
        background: '#E5E7EB',
      }}
    >
      {item.mediaType === 'image' ? (
        <img
          src={item.previewUrl} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <video
          src={item.previewUrl} muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {/* Status overlay */}
      {status !== 'idle' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {overlay[status]}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoryComposer({
  initialItems,
  onCancel,
  onPublishItem,
  onAllPublished,
}: StoryComposerProps) {
  const [queue,       setQueue]       = useState<ComposerItem[]>(initialItems);
  const [statuses,    setStatuses]    = useState<Record<string, ItemStatus>>({});
  const [publishing,  setPublishing]  = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Track blob URLs so we can revoke on unmount
  const blobUrls = useRef<Set<string>>(
    new Set(initialItems.map(i => i.previewUrl)),
  );
  // Persistent input ref — in JSX, never created dynamically
  const addMoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Revoke any un-claimed blobs when the composer unmounts
    return () => {
      blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  // ── Add More ──────────────────────────────────────────────────────────────

  function openAddMore() {
    const el = addMoreRef.current;
    if (!el) return;
    el.value = '';
    el.click();
  }

  function handleAddMoreChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const items: ComposerItem[] = files.map(f => {
      const url = URL.createObjectURL(f);
      blobUrls.current.add(url);
      return {
        id:         makeComposerId(),
        file:       f,
        previewUrl: url,
        mediaType:  f.type.startsWith('video/') ? 'video' : 'image',
      };
    });
    setQueue(prev => [...prev, ...items]);
    e.target.value = '';
  }

  // ── Remove ────────────────────────────────────────────────────────────────

  function removeItem(id: string) {
    if (publishing) return;
    setQueue(prev => {
      const item = prev.find(x => x.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        blobUrls.current.delete(item.previewUrl);
      }
      return prev.filter(x => x.id !== id);
    });
  }

  // ── Reorder ───────────────────────────────────────────────────────────────

  function move(idx: number, dir: -1 | 1) {
    if (publishing) return;
    setQueue(prev => {
      const to = idx + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  async function handlePublishAll() {
    if (!queue.length || publishing) return;
    setPublishing(true);
    setGlobalError(null);

    // Initialise all statuses to idle
    const init: Record<string, ItemStatus> = {};
    queue.forEach(it => { init[it.id] = 'idle'; });
    setStatuses(init);

    let hadError = false;
    for (const item of queue) {
      setStatuses(prev => ({ ...prev, [item.id]: 'uploading' }));
      try {
        await onPublishItem(item);
        setStatuses(prev => ({ ...prev, [item.id]: 'done' }));
      } catch {
        setStatuses(prev => ({ ...prev, [item.id]: 'error' }));
        hadError = true;
      }
    }

    setPublishing(false);

    if (!hadError) {
      // Ownership of blobs transfers to Cloudinary / caller; stop tracking
      blobUrls.current.clear();
      onAllPublished();
    } else {
      setGlobalError('Some uploads failed. You can try again — successful items won\'t be re-sent.');
    }
  }

  // Derived counts for progress display
  const doneCount  = queue.filter(i => statuses[i.id] === 'done').length;
  const errCount   = queue.filter(i => statuses[i.id] === 'error').length;
  const progress   = queue.length > 0
    ? ((doneCount + errCount) / queue.length) * 100
    : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Hidden Add More input (persistent in JSX — no phantom-click risk) ── */}
      <input
        ref={addMoreRef}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleAddMoreChange}
      />

      {/* ── Backdrop ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { if (!publishing) onCancel(); }}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 55,
          background: 'rgba(0,0,0,0.65)',
        }}
      />

      {/* ── Sheet ── */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 60,
          background: 'white',
          borderRadius: '24px 24px 0 0',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '12px 0 4px', flexShrink: 0,
        }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E7EB' }} />
        </div>

        {/* ── Header ── */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 14px',
        }}>
          {/* Cancel */}
          <button
            onClick={() => { if (!publishing) onCancel(); }}
            disabled={publishing}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 15, fontWeight: 600,
              color: publishing ? '#D1D5DB' : '#6B7280',
            }}
          >
            Cancel
          </button>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>
              New Story
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
              {queue.length} {queue.length === 1 ? 'item' : 'items'} selected
            </div>
          </div>

          {/* Spacer to balance Cancel */}
          <div style={{ width: 52 }} />
        </div>

        {/* ── Progress bar (visible while publishing) ── */}
        {publishing && (
          <div style={{
            flexShrink: 0,
            height: 3,
            background: '#F3F4F6',
            margin: '0 20px 12px',
            borderRadius: 99,
            overflow: 'hidden',
          }}>
            <motion.div
              style={{ height: '100%', background: GRAD, borderRadius: 99 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* ── Error banner ── */}
        {globalError && (
          <div style={{
            flexShrink: 0,
            margin: '0 20px 12px',
            padding: '10px 14px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 12,
            fontSize: 13, color: '#DC2626',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{globalError}</span>
          </div>
        )}

        {/* ── Item list (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {queue.length === 0 ? (
            /* Empty state after removing all items */
            <div style={{
              padding: '48px 0',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg,rgba(107,115,255,0.12),rgba(255,107,157,0.12))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={24} color="#6B73FF" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
                  No items selected
                </div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
                  Tap "+ Add More" below to pick photos or videos.
                </div>
              </div>
            </div>
          ) : (
            queue.map((item, idx) => {
              const status = statuses[item.id] ?? 'idle';
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 0',
                    borderBottom: idx < queue.length - 1
                      ? '1px solid #F3F4F6'
                      : 'none',
                  }}
                >
                  {/* Thumbnail */}
                  <Thumb item={item} status={status} />

                  {/* File info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {item.mediaType === 'video' ? 'Video' : 'Photo'}
                      {' · '}
                      {(item.file.size / 1_048_576).toFixed(1)} MB
                    </div>
                    {status === 'error' && (
                      <div style={{
                        fontSize: 12, color: '#EF4444',
                        fontWeight: 600, marginTop: 3,
                      }}>
                        Upload failed — will retry
                      </div>
                    )}
                    {status === 'done' && (
                      <div style={{
                        fontSize: 12, color: '#10B981',
                        fontWeight: 600, marginTop: 3,
                      }}>
                        Published ✓
                      </div>
                    )}
                  </div>

                  {/* Reorder buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={publishing || idx === 0}
                      aria-label="Move up"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: idx === 0 ? '#F9FAFB' : '#F3F4F6',
                        border: 'none',
                        cursor: idx === 0 || publishing ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ChevronUp size={16} color={idx === 0 ? '#D1D5DB' : '#6B7280'} />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={publishing || idx === queue.length - 1}
                      aria-label="Move down"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: idx === queue.length - 1 ? '#F9FAFB' : '#F3F4F6',
                        border: 'none',
                        cursor: idx === queue.length - 1 || publishing ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ChevronDown size={16} color={idx === queue.length - 1 ? '#D1D5DB' : '#6B7280'} />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={publishing}
                    aria-label="Remove"
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: '#FEF2F2',
                      border: 'none',
                      cursor: publishing ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: publishing ? 0.4 : 1,
                    }}
                  >
                    <X size={15} color="#EF4444" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          flexShrink: 0,
          padding: '14px 20px',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
          borderTop: '1px solid #F3F4F6',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {/* + Add More */}
          <button
            onClick={openAddMore}
            disabled={publishing}
            style={{
              width: '100%', padding: '13px 0',
              background: 'none',
              border: '2px dashed rgba(107,115,255,0.4)',
              borderRadius: 14,
              cursor: publishing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: publishing ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <Plus size={18} color="#6B73FF" strokeWidth={2.5} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#6B73FF' }}>
              + Add More Photos or Videos
            </span>
          </button>

          {/* Publish All */}
          <motion.button
            whileTap={{ scale: queue.length && !publishing ? 0.97 : 1 }}
            onClick={handlePublishAll}
            disabled={!queue.length || publishing}
            style={{
              width: '100%', padding: '17px 0',
              borderRadius: 16, border: 'none',
              background: !queue.length || publishing ? '#E5E7EB' : GRAD,
              color: !queue.length || publishing ? '#9CA3AF' : 'white',
              fontSize: 17, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: !queue.length || publishing ? 'default' : 'pointer',
              letterSpacing: '-0.01em',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {publishing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Publishing {doneCount + errCount} of {queue.length}…
              </>
            ) : (
              <>
                <Layers size={18} />
                Publish All ({queue.length}) →
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

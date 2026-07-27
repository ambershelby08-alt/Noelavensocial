/**
 * StoryComposer — curation + editing screen between the OS file picker and publishing.
 *
 * Flow:
 *   1. initialItems arrive from Home's hidden <input>.
 *   2. User can reorder/remove items and tap a thumbnail to open StoryItemEditor.
 *   3. Edits (layers, crop, trim, filter) are stored per-item in editDataMap.
 *   4. "Publish All" calls onPublishItem(item, editData) for each item.
 *   5. All succeed → onAllPublished() → Home opens StoryViewer.
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, ChevronUp, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, Layers, Pencil,
} from 'lucide-react';
import type { StoryMediaType } from '@/lib/stories';
import type { ItemEditData } from '@/components/stories/editor/types';
import type { SparkAudience } from '@/lib/mockData';
import { StoryItemEditor } from './StoryItemEditor';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

const GRAD = 'linear-gradient(135deg,#FF6B9D,#C44FDB,#6B73FF)';

const DEFAULT_EDIT_DATA: ItemEditData = {
  layers: [], cropData: null, trimData: null, filterName: 'normal',
};

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
  /** Upload + write ONE story. editData carries layers/crop/trim/filter. Throw to signal failure. */
  onPublishItem:  (item: ComposerItem, editData: ItemEditData, audience: SparkAudience) => Promise<void>;
  /** Called after every item succeeds. */
  onAllPublished: () => void;
}

// ─── Audience options ─────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: { value: SparkAudience; label: string; icon: string }[] = [
  { value: 'public',  label: 'Everyone', icon: '🌍' },
  { value: 'mutuals', label: 'Mutuals',  icon: '🤝' },
  { value: 'private', label: 'Followers', icon: '👥' },
  { value: 'onlyMe',  label: 'Only Me',  icon: '🔒' },
];

// ─── ID helper (exported for Home.tsx) ───────────────────────────────────────

let _seq = 0;
export function makeComposerId(): string {
  return `sc-${Date.now()}-${++_seq}`;
}

// ─── Thumbnail sub-component ─────────────────────────────────────────────────

function Thumb({
  item,
  status,
  edited,
  onEdit,
}: {
  item:    ComposerItem;
  status:  ItemStatus;
  edited:  boolean;
  onEdit:  () => void;
}) {
  const overlay: Record<ItemStatus, React.ReactNode> = {
    idle:      null,
    uploading: <Loader2 size={22} color="white" className="animate-spin" />,
    done:      <CheckCircle2 size={22} color="#4ADE80" />,
    error:     <AlertCircle size={22} color="#F87171" />,
  };

  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <div
        style={{
          width: 72, height: 72,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#E5E7EB',
          border: edited ? '2.5px solid #FF6B9D' : '2.5px solid transparent',
          boxSizing: 'border-box',
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
        {status !== 'idle' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 10,
          }}>
            {overlay[status]}
          </div>
        )}
      </div>

      {/* Edit button — pencil in corner */}
      {status === 'idle' && (
        <button
          onClick={onEdit}
          style={{
            position: 'absolute', top: -6, right: -6,
            width: 24, height: 24, borderRadius: 12,
            background: edited ? 'linear-gradient(135deg,#FF6B9D,#C44FDB)' : '#6B73FF',
            border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Pencil size={11} color="white" />
        </button>
      )}

      {/* Edited badge */}
      {edited && status === 'idle' && (
        <div style={{
          position: 'absolute', bottom: -8, left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg,#FF6B9D,#C44FDB)',
          borderRadius: 6, padding: '1px 6px',
          fontSize: 9, fontWeight: 700, color: 'white', whiteSpace: 'nowrap',
        }}>
          EDITED
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
  const [audience,    setAudience]    = useState<SparkAudience>('public');

  // Per-item edit data keyed by item.id
  const [editDataMap, setEditDataMap] = useState<Record<string, ItemEditData>>({});
  // Which item is currently open in the editor (null = no editor open)
  const [editingItem, setEditingItem] = useState<ComposerItem | null>(null);

  // Track blob URLs so we can revoke on unmount
  const blobUrls = useRef<Set<string>>(
    new Set(initialItems.map(i => i.previewUrl)),
  );
  // Persistent input ref — in JSX, never created dynamically
  const addMoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
    setEditDataMap(prev => { const next = { ...prev }; delete next[id]; return next; });
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

  // ── Editor callbacks ──────────────────────────────────────────────────────

  function openEditor(item: ComposerItem) {
    if (publishing) return;
    setEditingItem(item);
  }

  function handleEditorDone(data: ItemEditData) {
    if (!editingItem) return;
    setEditDataMap(prev => ({ ...prev, [editingItem.id]: data }));
    setEditingItem(null);
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  async function handlePublishAll() {
    if (!queue.length || publishing) return;
    setPublishing(true);
    setGlobalError(null);

    const init: Record<string, ItemStatus> = {};
    queue.forEach(it => { init[it.id] = 'idle'; });
    setStatuses(init);

    let hadError = false;
    for (const item of queue) {
      // Skip already-succeeded items on retry
      if (statuses[item.id] === 'done') continue;
      setStatuses(prev => ({ ...prev, [item.id]: 'uploading' }));
      try {
        const editData = editDataMap[item.id] ?? DEFAULT_EDIT_DATA;
        await onPublishItem(item, editData, audience);
        setStatuses(prev => ({ ...prev, [item.id]: 'done' }));
      } catch {
        setStatuses(prev => ({ ...prev, [item.id]: 'error' }));
        hadError = true;
      }
    }

    setPublishing(false);

    if (!hadError) {
      blobUrls.current.clear();
      onAllPublished();
    } else {
      setGlobalError('Some uploads failed. Tap "Publish All" to retry — successful items won\'t be re-sent.');
    }
  }

  // Derived counts
  const doneCount = queue.filter(i => statuses[i.id] === 'done').length;
  const errCount  = queue.filter(i => statuses[i.id] === 'error').length;
  const progress  = queue.length > 0
    ? ((doneCount + errCount) / queue.length) * 100
    : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Hidden Add More input ── */}
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
        onClick={() => { if (!publishing && !editingItem) onCancel(); }}
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E7EB' }} />
        </div>

        {/* ── Header ── */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 14px',
        }}>
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
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>New Story</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
              {queue.length} {queue.length === 1 ? 'item' : 'items'}
              {Object.keys(editDataMap).length > 0 && (
                <span style={{ color: '#FF6B9D', marginLeft: 4 }}>
                  · {Object.keys(editDataMap).length} edited
                </span>
              )}
            </div>
          </div>
          <div style={{ width: 52 }} />
        </div>

        {/* ── Progress bar ── */}
        {publishing && (
          <div style={{ flexShrink: 0, height: 3, background: '#F3F4F6', margin: '0 20px 12px', borderRadius: 99, overflow: 'hidden' }}>
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
            flexShrink: 0, margin: '0 20px 12px', padding: '10px 14px',
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
            fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{globalError}</span>
          </div>
        )}

        {/* ── Item list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {queue.length === 0 ? (
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
                <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>No items selected</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
                  Tap "+ Add More" below to pick photos or videos.
                </div>
              </div>
            </div>
          ) : (
            queue.map((item, idx) => {
              const status  = statuses[item.id] ?? 'idle';
              const edited  = Boolean(editDataMap[item.id]);
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 0',
                    borderBottom: idx < queue.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  {/* Thumbnail with edit button */}
                  <Thumb
                    item={item}
                    status={status}
                    edited={edited}
                    onEdit={() => openEditor(item)}
                  />

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
                      {' · '}{(item.file.size / 1_048_576).toFixed(1)} MB
                    </div>
                    {edited && status === 'idle' && (
                      <button
                        onClick={() => openEditor(item)}
                        style={{
                          marginTop: 4, background: 'none', border: 'none', padding: 0,
                          fontSize: 12, color: '#FF6B9D', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✏️ Tap to edit
                      </button>
                    )}
                    {!edited && status === 'idle' && (
                      <button
                        onClick={() => openEditor(item)}
                        style={{
                          marginTop: 4, background: 'none', border: 'none', padding: 0,
                          fontSize: 12, color: '#6B73FF', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        + Add text, filters…
                      </button>
                    )}
                    {status === 'error' && (
                      <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, marginTop: 3 }}>
                        Upload failed — will retry
                      </div>
                    )}
                    {status === 'done' && (
                      <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, marginTop: 3 }}>
                        Published ✓
                      </div>
                    )}
                  </div>

                  {/* Reorder */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={publishing || idx === 0}
                      style={reorderBtnStyle(idx === 0 || publishing)}
                    >
                      <ChevronUp size={16} color={idx === 0 ? '#D1D5DB' : '#6B7280'} />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={publishing || idx === queue.length - 1}
                      style={reorderBtnStyle(idx === queue.length - 1 || publishing)}
                    >
                      <ChevronDown size={16} color={idx === queue.length - 1 ? '#D1D5DB' : '#6B7280'} />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={publishing}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: '#FEF2F2', border: 'none',
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
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <button
            onClick={openAddMore}
            disabled={publishing}
            style={{
              width: '100%', padding: '13px 0',
              background: 'none',
              border: '2px dashed rgba(107,115,255,0.4)',
              borderRadius: 14, cursor: publishing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: publishing ? 0.5 : 1,
            }}
          >
            <Plus size={18} color="#6B73FF" strokeWidth={2.5} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#6B73FF' }}>
              + Add More Photos or Videos
            </span>
          </button>

          {/* ── Audience picker ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Who can see this?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {AUDIENCE_OPTIONS.map(opt => {
                const active = audience === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => !publishing && setAudience(opt.value)}
                    disabled={publishing}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: active ? 'none' : '1.5px solid #E5E7EB',
                      background: active ? 'linear-gradient(135deg,#6B73FF,#C44FDB)' : 'transparent',
                      cursor: publishing ? 'default' : 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 3,
                      opacity: publishing ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{opt.icon}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: active ? 'white' : '#6B7280',
                      letterSpacing: '-0.01em',
                    }}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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
            }}
          >
            {publishing ? (
              <><Loader2 size={18} className="animate-spin" />Publishing {doneCount + errCount} of {queue.length}…</>
            ) : (
              <><Layers size={18} />Publish All ({queue.length}) →</>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Per-item editor (z-70, full-screen) ── */}
      <AnimatePresence>
        {editingItem && (
          <StoryItemEditor
            key={editingItem.id}
            item={editingItem}
            initial={editDataMap[editingItem.id]}
            onDone={handleEditorDone}
            onCancel={() => setEditingItem(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function reorderBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8,
    background: disabled ? '#F9FAFB' : '#F3F4F6',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

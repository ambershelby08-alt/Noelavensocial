/**
 * StoryEditor — full-screen story editor.
 *
 * Architecture
 * ────────────
 *   Top bar      → close | undo | crop/trim toggles | preview/publish
 *   EditorCanvas → media + gesture layers + crop overlay
 *   Panel area   → slides up when a tool tab is active
 *   BottomToolbar→ extensible tab bar (text, emoji; music/filters/draw = "soon")
 *
 * Adding a future tool
 * ─────────────────────
 *   1. Add a ToolbarTabDef to TOOLBAR_TABS below.
 *   2. Implement a panel component.
 *   3. Add a case to renderPanel().
 *   No changes needed in BottomToolbar or EditorCanvas.
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Undo2, Crop, Scissors, Type, Smile,
  Music, SlidersHorizontal, Pencil, Eye, Loader2,
} from 'lucide-react';

import { EditorCanvas }    from './EditorCanvas';
import { BottomToolbar }   from './BottomToolbar';
import { TextPanel }       from './TextPanel';
import { EmojiPanel }      from './EmojiPanel';
import { VideoTrimmer }    from './VideoTrimmer';
import { useEditorState }  from './useEditorState';
import { isCloudinaryConfigured } from '@/lib/cloudinary';
import type { ToolbarTabDef, EditorLayer, StoryMediaType, CropData, TrimData } from './types';

// ─── Extensible toolbar tab registry ─────────────────────────────────────────
// Push a new ToolbarTabDef here + implement a panel below to add future tools.

const TOOLBAR_TABS: ToolbarTabDef[] = [
  { id: 'text',    label: 'Text',    Icon: Type,               available: true  },
  { id: 'emoji',   label: 'Emoji',   Icon: Smile,              available: true  },
  { id: 'music',   label: 'Music',   Icon: Music,              available: false },
  { id: 'filters', label: 'Filters', Icon: SlidersHorizontal,  available: false },
  { id: 'draw',    label: 'Draw',    Icon: Pencil,             available: false },
];

// ─── Upload helpers ───────────────────────────────────────────────────────────

async function uploadToCloudinary(
  file: File,
): Promise<{ url: string; mediaType: StoryMediaType }> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
  const preset    = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
  const isVideo   = file.type.startsWith('video/');
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  form.append('folder', 'noelaven/stories');
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`,
    { method: 'POST', body: form },
  );
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(e.error?.message ?? `Upload failed (${res.status})`);
  }
  const data = (await res.json()) as { secure_url: string };
  return { url: data.secure_url, mediaType: isVideo ? 'video' : 'image' };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StoryEditorPublishPayload {
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption: string;
  layers: EditorLayer[];
  cropData: CropData | null;
  trimData: TrimData | null;
}

interface StoryEditorProps {
  file: File;
  previewUrl: string;
  mediaType: StoryMediaType;
  onClose: () => void;
  onPublish: (payload: StoryEditorPublishPayload) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StoryEditor({
  file, previewUrl, mediaType, onClose, onPublish,
}: StoryEditorProps) {
  const { state, dispatch, addTextLayer, addStickerLayer, updateLayer, deleteLayer, selectLayer } =
    useEditorState();

  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);

  const [previewing, setPreviewing] = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const isVideo = mediaType === 'video';

  // ── Panel toggle ────────────────────────────────────────────────────────────
  function togglePanel(id: string) {
    const next = state.activePanel === id ? null : (id as import('./types').ActivePanel);
    dispatch({ type: 'SET_PANEL', panel: next });
  }

  // ── Render the active tool panel ────────────────────────────────────────────
  function renderPanel() {
    switch (state.activePanel) {
      case 'text':
        return (
          <TextPanel
            state={state}
            dispatch={dispatch}
            onAdd={() => {
              if (!state.draftText.trim()) return;
              addTextLayer(state.draftText, 50, 45, {
                color: state.draftColor,
                fontWeight: state.draftFontWeight,
                layerStyle: state.draftLayerStyle,
              });
            }}
          />
        );
      case 'emoji':
        return (
          <EmojiPanel
            onPick={(emoji) => addStickerLayer(emoji, 50, 50)}
          />
        );
      // Future: 'music', 'filters', 'draw' cases go here
      default:
        return null;
    }
  }

  // ── Trim panel (replaces toolbar when trimMode active) ─────────────────────
  function renderTrimPanel() {
    if (!state.trimMode || !isVideo) return null;
    return (
      <VideoTrimmer
        duration={state.videoDuration}
        trim={state.trim ?? { start: 0, end: state.videoDuration }}
        videoRef={videoRef}
        onChange={(t) => dispatch({ type: 'SET_TRIM', trim: t })}
        onDone={() => dispatch({ type: 'SET_TRIM_MODE', active: false })}
      />
    );
  }

  // ── Publish ─────────────────────────────────────────────────────────────────
  async function handlePublish() {
    setUploading(true);
    setError(null);
    try {
      let url    = previewUrl;
      let mtype: StoryMediaType = mediaType;

      if (isCloudinaryConfigured) {
        const result = await uploadToCloudinary(file);
        url   = result.url;
        mtype = result.mediaType;
      }
      // caption = first text layer content, or empty
      const captionLayer = state.layers.find((l) => l.kind === 'text') as import('./types').TextLayer | undefined;
      await onPublish({
        mediaUrl:  url,
        mediaType: mtype,
        caption:   captionLayer?.content ?? '',
        layers:    state.layers,
        cropData:  state.crop,
        trimData:  state.trim,
      });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Something went wrong.');
    } finally {
      setUploading(false);
    }
  }

  // ── Preview overlay ─────────────────────────────────────────────────────────
  if (previewing) {
    return (
      <div className="fixed inset-0 z-[90] bg-black flex flex-col">
        {/* Preview media + frozen layers */}
        <div className="flex-1 relative overflow-hidden">
          {mediaType === 'image' ? (
            <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
          ) : (
            <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
          )}
          {/* Frozen layers */}
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            {state.layers.map((layer) => {
              const style: React.CSSProperties = {
                position: 'absolute',
                left: `${layer.x}%`,
                top: `${layer.y}%`,
                transform: `translate(-50%,-50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                transformOrigin: 'center center',
                userSelect: 'none',
              };
              if (layer.kind === 'sticker') {
                return <div key={layer.id} style={style}><span style={{ fontSize: 48, display: 'block', lineHeight: 1 }}>{layer.content}</span></div>;
              }
              const tl = layer as import('./types').TextLayer;
              return (
                <div key={layer.id} style={style}>
                  <div style={{
                    fontSize: 24, fontWeight: tl.fontWeight, color: tl.color,
                    whiteSpace: 'pre-wrap', lineHeight: 1.25, padding: '4px 8px',
                    borderRadius: 6, textAlign: 'center', wordBreak: 'break-word',
                    ...(tl.layerStyle === 'bubble-dark' ? { background: 'rgba(0,0,0,0.65)' } : {}),
                    ...(tl.layerStyle === 'bubble-light' ? { background: 'rgba(255,255,255,0.82)' } : {}),
                    ...(tl.layerStyle === 'plain' ? { textShadow: '0 1px 6px rgba(0,0,0,0.6)' } : {}),
                  }}>
                    {tl.content}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Preview label */}
          <div className="absolute top-12 left-0 right-0 flex justify-center pointer-events-none">
            <span className="bg-black/40 text-white text-xs font-semibold px-4 py-1.5 rounded-full backdrop-blur-sm">
              Preview
            </span>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', background: 'rgba(0,0,0,0.8)' }}
        >
          <button
            onClick={() => setPreviewing(false)}
            className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            ← Edit
          </button>
          {error && <p className="text-xs text-red-400 text-center px-2">{error}</p>}
          <button
            onClick={handlePublish}
            disabled={uploading}
            className="flex-[2] py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB, #6B73FF)' }}
          >
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Publishing…</> : 'Share Story ✨'}
          </button>
        </div>
      </div>
    );
  }

  // ── Main editor ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col" style={{ touchAction: 'none' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-4 pt-12 pb-3 flex-shrink-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
      >
        {/* Left: close + undo */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={18} className="text-white" />
          </button>
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={state.layers.length === 0}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
          >
            <Undo2 size={16} className="text-white" />
          </button>
        </div>

        {/* Right: crop/trim + preview */}
        <div className="flex items-center gap-2">
          {!isVideo && (
            <button
              onClick={() => dispatch({ type: 'SET_CROP_MODE', active: !state.cropMode })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold backdrop-blur-sm active:scale-95 transition-all"
              style={{ background: state.cropMode ? 'rgba(255,107,157,0.7)' : 'rgba(0,0,0,0.4)' }}
            >
              <Crop size={14} /> Crop
            </button>
          )}
          {isVideo && (
            <button
              onClick={() => dispatch({ type: 'SET_TRIM_MODE', active: !state.trimMode })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold backdrop-blur-sm active:scale-95 transition-all"
              style={{ background: state.trimMode ? 'rgba(107,115,255,0.7)' : 'rgba(0,0,0,0.4)' }}
            >
              <Scissors size={14} /> Trim
            </button>
          )}
          <button
            onClick={() => setPreviewing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold backdrop-blur-sm active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #FF6B9D80, #6B73FF80)' }}
          >
            <Eye size={14} /> Preview
          </button>
        </div>
      </div>

      {/* ── Canvas — fills remaining space ── */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-2">
        <EditorCanvas
          previewUrl={previewUrl}
          mediaType={mediaType}
          state={state}
          dispatch={dispatch}
          onUpdate={updateLayer}
          onDelete={deleteLayer}
          onSelect={selectLayer}
          canvasRef={canvasRef}
          videoRef={videoRef}
        />
      </div>

      {/* ── Bottom panel + toolbar ── */}
      <div
        className="flex-shrink-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 100%)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        }}
      >
        {/* Active tool panel (slides in) */}
        <AnimatePresence>
          {(state.activePanel !== null || state.trimMode) && (
            <motion.div
              key={state.trimMode ? 'trim' : state.activePanel}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.18 }}
            >
              {state.trimMode ? renderTrimPanel() : renderPanel()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar tabs (hidden in trim mode) */}
        {!state.trimMode && (
          <BottomToolbar
            tabs={TOOLBAR_TABS}
            activePanel={state.activePanel}
            onTabPress={togglePanel}
          />
        )}
      </div>
    </div>
  );
}

/**
 * StoryItemEditor — full-screen per-story editor.
 *
 * Modes (selected via bottom toolbar):
 *   canvas  — default: drag/select layers, see current edits applied
 *   crop    — pan + pinch-zoom the image (desktop: mouse-drag + wheel)
 *   trim    — video start/end sliders
 *   text    — type text, pick font/color/style, tap Add to create a TextLayer
 *   sticker — emoji grid; tap to place a StickerLayer at center
 *   filter  — horizontal filter picker
 *   preview — read-only full-screen preview
 */

import React, {
  useState, useRef, useEffect, useCallback,
  type PointerEvent as RPointerEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, Crop, Scissors, Type, Smile,
  Sparkles, Eye, Trash2, Bold, AlignLeft, AlignCenter,
  AlignRight, Plus, Minus,
} from 'lucide-react';
import { FILTER_DEFS, filterCSS } from '@/components/stories/editor/filters';
import type {
  EditorLayer, TextLayer, StickerLayer,
  CropData, TrimData, ItemEditData, FilterPreset,
} from '@/components/stories/editor/types';
import type { ComposerItem } from './StoryComposer';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAD = 'linear-gradient(135deg,#FF6B9D,#C44FDB,#6B73FF)';

const TEXT_COLORS = [
  '#FFFFFF','#000000','#F5C542','#C44FDB','#F5C542',
  '#FF9800','#4CAF50','#00BCD4','#F44336','#FFEB3B',
];

const FONT_OPTIONS = [
  { id: 'sans',    label: 'Clean',   css: 'system-ui, sans-serif' },
  { id: 'impact',  label: 'Bold',    css: 'Impact, Arial Black, sans-serif' },
  { id: 'serif',   label: 'Classic', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono',    label: 'Mono',    css: '"Courier New", Courier, monospace' },
  { id: 'cursive', label: 'Casual',  css: '"Comic Sans MS", "Comic Sans", cursive' },
];

const EMOJI_GRID = [
  '😀','😂','😍','🥰','😎','🤩','😅','😭','🥲','😤',
  '🔥','❤️','💯','✨','🌟','⭐','🎉','🙌','💫','🫶',
  '🌈','🌸','🌺','🌊','🌙','🦋','🍀','🌻','⛅','🌿',
  '🍕','🍦','🍰','🎂','🥂','☕','🍓','🍉','🍫','🥑',
  '🐶','🐱','🐼','🦊','🐨','🐸','🦄','🐝','🦋','🐙',
];

type EditorMode = 'canvas' | 'crop' | 'trim' | 'text' | 'sticker' | 'filter' | 'preview';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _layerSeq = 0;
function newLayerId() { return `lay-${Date.now()}-${++_layerSeq}`; }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StoryItemEditorProps {
  item:     ComposerItem;
  initial?: ItemEditData;
  onDone:   (data: ItemEditData) => void;
  onCancel: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoryItemEditor({ item, initial, onDone, onCancel }: StoryItemEditorProps) {
  const [mode, setMode] = useState<EditorMode>('canvas');

  // ── Edit state ────────────────────────────────────────────────────────────
  const [layers,    setLayers]    = useState<EditorLayer[]>(initial?.layers     ?? []);
  const [crop,      setCrop]      = useState<CropData>(initial?.cropData        ?? { x: 0, y: 0, scale: 1 });
  const [trim,      setTrim]      = useState<TrimData>(initial?.trimData        ?? { start: 0, end: 0 });
  const [filter,    setFilter]    = useState<FilterPreset>(initial?.filterName  ?? 'normal');
  const [selectedId, setSelId]    = useState<string | null>(null);
  const [videoDur,   setVideoDur] = useState(0);

  // ── Text draft ────────────────────────────────────────────────────────────
  const [draftText,   setDraftText]   = useState('');
  const [draftColor,  setDraftColor]  = useState('#FFFFFF');
  const [draftFont,   setDraftFont]   = useState(FONT_OPTIONS[0].css);
  const [draftSize,   setDraftSize]   = useState(24);
  const [draftAlign,  setDraftAlign]  = useState<'left' | 'center' | 'right'>('center');
  const [draftStyle,  setDraftStyle]  = useState<TextLayer['layerStyle']>('plain');
  const [draftWeight, setDraftWeight] = useState<'normal' | 'bold'>('bold');

  // ── Crop gesture refs ─────────────────────────────────────────────────────
  const canvasRef   = useRef<HTMLDivElement>(null);
  const cropPtrs    = useRef<Map<number, { x: number; y: number }>>(new Map());
  const cropStart   = useRef<{ tx: number; ty: number; scale: number; dist: number; mx: number; my: number } | null>(null);

  // ── Layer drag refs ───────────────────────────────────────────────────────
  const layerDragRef = useRef<{ id: string; startX: number; startY: number; layerX: number; layerY: number } | null>(null);

  // ── Video ref ─────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);

  // Deselect layer when switching modes
  useEffect(() => { setSelId(null); }, [mode]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const cssFilt    = filterCSS(filter);
  const cropTransform = `translate(${crop.x * 100}%, ${crop.y * 100}%) scale(${crop.scale})`;
  const mediaSrc = item.mediaType === 'video' && trim.end > 0
    ? `${item.previewUrl}#t=${trim.start},${trim.end}`
    : item.previewUrl;

  // ── Crop gesture handlers ─────────────────────────────────────────────────

  function onCropPtrDown(e: RPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    cropPtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...cropPtrs.current.values()];
    if (pts.length === 2) {
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      cropStart.current = { tx: crop.x, ty: crop.y, scale: crop.scale, dist, mx: e.clientX, my: e.clientY };
    } else {
      cropStart.current = { tx: crop.x, ty: crop.y, scale: crop.scale, dist: 0, mx: e.clientX, my: e.clientY };
    }
  }

  function onCropPtrMove(e: RPointerEvent<HTMLDivElement>) {
    if (!cropPtrs.current.has(e.pointerId)) return;
    cropPtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!cropStart.current || !canvasRef.current) return;
    const init = cropStart.current;
    const pts  = [...cropPtrs.current.values()];

    if (pts.length >= 2) {
      // Pinch
      const dist     = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const newScale = clamp(init.scale * dist / (init.dist || 1), 1, 5);
      const maxT     = (newScale - 1) / (2 * newScale);
      setCrop(prev => ({ ...prev, scale: newScale, x: clamp(prev.x, -maxT, maxT), y: clamp(prev.y, -maxT, maxT) }));
    } else {
      // Pan
      const cw = canvasRef.current.clientWidth;
      const ch = canvasRef.current.clientHeight;
      const dx = (e.clientX - init.mx) / cw;
      const dy = (e.clientY - init.my) / ch;
      const maxT = (init.scale - 1) / (2 * init.scale);
      setCrop(prev => ({
        ...prev,
        x: clamp(init.tx + dx, -maxT, maxT),
        y: clamp(init.ty + dy, -maxT, maxT),
      }));
    }
  }

  function onCropPtrUp(e: RPointerEvent<HTMLDivElement>) {
    cropPtrs.current.delete(e.pointerId);
    cropStart.current = null;
  }

  function onCropWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = -e.deltaY / 500;
    setCrop(prev => {
      const newScale = clamp(prev.scale + delta, 1, 5);
      const maxT = (newScale - 1) / (2 * newScale);
      return { x: clamp(prev.x, -maxT, maxT), y: clamp(prev.y, -maxT, maxT), scale: newScale };
    });
  }

  // ── Layer drag ────────────────────────────────────────────────────────────

  const onLayerPtrDown = useCallback((e: RPointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelId(id);
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    layerDragRef.current = { id, startX: e.clientX, startY: e.clientY, layerX: layer.x, layerY: layer.y };
  }, [layers]);

  const onLayerPtrMove = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    if (!layerDragRef.current || !canvasRef.current) return;
    const { id, startX, startY, layerX, layerY } = layerDragRef.current;
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    const dx = ((e.clientX - startX) / cw) * 100;
    const dy = ((e.clientY - startY) / ch) * 100;
    setLayers(prev => prev.map(l => l.id === id
      ? { ...l, x: clamp(layerX + dx, 5, 95), y: clamp(layerY + dy, 5, 95) }
      : l));
  }, []);

  const onLayerPtrUp = useCallback(() => { layerDragRef.current = null; }, []);

  // ── Text add ──────────────────────────────────────────────────────────────

  function addTextLayer() {
    if (!draftText.trim()) return;
    const layer: TextLayer = {
      id:         newLayerId(),
      kind:       'text',
      content:    draftText.trim(),
      x: 50, y: 50,
      scale:      1,
      rotation:   0,
      color:      draftColor,
      fontWeight: draftWeight,
      layerStyle: draftStyle,
      fontFamily: draftFont,
      fontSize:   draftSize,
      textAlign:  draftAlign,
    };
    setLayers(prev => [...prev, layer]);
    setDraftText('');
    setSelId(layer.id);
    setMode('canvas');
  }

  // ── Sticker add ───────────────────────────────────────────────────────────

  function addSticker(emoji: string) {
    const layer: StickerLayer = {
      id: newLayerId(), kind: 'sticker', content: emoji,
      x: 50, y: 50, scale: 1.5, rotation: 0,
    };
    setLayers(prev => [...prev, layer]);
    setSelId(layer.id);
    setMode('canvas');
  }

  // ── Layer controls ────────────────────────────────────────────────────────

  function scaleLayer(id: string, delta: number) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, scale: clamp(l.scale + delta, 0.3, 5) } : l));
  }
  function rotateLayer(id: string, delta: number) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, rotation: l.rotation + delta } : l));
  }
  function deleteLayer(id: string) {
    setLayers(prev => prev.filter(l => l.id !== id));
    setSelId(null);
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  function handleDone() {
    onDone({
      layers,
      cropData:   crop.scale === 1 && crop.x === 0 && crop.y === 0 ? null : crop,
      trimData:   trim.end > 0 ? trim : null,
      filterName: filter,
    });
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  const selectedLayer = layers.find(l => l.id === selectedId) ?? null;

  function renderMedia(forPreview = false) {
    const style: React.CSSProperties = {
      position: 'absolute', inset: 0,
      width: '100%', height: '100%',
      objectFit: 'cover',
      filter: cssFilt,
      transform: cropTransform,
      transformOrigin: 'center center',
      userSelect: 'none',
      pointerEvents: 'none',
    };
    if (item.mediaType === 'image') {
      return <img src={item.previewUrl} style={style} alt="" draggable={false} />;
    }
    return (
      <video
        key={forPreview ? 'prev' : 'edit'}
        ref={forPreview ? undefined : videoRef}
        src={mediaSrc}
        style={style}
        autoPlay muted playsInline loop={forPreview}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (v && isFinite(v.duration) && v.duration > 0) {
            setVideoDur(v.duration);
            if (trim.end === 0) setTrim({ start: 0, end: v.duration });
          }
        }}
      />
    );
  }

  function renderLayers(interactive = true) {
    return layers.map(layer => {
      const isSelected = layer.id === selectedId;
      const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${layer.x}%`, top: `${layer.y}%`,
        transform: `translate(-50%,-50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
        transformOrigin: 'center center',
        cursor: interactive ? 'grab' : 'default',
        touchAction: 'none',
        zIndex: isSelected ? 12 : 8,
      };
      const ringStyle: React.CSSProperties = isSelected
        ? { outline: '2px dashed rgba(255,255,255,0.8)', outlineOffset: 4, borderRadius: 4 }
        : {};

      if (layer.kind === 'sticker') {
        return (
          <div
            key={layer.id} style={{ ...baseStyle, ...ringStyle }}
            onPointerDown={interactive ? e => onLayerPtrDown(e, layer.id) : undefined}
            onPointerMove={interactive ? onLayerPtrMove : undefined}
            onPointerUp={interactive ? onLayerPtrUp : undefined}
          >
            <span style={{ fontSize: 48, display: 'block', lineHeight: 1, userSelect: 'none' }}>
              {layer.content}
            </span>
          </div>
        );
      }

      const tl = layer as TextLayer;
      return (
        <div
          key={layer.id} style={{ ...baseStyle, ...ringStyle }}
          onPointerDown={interactive ? e => onLayerPtrDown(e, layer.id) : undefined}
          onPointerMove={interactive ? onLayerPtrMove : undefined}
          onPointerUp={interactive ? onLayerPtrUp : undefined}
        >
          <div style={{
            fontSize:   tl.fontSize ?? 24,
            fontWeight: tl.fontWeight,
            fontFamily: tl.fontFamily ?? 'system-ui, sans-serif',
            color:      tl.color,
            textAlign:  tl.textAlign ?? 'center',
            whiteSpace: 'pre-wrap',
            padding:    '4px 8px',
            borderRadius: 6,
            wordBreak:  'break-word',
            maxWidth:   240,
            userSelect: 'none',
            lineHeight:  1.25,
            ...(tl.layerStyle === 'bubble-dark'  ? { background: 'rgba(0,0,0,0.65)' }                              : {}),
            ...(tl.layerStyle === 'bubble-light' ? { background: 'rgba(255,255,255,0.82)', color: tl.color === '#FFFFFF' ? '#000' : tl.color } : {}),
            ...(tl.layerStyle === 'outlined'     ? { WebkitTextStroke: `2px ${tl.color === '#FFFFFF' ? '#000' : '#fff'}`, paintOrder: 'stroke fill' } : {}),
            ...(tl.layerStyle === 'plain'        ? { textShadow: '0 1px 8px rgba(0,0,0,0.7)' }                      : {}),
          }}>
            {tl.content}
          </div>
        </div>
      );
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const toolbarTabs: { id: EditorMode; label: string; icon: React.ReactNode; hidden?: boolean }[] = [
    { id: 'crop',    label: item.mediaType === 'video' ? 'Trim' : 'Crop', icon: item.mediaType === 'video' ? <Scissors size={18}/> : <Crop size={18}/> },
    { id: 'text',    label: 'Text',    icon: <Type size={18}/> },
    { id: 'sticker', label: 'Sticker', icon: <Smile size={18}/> },
    { id: 'filter',  label: 'Filter',  icon: <Sparkles size={18}/> },
    { id: 'preview', label: 'Preview', icon: <Eye size={18}/> },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(env(safe-area-inset-top),16px) 16px 12px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
      }}>
        <button
          onClick={mode === 'canvas' ? onCancel : () => setMode('canvas')}
          style={btnStyle('rgba(0,0,0,0.35)')}
        >
          <ArrowLeft size={20} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
          {mode === 'preview' ? 'Preview' : mode === 'crop' && item.mediaType === 'video' ? 'Trim' : mode === 'crop' ? 'Crop' : mode === 'text' ? 'Add Text' : mode === 'sticker' ? 'Sticker' : mode === 'filter' ? 'Filter' : 'Edit Story'}
        </span>
        <button onClick={handleDone} style={btnStyle(GRAD)}>
          <Check size={20} color="#fff" />
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
        onClick={() => { if (mode === 'canvas') setSelId(null); }}
        // Crop pointer events (only active in crop mode for images)
        onPointerDown={mode === 'crop' && item.mediaType === 'image' ? onCropPtrDown : undefined}
        onPointerMove={mode === 'crop' && item.mediaType === 'image' ? onCropPtrMove : undefined}
        onPointerUp={mode === 'crop'   && item.mediaType === 'image' ? onCropPtrUp   : undefined}
        onWheel={mode === 'crop'       && item.mediaType === 'image' ? onCropWheel   : undefined}
      >
        {/* Media */}
        {renderMedia()}

        {/* Layers (hidden in preview and crop modes — crop shows raw) */}
        {mode !== 'preview' && renderLayers(mode === 'canvas')}

        {/* Preview overlay */}
        {mode === 'preview' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 15 }}>
            {renderMedia(true)}
            {renderLayers(false)}
          </div>
        )}
      </div>

      {/* ── Selected layer controls ── */}
      <AnimatePresence>
        {mode === 'canvas' && selectedLayer && (
          <motion.div
            key="layer-ctrl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute', bottom: 120, left: 0, right: 0, zIndex: 25,
              display: 'flex', justifyContent: 'center', gap: 8, padding: '0 20px',
            }}
          >
            {[
              { icon: <Minus size={14}/>, action: () => scaleLayer(selectedId!, -0.15), label: 'Smaller' },
              { icon: <Plus  size={14}/>, action: () => scaleLayer(selectedId!,  0.15), label: 'Larger'  },
              { icon: <span style={{fontSize:12,fontWeight:700,color:'#fff'}}>↺</span>, action: () => rotateLayer(selectedId!, -15), label: 'Rot L' },
              { icon: <span style={{fontSize:12,fontWeight:700,color:'#fff'}}>↻</span>, action: () => rotateLayer(selectedId!,  15), label: 'Rot R' },
              { icon: <Trash2 size={14}/>, action: () => deleteLayer(selectedId!), label: 'Delete', danger: true },
            ].map(({ icon, action, label, danger }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  background: danger ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.55)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', cursor: 'pointer',
                }}
              >
                {icon}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Crop hint ── */}
      {mode === 'crop' && item.mediaType === 'image' && (
        <div style={{
          position: 'absolute', bottom: 100, left: 0, right: 0, zIndex: 20,
          textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, pointerEvents: 'none',
        }}>
          Drag to pan · Pinch or scroll to zoom
          <br />
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
            Zoom: {crop.scale.toFixed(2)}×
          </span>
        </div>
      )}

      {/* ── Trim UI ── */}
      <AnimatePresence>
        {mode === 'crop' && item.mediaType === 'video' && videoDur > 0 && (
          <motion.div
            key="trim"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{
              position: 'absolute', bottom: 90, left: 0, right: 0, zIndex: 25,
              padding: '16px 24px',
              background: 'rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 10, textAlign: 'center' }}>
              Trim Video &nbsp;
              <span style={{ color: '#aaa', fontWeight: 400 }}>
                {formatTime(trim.start)} – {formatTime(trim.end > 0 ? trim.end : videoDur)} (of {formatTime(videoDur)})
              </span>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, display: 'block', marginBottom: 4 }}>
                Start: {formatTime(trim.start)}
              </label>
              <input
                type="range" min={0} max={videoDur} step={0.1}
                value={trim.start}
                onChange={e => {
                  const s = parseFloat(e.target.value);
                  setTrim(prev => ({ start: Math.min(s, prev.end - 0.5 > 0 ? prev.end - 0.5 : 0), end: prev.end }));
                }}
                style={{ width: '100%', accentColor: '#F5C542' }}
              />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, display: 'block', marginBottom: 4 }}>
                End: {formatTime(trim.end > 0 ? trim.end : videoDur)}
              </label>
              <input
                type="range" min={0} max={videoDur} step={0.1}
                value={trim.end > 0 ? trim.end : videoDur}
                onChange={e => {
                  const end = parseFloat(e.target.value);
                  setTrim(prev => ({ start: prev.start, end: Math.max(end, prev.start + 0.5) }));
                }}
                style={{ width: '100%', accentColor: '#F5C542' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Text panel ── */}
      <AnimatePresence>
        {mode === 'text' && (
          <motion.div
            key="text-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
              background: 'rgba(15,15,20,0.97)',
              borderRadius: '20px 20px 0 0',
              padding: '16px 20px',
              paddingBottom: 'max(env(safe-area-inset-bottom),20px)',
            }}
          >
            {/* Text input */}
            <textarea
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              placeholder="Type something…"
              autoFocus
              rows={2}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12, color: '#fff', fontSize: 16,
                padding: '10px 12px', outline: 'none', resize: 'none',
                fontFamily: draftFont, boxSizing: 'border-box',
              }}
            />

            {/* Font picker */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {FONT_OPTIONS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setDraftFont(f.css)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1.5px solid',
                    borderColor: draftFont === f.css ? '#F5C542' : 'rgba(255,255,255,0.2)',
                    background: draftFont === f.css ? 'rgba(255,107,157,0.18)' : 'transparent',
                    color: '#fff', fontSize: 13, cursor: 'pointer',
                    fontFamily: f.css,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Color palette */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              {TEXT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setDraftColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 14, border: '2.5px solid',
                    borderColor: draftColor === c ? '#fff' : 'transparent',
                    background: c, cursor: 'pointer', flexShrink: 0,
                    boxShadow: c === '#FFFFFF' ? '0 0 0 1px rgba(0,0,0,0.3)' : 'none',
                  }}
                />
              ))}
            </div>

            {/* Style row */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Bold toggle */}
              <button
                onClick={() => setDraftWeight(w => w === 'bold' ? 'normal' : 'bold')}
                style={{ ...smallBtnStyle(draftWeight === 'bold') }}
              >
                <Bold size={14}/>
              </button>
              {/* Align */}
              {(['left','center','right'] as const).map(a => (
                <button key={a} onClick={() => setDraftAlign(a)} style={smallBtnStyle(draftAlign === a)}>
                  {a === 'left' ? <AlignLeft size={14}/> : a === 'center' ? <AlignCenter size={14}/> : <AlignRight size={14}/>}
                </button>
              ))}
              {/* Style */}
              {([
                { id: 'plain',        label: 'Plain' },
                { id: 'bubble-dark',  label: '● Dark' },
                { id: 'bubble-light', label: '○ Light' },
                { id: 'outlined',     label: 'Outline' },
              ] as { id: TextLayer['layerStyle']; label: string }[]).map(s => (
                <button
                  key={s.id}
                  onClick={() => setDraftStyle(s.id)}
                  style={{
                    padding: '5px 10px', borderRadius: 20, border: '1.5px solid',
                    borderColor: draftStyle === s.id ? '#F5C542' : 'rgba(255,255,255,0.25)',
                    background: draftStyle === s.id ? 'rgba(255,107,157,0.18)' : 'transparent',
                    color: '#fff', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Size slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 56 }}>
                Size: {draftSize}
              </span>
              <input
                type="range" min={14} max={64} step={2}
                value={draftSize}
                onChange={e => setDraftSize(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: '#F5C542' }}
              />
            </div>

            {/* Add button */}
            <button
              onClick={addTextLayer}
              disabled={!draftText.trim()}
              style={{
                width: '100%', marginTop: 14, padding: '14px 0',
                borderRadius: 14, border: 'none',
                background: draftText.trim() ? GRAD : '#333',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: draftText.trim() ? 'pointer' : 'default',
              }}
            >
              Add Text
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticker tray ── */}
      <AnimatePresence>
        {mode === 'sticker' && (
          <motion.div
            key="sticker-tray"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
              background: 'rgba(15,15,20,0.97)',
              borderRadius: '20px 20px 0 0',
              padding: '16px 20px 24px',
              maxHeight: '55vh', overflowY: 'auto',
            }}
          >
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 12, textAlign: 'center' }}>
              Stickers &amp; Emoji
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8,
            }}>
              {EMOJI_GRID.map(em => (
                <button
                  key={em}
                  onClick={() => addSticker(em)}
                  style={{
                    fontSize: 28, background: 'none', border: 'none',
                    cursor: 'pointer', borderRadius: 8, padding: 4,
                    lineHeight: 1.2,
                    transition: 'transform 0.1s',
                  }}
                  onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)'; }}
                  onPointerUp={e   => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)';   }}
                >
                  {em}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter picker ── */}
      <AnimatePresence>
        {mode === 'filter' && (
          <motion.div
            key="filter-picker"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{
              position: 'absolute', bottom: 90, left: 0, right: 0, zIndex: 25,
              padding: '12px 0 12px 16px',
            }}
          >
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingRight: 16 }}>
              {FILTER_DEFS.map(fd => (
                <button
                  key={fd.id}
                  onClick={() => setFilter(fd.id)}
                  style={{
                    flexShrink: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 6, background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  <div style={{
                    width: 64, height: 80, borderRadius: 12, overflow: 'hidden',
                    border: `2.5px solid ${filter === fd.id ? '#F5C542' : 'transparent'}`,
                    boxSizing: 'border-box',
                    boxShadow: filter === fd.id ? '0 0 0 1px #FF6B9D' : '0 1px 6px rgba(0,0,0,0.4)',
                  }}>
                    {item.mediaType === 'image' ? (
                      <img
                        src={item.previewUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: fd.css === 'none' ? '' : fd.css }}
                        alt={fd.label}
                        draggable={false}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, #333, #666)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        filter: fd.css === 'none' ? '' : fd.css,
                      }}>
                        <Sparkles size={22} color="#fff" />
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: filter === fd.id ? 700 : 400,
                    color: filter === fd.id ? '#F5C542' : '#fff',
                  }}>
                    {fd.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom toolbar ── */}
      {mode !== 'preview' && mode !== 'text' && mode !== 'sticker' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 25,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
          padding: '0 16px',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          paddingTop: 20,
          display: 'flex', justifyContent: 'center', gap: 4,
        }}>
          {toolbarTabs.map(tab => {
            const isActive = mode === tab.id;
            const isCrop = tab.id === 'crop';
            // For trim mode, use 'crop' tab with video label
            const activates = isCrop ? 'crop' : tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMode(isActive ? 'canvas' : activates)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, padding: '8px 14px', borderRadius: 16,
                  background: isActive ? 'rgba(255,107,157,0.25)' : 'rgba(255,255,255,0.08)',
                  border: isActive ? '1.5px solid rgba(255,107,157,0.6)' : '1.5px solid transparent',
                  cursor: 'pointer', color: isActive ? '#F5C542' : '#fff',
                  minWidth: 56,
                }}
              >
                {tab.icon}
                <span style={{ fontSize: 10, fontWeight: 600 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Micro style helpers ──────────────────────────────────────────────────────

function btnStyle(bg: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 18,
    background: bg, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

function smallBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8,
    background: active ? 'rgba(255,107,157,0.3)' : 'rgba(255,255,255,0.1)',
    border: `1.5px solid ${active ? 'rgba(255,107,157,0.8)' : 'transparent'}`,
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

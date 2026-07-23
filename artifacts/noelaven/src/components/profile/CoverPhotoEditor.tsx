/**
 * CoverPhotoEditor — full-screen cover photo editor.
 *
 * UX
 * ──
 *   • Shows the image full-screen behind a fixed 3:1 crop-frame overlay.
 *   • Single-finger drag pans the focal point (x/y as objectPosition %).
 *   • Two-finger pinch zooms (scale multiplier).
 *   • Bottom bar: Cancel | Replace/Upload | Remove | Save.
 *   • Upload only happens on explicit Save — Cancel is fully non-destructive.
 *
 * Storage
 * ───────
 *   coverPosition: { x, y, zoom }
 *     x/y  → CSS objectPosition percentages (0–100)
 *     zoom → CSS scale multiplier (≥ 1)
 *
 * Profile display uses the same CSS:
 *   objectFit: cover; objectPosition: x% y%;
 *   transform: scale(zoom); transformOrigin: x% y%;
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X, Camera, Trash2, Check, Loader2, ImagePlus, Move, ZoomIn,
} from 'lucide-react';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoverPosition { x: number; y: number; zoom: number }

export interface CoverSavePayload {
  coverUrl:      string;
  coverPosition: CoverPosition;
}

interface CoverPhotoEditorProps {
  currentCoverUrl:  string;
  currentPosition:  CoverPosition;
  onSave:  (payload: CoverSavePayload) => Promise<void>;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

interface Pt { x: number; y: number }
const ptDist  = (a: Pt, b: Pt) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const ptMid   = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// ─── Component ────────────────────────────────────────────────────────────────

export function CoverPhotoEditor({
  currentCoverUrl, currentPosition, onSave, onClose,
}: CoverPhotoEditorProps) {
  const [localUrl,    setLocalUrl]    = useState(currentCoverUrl);
  // Ensure pos is always fully initialised even if caller passes a partial object.
  const [pos, setPos] = useState<CoverPosition>({
    x:    currentPosition?.x    ?? 50,
    y:    currentPosition?.y    ?? 50,
    zoom: currentPosition?.zoom ?? 1,
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [changed,     setChanged]     = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileRevokeRef = useRef<string | null>(null);   // track blob URL to revoke later

  // Pointer tracking for drag + pinch
  const ptrs       = useRef(new Map<number, Pt>());
  const dragAnchor = useRef<{ px: number; py: number; posX: number; posY: number } | null>(null);
  const pinchAnchor = useRef<{ dist: number; zoom: number; center: Pt; posX: number; posY: number } | null>(null);

  // ── Pointer helpers ──────────────────────────────────────────────────────────

  const containerSize = useCallback((): { w: number; h: number } => {
    const el = containerRef.current;
    if (!el) return { w: 1, h: 1 };
    return { w: el.clientWidth, h: el.clientHeight };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrs.current.size === 1) {
      dragAnchor.current = { px: e.clientX, py: e.clientY, posX: pos.x, posY: pos.y };
      pinchAnchor.current = null;
    }

    if (ptrs.current.size === 2) {
      dragAnchor.current = null;
      const [a, b] = Array.from(ptrs.current.values()) as [Pt, Pt];
      pinchAnchor.current = {
        dist: ptDist(a, b), zoom: pos.zoom,
        center: ptMid(a, b), posX: pos.x, posY: pos.y,
      };
    }
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w, h } = containerSize();

    if (ptrs.current.size === 1) {
      // Snapshot the ref NOW — the setPos updater runs later and the ref may be
      // null by then (onPointerUp clears it between the guard check and the call).
      const anchor = dragAnchor.current;
      if (!anchor) return;
      const dx = e.clientX - anchor.px;
      const dy = e.clientY - anchor.py;
      // Capture anchor values as plain numbers so the updater never touches the ref.
      const { posX, posY } = anchor;
      setPos(prev => ({
        ...prev,
        x: clamp(posX - (dx / w) * 100, 0, 100),
        y: clamp(posY - (dy / h) * 100, 0, 100),
      }));
      if (!changed) setChanged(true);
    }

    if (ptrs.current.size === 2) {
      // pinchAnchor is also snapshotted immediately for the same reason.
      const anc = pinchAnchor.current;
      if (!anc) return;
      const [a, b] = Array.from(ptrs.current.values()) as [Pt, Pt];
      const newDist   = ptDist(a, b);
      const newCenter = ptMid(a, b);
      const newZoom   = clamp(anc.zoom * (newDist / anc.dist), 1, 5);
      const cdx = (newCenter.x - anc.center.x) / w * 100;
      const cdy = (newCenter.y - anc.center.y) / h * 100;
      // All values plain numbers — no ref read inside the updater.
      const nx = clamp(anc.posX - cdx, 0, 100);
      const ny = clamp(anc.posY - cdy, 0, 100);
      setPos(() => ({ x: nx, y: ny, zoom: newZoom }));
      if (!changed) setChanged(true);
    }
  }, [containerSize, changed]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinchAnchor.current = null;
    if (ptrs.current.size === 0) dragAnchor.current = null;
  }, []);

  // ── File pick ──────────────────────────────────────────────────────────────

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRevokeRef.current) URL.revokeObjectURL(fileRevokeRef.current);
    const url = URL.createObjectURL(file);
    fileRevokeRef.current = url;
    setPendingFile(file);
    setLocalUrl(url);
    setPos({ x: 50, y: 50, zoom: 1 });
    setChanged(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  async function handleRemove() {
    setSaving(true); setError(null);
    try {
      await onSave({ coverUrl: '', coverPosition: { x: 50, y: 50, zoom: 1 } });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Remove failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      let finalUrl = localUrl;
      if (pendingFile && isCloudinaryConfigured) {
        setUploading(true);
        finalUrl = await uploadImage(pendingFile, 'covers');
        setUploading(false);
      }
      await onSave({ coverUrl: finalUrl, coverPosition: pos });
      onClose();
    } catch (err: unknown) {
      setUploading(false);
      setError((err as Error).message ?? 'Upload failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasImage = Boolean(localUrl);

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">

      {/* ── Full-screen image with pan/pinch ── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: hasImage ? 'grab' : 'default' }}
        onPointerDown={hasImage ? onPointerDown : undefined}
        onPointerMove={hasImage ? onPointerMove : undefined}
        onPointerUp={hasImage ? onPointerUp : undefined}
        onPointerCancel={hasImage ? onPointerUp : undefined}
      >
        {/* Image (or placeholder) */}
        {hasImage ? (
          <img
            src={localUrl}
            alt="Cover"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: `${pos.x}% ${pos.y}%`,
              transform: `scale(${pos.zoom})`,
              transformOrigin: `${pos.x}% ${pos.y}%`,
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/40">
            <ImagePlus size={48} strokeWidth={1} />
            <p className="text-sm font-medium">
              {isCloudinaryConfigured ? 'Tap "Upload Photo" below' : 'Configure Cloudinary to upload'}
            </p>
          </div>
        )}

        {/* ── 3:1 crop-frame overlay ── */}
        <div className="absolute inset-0 flex flex-col pointer-events-none">
          {/* dim above */}
          <div className="flex-1 bg-black/55" />
          {/* crop frame */}
          <div
            className="w-full flex-shrink-0 relative"
            style={{ aspectRatio: '3 / 1' }}
          >
            {/* white border */}
            <div className="absolute inset-0 border-2 border-white" />
            {/* rule-of-thirds grid */}
            {[1/3, 2/3].map((p, i) => (
              <React.Fragment key={i}>
                <div style={{ position:'absolute', left:`${p*100}%`, top:0, bottom:0, width:1, background:'rgba(255,255,255,0.25)' }} />
                <div style={{ position:'absolute', top:`${p*100}%`, left:0, right:0, height:1, background:'rgba(255,255,255,0.25)' }} />
              </React.Fragment>
            ))}
            {/* Centre label */}
            {hasImage && (
              <div className="absolute inset-0 flex items-end justify-center pb-1.5">
                <span className="flex items-center gap-1 bg-black/35 backdrop-blur-sm text-white/80 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  <Move size={9} /> drag  &nbsp;·&nbsp;  <ZoomIn size={9} /> pinch to zoom
                </span>
              </div>
            )}
          </div>
          {/* dim below */}
          <div className="flex-1 bg-black/55" />
        </div>

        {/* ── Top bar ── */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 44px)', paddingBottom: 12 }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          >
            <X size={18} className="text-white" />
          </button>
          <span className="text-white font-bold text-sm bg-black/40 backdrop-blur-sm px-4 py-1.5 rounded-full">
            Edit Cover
          </span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={saving || (!changed && localUrl === currentCoverUrl)}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
          >
            {(saving || uploading) ? <Loader2 size={16} className="text-white animate-spin" /> : <Check size={16} className="text-white" />}
          </motion.button>
        </div>

        {/* Error */}
        {error && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
            <div className="bg-red-500/90 text-white text-sm font-medium text-center px-4 py-2.5 rounded-xl">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div
        className="flex-shrink-0 flex items-center justify-around px-4 py-3 gap-2"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Upload / Replace */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={saving || !isCloudinaryConfigured}
          className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl active:bg-white/10 transition-colors disabled:opacity-40"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}>
            <Camera size={18} className="text-white" />
          </div>
          <span className="text-white/80 text-[11px] font-semibold leading-none">
            {hasImage ? 'Replace' : 'Upload'}
          </span>
          {!isCloudinaryConfigured && (
            <span className="text-white/30 text-[9px]">unconfigured</span>
          )}
        </button>

        {/* Remove — only when there's a cover */}
        {hasImage && (
          <button
            onClick={handleRemove}
            disabled={saving}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl active:bg-white/10 transition-colors disabled:opacity-40"
          >
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <Trash2 size={18} className="text-red-400" />
            </div>
            <span className="text-red-400 text-[11px] font-semibold leading-none">Remove</span>
          </button>
        )}

        {/* Save (large) */}
        <button
          onClick={handleSave}
          disabled={saving || (!changed && localUrl === currentCoverUrl)}
          className="flex-[2] py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
        >
          {(saving || uploading) ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={15} /> Save Cover</>}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFilePick}
      />
    </div>
  );
}

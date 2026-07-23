/**
 * CoverPhotoEditor — full-screen mobile cover photo editor.
 *
 * Layout (390 × 844 mobile)
 * ─────────────────────────
 *  [safe-area + title bar]
 *  [full-screen image behind everything]
 *  [dim area above frame — flex-1]
 *  [3:1 crop frame — white border, rule-of-thirds, "Your cover" label]
 *  [dim area below frame — shows "Move and zoom" instruction]
 *  [fixed bottom controls — Change · Remove · SAVE · Cancel]
 *
 * The image fills the entire screen as the drag surface.
 * Pointer events are blocked on all overlaid UI so drags only hit the image.
 *
 * State
 * ─────
 *  pos.x / pos.y  → CSS objectPosition % (0–100)
 *  pos.zoom       → CSS scale multiplier (1–5)
 *
 * Saving
 * ──────
 *  Upload to Cloudinary only on explicit Save.
 *  Cancel is fully non-destructive — no network calls.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Camera, Trash2, Loader2, ImagePlus, CheckCircle2,
} from 'lucide-react';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoverPosition { x: number; y: number; zoom: number }

export interface CoverSavePayload {
  coverUrl:      string;
  coverPosition: CoverPosition;
}

interface CoverPhotoEditorProps {
  currentCoverUrl: string;
  currentPosition: CoverPosition;
  onSave:  (payload: CoverSavePayload) => Promise<void>;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

interface Pt { x: number; y: number }
const ptDist = (a: Pt, b: Pt) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const ptMid  = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// ─── Component ────────────────────────────────────────────────────────────────

export function CoverPhotoEditor({
  currentCoverUrl, currentPosition, onSave, onClose,
}: CoverPhotoEditorProps) {

  const [localUrl,    setLocalUrl]    = useState(currentCoverUrl);
  const [pos,         setPos]         = useState<CoverPosition>({
    x:    currentPosition?.x    ?? 50,
    y:    currentPosition?.y    ?? 50,
    zoom: currentPosition?.zoom ?? 1,
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [changed,     setChanged]     = useState(false);
  const [saved,       setSaved]       = useState(false);

  const containerRef  = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const blobUrlRef    = useRef<string | null>(null);

  // ── Pointer tracking ────────────────────────────────────────────────────────

  const ptrs        = useRef(new Map<number, Pt>());
  const dragAnchor  = useRef<{ px: number; py: number; posX: number; posY: number } | null>(null);
  const pinchAnchor = useRef<{ dist: number; zoom: number; center: Pt; posX: number; posY: number } | null>(null);

  const containerSize = useCallback(() => {
    const el = containerRef.current;
    return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 1, h: 1 };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrs.current.size === 1) {
      dragAnchor.current  = { px: e.clientX, py: e.clientY, posX: pos.x, posY: pos.y };
      pinchAnchor.current = null;
    }
    if (ptrs.current.size === 2) {
      dragAnchor.current = null;
      const [a, b] = Array.from(ptrs.current.values()) as [Pt, Pt];
      pinchAnchor.current = { dist: ptDist(a, b), zoom: pos.zoom, center: ptMid(a, b), posX: pos.x, posY: pos.y };
    }
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w, h } = containerSize();

    if (ptrs.current.size === 1) {
      // Snapshot ref before async setPos — onPointerUp may null it before the updater runs.
      const anchor = dragAnchor.current;
      if (!anchor) return;
      const dx = e.clientX - anchor.px;
      const dy = e.clientY - anchor.py;
      const { posX, posY } = anchor;
      setPos(prev => ({
        ...prev,
        x: clamp(posX - (dx / w) * 100, 0, 100),
        y: clamp(posY - (dy / h) * 100, 0, 100),
      }));
      if (!changed) setChanged(true);
    }

    if (ptrs.current.size === 2) {
      const anc = pinchAnchor.current;
      if (!anc) return;
      const [a, b] = Array.from(ptrs.current.values()) as [Pt, Pt];
      const newDist   = ptDist(a, b);
      const newCenter = ptMid(a, b);
      const newZoom   = clamp(anc.zoom * (newDist / anc.dist), 1, 5);
      const cdx       = (newCenter.x - anc.center.x) / w * 100;
      const cdy       = (newCenter.y - anc.center.y) / h * 100;
      const nx        = clamp(anc.posX - cdx, 0, 100);
      const ny        = clamp(anc.posY - cdy, 0, 100);
      setPos(() => ({ x: nx, y: ny, zoom: newZoom }));
      if (!changed) setChanged(true);
    }
  }, [containerSize, changed]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinchAnchor.current = null;
    if (ptrs.current.size === 0) dragAnchor.current = null;
  }, []);

  // ── File pick ───────────────────────────────────────────────────────────────

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    setPendingFile(file);
    setLocalUrl(url);
    setPos({ x: 50, y: 50, zoom: 1 });
    setChanged(true);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Remove ──────────────────────────────────────────────────────────────────

  async function handleRemove() {
    setSaving(true); setError(null);
    try {
      await onSave({ coverUrl: '', coverPosition: { x: 50, y: 50, zoom: 1 } });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Remove failed');
      setSaving(false);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

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
      setSaved(true);
      setTimeout(onClose, 600);
    } catch (err: unknown) {
      setUploading(false);
      setError((err as Error).message ?? 'Upload failed — try again.');
      setSaving(false);
    }
  }

  const hasImage    = Boolean(localUrl);
  const saveEnabled = hasImage && (changed || localUrl !== currentCoverUrl);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col" style={{ fontFamily: 'inherit' }}>

      {/* ─ Full-screen drag surface ─ */}
      <div
        ref={containerRef}
        className="absolute inset-0 select-none"
        style={{ touchAction: 'none', cursor: hasImage ? 'grab' : 'default' }}
        onPointerDown={hasImage ? onPointerDown : undefined}
        onPointerMove={hasImage ? onPointerMove : undefined}
        onPointerUp={hasImage ? onPointerUp : undefined}
        onPointerCancel={hasImage ? onPointerUp : undefined}
      >
        {hasImage && (
          <img
            src={localUrl}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: `${pos.x}% ${pos.y}%`,
              transform: `scale(${pos.zoom})`,
              transformOrigin: `${pos.x}% ${pos.y}%`,
              pointerEvents: 'none',
            }}
          />
        )}

        {!hasImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/30">
            <ImagePlus size={64} strokeWidth={1} />
            <p className="text-base font-medium">
              {isCloudinaryConfigured ? 'Tap "Change Photo" below to upload' : 'Cloudinary not configured'}
            </p>
          </div>
        )}
      </div>

      {/* ─ Overlay: dim + crop frame + instruction (pointer-events-none) ─ */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 'calc(max(env(safe-area-inset-top), 0px) + 56px)',  /* below title bar */
          bottom: '200px',   /* above bottom controls */
          left: 0, right: 0,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Dim above frame */}
        <div className="flex-1" style={{ background: 'rgba(0,0,0,0.62)' }} />

        {/* 3:1 Crop frame */}
        <div style={{ width: '100%', aspectRatio: '3 / 1', position: 'relative', flexShrink: 0 }}>
          {/* White border */}
          <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(255,255,255,0.95)', boxShadow: '0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.2)' }} />

          {/* Corner accents */}
          {[
            { top: -2, left: -2 }, { top: -2, right: -2 },
            { bottom: -2, left: -2 }, { bottom: -2, right: -2 },
          ].map((style, i) => (
            <div key={i} style={{
              position: 'absolute', width: 18, height: 18,
              background: 'white', borderRadius: 2, ...style,
            }} />
          ))}

          {/* Rule-of-thirds grid */}
          {[1/3, 2/3].map((p, i) => (
            <React.Fragment key={i}>
              <div style={{ position: 'absolute', left: `${p*100}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ position: 'absolute', top: `${p*100}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
            </React.Fragment>
          ))}

          {/* "Cover preview" label centred in frame */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
              color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              padding: '4px 10px', borderRadius: 999,
            }}>
              Profile cover preview
            </span>
          </div>
        </div>

        {/* Dim below frame + instruction text */}
        <div
          className="flex-1 flex flex-col items-center justify-start pt-5 gap-2"
          style={{ background: 'rgba(0,0,0,0.62)' }}
        >
          {hasImage && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                borderRadius: 999, padding: '8px 16px',
              }}>
                <span style={{ fontSize: 18 }}>☝️</span>
                <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>
                  Move and zoom your photo
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 2 }}>
                Drag to reposition · Pinch to zoom
              </p>
            </>
          )}
        </div>
      </div>

      {/* ─ Title bar ─ */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between pointer-events-auto"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 44px)',
          paddingLeft: 20, paddingRight: 20, paddingBottom: 12,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}
      >
        <button
          onClick={onClose}
          disabled={saving}
          style={{
            color: 'white', fontSize: 16, fontWeight: 600,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            border: 'none', borderRadius: 999, padding: '8px 16px',
            opacity: saving ? 0.4 : 1, cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <span style={{
          color: 'white', fontSize: 16, fontWeight: 700,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
          borderRadius: 999, padding: '8px 18px',
        }}>
          Edit Cover Photo
        </span>

        {/* Spacer to balance Cancel */}
        <div style={{ width: 80 }} />
      </div>

      {/* ─ Bottom controls ─ */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
          paddingLeft: 20, paddingRight: 20, paddingTop: 16,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.9)', color: 'white',
            borderRadius: 12, padding: '10px 16px', marginBottom: 12,
            fontSize: 13, fontWeight: 600, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Secondary actions row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={saving || !isCloudinaryConfigured}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '12px 0',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 14, color: 'white', fontSize: 14, fontWeight: 600,
              opacity: (saving || !isCloudinaryConfigured) ? 0.4 : 1, cursor: 'pointer',
            }}
          >
            <Camera size={16} />
            {hasImage ? 'Change Photo' : 'Upload Photo'}
          </button>

          {hasImage && (
            <button
              onClick={handleRemove}
              disabled={saving}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '12px 0',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 14, color: '#F87171', fontSize: 14, fontWeight: 600,
                opacity: saving ? 0.4 : 1, cursor: 'pointer',
              }}
            >
              <Trash2 size={16} />
              Remove Photo
            </button>
          )}
        </div>

        {/* Primary Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !saveEnabled}
          style={{
            width: '100%', padding: '17px 0', borderRadius: 16,
            border: 'none', cursor: saving || !saveEnabled ? 'default' : 'pointer',
            background: saved
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'linear-gradient(135deg, #6B73FF, #C44FDB, #FF6B9D)',
            color: 'white', fontSize: 17, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: !saveEnabled && !saving ? 0.45 : 1,
            transition: 'opacity 0.2s, background 0.3s',
            letterSpacing: '-0.01em',
          }}
        >
          {saved ? (
            <><CheckCircle2 size={20} /> Saved!</>
          ) : (saving || uploading) ? (
            <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> {uploading ? 'Uploading…' : 'Saving…'}</>
          ) : (
            'Save Cover Photo'
          )}
        </button>

        {!isCloudinaryConfigured && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
            Image upload requires Cloudinary to be configured
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFilePick}
      />

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * CoverPhotoEditor — full-screen mobile cover photo editor.
 *
 * Layout (flex-column, fills 100 dvh)
 * ────────────────────────────────────
 *  ① Instruction bar  ~72 px — "Move and zoom your photo"
 *  ② Interactive zone flex-1 — image behind pointer events;
 *     dim overlay (pointer-events-none) with centered 3:1 crop frame
 *  ③ Bottom bar  ~230 px — live cover preview + Change/Remove + Save + Cancel
 *
 * The crop frame is centered inside ② purely by flexbox — no pixel math.
 * The image uses objectFit:cover + objectPosition + scale so it always fills
 * the zone and the user sees exactly what they're doing.
 *
 * Pointer-event safety
 * ────────────────────
 * dragAnchor / pinchAnchor refs are snapshotted into plain local consts
 * BEFORE every setPos call. The updater function never touches the ref,
 * so it cannot crash when onPointerUp nulls the ref between the guard
 * check and the async execution of the updater.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Camera, Trash2, Loader2, ImagePlus, Check } from 'lucide-react';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';

// ─── Public types (imported by Profile.tsx) ───────────────────────────────────

export interface CoverPosition { x: number; y: number; zoom: number }
export interface CoverSavePayload { coverUrl: string; coverPosition: CoverPosition }

interface Props {
  currentCoverUrl: string;
  currentPosition: CoverPosition;
  onSave:  (p: CoverSavePayload) => Promise<void>;
  onClose: () => void;
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
interface Pt { x: number; y: number }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid  = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// ─── Corner L-mark ────────────────────────────────────────────────────────────

function Corner({ t, r, b, l }: { t?: number; r?: number; b?: number; l?: number }) {
  return (
    <div style={{
      position: 'absolute',
      top: t, right: r, bottom: b, left: l,
      width: 22, height: 22,
      borderTop:    t !== undefined ? '3px solid white' : undefined,
      borderBottom: b !== undefined ? '3px solid white' : undefined,
      borderLeft:   l !== undefined ? '3px solid white' : undefined,
      borderRight:  r !== undefined ? '3px solid white' : undefined,
    }} />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CoverPhotoEditor({ currentCoverUrl, currentPosition, onSave, onClose }: Props) {

  const [url,       setUrl]       = useState(currentCoverUrl);
  const [pos,       setPos]       = useState<CoverPosition>({
    x:    currentPosition?.x    ?? 50,
    y:    currentPosition?.y    ?? 50,
    zoom: currentPosition?.zoom ?? 1,
  });
  const [file,      setFile]      = useState<File | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [dirty,     setDirty]     = useState(false);
  const [done,      setDone]      = useState(false);

  const zoneRef     = useRef<HTMLDivElement>(null);   // interactive flex-1 zone
  const fileRef     = useRef<HTMLInputElement>(null);
  const blobRef     = useRef<string | null>(null);

  // pointer state
  const ptrs   = useRef(new Map<number, Pt>());
  const drag   = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinch  = useRef<{ d0: number; z0: number; cx0: number; cy0: number; ox: number; oy: number } | null>(null);

  // ── pointer helpers ──────────────────────────────────────────────────────────

  const zoneSize = useCallback(() => {
    const el = zoneRef.current;
    return el ? { w: el.clientWidth || 1, h: el.clientHeight || 1 } : { w: 1, h: 1 };
  }, []);

  const onPD = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrs.current.size === 1) {
      drag.current  = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
      pinch.current = null;
    } else if (ptrs.current.size === 2) {
      drag.current  = null;
      const [a, b] = Array.from(ptrs.current.values()) as [Pt, Pt];
      const m = mid(a, b);
      pinch.current = { d0: dist(a, b), z0: pos.zoom, cx0: m.x, cy0: m.y, ox: pos.x, oy: pos.y };
    }
  }, [pos]);

  const onPM = useCallback((e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w, h } = zoneSize();

    if (ptrs.current.size === 1) {
      const a = drag.current;
      if (!a) return;
      const dx = e.clientX - a.px;
      const dy = e.clientY - a.py;
      const ox = a.ox, oy = a.oy;            // plain numbers — safe in updater
      setPos(p => ({ ...p, x: clamp(ox - (dx / w) * 100, 0, 100), y: clamp(oy - (dy / h) * 100, 0, 100) }));
      if (!dirty) setDirty(true);
    } else if (ptrs.current.size === 2) {
      const a = pinch.current;
      if (!a) return;
      const [p1, p2] = Array.from(ptrs.current.values()) as [Pt, Pt];
      const m    = mid(p1, p2);
      const zoom = clamp(a.z0 * (dist(p1, p2) / a.d0), 1, 6);
      const cdx  = (m.x - a.cx0) / w * 100;
      const cdy  = (m.y - a.cy0) / h * 100;
      const nx   = clamp(a.ox - cdx, 0, 100);
      const ny   = clamp(a.oy - cdy, 0, 100);
      setPos(() => ({ x: nx, y: ny, zoom }));   // plain numbers — no ref read
      if (!dirty) setDirty(true);
    }
  }, [zoneSize, dirty]);

  const onPU = useCallback((e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 0) drag.current = null;
  }, []);

  // ── file pick ────────────────────────────────────────────────────────────────

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    const blob = URL.createObjectURL(f);
    blobRef.current = blob;
    setFile(f); setUrl(blob);
    setPos({ x: 50, y: 50, zoom: 1 });
    setDirty(true); setDone(false); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── remove ───────────────────────────────────────────────────────────────────

  async function handleRemove() {
    setSaving(true); setError(null);
    try   { await onSave({ coverUrl: '', coverPosition: { x: 50, y: 50, zoom: 1 } }); onClose(); }
    catch  (err: unknown) { setError((err as Error).message ?? 'Remove failed'); setSaving(false); }
  }

  // ── save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!url) return;
    setSaving(true); setError(null);
    try {
      let finalUrl = url;
      if (file && isCloudinaryConfigured) {
        setUploading(true);
        finalUrl = await uploadImage(file, 'covers');
        setUploading(false);
      }
      await onSave({ coverUrl: finalUrl, coverPosition: pos });
      setDone(true);
      setTimeout(onClose, 700);
    } catch (err: unknown) {
      setUploading(false);
      setError((err as Error).message ?? 'Upload failed. Try again.');
      setSaving(false);
    }
  }

  const hasImage   = Boolean(url);
  const canSave    = hasImage && (dirty || url !== currentCoverUrl) && !done;

  // ── image style (reused for both main + preview) ──────────────────────────────

  const imgStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'cover',
    objectPosition: `${pos.x}% ${pos.y}%`,
    transform:       `scale(${pos.zoom})`,
    transformOrigin: `${pos.x}% ${pos.y}%`,
    pointerEvents: 'none',
    ...extra,
  });

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column',
      background: '#000',
      // use dynamic viewport height so bottom bar doesn't hide behind browser chrome
      height: '100dvh',
    }}>

      {/* ════════════════════════════════════════════════════════
          ①  INSTRUCTION BAR — always at the top
          ════════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'max(env(safe-area-inset-top), 14px)',
        paddingBottom: 14,
        paddingLeft: 20, paddingRight: 20,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Cancel — left */}
        <button
          onClick={onClose}
          disabled={saving}
          style={{
            flexShrink: 0, padding: '9px 18px',
            borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.22)',
            background: 'rgba(255,255,255,0.08)',
            color: 'white', fontSize: 15, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.45 : 1,
          }}
        >
          Cancel
        </button>

        {/* Centre text */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ color: 'white', fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Move and zoom your photo
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
            Drag to reposition · Pinch to zoom
          </div>
        </div>

        {/* Save — right (icon badge so top bar is balanced) */}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            flexShrink: 0, width: 42, height: 42, borderRadius: 999,
            border: 'none', cursor: canSave && !saving ? 'pointer' : 'default',
            background: done
              ? 'linear-gradient(135deg,#22c55e,#16a34a)'
              : canSave
                ? 'linear-gradient(135deg,#6B73FF,#FF6B9D)'
                : 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: !canSave && !saving ? 0.35 : 1,
            transition: 'background .25s, opacity .2s',
          }}
        >
          {saving
            ? <Loader2 size={18} color="white" style={{ animation: 'spin .9s linear infinite' }} />
            : <Check size={18} color="white" strokeWidth={3} />}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
          ②  INTERACTIVE ZONE — image + pointer events (flex-1)
          ════════════════════════════════════════════════════════ */}
      <div
        ref={zoneRef}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          touchAction: 'none', userSelect: 'none',
          cursor: hasImage ? 'grab' : 'default',
          minHeight: 0,   // prevents flex-1 overflow
        }}
        onPointerDown={hasImage ? onPD : undefined}
        onPointerMove={hasImage ? onPM : undefined}
        onPointerUp={hasImage ? onPU : undefined}
        onPointerCancel={hasImage ? onPU : undefined}
      >
        {/* ── Image ── */}
        {hasImage
          ? <img src={url} alt="" draggable={false} style={imgStyle()} />
          : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              color: 'rgba(255,255,255,0.25)',
            }}>
              <ImagePlus size={60} strokeWidth={1} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Tap "Change Photo" below to upload
              </span>
            </div>
          )
        }

        {/* ── Dim overlay + 3:1 crop frame (pointer-events-none) ── */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          pointerEvents: 'none',
        }}>
          {/* Top dim — flex-1 */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.70)' }} />

          {/* Crop frame — 3:1 aspect ratio, full width */}
          <div style={{ width: '100%', aspectRatio: '3 / 1', flexShrink: 0, position: 'relative' }}>
            {/* Outer frame border */}
            <div style={{
              position: 'absolute', inset: 0,
              border: '2px solid rgba(255,255,255,0.85)',
              boxSizing: 'border-box',
            }} />

            {/* Corner L-marks */}
            <Corner t={0} l={0} />
            <Corner t={0} r={0} />
            <Corner b={0} l={0} />
            <Corner b={0} r={0} />

            {/* Rule-of-thirds grid (subtle) */}
            {[1/3, 2/3].map((f, i) => (
              <React.Fragment key={i}>
                <div style={{ position:'absolute', top:0, bottom:0, left:`${f*100}%`, width:1, background:'rgba(255,255,255,0.15)' }} />
                <div style={{ position:'absolute', left:0, right:0, top:`${f*100}%`, height:1, background:'rgba(255,255,255,0.15)' }} />
              </React.Fragment>
            ))}

            {/* "Cover preview" centre label */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
                color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '4px 12px', borderRadius: 999,
              }}>
                Cover frame
              </span>
            </div>
          </div>

          {/* Bottom dim — flex-1 */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.70)' }} />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          ③  BOTTOM BAR — live preview + actions + big Save
          ════════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
        paddingLeft: 20, paddingRight: 20,
        paddingTop: 14,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {/* ── Live cover preview strip ── */}
        {hasImage && (
          <div>
            <p style={{
              color: 'rgba(255,255,255,0.38)', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7,
            }}>
              Live preview — how it appears on your profile
            </p>
            {/* 3:1 strip exactly mimicking profile rendering */}
            <div style={{
              width: '100%', aspectRatio: '3 / 1',
              borderRadius: 10, overflow: 'hidden', position: 'relative',
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#1a1a2e',
            }}>
              <img
                src={url}
                alt="preview"
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
              {/* "Profile" simulation overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.35) 100%)',
                pointerEvents: 'none',
              }} />
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.85)', color: 'white',
            padding: '10px 14px', borderRadius: 12,
            fontSize: 13, fontWeight: 600, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* ── Secondary row: Change Photo / Remove ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={saving || !isCloudinaryConfigured}
            style={{
              flex: 1, padding: '12px 0',
              borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: 'white', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              opacity: (saving || !isCloudinaryConfigured) ? 0.35 : 1,
              cursor: (saving || !isCloudinaryConfigured) ? 'default' : 'pointer',
            }}
          >
            <Camera size={15} />
            {hasImage ? 'Change Photo' : 'Upload Photo'}
          </button>

          {hasImage && (
            <button
              onClick={handleRemove}
              disabled={saving}
              style={{
                flex: 1, padding: '12px 0',
                borderRadius: 14, border: '1.5px solid rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.1)',
                color: '#f87171', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                opacity: saving ? 0.35 : 1,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              <Trash2 size={15} />
              Remove
            </button>
          )}
        </div>

        {/* ── Primary: SAVE COVER PHOTO ── */}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            width: '100%', padding: '17px 0',
            borderRadius: 16, border: 'none',
            background: done
              ? 'linear-gradient(135deg,#22c55e,#16a34a)'
              : 'linear-gradient(135deg,#6B73FF,#C44FDB,#FF6B9D)',
            color: 'white', fontSize: 17, fontWeight: 800,
            letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: (!canSave && !saving) ? 0.4 : 1,
            transition: 'opacity .2s, background .3s',
            cursor: (!canSave || saving) ? 'default' : 'pointer',
          }}
        >
          {done ? (
            <><Check size={20} strokeWidth={3} /> Saved!</>
          ) : (saving || uploading) ? (
            <><Loader2 size={20} style={{ animation: 'spin .9s linear infinite' }} />
              {uploading ? 'Uploading photo…' : 'Saving…'}</>
          ) : (
            'Save Cover Photo'
          )}
        </button>

        {!isCloudinaryConfigured && (
          <p style={{ color:'rgba(255,255,255,0.25)', fontSize:11, textAlign:'center', marginTop:-4 }}>
            Image upload requires Cloudinary to be configured
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
        style={{ display:'none' }} onChange={pickFile}
      />

      {/* Keyframe for spinner — scoped to this overlay */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

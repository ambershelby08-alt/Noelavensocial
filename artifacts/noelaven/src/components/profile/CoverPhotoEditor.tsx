/**
 * CoverPhotoEditor — bottom sheet for editing the profile cover photo.
 *
 * Features:
 *   • Drag-to-reposition   — pan the image within the 3:1 preview
 *   • Upload               — pick from device; previewed locally before save
 *   • Remove               — clear to gradient fallback
 *   • Save / Cancel        — upload to Cloudinary only on explicit Save
 *
 * Position is stored as { x, y } percentages (0–100) mapping directly to
 * CSS `object-position: x% y%`.  No Cloudinary transform is applied.
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, Trash2, Check, Loader2, ImagePlus, Move } from 'lucide-react';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoverPosition { x: number; y: number }

export interface CoverSavePayload {
  coverUrl: string;
  coverPosition: CoverPosition;
}

interface CoverPhotoEditorProps {
  /** Current saved cover URL (empty string = no cover / gradient) */
  currentCoverUrl: string;
  /** Current saved position — defaults to centre (50, 50) */
  currentPosition: CoverPosition;
  /** Gradient fallback colours shown when no image */
  gradientFrom: string;
  gradientTo: string;
  onSave: (payload: CoverSavePayload) => Promise<void>;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, v));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CoverPhotoEditor({
  currentCoverUrl, currentPosition, gradientFrom, gradientTo, onSave, onClose,
}: CoverPhotoEditorProps) {
  // Local working copies — not committed until Save
  const [localUrl,  setLocalUrl]  = useState(currentCoverUrl);
  const [position,  setPosition]  = useState<CoverPosition>(currentPosition);
  const [pendingFile, setPendingFile] = useState<File | null>(null);  // file waiting to upload
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [didChange, setDidChange] = useState(false);

  // Drag-to-reposition state
  const previewRef   = useRef<HTMLDivElement>(null);
  const dragStart    = useRef<{ ptrX: number; ptrY: number; posX: number; posY: number } | null>(null);
  const isDragging   = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File pick ──────────────────────────────────────────────────────────────

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPendingFile(file);
    setLocalUrl(preview);
    setPosition({ x: 50, y: 50 });   // reset position for new image
    setDidChange(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Remove cover ───────────────────────────────────────────────────────────

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ coverUrl: '', coverPosition: { x: 50, y: 50 } });
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Remove failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let finalUrl = localUrl;
      if (pendingFile && isCloudinaryConfigured) {
        setUploading(true);
        finalUrl = await uploadImage(pendingFile, 'covers');
        setUploading(false);
      }
      await onSave({ coverUrl: finalUrl, coverPosition: position });
      onClose();
    } catch (e: unknown) {
      setUploading(false);
      setError((e as Error).message ?? 'Upload failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Drag-to-reposition ─────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!localUrl) return;              // no image → nothing to reposition
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { ptrX: e.clientX, ptrY: e.clientY, posX: position.x, posY: position.y };
    isDragging.current = false;
  }, [localUrl, position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStart.current.ptrX;
    const dy = e.clientY - dragStart.current.ptrY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
    // Pan: drag right → move image right (show left side) → x decreases
    const newX = clamp(dragStart.current.posX - (dx / rect.width)  * 100);
    const newY = clamp(dragStart.current.posY - (dy / rect.height) * 120);
    setPosition({ x: newX, y: newY });
    if (!didChange) setDidChange(true);
  }, [didChange]);

  const onPointerUp = useCallback(() => {
    dragStart.current  = null;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasImage = Boolean(localUrl);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[55]"
        onClick={() => !saving && onClose()}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 290 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#FDF9F6] rounded-t-[28px] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] flex-shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-40"
          >
            <X size={20} className="text-gray-600" />
          </button>
          <span className="font-black text-[16px] text-gray-900">Edit Cover Photo</span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={saving || (!didChange && localUrl === currentCoverUrl)}
            className="px-4 py-2 rounded-full text-[14px] font-bold text-white flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.3)' }}
          >
            {(saving || uploading) ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <><Check size={14} /> Save</>
            )}
          </motion.button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* ── Cover preview / drag area ── */}
          <div>
            <p className="text-[13px] font-semibold text-gray-500 mb-2 ml-0.5">
              {hasImage ? 'Drag to reposition' : 'No cover photo yet'}
            </p>

            <div
              ref={previewRef}
              className="relative w-full rounded-2xl overflow-hidden select-none"
              style={{
                aspectRatio: '3 / 1',
                background: `linear-gradient(135deg, ${gradientFrom}55 0%, ${gradientTo}44 50%, ${gradientFrom}33 100%)`,
                cursor: hasImage ? 'grab' : 'default',
                touchAction: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {hasImage && (
                <img
                  src={localUrl}
                  alt="Cover preview"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    objectFit: 'cover',
                    objectPosition: `${position.x}% ${position.y}%`,
                    opacity: 0.9,
                  }}
                  draggable={false}
                />
              )}

              {/* Drag hint overlay */}
              {hasImage && !dragStart.current && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                  <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                    <Move size={11} /> Drag to reposition
                  </span>
                </div>
              )}

              {/* Upload / Replace overlay when no image */}
              {!hasImage && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <ImagePlus size={28} strokeWidth={1.5} />
                  <span className="text-[12px] font-semibold">
                    {isCloudinaryConfigured ? 'Tap to upload a cover photo' : 'Cloudinary not configured'}
                  </span>
                </button>
              )}
            </div>

            {/* Position readout (subtle) */}
            {hasImage && (
              <p className="text-[11px] text-gray-400 text-right mt-1 mr-0.5">
                Position {Math.round(position.x)}% · {Math.round(position.y)}%
              </p>
            )}
          </div>

          {/* ── Action buttons ── */}
          <div className="flex flex-col gap-3">
            {/* Upload / Replace */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || !isCloudinaryConfigured}
              className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 active:bg-purple-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
              >
                <Camera size={18} className="text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">
                  {hasImage ? 'Replace cover photo' : 'Upload cover photo'}
                </div>
                <div className="text-xs text-gray-400">
                  {isCloudinaryConfigured ? 'JPEG · PNG · WebP' : 'Cloudinary is not configured'}
                </div>
              </div>
            </button>

            {/* Remove (only shown when there's a cover) */}
            {hasImage && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="flex items-center gap-3 p-4 rounded-2xl border border-red-100 hover:bg-red-50 active:bg-red-50 transition-colors disabled:opacity-40 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <div>
                  <div className="font-semibold text-red-600 text-sm">Remove cover photo</div>
                  <div className="text-xs text-gray-400">Returns to the default gradient</div>
                </div>
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          {/* Demo-mode hint */}
          {!isCloudinaryConfigured && (
            <p className="text-[12px] text-center text-gray-400 px-4">
              Cover repositioning works in demo mode. Add Cloudinary secrets to enable photo upload.
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
      </motion.div>
    </>
  );
}

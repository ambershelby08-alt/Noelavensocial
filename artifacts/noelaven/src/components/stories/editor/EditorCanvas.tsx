/**
 * EditorCanvas — the 9:16 media canvas with all gesture layers rendered on top.
 *
 * Responsibilities:
 *   • display the raw media (image or video) with optional CSS crop
 *   • render each TextLayer / StickerLayer via GestureLayer
 *   • show CropOverlay when cropMode is active
 *   • provide the canvasRef used by GestureLayer for % ↔ px conversion
 *   • deselect the active layer when the bare canvas is tapped
 */

import React, { useRef, type RefObject } from 'react';
import { GestureLayer } from './GestureLayer';
import { CropOverlay } from './CropOverlay';
import type { EditorState, EditorAction, EditorLayer, TextLayer } from './types';

// ─── Layer rendering helpers ──────────────────────────────────────────────────

function textLayerStyle(layer: TextLayer): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 24,
    fontWeight: layer.fontWeight,
    color: layer.color,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.25,
    padding: '4px 8px',
    borderRadius: 6,
    maxWidth: 240,
    textAlign: 'center',
    wordBreak: 'break-word',
  };

  switch (layer.layerStyle) {
    case 'bubble-dark':
      return { ...base, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' };
    case 'bubble-light':
      return { ...base, background: 'rgba(255,255,255,0.82)', color: layer.color === '#FFFFFF' ? '#000' : layer.color };
    case 'outlined':
      return {
        ...base,
        WebkitTextStroke: `2px ${layer.color === '#FFFFFF' ? '#000' : '#fff'}`,
        paintOrder: 'stroke fill',
        textShadow: 'none',
      };
    default: // 'plain'
      return {
        ...base,
        textShadow: '0 1px 6px rgba(0,0,0,0.6)',
      };
  }
}

function LayerContent({ layer }: { layer: EditorLayer }) {
  if (layer.kind === 'sticker') {
    return (
      <span style={{ fontSize: 48, display: 'block', lineHeight: 1, userSelect: 'none' }}>
        {layer.content}
      </span>
    );
  }
  return (
    <div style={textLayerStyle(layer)}>
      {layer.content}
    </div>
  );
}

// ─── EditorCanvas ─────────────────────────────────────────────────────────────

interface EditorCanvasProps {
  previewUrl: string;
  mediaType: 'image' | 'video';
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onUpdate: (id: string, patch: Partial<EditorLayer>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  /** Forwarded so GestureLayer can convert px ↔ % */
  canvasRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function EditorCanvas({
  previewUrl, mediaType, state, dispatch,
  onUpdate, onDelete, onSelect,
  canvasRef, videoRef,
}: EditorCanvasProps) {
  const { layers, selectedLayerId, cropMode, crop } = state;

  // CSS clip to apply the crop visually
  const cropClip: React.CSSProperties =
    crop && !cropMode
      ? {
          clipPath: `inset(${crop.y}% ${100 - crop.x - crop.w}% ${100 - crop.y - crop.h}% ${crop.x}%)`,
        }
      : {};

  return (
    <div
      ref={canvasRef}
      className="relative w-full overflow-hidden bg-black select-none"
      style={{ aspectRatio: '9/16', touchAction: 'none' }}
      onPointerDown={(e) => {
        // Deselect when tapping bare canvas (not a layer)
        if (e.target === canvasRef.current) onSelect(null);
      }}
    >
      {/* ── Media ── */}
      {mediaType === 'image' ? (
        <img
          src={previewUrl}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={cropClip}
          draggable={false}
          alt=""
        />
      ) : (
        <video
          ref={videoRef}
          src={
            state.trim
              ? `${previewUrl}#t=${state.trim.start},${state.trim.end}`
              : previewUrl
          }
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          autoPlay
          muted
          loop
          playsInline
        />
      )}

      {/* ── Gesture layers ── */}
      {layers.map((layer) => (
        <GestureLayer
          key={layer.id}
          layer={layer}
          selected={selectedLayerId === layer.id}
          canvasRef={canvasRef}
          onUpdate={(patch) => onUpdate(layer.id, patch)}
          onSelect={() => onSelect(layer.id)}
          onDelete={() => onDelete(layer.id)}
        >
          <LayerContent layer={layer} />
        </GestureLayer>
      ))}

      {/* ── Crop overlay (image only) ── */}
      {cropMode && (
        <CropOverlay
          crop={crop ?? { x: 10, y: 10, w: 80, h: 80 }}
          onChange={(c) => dispatch({ type: 'SET_CROP', crop: c })}
          onApply={() => dispatch({ type: 'SET_CROP_MODE', active: false })}
          onCancel={() => dispatch({ type: 'SET_CROP_MODE', active: false })}
        />
      )}
    </div>
  );
}

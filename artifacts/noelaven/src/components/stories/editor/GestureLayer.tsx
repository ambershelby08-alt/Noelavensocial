/**
 * GestureLayer — wraps text or sticker content and provides:
 *   • single-pointer drag  → updates x, y
 *   • two-pointer pinch    → updates scale
 *   • two-pointer twist    → updates rotation
 *   • double-tap           → fires onDoubleTap (for text edit)
 *
 * Uses the Pointer Events API so it works identically on mouse and touch.
 * Pointer capture ensures gestures continue even when the cursor leaves the element.
 *
 * Positions are percentages of the parent canvas so the spec is
 * resolution-independent.
 */

import React, { useRef, useCallback, type RefObject } from 'react';
import type { EditorLayer } from './types';

interface Pt { x: number; y: number }

interface GestureLayerProps {
  layer: EditorLayer;
  selected: boolean;
  canvasRef: RefObject<HTMLDivElement | null>;
  onUpdate: (patch: Partial<EditorLayer>) => void;
  onSelect: () => void;
  onDoubleTap?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}

const dist  = (a: Pt, b: Pt) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const angle = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
const mid   = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function GestureLayer({
  layer, selected, canvasRef,
  onUpdate, onSelect, onDoubleTap, onDelete, children,
}: GestureLayerProps) {
  /** All active pointers on this element */
  const ptrs = useRef(new Map<number, Pt>());

  /** Snapshot taken when a 2nd pointer lands — used as reference for each move frame */
  const twoFingerAnchor = useRef<{
    dist: number; angle: number; center: Pt;
    layerX: number; layerY: number; layerScale: number; layerRotation: number;
  } | null>(null);

  /** Snapshot taken when 1st pointer lands */
  const oneFingerAnchor = useRef<{
    ptrX: number; ptrY: number; layerX: number; layerY: number;
  } | null>(null);

  const lastTap = useRef(0);

  const canvasSize = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return { w: 1, h: 1 };
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }, [canvasRef]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    onSelect();

    if (ptrs.current.size === 1) {
      oneFingerAnchor.current = {
        ptrX: e.clientX, ptrY: e.clientY,
        layerX: layer.x, layerY: layer.y,
      };
      twoFingerAnchor.current = null;

      // Double-tap
      const now = Date.now();
      if (now - lastTap.current < 300) onDoubleTap?.();
      lastTap.current = now;
    }

    if (ptrs.current.size === 2) {
      oneFingerAnchor.current = null; // cancel single-finger drag
      const [a, b] = Array.from(ptrs.current.values()) as [Pt, Pt];
      twoFingerAnchor.current = {
        dist: dist(a, b), angle: angle(a, b), center: mid(a, b),
        layerX: layer.x, layerY: layer.y,
        layerScale: layer.scale, layerRotation: layer.rotation,
      };
    }
  }, [layer.x, layer.y, layer.scale, layer.rotation, onSelect, onDoubleTap]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w, h } = canvasSize();

    if (ptrs.current.size === 1 && oneFingerAnchor.current) {
      const dx = (e.clientX - oneFingerAnchor.current.ptrX) / w * 100;
      const dy = (e.clientY - oneFingerAnchor.current.ptrY) / h * 100;
      onUpdate({
        x: Math.min(100, Math.max(0, oneFingerAnchor.current.layerX + dx)),
        y: Math.min(100, Math.max(0, oneFingerAnchor.current.layerY + dy)),
      });
    }

    if (ptrs.current.size === 2 && twoFingerAnchor.current) {
      const [a, b] = Array.from(ptrs.current.values()) as [Pt, Pt];
      const anc = twoFingerAnchor.current;

      const curDist   = dist(a, b);
      const curAngle  = angle(a, b);
      const curCenter = mid(a, b);

      const scaleFactor = curDist / anc.dist;
      const angleDelta  = curAngle - anc.angle;
      const cdx = (curCenter.x - anc.center.x) / w * 100;
      const cdy = (curCenter.y - anc.center.y) / h * 100;

      onUpdate({
        scale:    Math.min(8, Math.max(0.15, anc.layerScale * scaleFactor)),
        rotation: anc.layerRotation + angleDelta,
        x:        Math.min(100, Math.max(0, anc.layerX + cdx)),
        y:        Math.min(100, Math.max(0, anc.layerY + cdy)),
      });
    }
  }, [canvasSize, onUpdate]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) twoFingerAnchor.current = null;
    if (ptrs.current.size === 0) oneFingerAnchor.current = null;
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${layer.x}%`,
        top:  `${layer.y}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
        transformOrigin: 'center center',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: selected ? 10 : 5,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}

      {/* Selection ring */}
      {selected && (
        <div style={{
          position: 'absolute', inset: '-5px',
          border: '1.5px dashed rgba(255,255,255,0.75)',
          borderRadius: 6, pointerEvents: 'none',
        }} />
      )}

      {/* Delete badge */}
      {selected && onDelete && (
        <button
          onPointerDown={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', top: -14, right: -14,
            width: 24, height: 24, borderRadius: '50%',
            background: '#ef4444', color: 'white',
            border: '2px solid white', fontSize: 15, lineHeight: '1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)', zIndex: 20,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

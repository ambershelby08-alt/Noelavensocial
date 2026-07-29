/**
 * CropOverlay — interactive crop rectangle drawn over the canvas.
 *
 * Provides 8 resize handles (corners + edge midpoints) plus body-drag.
 * All values are 0–100 percentages of canvas dimensions.
 */

import React, { useRef, useCallback } from 'react';

// Local rectangle type for the draggable crop overlay.
// Intentionally decoupled from the exported CropData (which is transform-based).
type CropRect = { x: number; y: number; w: number; h: number };
type Handle = 'tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'|'body';

interface CropOverlayProps {
  crop: CropRect;
  onChange: (c: CropRect) => void;
  onApply:  () => void;
  onCancel: () => void;
}

const MIN = 10;

export function CropOverlay({ crop, onChange, onApply, onCancel }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; sx: number; sy: number; sc: CropRect } | null>(null);

  const startDrag = useCallback((handle: Handle, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, sx: e.clientX, sy: e.clientY, sc: { ...crop } };
  }, [crop]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - drag.current.sx) / rect.width  * 100;
    const dy = (e.clientY - drag.current.sy) / rect.height * 100;
    const c  = { ...drag.current.sc };
    const h  = drag.current.handle;

    if (h === 'body') {
      c.x = Math.max(0, Math.min(100 - c.w, c.x + dx));
      c.y = Math.max(0, Math.min(100 - c.h, c.y + dy));
    } else {
      if (h === 'tl' || h === 'tc' || h === 'tr') {
        const ny = c.y + dy; const nh = c.h - dy;
        if (nh >= MIN) { c.y = ny; c.h = nh; }
      }
      if (h === 'bl' || h === 'bc' || h === 'br') {
        c.h = Math.max(MIN, c.h + dy);
      }
      if (h === 'tl' || h === 'ml' || h === 'bl') {
        const nx = c.x + dx; const nw = c.w - dx;
        if (nw >= MIN) { c.x = nx; c.w = nw; }
      }
      if (h === 'tr' || h === 'mr' || h === 'br') {
        c.w = Math.max(MIN, c.w + dx);
      }
      // clamp to canvas
      if (c.x < 0)        { c.w += c.x; c.x = 0; }
      if (c.y < 0)        { c.h += c.y; c.y = 0; }
      if (c.x + c.w > 100) c.w = 100 - c.x;
      if (c.y + c.h > 100) c.h = 100 - c.y;
    }
    onChange(c);
  }, [onChange]);

  const onPointerUp = useCallback(() => { drag.current = null; }, []);

  const { x, y, w, h } = crop;

  const hStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute', width: 22, height: 22,
    background: 'white', borderRadius: '50%',
    border: '2px solid rgba(0,0,0,0.25)',
    transform: 'translate(-50%,-50%)',
    cursor, touchAction: 'none',
    boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
    zIndex: 10,
  });

  const handles: [Handle, number, number, string][] = [
    ['tl', x,     y,     'nwse-resize'],
    ['tc', x+w/2, y,     'ns-resize'],
    ['tr', x+w,   y,     'nesw-resize'],
    ['ml', x,     y+h/2, 'ew-resize'],
    ['mr', x+w,   y+h/2, 'ew-resize'],
    ['bl', x,     y+h,   'nesw-resize'],
    ['bc', x+w/2, y+h,   'ns-resize'],
    ['br', x+w,   y+h,   'nwse-resize'],
  ];

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Full-canvas dim */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />

      {/* Crop box — cuts through the dim via box-shadow */}
      <div
        style={{
          position: 'absolute',
          left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          border: '2px solid white',
          boxSizing: 'border-box',
          cursor: 'move',
          touchAction: 'none',
        }}
        onPointerDown={(e) => startDrag('body', e)}
      >
        {/* Rule-of-thirds grid */}
        {[1/3, 2/3].map((p, i) => (
          <React.Fragment key={i}>
            <div style={{ position:'absolute', left:`${p*100}%`, top:0, bottom:0, width:1, background:'rgba(255,255,255,0.3)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:`${p*100}%`, left:0, right:0, height:1, background:'rgba(255,255,255,0.3)', pointerEvents:'none' }} />
          </React.Fragment>
        ))}
      </div>

      {/* Handles */}
      {handles.map(([handle, hx, hy, cursor]) => (
        <div
          key={handle}
          style={{ ...hStyle(cursor), left: `${hx}%`, top: `${hy}%` }}
          onPointerDown={(e) => startDrag(handle, e)}
        />
      ))}

      {/* Action buttons */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
        <button
          onClick={onCancel}
          className="px-6 py-2 rounded-full text-sm font-semibold text-white"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          className="px-6 py-2 rounded-full text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED)' }}
        >
          Apply Crop ✓
        </button>
      </div>
    </div>
  );
}

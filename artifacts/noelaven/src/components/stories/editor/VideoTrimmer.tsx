/**
 * VideoTrimmer — drag-handle timeline for trimming video start/end.
 * Syncs videoRef.currentTime as the user drags so they can preview the trim.
 */

import React, { useRef, useCallback } from 'react';
import type { TrimData } from './types';

interface VideoTrimmerProps {
  duration: number;
  trim: TrimData;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onChange: (t: TrimData) => void;
  onDone: () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoTrimmer({ duration, trim, videoRef, onChange, onDone }: VideoTrimmerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);
  const MIN_CLIP = 1;

  const toTime = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const r   = trackRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return pct * duration;
  }, [duration]);

  const startDrag = useCallback((handle: 'start' | 'end', e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = handle;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const t = toTime(e.clientX);
    if (dragging.current === 'start') {
      const ns = Math.max(0, Math.min(t, trim.end - MIN_CLIP));
      onChange({ ...trim, start: ns });
      if (videoRef.current) videoRef.current.currentTime = ns;
    } else {
      const ne = Math.min(duration, Math.max(t, trim.start + MIN_CLIP));
      onChange({ ...trim, end: ne });
      if (videoRef.current) videoRef.current.currentTime = ne;
    }
  }, [dragging, toTime, trim, duration, onChange, videoRef]);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  if (!duration) return null;

  const startPct = (trim.start / duration) * 100;
  const endPct   = (trim.end   / duration) * 100;
  const HANDLE   = 16;

  return (
    <div className="flex flex-col gap-2 px-4 py-3" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="flex items-center justify-between">
        <span className="text-white/70 text-xs font-semibold tracking-wide">Trim</span>
        <div className="flex gap-1.5 text-xs font-medium text-white/70">
          <span className="bg-white/10 px-2 py-0.5 rounded-md">{fmt(trim.start)}</span>
          <span className="text-white/30 self-center">–</span>
          <span className="bg-white/10 px-2 py-0.5 rounded-md">{fmt(trim.end)}</span>
          <span className="text-white/30 self-center">/ {fmt(duration)}</span>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-10 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      >
        {/* Left inactive */}
        <div style={{
          position:'absolute', left:0, top:0, bottom:0, width:`${startPct}%`,
          background:'rgba(0,0,0,0.55)', borderRadius:'12px 0 0 12px',
        }} />
        {/* Selected region */}
        <div style={{
          position:'absolute', left:`${startPct}%`, top:0, bottom:0,
          width:`${endPct - startPct}%`, border:'2px solid white', borderRadius:4,
        }} />
        {/* Right inactive */}
        <div style={{
          position:'absolute', right:0, top:0, bottom:0, width:`${100 - endPct}%`,
          background:'rgba(0,0,0,0.55)', borderRadius:'0 12px 12px 0',
        }} />

        {/* Start handle */}
        <div
          style={{
            position:'absolute', left:`${startPct}%`, top:0, bottom:0,
            width:HANDLE, transform:'translateX(-50%)',
            background:'white', borderRadius:4,
            cursor:'ew-resize', touchAction:'none',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
          onPointerDown={(e) => startDrag('start', e)}
        >
          <div style={{ width:2, height:16, background:'rgba(0,0,0,0.3)', borderRadius:1 }} />
        </div>

        {/* End handle */}
        <div
          style={{
            position:'absolute', left:`${endPct}%`, top:0, bottom:0,
            width:HANDLE, transform:'translateX(-50%)',
            background:'white', borderRadius:4,
            cursor:'ew-resize', touchAction:'none',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
          onPointerDown={(e) => startDrag('end', e)}
        >
          <div style={{ width:2, height:16, background:'rgba(0,0,0,0.3)', borderRadius:1 }} />
        </div>
      </div>

      <button
        onClick={onDone}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-white active:scale-[0.98] transition-transform mt-1"
        style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB)' }}
      >
        Done Trimming
      </button>
    </div>
  );
}

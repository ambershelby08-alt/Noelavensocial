/**
 * FloatingCallWindow — minimized call as a draggable picture-in-picture card.
 *
 * Rendered by AppShell when call.isMinimized === true.
 * The call continues uninterrupted during navigation; only the UI is collapsed.
 *
 * Drag behaviour: pointer-capture so drags work even if the pointer leaves the
 * element. Position is clamped to viewport bounds on every move.
 */
import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Mic, MicOff, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CallState } from '@/hooks/useWebRTC';

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const CARD_W = 148;
const CARD_H = 208;

interface Props {
  call: CallState;
  onEnd: () => void;
  onToggleMute: () => void;
  onRestore: () => void;
}

export function FloatingCallWindow({ call, onEnd, onToggleMute, onRestore }: Props) {
  // Start in the top-right corner with a small margin
  const [pos, setPos] = useState({ x: window.innerWidth - CARD_W - 16, y: 80 });
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Callback ref — applied at mount and whenever remoteStream changes ───────
  const setRemoteVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.srcObject = call.remoteStream ?? null;
  }, [call.remoteStream]);

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx   = e.clientX - drag.current.startX;
    const dy   = e.clientY - drag.current.startY;
    const maxX = window.innerWidth  - CARD_W - 8;
    const maxY = window.innerHeight - CARD_H - 8;
    setPos({
      x: Math.max(8, Math.min(maxX, drag.current.origX + dx)),
      y: Math.max(8, Math.min(maxY, drag.current.origY + dy)),
    });
  }, []);

  const onPointerUp = useCallback(() => { drag.current = null; }, []);

  // A quick tap (no drag) on the video area restores the full screen
  const tapStartPos = useRef<{ x: number; y: number } | null>(null);
  const onTapStart  = useCallback((e: React.PointerEvent) => {
    tapStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onTapEnd = useCallback((e: React.PointerEvent) => {
    if (!tapStartPos.current) return;
    const dx = Math.abs(e.clientX - tapStartPos.current.x);
    const dy = Math.abs(e.clientY - tapStartPos.current.y);
    tapStartPos.current = null;
    if (dx < 6 && dy < 6) onRestore();
  }, [onRestore]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      className="fixed z-[300] rounded-[20px] overflow-hidden shadow-2xl select-none touch-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: CARD_W,
        height: CARD_H,
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 2px rgba(255,255,255,0.13)',
        background: '#0a0a1a',
        cursor: 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* ── Video (remote) ──────────────────────────────────────────────────── */}
      {call.remoteStream && call.type === 'video' ? (
        <video
          ref={setRemoteVideo}
          autoPlay
          playsInline
          muted={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ pointerEvents: 'none' }}
        />
      ) : (
        /* Voice call or no video yet — dark gradient background */
        <div
          className="absolute inset-0 flex items-end justify-center pb-14"
          style={{ background: 'linear-gradient(160deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)' }}
        >
          <span className="text-white/50 text-[11px] font-semibold truncate px-2 text-center">
            {call.remoteName?.split(' ')[0] ?? 'Call'}
          </span>
        </div>
      )}

      {/* Gradient scrim over video so controls are readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)' }}
      />

      {/* ── Duration badge ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {call.isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-2.5 inset-x-0 text-center pointer-events-none"
          >
            <span className="text-[10px] text-white/75 font-mono tabular-nums bg-black/30 px-1.5 py-0.5 rounded-full">
              {fmtDuration(call.duration)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap zone — restore on quick tap, drag otherwise */}
      <div
        className="absolute inset-0"
        style={{ bottom: 56, cursor: 'grab' }}
        onPointerDown={onTapStart}
        onPointerUp={onTapEnd}
      />

      {/* ── Controls row ─────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-around px-3 pb-3.5 pt-1 pointer-events-auto">
        {/* Mute */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onToggleMute(); }}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            call.isMuted ? 'bg-[#111]/25' : 'bg-[#111]/12',
          )}
        >
          {call.isMuted
            ? <MicOff size={15} className="text-white" />
            : <Mic     size={15} className="text-white" />}
        </button>

        {/* Hang up */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEnd(); }}
          className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center"
          style={{ boxShadow: '0 4px 16px rgba(239,68,68,0.5)' }}
        >
          <PhoneOff size={15} className="text-white" />
        </button>

        {/* Restore / expand */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRestore(); }}
          className="w-10 h-10 rounded-full bg-[#111]/12 flex items-center justify-center"
        >
          <Maximize2 size={15} className="text-white" />
        </button>
      </div>
    </motion.div>
  );
}

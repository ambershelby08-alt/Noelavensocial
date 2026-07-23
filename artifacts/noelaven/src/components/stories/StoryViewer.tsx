/**
 * StoryViewer — full-screen story viewer.
 *
 * Progress bars:  images → 5 s fixed.  Videos → actual video duration.
 * Filter CSS:     applied from story.filterName via filterCSS().
 * Hold-to-pause:  single-finger hold pauses the progress bar.
 * Swipe-to-close: drag down ≥ 120 px dismisses.
 * Tap areas:      left 1/3 = prev, right 2/3 = next.
 * Layers:         text + sticker layers rendered as read-only overlays.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { filterCSS } from '@/components/stories/editor/filters';
import type { StoryGroup, Story } from '@/lib/stories';
import type { EditorLayer, TextLayer } from '@/components/stories/editor/types';

const PHOTO_DURATION_MS = 5000;

// ─── Layer rendering ──────────────────────────────────────────────────────────

function textBgStyle(style: TextLayer['layerStyle'], color: string): React.CSSProperties {
  switch (style) {
    case 'bubble-dark':  return { background: 'rgba(0,0,0,0.65)' };
    case 'bubble-light': return { background: 'rgba(255,255,255,0.82)', color: color === '#FFFFFF' ? '#000' : color };
    case 'outlined':     return { WebkitTextStroke: `2px ${color === '#FFFFFF' ? '#000' : '#fff'}`, paintOrder: 'stroke fill' };
    default:             return { textShadow: '0 1px 8px rgba(0,0,0,0.7)' };
  }
}

function StoryLayer({ layer }: { layer: EditorLayer }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: `${layer.x}%`, top: `${layer.y}%`,
    transform: `translate(-50%,-50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
    transformOrigin: 'center center',
    userSelect: 'none', pointerEvents: 'none', zIndex: 5,
  };
  if (layer.kind === 'sticker') {
    return <div style={base}><span style={{ fontSize: 48, display: 'block', lineHeight: 1 }}>{layer.content}</span></div>;
  }
  const tl = layer as TextLayer;
  return (
    <div style={base}>
      <div style={{
        fontSize: 24, fontWeight: tl.fontWeight, color: tl.color,
        whiteSpace: 'pre-wrap', lineHeight: 1.25, padding: '4px 8px',
        borderRadius: 6, textAlign: 'center', wordBreak: 'break-word', maxWidth: 240,
        ...textBgStyle(tl.layerStyle, tl.color),
      }}>
        {tl.content}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── StoryViewer ──────────────────────────────────────────────────────────────

interface StoryViewerProps {
  groups: StoryGroup[];
  initialGroupIdx?: number;
  onClose: () => void;
  onMarkViewed?: (storyId: string) => void;
}

export function StoryViewer({ groups, initialGroupIdx = 0, onClose, onMarkViewed }: StoryViewerProps) {
  const [groupIdx, setGroupIdx] = useState(Math.min(initialGroupIdx, groups.length - 1));
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused,   setPaused]   = useState(false);
  // Duration of the current segment in ms (set from video metadata for videos)
  const [segDurMs, setSegDurMs] = useState(PHOTO_DURATION_MS);

  const holdTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasHeld    = useRef(false);
  const videoRef   = useRef<HTMLVideoElement>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  // Mark viewed on story change
  useEffect(() => {
    if (story) onMarkViewed?.(story.id);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset duration to photo default whenever story changes;
  // videos update it once metadata loads.
  useEffect(() => {
    setSegDurMs(PHOTO_DURATION_MS);
  }, [groupIdx, storyIdx]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [group, storyIdx, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (groupIdx > 0) {
      const prev = groups[groupIdx - 1];
      setGroupIdx(g => g - 1);
      setStoryIdx(prev.stories.length - 1);
    }
  }, [storyIdx, groupIdx, groups]);

  // ── Hold-to-pause ───────────────────────────────────────────────────────────

  function startHold() {
    wasHeld.current = false;
    holdTimer.current = setTimeout(() => {
      wasHeld.current = true;
      setPaused(true);
      if (videoRef.current) videoRef.current.pause();
    }, 150);
  }

  function endHold(action?: () => void) {
    clearTimeout(holdTimer.current);
    if (wasHeld.current) {
      wasHeld.current = false;
      setPaused(false);
      videoRef.current?.play().catch(() => {});
    } else {
      action?.();
    }
  }

  function cancelHold() {
    clearTimeout(holdTimer.current);
    if (wasHeld.current) {
      wasHeld.current = false;
      setPaused(false);
      videoRef.current?.play().catch(() => {});
    }
  }

  if (!group || !story) return null;

  const cssFilt = story.filterName ? filterCSS(story.filterName) : 'none';
  const mediaSrc =
    story.mediaType === 'video' && story.trimData
      ? `${story.mediaUrl}#t=${story.trimData.start},${story.trimData.end}`
      : story.mediaUrl;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.25 }}
      onDragEnd={(_, info) => { if (info.offset.y > 120) onClose(); }}
      className="fixed inset-0 z-[80] bg-black flex flex-col select-none touch-none overflow-hidden"
    >
      {/* ── Media ── */}
      {story.mediaType === 'image' ? (
        <img
          key={story.id}
          src={story.mediaUrl}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ filter: cssFilt }}
          draggable={false}
          alt=""
        />
      ) : (
        <video
          key={story.id}
          ref={videoRef}
          src={mediaSrc}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ filter: cssFilt }}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            if (videoRef.current) {
              const dur = videoRef.current.duration;
              if (isFinite(dur) && dur > 0) setSegDurMs(dur * 1000);
            }
          }}
          onEnded={goNext}
        />
      )}

      {/* ── Editor layers ── */}
      {story.layers.map(layer => <StoryLayer key={layer.id} layer={layer} />)}

      {/* ── Top gradient + progress + author ── */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pb-5 pointer-events-none"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 44px)',
          paddingLeft: 12, paddingRight: 12,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }}
      >
        {/* Progress bars — one per story in this group */}
        <div className="flex gap-[3px] mb-3">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/30">
              {i < storyIdx ? (
                <div className="h-full w-full bg-white" />
              ) : i === storyIdx ? (
                <div
                  key={`${groupIdx}-${storyIdx}-${segDurMs}`}
                  className="h-full bg-white rounded-full"
                  style={{
                    animation: paused
                      ? 'none'
                      : `story-fill ${segDurMs}ms linear forwards`,
                    width: paused ? undefined : '0%',
                  }}
                  onAnimationEnd={goNext}
                />
              ) : null}
            </div>
          ))}
        </div>

        {/* Author row */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <GradientAvatar name={group.authorName} src={group.authorAvatarUrl || undefined} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{group.authorName}</p>
            <p className="text-white/60 text-xs">{relativeTime(story.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 active:bg-black/50 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Caption (fallback for old stories without layers) ── */}
      {story.caption && story.layers.length === 0 && (
        <div
          className="absolute bottom-10 left-0 right-0 px-5 pb-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)' }}
        >
          <p className="text-white text-sm font-medium text-center drop-shadow">{story.caption}</p>
        </div>
      )}

      {/* ── Tap areas ── */}
      <div className="absolute left-0 top-28 bottom-0 w-1/3 z-20"
           onPointerDown={startHold}
           onPointerUp={() => endHold(goPrev)}
           onPointerLeave={cancelHold} />
      <div className="absolute right-0 top-28 bottom-0 w-2/3 z-20"
           onPointerDown={startHold}
           onPointerUp={() => endHold(goNext)}
           onPointerLeave={cancelHold} />
    </motion.div>
  );
}

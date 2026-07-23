/**
 * StoryViewer — full-screen story viewer.
 *
 * Progress bars:  images → 5 s fixed.  Videos → actual video duration.
 * Filter CSS:     applied from story.filterName via filterCSS().
 * Crop transform: applied from story.cropData when present.
 * Hold-to-pause:  single-finger hold pauses the progress bar.
 * Swipe-to-close: drag down ≥ 120 px dismisses.
 * Tap areas:      left 1/3 = prev, right 2/3 = next.
 * Layers:         text + sticker layers rendered as read-only overlays.
 * Three-dot menu: visible only to the story owner — delete (with confirm) + save to device.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MoreVertical, Trash2, Download, AlertTriangle } from 'lucide-react';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { filterCSS } from '@/components/stories/editor/filters';
import type { StoryGroup, Story } from '@/lib/stories';
import type { EditorLayer, TextLayer, CropData } from '@/components/stories/editor/types';

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
        fontSize:   tl.fontSize ?? 24,
        fontWeight: tl.fontWeight,
        fontFamily: tl.fontFamily ?? 'system-ui, sans-serif',
        color:      tl.color,
        textAlign:  tl.textAlign ?? 'center',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.25,
        padding:    '4px 8px',
        borderRadius: 6,
        wordBreak: 'break-word', maxWidth: 240,
        ...textBgStyle(tl.layerStyle, tl.color),
      }}>
        {tl.content}
      </div>
    </div>
  );
}

// ─── Crop transform ───────────────────────────────────────────────────────────

function cropStyle(cropData: CropData | null): React.CSSProperties {
  if (!cropData) return {};
  return {
    transform: `translate(${cropData.x * 100}%, ${cropData.y * 100}%) scale(${cropData.scale})`,
    transformOrigin: 'center center',
  };
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

async function saveMediaToDevice(story: Story) {
  try {
    const res = await fetch(story.mediaUrl, { mode: 'cors' });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `story-${story.id}.${story.mediaType === 'video' ? 'mp4' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // CORS may prevent cross-origin save; open in new tab as fallback
    window.open(story.mediaUrl, '_blank');
  }
}

// ─── StoryViewer ──────────────────────────────────────────────────────────────

interface StoryViewerProps {
  groups:           StoryGroup[];
  initialGroupIdx?: number;
  currentUserId?:   string;
  onClose:          () => void;
  onMarkViewed?:    (storyId: string) => void;
  onDeleteStory?:   (storyId: string) => Promise<void>;
}

export function StoryViewer({
  groups,
  initialGroupIdx = 0,
  currentUserId,
  onClose,
  onMarkViewed,
  onDeleteStory,
}: StoryViewerProps) {
  const [groupIdx, setGroupIdx] = useState(Math.min(initialGroupIdx, Math.max(0, groups.length - 1)));
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused,   setPaused]   = useState(false);
  const [segDurMs, setSegDurMs] = useState(PHOTO_DURATION_MS);

  // Menu + delete state
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasHeld   = useRef(false);
  const videoRef  = useRef<HTMLVideoElement>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  // ── Guard against stale indices after groups change (e.g. after delete) ──
  useEffect(() => {
    if (groups.length === 0) { onClose(); return; }
    const clampedGroupIdx = Math.min(groupIdx, groups.length - 1);
    if (clampedGroupIdx !== groupIdx) {
      setGroupIdx(clampedGroupIdx);
      setStoryIdx(0);
      return;
    }
    const g = groups[clampedGroupIdx];
    if (!g || g.stories.length === 0) {
      if (clampedGroupIdx < groups.length - 1) {
        setGroupIdx(clampedGroupIdx + 1);
        setStoryIdx(0);
      } else {
        onClose();
      }
      return;
    }
    if (storyIdx >= g.stories.length) {
      setStoryIdx(g.stories.length - 1);
    }
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark viewed on story change
  useEffect(() => {
    if (story) onMarkViewed?.(story.id);
    setMenuOpen(false);
    setConfirmDel(false);
    setDeleteError(null);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset duration when story changes
  useEffect(() => { setSegDurMs(PHOTO_DURATION_MS); }, [groupIdx, storyIdx]);

  // Pause when menu/confirm is open
  useEffect(() => {
    if (menuOpen || confirmDel) {
      setPaused(true);
      videoRef.current?.pause();
    } else {
      setPaused(false);
      videoRef.current?.play().catch(() => {});
    }
  }, [menuOpen, confirmDel]);

  // ── Navigation ────────────────────────────────────────────────────────────

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

  // ── Hold-to-pause ─────────────────────────────────────────────────────────

  function startHold() {
    if (menuOpen || confirmDel) return;
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
      if (!menuOpen && !confirmDel) {
        setPaused(false);
        videoRef.current?.play().catch(() => {});
      }
    } else {
      action?.();
    }
  }

  function cancelHold() {
    clearTimeout(holdTimer.current);
    if (wasHeld.current) {
      wasHeld.current = false;
      if (!menuOpen && !confirmDel) {
        setPaused(false);
        videoRef.current?.play().catch(() => {});
      }
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!story || !onDeleteStory) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteStory(story.id);
      setConfirmDel(false);
      // Immediately advance — Firestore subscription will remove the deleted story
      // and the guard useEffect above will reconcile indices
      goNext();
    } catch {
      setDeleteError('Could not delete story. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Early return ──────────────────────────────────────────────────────────

  if (!group || !story) return null;

  const isOwner  = Boolean(currentUserId && story.authorId === currentUserId);
  const cssFilt  = story.filterName ? filterCSS(story.filterName) : 'none';
  const mediaSrc = story.mediaType === 'video' && story.trimData
    ? `${story.mediaUrl}#t=${story.trimData.start},${story.trimData.end}`
    : story.mediaUrl;

  const mediaStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
    filter: cssFilt,
    ...cropStyle(story.cropData),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.25 }}
      onDragEnd={(_, info) => { if (info.offset.y > 120 && !menuOpen && !confirmDel) onClose(); }}
      className="fixed inset-0 z-[80] bg-black flex flex-col select-none touch-none overflow-hidden"
    >
      {/* ── Media ── */}
      {story.mediaType === 'image' ? (
        <img key={story.id} src={story.mediaUrl} style={mediaStyle} draggable={false} alt="" />
      ) : (
        <video
          key={story.id}
          ref={videoRef}
          src={mediaSrc}
          style={mediaStyle}
          autoPlay playsInline muted
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
        {/* Progress bars */}
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
                    animation: paused ? 'none' : `story-fill ${segDurMs}ms linear forwards`,
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

          {/* Three-dot menu — owner only */}
          {isOwner && onDeleteStory && (
            <button
              onClick={() => setMenuOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 active:bg-black/50 transition-colors"
            >
              <MoreVertical size={18} className="text-white" />
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 active:bg-black/50 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Caption ── */}
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

      {/* ── Owner menu sheet ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="menu-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/50"
              onClick={() => setMenuOpen(false)}
            />
            {/* Sheet */}
            <motion.div
              key="menu-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="absolute bottom-0 left-0 right-0 z-40 bg-[#1C1C1E] rounded-t-3xl overflow-hidden"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-4" />

              {/* Delete Story */}
              <button
                onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                className="w-full flex items-center gap-3 px-6 py-4 active:bg-white/5 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-400" />
                </div>
                <span className="text-red-400 font-semibold text-[15px]">Delete Story</span>
              </button>

              {/* Save to Device */}
              <button
                onClick={() => { setMenuOpen(false); saveMediaToDevice(story); }}
                className="w-full flex items-center gap-3 px-6 py-4 active:bg-white/5 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                  <Download size={18} className="text-white/80" />
                </div>
                <span className="text-white font-semibold text-[15px]">Save to Device</span>
              </button>

              {/* Cancel */}
              <button
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center justify-center px-6 py-4 mt-1 border-t border-white/8 active:bg-white/5"
              >
                <span className="text-white/60 font-medium text-[15px]">Cancel</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ── */}
      <AnimatePresence>
        {confirmDel && (
          <>
            <motion.div
              key="confirm-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/60"
              onClick={() => !deleting && setConfirmDel(false)}
            />
            <motion.div
              key="confirm-box"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              className="absolute inset-x-6 top-1/2 z-40 -translate-y-1/2 bg-[#1C1C1E] rounded-2xl p-6"
            >
              <div className="flex flex-col items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-400" />
                </div>
                <h3 className="text-white font-bold text-lg text-center">Delete this story?</h3>
                <p className="text-white/50 text-sm text-center leading-relaxed">
                  This story will be permanently removed and won't be visible to anyone.
                </p>
                {deleteError && (
                  <p className="text-red-400 text-sm text-center font-medium">{deleteError}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDel(false)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold text-[15px] active:bg-white/20 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-[15px] active:bg-red-600 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Deleting…</>
                  ) : (
                    <>Delete</>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

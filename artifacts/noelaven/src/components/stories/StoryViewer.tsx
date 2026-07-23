import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import type { StoryGroup } from '@/lib/stories';

const STORY_DURATION_MS = 5000;

interface StoryViewerProps {
  groups: StoryGroup[];
  initialGroupIdx?: number;
  onClose: () => void;
  onMarkViewed?: (storyId: string) => void;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function StoryViewer({
  groups,
  initialGroupIdx = 0,
  onClose,
  onMarkViewed,
}: StoryViewerProps) {
  const [groupIdx, setGroupIdx] = useState(
    Math.min(initialGroupIdx, groups.length - 1),
  );
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused]     = useState(false);

  // Hold-to-pause detection
  const holdTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasHeld     = useRef(false);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  // Mark as viewed when story changes
  useEffect(() => {
    if (story) onMarkViewed?.(story.id);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ────────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [group, storyIdx, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(prevGroup.stories.length - 1);
    }
    // If at the very beginning, do nothing
  }, [storyIdx, groupIdx, groups]);

  // ── Hold-to-pause handlers ────────────────────────────────────────────────

  function startHold() {
    wasHeld.current = false;
    holdTimer.current = setTimeout(() => {
      wasHeld.current = true;
      setPaused(true);
    }, 150);
  }

  function endHold(action?: () => void) {
    clearTimeout(holdTimer.current);
    if (wasHeld.current) {
      wasHeld.current = false;
      setPaused(false);
    } else {
      action?.();
    }
  }

  function cancelHold() {
    clearTimeout(holdTimer.current);
    if (wasHeld.current) {
      wasHeld.current = false;
      setPaused(false);
    }
  }

  if (!group || !story) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.25 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120) onClose();
      }}
      className="fixed inset-0 z-[80] bg-black flex flex-col select-none touch-none overflow-hidden"
    >
      {/* ── Media ─────────────────────────────────────────────────────── */}
      {story.mediaType === 'image' ? (
        <img
          key={story.id}
          src={story.mediaUrl}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          alt=""
        />
      ) : (
        <video
          key={story.id}
          src={story.mediaUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          onEnded={goNext}
        />
      )}

      {/* ── Top gradient overlay ──────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pt-12 px-3 pb-6 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
      >
        {/* Progress bars */}
        <div className="flex gap-[3px] mb-3">
          {group.stories.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/30"
            >
              {i < storyIdx ? (
                // Fully seen
                <div className="h-full w-full bg-white" />
              ) : i === storyIdx ? (
                // Animating — re-mount via compound key resets the animation
                <div
                  key={`${groupIdx}-${storyIdx}`}
                  className="h-full bg-white rounded-full"
                  style={{
                    animation: paused
                      ? 'none'
                      : `story-fill ${STORY_DURATION_MS}ms linear forwards`,
                    width: paused ? undefined : '0%',
                  }}
                  onAnimationEnd={goNext}
                />
              ) : null /* future — empty bg */ }
            </div>
          ))}
        </div>

        {/* Author row */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <GradientAvatar
            name={group.authorName}
            src={group.authorAvatarUrl || undefined}
            size={36}
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              {group.authorName}
            </p>
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

      {/* ── Caption ───────────────────────────────────────────────────── */}
      {story.caption ? (
        <div
          className="absolute bottom-10 left-0 right-0 px-5 pb-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)' }}
        >
          <p className="text-white text-sm font-medium text-center drop-shadow">
            {story.caption}
          </p>
        </div>
      ) : null}

      {/* ── Tap / hold areas ──────────────────────────────────────────── */}
      {/* Previous (left third) */}
      <div
        className="absolute left-0 top-[80px] bottom-0 w-1/3 z-20"
        onPointerDown={startHold}
        onPointerUp={() => endHold(goPrev)}
        onPointerLeave={cancelHold}
      />
      {/* Next (right two-thirds) */}
      <div
        className="absolute right-0 top-[80px] bottom-0 w-2/3 z-20"
        onPointerDown={startHold}
        onPointerUp={() => endHold(goNext)}
        onPointerLeave={cancelHold}
      />
    </motion.div>
  );
}

/**
 * ReactionButton — Noelaven's signature reaction system.
 *
 * • Single tap  → toggle 🌊 Vibe (default reaction)
 * • Long press  → open full reaction tray (all 20 reactions)
 * • Count tap   → open ReactorsModal
 *
 * Special animations when a reaction is selected:
 *   🌊 Vibe     → ripple ring
 *   💜 Noelove  → purple glow + floating hearts
 *   ✨ Inspired → sparkle burst
 *   🔥 Fire     → flicker
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  REACTIONS, POSITIVE_REACTIONS, THOUGHTFUL_REACTIONS,
  DEFAULT_REACTION, getLabelForEmoji, getTopReactions, totalReactionCount,
} from '@/lib/reactions';
import { ReactorsModal } from '@/components/ui/ReactorsModal';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reactor {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

interface ReactionButtonProps {
  /** Map of emoji → [userId, …] */
  reactions: Record<string, string[]>;
  /** The emoji this user has already selected, or null */
  myReaction: string | null;
  /** Called when the user picks or removes a reaction */
  onReact: (emoji: string) => void;
  /** For ReactorsModal — resolves userId → display info */
  resolveUser?: (userId: string) => Reactor | undefined;
  /** Compact mode (comments/replies) — hides tray label row */
  compact?: boolean;
}

// ─── Special-effect overlays ──────────────────────────────────────────────────

function RippleEffect() {
  return (
    <motion.span
      className="absolute inset-0 rounded-full pointer-events-none"
      initial={{ opacity: 0.7, scale: 1 }}
      animate={{ opacity: 0, scale: 2.8 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)' }}
    />
  );
}

function FloatingHeart({ delay }: { delay: number }) {
  return (
    <motion.span
      className="absolute text-[14px] pointer-events-none select-none"
      style={{ left: `${30 + Math.random() * 40}%`, bottom: '100%' }}
      initial={{ opacity: 1, y: 0, scale: 0.8 }}
      animate={{ opacity: 0, y: -48, scale: 1.2, rotate: (Math.random() - 0.5) * 30 }}
      transition={{ delay, duration: 0.9, ease: 'easeOut' }}
    >
      💜
    </motion.span>
  );
}

function SparkleEffect() {
  const sparks = [0, 1, 2, 3, 4, 5];
  const angles = [0, 60, 120, 180, 240, 300];
  return (
    <>
      {sparks.map((i) => (
        <motion.span
          key={i}
          className="absolute text-[10px] pointer-events-none select-none"
          style={{ left: '50%', top: '50%' }}
          initial={{ opacity: 1, x: '-50%', y: '-50%', scale: 0 }}
          animate={{
            opacity: [1, 0],
            x: `calc(-50% + ${Math.cos((angles[i] * Math.PI) / 180) * 28}px)`,
            y: `calc(-50% + ${Math.sin((angles[i] * Math.PI) / 180) * 28}px)`,
            scale: [0, 1, 0],
          }}
          transition={{ delay: i * 0.04, duration: 0.55, ease: 'easeOut' }}
        >
          ✨
        </motion.span>
      ))}
    </>
  );
}

function FireFlicker() {
  return (
    <motion.span
      className="absolute inset-0 rounded-full pointer-events-none"
      animate={{ opacity: [0.3, 0.6, 0.2, 0.5, 0] }}
      transition={{ duration: 0.7, times: [0, 0.25, 0.5, 0.75, 1] }}
      style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.4) 0%, transparent 70%)' }}
    />
  );
}

function NoeloveGlow() {
  return (
    <motion.span
      className="absolute inset-0 rounded-full pointer-events-none"
      initial={{ opacity: 0.8, scale: 1 }}
      animate={{ opacity: 0, scale: 2.2 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.5) 0%, transparent 70%)' }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReactionButton({
  reactions,
  myReaction,
  onReact,
  resolveUser,
  compact = false,
}: ReactionButtonProps) {
  const [trayOpen, setTrayOpen] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [effectKey, setEffectKey] = useState(0);
  const [pendingEffect, setPendingEffect] = useState<string | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress   = useRef(false);
  const trayRef        = useRef<HTMLDivElement>(null);

  const total   = totalReactionCount(reactions);
  const topThree = getTopReactions(reactions, 3);
  const activeEmoji = myReaction ?? DEFAULT_REACTION.emoji;

  // ── Long-press detection ──────────────────────────────────────────────────
  const startLongPress = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setTrayOpen(true);
    }, 480);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePressEnd = useCallback(() => {
    cancelLongPress();
    if (!didLongPress.current) {
      // Regular tap → toggle default Vibe
      triggerReact(DEFAULT_REACTION.emoji);
    }
  }, [cancelLongPress]);

  // ── Trigger a reaction ────────────────────────────────────────────────────
  function triggerReact(emoji: string) {
    setTrayOpen(false);
    onReact(emoji);
    // Fire animation
    setPendingEffect(emoji);
    setEffectKey(k => k + 1);
    // Clear after animation completes
    setTimeout(() => setPendingEffect(null), 1000);
  }

  // ── Close tray on outside click ───────────────────────────────────────────
  useEffect(() => {
    if (!trayOpen) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setTrayOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [trayOpen]);

  // ── Special effect overlay ────────────────────────────────────────────────
  function renderEffect() {
    if (!pendingEffect) return null;
    switch (pendingEffect) {
      case '🌊': return <RippleEffect key={effectKey} />;
      case '💜': return (
        <React.Fragment key={effectKey}>
          <NoeloveGlow />
          {[0, 0.15, 0.3].map((d, i) => <FloatingHeart key={i} delay={d} />)}
        </React.Fragment>
      );
      case '✨': return <SparkleEffect key={effectKey} />;
      case '🔥': return <FireFlicker key={effectKey} />;
      default:   return null;
    }
  }

  // ── Reaction tray ─────────────────────────────────────────────────────────
  function ReactionTray() {
    return (
      <motion.div
        ref={trayRef}
        initial={{ opacity: 0, y: 12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.92 }}
        transition={{ type: 'spring', damping: 22, stiffness: 340 }}
        className="absolute bottom-full left-0 mb-2 z-[60] select-none"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="rounded-[22px] overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,248,255,0.98) 100%)',
            border: '1px solid rgba(139,92,246,0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Category label */}
          {!compact && (
            <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
              <span className="text-[10px] font-black tracking-[0.1em] uppercase text-purple-400">Positive</span>
              <div className="flex-1 h-px bg-purple-100" />
            </div>
          )}

          {/* Positive row */}
          <div className="flex px-2 pb-2 gap-0.5">
            {POSITIVE_REACTIONS.map((r, i) => (
              <TrayItem key={r.emoji} reaction={r} delay={i * 0.025} myReaction={myReaction} onSelect={triggerReact} compact={compact} />
            ))}
          </div>

          {/* Thoughtful label */}
          {!compact && (
            <div className="px-3 pb-1 flex items-center gap-2">
              <span className="text-[10px] font-black tracking-[0.1em] uppercase text-indigo-400">Thoughtful</span>
              <div className="flex-1 h-px bg-indigo-100" />
            </div>
          )}

          {/* Thoughtful row */}
          <div className="flex px-2 pb-2.5 gap-0.5">
            {THOUGHTFUL_REACTIONS.map((r, i) => (
              <TrayItem key={r.emoji} reaction={r} delay={(POSITIVE_REACTIONS.length + i) * 0.025} myReaction={myReaction} onSelect={triggerReact} compact={compact} />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Tray */}
      <AnimatePresence>
        {trayOpen && <ReactionTray />}
      </AnimatePresence>

      {/* Main reaction button */}
      <motion.button
        onPointerDown={startLongPress}
        onPointerUp={handlePressEnd}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        whileTap={{ scale: 0.84 }}
        className={cn(
          'relative flex items-center gap-1.5 text-[13px] font-bold px-3 py-1.5 rounded-full transition-all select-none',
          myReaction
            ? 'text-purple-600 bg-purple-50 ring-1 ring-purple-200'
            : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
        )}
        style={myReaction === '💜' ? {
          background: 'linear-gradient(135deg, #F5F0FF, #FDF0FF)',
          boxShadow: '0 0 0 1px rgba(167,139,250,0.4), 0 0 12px rgba(167,139,250,0.2)',
        } : undefined}
      >
        {/* Special effects overlay */}
        <AnimatePresence>{renderEffect()}</AnimatePresence>

        {/* Emoji: user's reaction or Vibe default */}
        <motion.span
          className="text-[15px] leading-none relative z-10"
          animate={myReaction ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: 0.28 }}
        >
          {activeEmoji}
        </motion.span>

        {/* Stacked top-reaction mini bubbles (when > 1 reaction type) */}
        {topThree.length > 1 && (
          <span className="flex -space-x-0.5 relative z-10">
            {topThree.slice(1, 3).map(r => (
              <span key={r.emoji} className="text-[11px] leading-none">{r.emoji}</span>
            ))}
          </span>
        )}

        {/* Count */}
        <span className="relative z-10 tabular-nums">{total > 0 ? total : getLabelForEmoji(DEFAULT_REACTION.emoji)}</span>
      </motion.button>

      {/* Reaction count pill — tap to open ReactorsModal */}
      {total > 0 && (
        <AnimatePresence>
          <motion.button
            key="count-pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setReactorsOpen(true)}
            className="hidden" // count already shown inside main button — only open modal via long-press / dedicated icon
          />
        </AnimatePresence>
      )}

      {/* Reactors modal */}
      <AnimatePresence>
        {reactorsOpen && (
          <ReactorsModal
            reactions={reactions}
            resolveUser={resolveUser}
            onClose={() => setReactorsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Individual tray item ──────────────────────────────────────────────────────

interface TrayItemProps {
  reaction: { emoji: string; label: string };
  delay: number;
  myReaction: string | null;
  onSelect: (emoji: string) => void;
  compact: boolean;
}

function TrayItem({ reaction, delay, myReaction, onSelect, compact }: TrayItemProps) {
  const [hovered, setHovered] = useState(false);
  const isActive = myReaction === reaction.emoji;

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 10, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', damping: 18, stiffness: 360 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip label */}
      <AnimatePresence>
        {hovered && !compact && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-1.5 whitespace-nowrap text-[10px] font-black text-white px-2 py-1 rounded-lg pointer-events-none z-10"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
          >
            {reaction.label}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.3, y: -6 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', damping: 16, stiffness: 400 }}
        onClick={() => onSelect(reaction.emoji)}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center text-[20px] transition-all',
          isActive
            ? 'bg-purple-100 ring-2 ring-purple-400 ring-offset-1'
            : 'hover:bg-purple-50'
        )}
      >
        {reaction.emoji}
      </motion.button>
    </motion.div>
  );
}

// ─── Compact reaction button (for comments / replies) ─────────────────────────

interface CommentReactionButtonProps {
  likes: number;
  liked: boolean;
  onToggle: () => void;
}

/**
 * Lightweight version for comments — just toggles 🌊 Vibe with a count.
 * No tray, no modal.
 */
export function CommentReactionButton({ likes, liked, onToggle }: CommentReactionButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1 text-[11.5px] font-bold transition-colors',
        liked ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'
      )}
    >
      <motion.span
        animate={liked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
        transition={{ duration: 0.22 }}
        className="text-[13px] leading-none"
      >
        {liked ? '🌊' : '🌊'}
      </motion.span>
      {likes > 0 && <span>{likes}</span>}
    </motion.button>
  );
}

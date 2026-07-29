/**
 * StoryViewer — full-screen story viewer.
 *
 * Progress bars:  images → 5 s fixed.  Videos → actual video duration.
 * Filter CSS:     applied from story.filterName via filterCSS().
 * Crop transform: applied from story.cropData when present.
 * Hold-to-pause:  single-finger hold pauses the progress bar.
 * Swipe-to-close: drag down ≥ 120 px dismisses.
 * Tap areas:      left 1/3 = prev, right 2/3 = next (stop 80 px from bottom).
 * Layers:         text + sticker layers rendered as read-only overlays.
 *
 * v2 features:
 * Reactions:      long-press the emoji pill at bottom → full Noelaven tray.
 *                 Tap your own reaction again → remove it.
 *                 Saved to stories/{storyId}/reactions/{userId}.
 * Comments:       Text input at bottom for non-owners (private, Instagram-style).
 *                 Saved to stories/{storyId}/comments/{commentId}.
 * Activity panel: Owner taps "👁 N" to see all viewers/reactions/comments.
 * Profile nav:    Author avatar + name → navigate to /profile/{uid}, close viewer.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MoreVertical, Trash2, Download, AlertTriangle, Eye, Send } from 'lucide-react';
import { useLocation } from 'wouter';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { filterCSS } from '@/components/stories/editor/filters';
import type { StoryGroup, Story, StoryReaction, StoryComment } from '@/lib/stories';
import {
  subscribeStoryReactions,
  toggleStoryReaction as fsToggleReaction,
  subscribeStoryComments,
  addStoryComment as fsAddComment,
} from '@/lib/stories';
import type { EditorLayer, TextLayer, CropData } from '@/components/stories/editor/types';
import { formatRelativeTime } from '@/lib/timestamp';
import { REACTIONS, getLabelForEmoji } from '@/lib/reactions';
import { writeNotification } from '@/lib/firestore';
import { notifyStoryView } from '@/lib/notifications';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/lib/mockData';

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
        fontSize:     tl.fontSize ?? 24,
        fontWeight:   tl.fontWeight,
        fontFamily:   tl.fontFamily ?? 'system-ui, sans-serif',
        color:        tl.color,
        textAlign:    tl.textAlign ?? 'center',
        whiteSpace:   'pre-wrap',
        lineHeight:   1.25,
        padding:      '4px 8px',
        borderRadius: 6,
        wordBreak:    'break-word', maxWidth: 240,
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

function relativeTime(date: unknown): string {
  const result = formatRelativeTime(date);
  return result.replace(' ago', '');
}

async function saveMediaToDevice(story: Story) {
  try {
    const res  = await fetch(story.mediaUrl, { mode: 'cors' });
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
    window.open(story.mediaUrl, '_blank');
  }
}

// ─── Reaction tray overlay ────────────────────────────────────────────────────

interface ReactionTrayProps {
  myReaction: string | null;
  onPick:     (emoji: string) => void;
  onClose:    () => void;
}

function StoryReactionTray({ myReaction, onPick, onClose }: ReactionTrayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      className="absolute bottom-[88px] left-0 right-0 z-[35] mx-3"
      // Stop drag propagation so the parent swipe-to-close doesn't fire
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Backdrop tap to close */}
      <div
        className="fixed inset-0 z-[-1]"
        onPointerDown={e => { e.stopPropagation(); onClose(); }}
      />
      <div className="bg-[#1C1C1E]/95 backdrop-blur-lg rounded-3xl p-4 shadow-2xl">
        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-3 text-center">Positive</p>
        <div className="grid grid-cols-6 gap-2 mb-3">
          {REACTIONS.filter(r => r.category === 'positive').map(r => (
            <button
              key={r.emoji}
              onPointerDown={e => { e.stopPropagation(); onPick(r.emoji); }}
              className={[
                'flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-all active:scale-90',
                myReaction === r.emoji ? 'bg-[#111]/20 ring-1 ring-white/30' : 'hover:bg-[#111]/10',
              ].join(' ')}
            >
              <span className="text-2xl leading-none">{r.emoji}</span>
              <span className="text-[8px] text-white/50 leading-none">{r.label}</span>
            </button>
          ))}
        </div>
        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-3 text-center">Thoughtful</p>
        <div className="grid grid-cols-4 gap-2">
          {REACTIONS.filter(r => r.category === 'thoughtful').map(r => (
            <button
              key={r.emoji}
              onPointerDown={e => { e.stopPropagation(); onPick(r.emoji); }}
              className={[
                'flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-all active:scale-90',
                myReaction === r.emoji ? 'bg-[#111]/20 ring-1 ring-white/30' : 'hover:bg-[#111]/10',
              ].join(' ')}
            >
              <span className="text-2xl leading-none">{r.emoji}</span>
              <span className="text-[9px] text-white/50 leading-none text-center">{r.label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Activity panel (owner only) ──────────────────────────────────────────────

interface ActivityPanelProps {
  reactions:   StoryReaction[];
  comments:    StoryComment[];
  viewerCount: number;
  onClose:     () => void;
  onGoProfile: (uid: string) => void;
}

function ActivityPanel({ reactions, comments, viewerCount, onClose, onGoProfile }: ActivityPanelProps) {
  // Build combined activity: merge reactions and comments by author
  const reactionMap = new Map(reactions.map(r => [r.userId, r.reactionType]));

  // All commenters + all reactors as a unified user list
  const userIds = Array.from(new Set([
    ...reactions.map(r => r.userId),
    ...comments.map(c => c.authorId),
  ]));

  // Group comments by author
  const commentsByAuthor = new Map<string, StoryComment[]>();
  for (const c of comments) {
    if (!commentsByAuthor.has(c.authorId)) commentsByAuthor.set(c.authorId, []);
    commentsByAuthor.get(c.authorId)!.push(c);
  }

  // Build display rows: prefer to show comment author info; fallback to reaction-only users
  interface ActivityRow {
    uid: string;
    name: string;
    avatar: string;
    reaction: string | null;
    latestComment: StoryComment | null;
  }

  const rows: ActivityRow[] = userIds.map(uid => {
    const commentList = commentsByAuthor.get(uid) ?? [];
    const latest = commentList.length > 0 ? commentList[commentList.length - 1] : null;
    // Try to get name/avatar from comments first, then from reactions
    const fromComment = comments.find(c => c.authorId === uid);
    return {
      uid,
      name:          fromComment?.authorName      ?? uid,
      avatar:        fromComment?.authorAvatarUrl ?? '',
      reaction:      reactionMap.get(uid) ?? null,
      latestComment: latest,
    };
  });

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="act-bd"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[36] bg-black"
        onPointerDown={e => { e.stopPropagation(); onClose(); }}
      />
      {/* Sheet */}
      <motion.div
        key="act-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 340 }}
        className="absolute bottom-0 left-0 right-0 z-[37] bg-[#1C1C1E] rounded-t-3xl overflow-hidden"
        style={{ maxHeight: '70dvh', paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#111]/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-white/50" />
            <span className="text-white font-semibold text-[15px]">{viewerCount} viewer{viewerCount !== 1 ? 's' : ''}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#111]/10 transition-colors">
            <X size={16} className="text-white/50" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70dvh - 80px)' }}>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Eye size={32} className="text-white/20" />
              <p className="text-white/40 text-sm">No reactions or comments yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {rows.map(row => (
                <div key={row.uid} className="flex items-start gap-3 px-5 py-3.5">
                  {/* Avatar → navigate to profile */}
                  <button
                    onClick={() => onGoProfile(row.uid)}
                    className="flex-shrink-0 mt-0.5"
                  >
                    <UserAvatar
                      userId={row.uid}
                      fallbackName={row.name}
                      fallbackSrc={row.avatar || undefined}
                      size={36}
                      className="ring-[1.5px] ring-white/20"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {/* Name → navigate to profile */}
                      <button
                        onClick={() => onGoProfile(row.uid)}
                        className="text-white font-semibold text-[13px] hover:underline truncate"
                      >
                        {row.name}
                      </button>
                      {row.reaction && (
                        <span className="text-base leading-none" title={getLabelForEmoji(row.reaction)}>
                          {row.reaction}
                        </span>
                      )}
                    </div>
                    {row.latestComment && (
                      <p className="text-white/60 text-[12.5px] leading-relaxed line-clamp-2">
                        "{row.latestComment.text}"
                      </p>
                    )}
                    {row.latestComment && (
                      <p className="text-white/30 text-[10px] mt-0.5">
                        {formatRelativeTime(row.latestComment.createdAt)}
                      </p>
                    )}
                    {!row.latestComment && row.reaction && (
                      <p className="text-white/40 text-[11px]">{getLabelForEmoji(row.reaction)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
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
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();

  const [groupIdx, setGroupIdx] = useState(Math.min(initialGroupIdx, Math.max(0, groups.length - 1)));
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused,   setPaused]   = useState(false);
  const [segDurMs, setSegDurMs] = useState(PHOTO_DURATION_MS);

  // Owner menu / delete
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reactions + comments (real-time)
  const [reactions,         setReactions]         = useState<StoryReaction[]>([]);
  const [comments,          setComments]          = useState<StoryComment[]>([]);
  const [showReactionTray,  setShowReactionTray]  = useState(false);
  const [showActivity,      setShowActivity]      = useState(false);
  const [commentText,       setCommentText]       = useState('');
  const [inputFocused,      setInputFocused]      = useState(false);
  const [sendingComment,    setSendingComment]    = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasHeld   = useRef(false);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const isOwner = Boolean(currentUserId && story?.authorId === currentUserId);

  const myReaction = reactions.find(r => r.userId === currentUserId) ?? null;

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
    if (storyIdx >= g.stories.length) setStoryIdx(g.stories.length - 1);
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark viewed on story change; reset overlays; notify story author
  useEffect(() => {
    if (story) {
      onMarkViewed?.(story.id);
      // Notify the story author that someone viewed their story (fire-and-forget).
      // Guard: only fire when Firebase is live and the viewer isn't the author.
      if (isFirebaseConfigured && currentUser && story.authorId && story.authorId !== currentUser.id) {
        notifyStoryView(story.authorId, currentUser as unknown as User, story.id).catch(() => {});
      }
    }
    setMenuOpen(false);
    setConfirmDel(false);
    setDeleteError(null);
    setShowReactionTray(false);
    setShowActivity(false);
    setCommentText('');
    setReactions([]);
    setComments([]);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset duration when story changes
  useEffect(() => { setSegDurMs(PHOTO_DURATION_MS); }, [groupIdx, storyIdx]);

  // Subscribe to reactions + comments for the current story.
  // Comments query is scoped by ownership: the story author sees all comments;
  // other viewers only see their own (Firestore rule enforcement).
  useEffect(() => {
    if (!story || !isFirebaseConfigured || !currentUserId) return;
    const unsubR = subscribeStoryReactions(story.id, setReactions);
    const unsubC = subscribeStoryComments(story.id, currentUserId, isOwner, setComments);
    return () => { unsubR(); unsubC(); };
  }, [story?.id, currentUserId, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause when any overlay blocks interaction
  useEffect(() => {
    const blocked = menuOpen || confirmDel || showReactionTray || showActivity || inputFocused;
    if (blocked) {
      setPaused(true);
      videoRef.current?.pause();
    } else {
      setPaused(false);
      videoRef.current?.play().catch(() => {});
    }
  }, [menuOpen, confirmDel, showReactionTray, showActivity, inputFocused]);

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
    if (menuOpen || confirmDel || showReactionTray || showActivity) return;
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
      goNext();
    } catch {
      setDeleteError('Could not delete story. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Reaction toggle ───────────────────────────────────────────────────────

  async function handleReact(emoji: string) {
    if (!currentUserId || !story) return;
    setShowReactionTray(false);

    const wasMyReaction = myReaction?.reactionType === emoji;

    // Optimistic update
    setReactions(prev => {
      const without = prev.filter(r => r.userId !== currentUserId);
      if (wasMyReaction) return without; // toggle off
      return [...without, { userId: currentUserId, reactionType: emoji, createdAt: new Date() }];
    });

    if (isFirebaseConfigured) {
      fsToggleReaction(story.id, currentUserId, emoji).catch(console.error);
      // Notify the author when adding a new reaction (not to own story)
      if (!isOwner && !wasMyReaction && currentUser) {
        writeNotification(
          story.authorId,
          'story_reaction',
          currentUser as unknown as User,
          {
            storyId: story.id,
            emoji,
            message: `${currentUser.displayName} reacted ${emoji} to your story`,
          },
        ).catch(console.error);
      }
    }
  }

  // ── Comment submit ────────────────────────────────────────────────────────

  async function handleSendComment() {
    const text = commentText.trim();
    if (!text || !currentUser || !story) return;
    setCommentText('');
    setSendingComment(true);

    // Optimistic comment — shown to commenter immediately
    const optimistic: StoryComment = {
      id:              `opt-${Date.now()}`,
      authorId:        currentUser.id,
      authorName:      currentUser.displayName,
      authorAvatarUrl: currentUser.avatarUrl ?? '',
      text,
      createdAt:       new Date(),
    };
    setComments(prev => [...prev, optimistic]);

    if (isFirebaseConfigured) {
      try {
        await fsAddComment(story.id, currentUser as unknown as User, text);
        writeNotification(
          story.authorId,
          'story_reply',
          currentUser as unknown as User,
          {
            storyId:  story.id,
            message:  `${currentUser.displayName} replied to your story`,
          },
        ).catch(console.error);
      } catch (e) {
        console.error('[StoryViewer] comment error', e);
        setComments(prev => prev.filter(c => c.id !== optimistic.id));
      }
    }
    setSendingComment(false);
  }

  // ── Navigate to author profile ────────────────────────────────────────────

  function goToProfile(uid: string) {
    onClose();
    navigate(`/profile/${uid}`);
  }

  // ── Early return ──────────────────────────────────────────────────────────

  if (!group || !story) return null;

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

  // Viewer count = total unique viewers who have reacted or commented (proxy;
  // true view count requires server-side counting or counting viewerIds)
  const uniqueInteractors = new Set([
    ...reactions.map(r => r.userId),
    ...comments.map(c => c.authorId),
  ]).size;

  // My last submitted comment (shown inline below the input for non-owners)
  const myLastComment = !isOwner
    ? [...comments].reverse().find(c => c.authorId === currentUserId)
    : null;

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
        if (info.offset.y > 120 && !menuOpen && !confirmDel && !showActivity && !showReactionTray) {
          onClose();
        }
      }}
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
            <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden bg-[#111]/30">
              {i < storyIdx ? (
                <div className="h-full w-full bg-[#111]" />
              ) : i === storyIdx ? (
                <div
                  key={`${groupIdx}-${storyIdx}-${segDurMs}`}
                  className="h-full bg-[#111] rounded-full"
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

        {/* Author row — avatar + name are clickable to navigate to profile */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* Avatar — clickable */}
          <button
            aria-label={`View ${group.authorName}'s profile`}
            onClick={() => goToProfile(group.authorId)}
            className="flex-shrink-0 rounded-full active:opacity-70 transition-opacity"
          >
            <UserAvatar
              userId={group.authorId}
              fallbackName={group.authorName}
              fallbackSrc={group.authorAvatarUrl || undefined}
              size={36}
              className="ring-2 ring-white/40"
            />
          </button>

          {/* Name + timestamp — name clickable */}
          <div className="flex-1 min-w-0">
            <button
              aria-label={`View ${group.authorName}'s profile`}
              onClick={() => goToProfile(group.authorId)}
              className="text-white font-semibold text-sm leading-tight hover:underline block text-left"
            >
              {group.authorName}
            </button>
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
          className="absolute left-0 right-0 px-5 pb-4 pointer-events-none z-10"
          style={{
            bottom: 88,
            background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
          }}
        >
          <p className="text-white text-sm font-medium text-center drop-shadow">{story.caption}</p>
        </div>
      )}

      {/* ── Tap areas (stop 88 px from bottom to leave room for bottom bar) ── */}
      <div className="absolute left-0 top-28 z-20" style={{ bottom: 88, width: '33%' }}
           onPointerDown={startHold}
           onPointerUp={() => endHold(goPrev)}
           onPointerLeave={cancelHold} />
      <div className="absolute right-0 top-28 z-20" style={{ bottom: 88, width: '67%' }}
           onPointerDown={startHold}
           onPointerUp={() => endHold(goNext)}
           onPointerLeave={cancelHold} />

      {/* ── Bottom bar (z-25, above tap areas) ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[25] pointer-events-auto"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* My latest comment preview (non-owner, shown above the input) */}
        {myLastComment && (
          <div className="px-4 mb-1.5">
            <div className="bg-[#111]/10 rounded-2xl px-3.5 py-2">
              <p className="text-white/90 text-[12.5px] leading-relaxed line-clamp-2">
                "{myLastComment.text}"
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 px-4 pt-2">
          {/* Reaction pill */}
          <button
            onPointerDown={e => {
              e.stopPropagation();
              // Long-press logic is handled by the tray toggle
            }}
            onClick={() => setShowReactionTray(v => !v)}
            className={[
              'flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all',
              myReaction
                ? 'bg-[#111]/25 ring-1 ring-white/30'
                : 'bg-black/40 hover:bg-black/60',
            ].join(' ')}
            aria-label="React to story"
          >
            <span className="text-xl leading-none">
              {myReaction ? myReaction.reactionType : '😊'}
            </span>
            {myReaction && (
              <span className="text-white text-[11px] font-semibold leading-none">
                {getLabelForEmoji(myReaction.reactionType)}
              </span>
            )}
          </button>

          {isOwner ? (
            // Owner: show unique interactor count + activity button
            <>
              <button
                onClick={() => setShowActivity(true)}
                className="flex items-center gap-1.5 flex-1 bg-black/40 hover:bg-black/60 rounded-full px-4 py-2 transition-all"
                aria-label="View story activity"
              >
                <Eye size={15} className="text-white/70 flex-shrink-0" />
                <span className="text-white/80 text-[13px]">
                  {story.viewerIds?.length ?? 0} viewer{(story.viewerIds?.length ?? 0) !== 1 ? 's' : ''}
                </span>
                {uniqueInteractors > 0 && (
                  <span className="ml-auto text-white/50 text-[11px]">
                    {reactions.length > 0 && `${reactions.length} reaction${reactions.length !== 1 ? 's' : ''}`}
                    {reactions.length > 0 && comments.length > 0 && ' · '}
                    {comments.length > 0 && `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
                  </span>
                )}
              </button>
            </>
          ) : (
            // Viewer: comment input + send
            <>
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={`Reply to ${group.authorName}…`}
                className="flex-1 bg-black/40 text-white placeholder:text-white/40 text-[13px] rounded-full px-4 py-2 outline-none border border-white/10 focus:border-white/30 transition-colors"
              />
              <button
                onClick={handleSendComment}
                disabled={!commentText.trim() || sendingComment}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[#111]/20 hover:bg-[#111]/30 active:scale-90 disabled:opacity-40 transition-all flex-shrink-0"
                aria-label="Send reply"
              >
                <Send size={15} className="text-white" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Reaction tray ── */}
      <AnimatePresence>
        {showReactionTray && (
          <StoryReactionTray
            myReaction={myReaction?.reactionType ?? null}
            onPick={handleReact}
            onClose={() => setShowReactionTray(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Activity panel (owner only) ── */}
      <AnimatePresence>
        {showActivity && (
          <ActivityPanel
            reactions={reactions}
            comments={comments}
            viewerCount={story.viewerIds?.length ?? 0}
            onClose={() => setShowActivity(false)}
            onGoProfile={uid => { setShowActivity(false); goToProfile(uid); }}
          />
        )}
      </AnimatePresence>

      {/* ── Owner menu sheet ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="menu-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/50"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              key="menu-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="absolute bottom-0 left-0 right-0 z-40 bg-[#1C1C1E] rounded-t-3xl overflow-hidden"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
            >
              <div className="w-10 h-1 rounded-full bg-[#111]/20 mx-auto mt-3 mb-4" />

              {/* Delete Story */}
              <button
                onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                className="w-full flex items-center gap-3 px-6 py-4 active:bg-[#111]/5 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-400" />
                </div>
                <span className="text-red-400 font-semibold text-[15px]">Delete Story</span>
              </button>

              {/* Save to Device */}
              <button
                onClick={() => { setMenuOpen(false); saveMediaToDevice(story); }}
                className="w-full flex items-center gap-3 px-6 py-4 active:bg-[#111]/5 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#111]/10 flex items-center justify-center">
                  <Download size={18} className="text-white/80" />
                </div>
                <span className="text-white font-semibold text-[15px]">Save to Device</span>
              </button>

              {/* View Activity (owner) */}
              <button
                onClick={() => { setMenuOpen(false); setShowActivity(true); }}
                className="w-full flex items-center gap-3 px-6 py-4 active:bg-[#111]/5 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#111]/10 flex items-center justify-center">
                  <Eye size={18} className="text-white/80" />
                </div>
                <span className="text-white font-semibold text-[15px]">View Activity</span>
              </button>

              {/* Cancel */}
              <button
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center justify-center px-6 py-4 mt-1 border-t border-white/8 active:bg-[#111]/5"
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
                  className="flex-1 py-3 rounded-xl bg-[#111]/10 text-white font-semibold text-[15px] active:bg-[#111]/20 disabled:opacity-40"
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

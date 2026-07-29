import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Share2, Bookmark, Heart,
  Image as ImageIcon, Smile, MapPin, Send,
  MoreHorizontal, Sparkles, X,
  Link as LinkIcon, Users, MessageSquare, Check,
  ChevronDown, Trash2, Flag, EyeOff, UserMinus,
  Edit2, MessageCircleOff, ClipboardCopy,
  Globe, Lock, UserCircle, Flame, VolumeX, UserX,
} from 'lucide-react';
import { ReactionButton, CommentReactionButton } from '@/components/ui/ReactionButton';
import { reactionPhrase, myReactionEmoji } from '@/lib/reactions';
import { useAuth } from '@/contexts/AuthContext';
import { dailySparks, mockUsers } from '@/lib/mockData';
import type { Post, User, SparkAudience } from '@/lib/mockData';
import { useFeed } from '@/hooks/useFeed';
import { useDailySpark, streakBadges, todayKeyET } from '@/hooks/useDailySpark';
import { useDailySparkStatus } from '@/contexts/DailySparkContext';
import { useSparkCommunity, type CommunitySort } from '@/hooks/useSparkCommunity';
import { useFollowerIds } from '@/hooks/useFollowerIds';
import { useStories } from '@/hooks/useStories';
import { StoriesRow } from '@/components/stories/StoriesRow';
import { StoryViewer } from '@/components/stories/StoryViewer';
import {
  StoryComposer, makeComposerId, type ComposerItem,
} from '@/components/stories/StoryComposer';
import { uploadImage, uploadStoryMedia, isCloudinaryConfigured } from '@/lib/cloudinary';
import {
  reportPost as fsReportPost, unfollowUser as fsUnfollowUser,
  subscribeComments as subscribePostComments,
  addComment as fsAddComment,
  toggleCommentReaction as fsToggleCommentReaction,
  toggleReplyReaction as fsToggleReplyReaction,
  subscribeReplies,
  addReply as fsAddReply,
  writeNotification as fsWriteNotification,
  sendMessage as fsSendMessage,
  recordSparkAnswer,
} from '@/lib/firestore';
import type { ReplyData } from '@/lib/firestore';
import { useConversations } from '@/hooks/useConversations';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { useSafety } from '@/contexts/SafetyContext';
import { ReportSheet } from '@/components/ui/ReportSheet';
import { Link } from 'wouter';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useUserProfile } from '@/contexts/UserCacheContext';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { FounderBadge } from '@/components/ui/FounderBadge';
import { useFollowingIds } from '@/hooks/useFollowingIds';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Re-export the project-wide utility so every caller in this file is safe.
import { formatRelativeTime } from '@/lib/timestamp';

// ─── Comment types ────────────────────────────────────────────────────────────

type CommentData = {
  id: string;
  authorId: string;
  author: User;
  text: string;
  reactions: Record<string, string[]>;
  replyCount: number;
  createdAt: Date;
};

const DEMO_COMMENTS: CommentData[] = [
  { id: 'c1', authorId: mockUsers[1].id, author: mockUsers[1], text: 'This is amazing! 🔥 Love the vibes.', reactions: { '🌊': [mockUsers[2].id, mockUsers[3].id], '🔥': [mockUsers[4].id] }, replyCount: 1, createdAt: new Date(Date.now() - 1800000) },
  { id: 'c2', authorId: mockUsers[3].id, author: mockUsers[3], text: 'Totally agree, so well done!', reactions: { '💜': [mockUsers[1].id] }, replyCount: 0, createdAt: new Date(Date.now() - 3600000) },
  { id: 'c3', authorId: mockUsers[4].id, author: mockUsers[4], text: 'Wow, you always inspire me ✨', reactions: {}, replyCount: 2, createdAt: new Date(Date.now() - 7200000) },
];

// ─── Overlay backdrop ─────────────────────────────────────────────────────────

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55]"
      onClick={onClose}
    />
  );
}

// ─── Comments Drawer ──────────────────────────────────────────────────────────

interface CommentsDrawerProps {
  post: Post;
  onClose: () => void;
  onCommentAdded: (postId: string) => void;
}

function CommentsDrawer({ post, onClose, onCommentAdded }: CommentsDrawerProps) {
  const { currentUser } = useAuth();
  const [text, setText] = useState('');
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Reply expansion state ───────────────────────────────────────────────────
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [commentReplies, setCommentReplies] = useState<ReplyData[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  // Subscribe to real Firestore comments (or use demo data)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setComments(DEMO_COMMENTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribePostComments(post.id, raw => {
      setComments(raw);
      setLoading(false);
    });
    return unsub;
  }, [post.id]);

  // Subscribe to replies for the expanded comment
  useEffect(() => {
    if (!expandedCommentId) { setCommentReplies([]); return; }
    if (!isFirebaseConfigured) {
      // Demo mode: synthesise a couple of placeholder replies so the UI is testable
      setCommentReplies([]);
      setRepliesLoading(false);
      return;
    }
    setRepliesLoading(true);
    const unsub = subscribeReplies(post.id, expandedCommentId, (replies) => {
      setCommentReplies(replies);
      setRepliesLoading(false);
    });
    return unsub;
  }, [post.id, expandedCommentId]);

  function toggleReplies(commentId: string) {
    if (expandedCommentId === commentId) {
      setExpandedCommentId(null);
      setCommentReplies([]);
    } else {
      // Clear stale replies immediately so the previous comment's data never
      // renders under this comment while the new subscription is loading.
      setCommentReplies([]);
      setExpandedCommentId(commentId);
      setRepliesLoading(true);
    }
  }

  function handleReactReply(commentId: string, replyId: string, emoji: string) {
    if (!currentUser) return;
    const reply = commentReplies.find(r => r.id === replyId);
    if (!reply) return;
    const current = reply.reactions ?? {};
    const hadThis = (current[emoji] ?? []).includes(currentUser.id);
    const updated: Record<string, string[]> = {};
    for (const [e, users] of Object.entries(current)) {
      const filtered = users.filter(id => id !== currentUser.id);
      if (filtered.length > 0) updated[e] = filtered;
    }
    if (!hadThis) updated[emoji] = [...(updated[emoji] ?? []), currentUser.id];
    setCommentReplies(prev => prev.map(r => r.id === replyId ? { ...r, reactions: updated } : r));
    if (isFirebaseConfigured) {
      fsToggleReplyReaction(post.id, commentId, replyId, currentUser.id, emoji).catch(console.error);
      // Notify the reply author (only when adding a reaction, not removing it)
      if (!hadThis && reply.authorId && reply.authorId !== currentUser.id) {
        fsWriteNotification(reply.authorId, 'reaction', currentUser as unknown as User, {
          postId: post.id,
          commentId,
          emoji,
          message: `${currentUser.displayName} reacted ${emoji} to your reply`,
        }).catch(console.error);
      }
    }
  }

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  async function submit() {
    if (!text.trim() || !currentUser) return;
    const body = text.trim();
    const target = replyingTo;
    setText('');
    setReplyingTo(null);

    if (target) {
      // ── Reply ──────────────────────────────────────────────────────────
      setComments(prev => prev.map(c => c.id === target.id ? { ...c, replyCount: c.replyCount + 1 } : c));
      onCommentAdded(post.id); // replies also count toward the post total
      if (isFirebaseConfigured) {
        fsAddReply(post.id, target.id, currentUser as unknown as User, body).catch(console.error);
        if (target.authorId !== currentUser.id) {
          fsWriteNotification(target.authorId, 'reply', currentUser as unknown as User, {
            postId: post.id,
            message: `${currentUser.displayName} replied to your comment`,
          }).catch(console.error);
        }
      } else {
        setComments(prev => [...prev, {
          id: `r-${Date.now()}`, authorId: currentUser.id,
          author: currentUser as unknown as User,
          text: `@${target.author.handle} ${body}`,
          reactions: {}, replyCount: 0, createdAt: new Date(),
        }]);
      }
    } else {
      // ── Top-level comment ──────────────────────────────────────────────
      onCommentAdded(post.id);
      if (isFirebaseConfigured) {
        fsAddComment(post.id, currentUser as unknown as User, body).catch(console.error);
        if (post.authorId !== currentUser.id) {
          fsWriteNotification(post.authorId, 'comment', currentUser as unknown as User, {
            postId: post.id,
            message: `${currentUser.displayName} commented: "${body.slice(0, 50)}${body.length > 50 ? '…' : ''}"`,
          }).catch(console.error);
        }
      } else {
        setComments(prev => [...prev, {
          id: `c-${Date.now()}`, authorId: currentUser.id,
          author: currentUser as unknown as User,
          text: body, reactions: {}, replyCount: 0, createdAt: new Date(),
        }]);
      }
    }
  }

  function handleReactComment(commentId: string, emoji: string) {
    if (!currentUser) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    const current = comment.reactions ?? {};
    const hadThis = (current[emoji] ?? []).includes(currentUser.id);
    // Optimistic — rebuild reactions map
    const updated: Record<string, string[]> = {};
    for (const [e, users] of Object.entries(current)) {
      const filtered = users.filter(id => id !== currentUser.id);
      if (filtered.length > 0) updated[e] = filtered;
    }
    if (!hadThis) updated[emoji] = [...(updated[emoji] ?? []), currentUser.id];
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, reactions: updated } : c));
    if (isFirebaseConfigured) {
      fsToggleCommentReaction(post.id, commentId, currentUser.id, emoji).catch(console.error);
      if (!hadThis && comment.authorId !== currentUser.id) {
        fsWriteNotification(comment.authorId, 'reaction', currentUser as unknown as User, {
          postId: post.id,
          commentId,
          emoji,
          message: `${currentUser.displayName} reacted ${emoji} to your comment`,
        }).catch(console.error);
      }
    }
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111] rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(80dvh, 80vh)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#222]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-[#222] flex-shrink-0">
          <span className="font-bold text-white text-[15px]">
            Comments{!loading && <span className="text-[rgba(255,255,255,0.45)] font-normal ml-1">({comments.length})</span>}
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
            <X size={18} className="text-[#BDBDBD]" />
          </button>
        </div>

        {/* Body — scrollable comment list */}
        {post.commentsDisabled ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-10 overflow-y-auto">
            <MessageCircleOff size={36} className="text-gray-200" />
            <p className="text-[14px] font-semibold text-[rgba(255,255,255,0.45)]">Comments are turned off</p>
            <p className="text-[12px] text-[rgba(255,255,255,0.35)] text-center leading-relaxed">The author has disabled comments on this post.</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center py-10 overflow-y-auto">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <MessageCircle size={32} className="text-gray-200" />
                <p className="text-[14px] text-[rgba(255,255,255,0.45)] font-medium">No comments yet</p>
                <p className="text-[12px] text-[rgba(255,255,255,0.35)]">Be the first to share your thoughts!</p>
              </div>
            ) : comments.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="flex gap-3"
              >
                <Link href={`/profile/${c.authorId}`} className="flex-shrink-0 mt-0.5">
                  <UserAvatar userId={c.authorId} fallbackName={c.author.displayName} fallbackSrc={c.author.avatarUrl || undefined} size={34} className="cursor-pointer hover:opacity-90 transition-opacity" />
                </Link>
                <div className="flex-1">
                  <div className="bg-[#111] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Link href={`/profile/${c.authorId}`}><p className="font-semibold text-[13px] text-white hover:underline">{c.author.displayName}</p></Link>
                      <FounderBadge userId={c.authorId} size="xs" />
                    </div>
                    <p className="text-[13.5px] text-[#BDBDBD] leading-relaxed">{c.text}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 px-1">
                    <span className="text-[11px] text-[rgba(255,255,255,0.45)]">{formatRelativeTime(c.createdAt)}</span>
                    <CommentReactionButton
                      reactions={c.reactions ?? {}}
                      myReaction={myReactionEmoji(c.reactions ?? {}, currentUser?.id ?? '')}
                      onReact={emoji => handleReactComment(c.id, emoji)}
                    />
                    <button
                      onClick={() => { setReplyingTo(c); setTimeout(() => inputRef.current?.focus(), 100); }}
                      className="text-[11px] text-[rgba(255,255,255,0.45)] font-semibold hover:text-[#F5C542] transition-colors"
                    >
                      Reply
                    </button>
                    {c.replyCount > 0 && (
                      <button
                        onClick={() => toggleReplies(c.id)}
                        className="text-[11px] text-[#F5C542] font-medium hover:text-[#F5C542] transition-colors flex items-center gap-0.5"
                      >
                        {expandedCommentId === c.id ? '▲' : '▼'}&nbsp;
                        {c.replyCount} {c.replyCount === 1 ? 'reply' : 'replies'}
                      </button>
                    )}
                  </div>

                  {/* ── Reply rows ──────────────────────────────────────── */}
                  {expandedCommentId === c.id && (
                    <div className="mt-2 ml-1 border-l-2 border-[rgba(245,197,66,0.2)] pl-3 space-y-2">
                      {repliesLoading && commentReplies.length === 0 ? (
                        <div className="py-1 flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-purple-400 rounded-full animate-spin" />
                          <span className="text-[11px] text-[rgba(255,255,255,0.45)]">Loading replies…</span>
                        </div>
                      ) : commentReplies.length === 0 ? (
                        <p className="text-[11px] text-[rgba(255,255,255,0.45)] py-1">No replies yet.</p>
                      ) : commentReplies.map(r => (
                        <div key={r.id} className="flex gap-2">
                          <Link href={`/profile/${r.authorId}`} className="flex-shrink-0 mt-0.5">
                            <UserAvatar userId={r.authorId} fallbackName={r.authorName} fallbackSrc={r.authorAvatar || undefined} size={26} className="cursor-pointer hover:opacity-90 transition-opacity" />
                          </Link>
                          <div className="flex-1">
                            <div className="bg-[rgba(245,197,66,0.08)]/60 rounded-2xl rounded-tl-sm px-3 py-2">
                              <Link href={`/profile/${r.authorId}`}>
                                <p className="font-semibold text-[12px] text-white hover:underline leading-tight">{r.authorName}</p>
                              </Link>
                              <p className="text-[12.5px] text-[#BDBDBD] leading-relaxed mt-0.5">{r.text}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1 px-1">
                              <span className="text-[10px] text-[rgba(255,255,255,0.45)]">{formatRelativeTime(r.createdAt)}</span>
                              <CommentReactionButton
                                reactions={r.reactions ?? {}}
                                myReaction={myReactionEmoji(r.reactions ?? {}, currentUser?.id ?? '')}
                                onReact={emoji => handleReactReply(c.id, r.id, emoji)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Composer — pinned above safe-area, always visible */}
        {!post.commentsDisabled && (
          <div
            className="px-4 pt-3 border-t border-[#222] flex-shrink-0"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
          >
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <MessageCircle size={12} className="text-[#EC4899] flex-shrink-0" />
                <span className="flex-1 text-[12px] text-[#EC4899] font-semibold truncate">
                  Replying to @{replyingTo.author.handle}
                </span>
                <button onClick={() => setReplyingTo(null)} className="p-0.5 rounded-full hover:bg-[#1a1a1a]">
                  <X size={13} className="text-[rgba(255,255,255,0.45)]" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2.5">
              {currentUser && <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={36} className="flex-shrink-0 mb-0.5" />}
              <div className="flex-1 bg-[#111] rounded-2xl px-3.5 py-2.5 flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  placeholder={replyingTo ? `Reply to ${replyingTo.author.displayName}…` : 'Add a kind comment… 💛'}
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-[14px] text-white placeholder:text-[#555] max-h-24"
                  style={{ lineHeight: '1.5' }}
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={submit}
                  disabled={!text.trim()}
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                    text.trim() ? 'text-white shadow-md' : 'bg-[#222] text-[rgba(255,255,255,0.45)]'
                  )}
                  style={text.trim() ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 3px 12px rgba(107,115,255,0.4)' } : {}}
                >
                  <Send size={14} />
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Share Sheet ──────────────────────────────────────────────────────────────

interface ShareSheetProps {
  post: Post;
  onClose: () => void;
  onShared: (postId: string) => void;
  onSendToChats?: () => void;
}

function ShareSheet({ post, onClose, onShared, onSendToChats }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(`https://noelaven.app/post/${post.id}`).catch(() => {});
    setCopied(true);
    onShared(post.id);
    setTimeout(() => { setCopied(false); onClose(); }, 1500);
  }

  const options = [
    {
      icon: copied ? Check : LinkIcon,
      label: copied ? 'Copied!' : 'Copy link',
      color: '#F5C542',
      bg: '#EEF0FF',
      action: copyLink,
    },
    {
      icon: Users,
      label: 'Share to Circles',
      color: '#F5C542',
      bg: '#F5EEF8',
      action: () => { onShared(post.id); onClose(); },
    },
    {
      icon: MessageSquare,
      label: 'Send via Chats',
      color: '#F5C542',
      bg: '#FFF0F6',
      action: () => { onSendToChats?.(); },
    },
    {
      icon: Sparkles,
      label: 'Spark it forward',
      color: '#FF8C42',
      bg: '#FFF4EE',
      action: () => { onShared(post.id); onClose(); },
    },
  ];

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111] rounded-t-[28px] shadow-2xl"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#222]" />
        </div>

        <div className="px-5 pb-2 pt-1">
          <p className="font-bold text-white text-[15px] mb-0.5">Share post</p>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] truncate">"{post.content.slice(0, 60)}…"</p>
        </div>

        <div className="grid grid-cols-4 gap-3 px-5 py-4">
          {options.map(({ icon: Icon, label, color, bg, action }) => (
            <motion.button
              key={label}
              whileTap={{ scale: 0.92 }}
              onClick={action}
              className="flex flex-col items-center gap-2"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ background: bg }}
              >
                <Icon size={22} style={{ color }} strokeWidth={2} />
              </div>
              <span className="text-[11px] text-[#BDBDBD] font-medium text-center leading-tight">{label}</span>
            </motion.button>
          ))}
        </div>

        <div className="px-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px] hover:bg-[#222] transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Daily Spark Response Modal ───────────────────────────────────────────────

// ─── Audience options ─────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: { value: SparkAudience; label: string; icon: React.ReactNode }[] = [
  { value: 'public',  label: 'Public',   icon: <Globe      size={11} /> },
  { value: 'mutuals', label: 'Mutuals',  icon: <Users      size={11} /> },
  { value: 'private', label: 'Followers', icon: <Lock       size={11} /> },
  { value: 'onlyMe',  label: 'Only Me',  icon: <UserCircle size={11} /> },
];

interface SparkModalProps {
  spark: string;
  onClose: () => void;
  onPosted: (content: string, imageUrl?: string, audience?: SparkAudience) => void;
}

function SparkModal({ spark, onClose, onPosted }: SparkModalProps) {
  const { currentUser } = useAuth();
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [posted, setPosted] = useState(false);
  const [audience, setAudience] = useState<SparkAudience>('public');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 300);
  }, []);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const url = await uploadImage(file, 'posts');
      setImageUrl(url);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  const canPost = text.trim().length > 0 || imageUrl.length > 0;

  function submit() {
    if (!canPost) return;
    setPosted(true);
    setTimeout(() => {
      onPosted(text.trim(), imageUrl || undefined, audience);
      onClose();
    }, 900);
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111] rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Hidden image input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageFile}
        />

        {/* ── Fixed top: handle + header + prompt ────────────────────────── */}
        <div className="flex-shrink-0">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[#222]" />
          </div>
          <div className="flex items-center justify-between px-5 pt-2 pb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
              >
                <Sparkles size={13} className="text-white" />
              </div>
              <span className="font-black text-white text-[15px]">Daily Spark</span>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
              <X size={18} className="text-[#BDBDBD]" />
            </button>
          </div>
          <div className="mx-5 mb-3 px-4 py-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #EEF0FF, #FFF0F6)' }}>
            <p className="text-[13px] font-semibold text-[#BDBDBD] mb-0.5">Today's prompt</p>
            <p className="text-[15px] font-bold text-white">"{spark}"</p>
          </div>
        </div>

        {/* ── Scrollable compose area ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0">
          <div className="flex gap-3">
            {currentUser && (
              <GradientAvatar
                name={currentUser.displayName}
                src={currentUser.avatarUrl || undefined}
                size={40}
                className="flex-shrink-0 mt-1"
              />
            )}
            <div className="flex-1 min-w-0">
              <textarea
                ref={textRef}
                value={text}
                onChange={e => setText(e.target.value.slice(0, 500))}
                placeholder="Share your spark with the world… ✨"
                rows={4}
                maxLength={500}
                className="w-full bg-[#111] rounded-2xl px-4 py-3 text-[14.5px] text-white placeholder:text-[#555] outline-none resize-none leading-relaxed"
              />
              {text.length > 400 && (
                <p className={`text-right text-[11px] font-medium mt-0.5 ${text.length >= 500 ? 'text-red-500' : 'text-amber-500'}`}>
                  {500 - text.length} left
                </p>
              )}

              {/* Image preview */}
              {imageUrl && (
                <div className="relative mt-2 rounded-2xl overflow-hidden">
                  <img src={imageUrl} alt="Attached" className="w-full max-h-52 object-cover rounded-2xl" />
                  <button
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X size={13} className="text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky footer: photo button + submit ───────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-3 border-t border-[#222]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          {/* Audience selector */}
          <div className="flex gap-1.5 mb-3">
            {AUDIENCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAudience(opt.value)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-bold transition-all flex-1 justify-center',
                  audience === opt.value ? 'text-white shadow-sm' : 'bg-[#1a1a1a] text-[#BDBDBD] hover:bg-[#222]'
                )}
                style={audience === opt.value ? { background: 'linear-gradient(135deg, #6B73FF, #9B59B6)' } : {}}
              >
                {opt.icon}
                <span className="ml-0.5">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Photo row — full-width tap target */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => isCloudinaryConfigured && imageInputRef.current?.click()}
            disabled={imageUploading || !isCloudinaryConfigured}
            className={cn(
              'w-full flex items-center gap-3 mb-3 px-4 py-3 rounded-2xl transition-colors',
              isCloudinaryConfigured ? 'bg-[#111] active:bg-[#1a1a1a]' : 'bg-[#111] opacity-50 cursor-not-allowed'
            )}
            title={isCloudinaryConfigured ? 'Add photo' : 'Image upload not configured'}
          >
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ImageIcon size={18} className={cn(imageUrl ? 'text-[#F5C542]' : 'text-[#F5C542]')} />
            </div>
            <span className={cn('text-[14px] font-semibold', imageUrl ? 'text-[#F5C542]' : 'text-[#BDBDBD]')}>
              {imageUrl ? 'Replace photo' : 'Add a photo'}
            </span>
            {imageUploading && (
              <div className="ml-auto w-4 h-4 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin" />
            )}
            {imageUrl && !imageUploading && (
              <span className="ml-auto text-[12px] text-[#F5C542] font-semibold">✓ Added</span>
            )}
          </motion.button>

          <AnimatePresence mode="wait">
            {posted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 bg-green-50 text-green-600 font-bold text-[15px]"
              >
                <Check size={18} />
                Spark posted! ✨
              </motion.div>
            ) : (
              <motion.button
                key="post"
                whileTap={{ scale: 0.97 }}
                onClick={submit}
                disabled={!canPost || imageUploading}
                className={cn(
                  'w-full py-3.5 rounded-2xl font-bold text-[15px] transition-all',
                  canPost && !imageUploading ? 'text-white shadow-lg' : 'bg-[#1a1a1a] text-[rgba(255,255,255,0.45)]'
                )}
                style={
                  canPost && !imageUploading
                    ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 4px 20px rgba(124,58,237,0.45)' }
                    : {}
                }
              >
                Share Your Spark ✨
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info';

const TOAST_STYLES: Record<ToastVariant, { bg: string; shadow: string }> = {
  success: { bg: 'linear-gradient(135deg, #C9982A, #F5C542)',  shadow: '0 8px 24px rgba(107,115,255,0.4)' },
  error:   { bg: 'linear-gradient(135deg, #FF5E5E, #FF8C42)',  shadow: '0 8px 24px rgba(255,94,94,0.4)'   },
  info:    { bg: 'linear-gradient(135deg, #6B73FF, #4F75FF)',  shadow: '0 8px 24px rgba(245,197,66,0.3)' },
};

function Toast({
  message,
  visible,
  variant = 'success',
}: {
  message: string;
  visible: boolean;
  variant?: ToastVariant;
}) {
  const s = TOAST_STYLES[variant];
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl text-white text-[13.5px] font-semibold shadow-xl flex items-center gap-2 max-w-[85vw]"
          style={{ background: s.bg, boxShadow: s.shadow }}
        >
          {variant === 'error' ? <X size={15} /> : <Check size={15} />}
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ─── Daily Spark ──────────────────────────────────────────────────────────────

interface DailySparkProps {
  onRespond: () => void;
  spark?: string;
  hasAnsweredToday: boolean;
  justCompleted: boolean;
  streak: number;
}

export function DailySpark({ onRespond, spark, hasAnsweredToday, justCompleted, streak }: DailySparkProps) {
  const [dismissed, setDismissed] = useState(false);

  if ((hasAnsweredToday && !justCompleted) || dismissed) return null;

  // ── Completion state ────────────────────────────────────────────────────────
  if (justCompleted) {
    return (
      <motion.div
        key="spark-done"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mx-4 mb-4 rounded-[24px] overflow-hidden"
        style={{ background: '#111', border: '1.5px solid #10B981', boxShadow: '0 0 20px rgba(16,185,129,0.15)' }}
      >
        <div className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
            <Check size={26} className="text-white" />
          </div>
          <div>
            <p className="font-black text-white text-[18px] leading-tight">Spark shared! ✨</p>
            <p className="text-[13px] text-[#BDBDBD] mt-0.5">
              {streak > 1 ? `🔥 ${streak}-day streak — keep it up!` : "You're on a roll!"}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Unanswered prompt card ───────────────────────────────────────────────────
  return (
    <motion.div
      key="spark-prompt"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="mx-4 mb-4 rounded-[24px] overflow-hidden"
      style={{ background: '#111', border: '1.5px solid #F5C542', boxShadow: '0 0 24px rgba(245,197,66,0.10)' }}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(245,197,66,0.12)', border: '1px solid rgba(245,197,66,0.22)' }}>
            <Sparkles size={12} style={{ color: '#F5C542' }} />
            <span className="text-[11px] font-black uppercase tracking-[0.10em]" style={{ color: '#F5C542' }}>
              Daily Spark
            </span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.22)' }}>
              <Flame size={12} className="text-orange-400" />
              <span className="text-[11px] font-bold text-orange-400">{streak} day streak</span>
            </div>
          )}
        </div>

        {/* Prompt text */}
        <p className="text-white text-[24px] font-black leading-[1.25] mb-6">
          {spark ?? dailySparks[0]}
        </p>

        {/* Action buttons */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onRespond}
            className="flex-1 py-3.5 rounded-full font-black text-[15px] text-white"
            style={{ background: 'linear-gradient(90deg, #EC4899, #F59E0B)', boxShadow: '0 4px 20px rgba(236,72,153,0.35)' }}
          >
            Answer Spark ✨
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setDismissed(true)}
            className="px-6 py-3.5 rounded-full font-black text-[15px] text-white"
            style={{ background: '#222' }}
          >
            Skip
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Spark Skeleton Card ──────────────────────────────────────────────────────

function SparkSkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <div
      className="mx-4 mb-4 bg-[#111] rounded-[24px] p-4 border border-[#1a1a1a] shadow-sm overflow-hidden"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center gap-3 mb-3.5">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-150 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-[#1a1a1a] animate-pulse rounded-full w-28" />
          <div className="h-2.5 bg-[#1a1a1a] animate-pulse rounded-full w-20" />
        </div>
      </div>
      {/* Content lines */}
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-[#1a1a1a] animate-pulse rounded-full w-full" />
        <div className="h-3 bg-[#1a1a1a] animate-pulse rounded-full w-[90%]" />
        <div className="h-3 bg-[#1a1a1a] animate-pulse rounded-full w-[70%]" />
      </div>
      {/* Action row */}
      <div className="flex gap-5 pt-3 border-t border-gray-50">
        <div className="h-3 bg-[#1a1a1a] animate-pulse rounded-full w-10" />
        <div className="h-3 bg-[#1a1a1a] animate-pulse rounded-full w-10" />
        <div className="h-3 bg-[#1a1a1a] animate-pulse rounded-full w-10" />
      </div>
    </div>
  );
}

// ─── Community Reveal ─────────────────────────────────────────────────────────

interface CommunityRevealProps {
  prompt: string;
  streak: number;
  memoryLane: import('@/hooks/useDailySpark').MemoryLaneEntry | null;
  currentUserId?: string;
  hasAnsweredToday: boolean;
  // Passed from parent (pre-warmed before user even answers)
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  timedOut: boolean;
  error: string | null;
  retry: () => void;
  onOpenComments: (post: Post) => void;
  onOpenShare: (post: Post) => void;
  onReact: (postId: string, emoji: string) => void;
  onOpenMenu: (post: Post) => void;
  onOpenPhoto: (src: string) => void;
}

function CommunityReveal({
  prompt, streak, memoryLane, currentUserId, hasAnsweredToday,
  posts, loading, hasMore, loadMore, timedOut, error, retry,
  onOpenComments, onOpenShare, onReact, onOpenMenu, onOpenPhoto,
}: CommunityRevealProps) {
  const [sort, setSort] = useState<CommunitySort>('everyone');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Scroll-based lazy loading — fires loadMore() when the sentinel enters the viewport.
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '300px' } // pre-load 300px before the user reaches the bottom
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  const SORT_TABS: { key: CommunitySort; label: string }[] = [
    { key: 'mutuals',   label: 'Mutuals'   },
    { key: 'following', label: 'Following' },
    { key: 'everyone',  label: 'Everyone'  },
  ];

  // ── Real-time following / follower lists for tab filtering ───────────────────
  // followingIds — UIDs the current user follows
  // followerIds  — UIDs who follow the current user back
  // Mutuals = followingIds ∩ followerIds (both follow each other)
  const followingIds = useFollowingIds(currentUserId);
  const followerIds  = useFollowerIds(currentUserId);

  // ── Audience-aware visibility gate ──────────────────────────────────────────
  //
  // useSparkCommunity returns 'public', 'mutuals', and 'private'-audience posts.
  // This function enforces the audience contract regardless of which tab is active:
  //
  //   public   → always visible to any viewer
  //   mutuals  → ONLY visible when the viewer is a mutual follow with the author
  //              (viewer follows author AND author follows viewer)
  //   private  → "Followers-only": visible when the viewer follows the author
  //              (one-way follow is sufficient — similar to Twitter/X private accounts)
  //
  // The tab filters then layer an author-relationship constraint ON TOP of this
  // gate — they never loosen it.
  function isVisible(p: Post): boolean {
    if (p.sparkAudience === 'public') return true;
    if (p.sparkAudience === 'mutuals') {
      return followingIds.has(p.authorId) && followerIds.has(p.authorId);
    }
    if (p.sparkAudience === 'private') {
      // "Followers-only" — visible to anyone who follows the author.
      return followingIds.has(p.authorId);
    }
    return false;
  }

  const allOthers = posts.filter(p => p.authorId !== currentUserId);

  const community = (() => {
    if (sort === 'everyone') {
      // Only public posts — mutuals-only posts are never shown here.
      return allOthers.filter(p => p.sparkAudience === 'public');
    }
    if (sort === 'following') {
      // Posts from followed authors that the viewer is authorized to see.
      // A mutuals-only post from a one-way follow is excluded by isVisible().
      return allOthers.filter(p => followingIds.has(p.authorId) && isVisible(p));
    }
    if (sort === 'mutuals') {
      // Posts from mutual authors. isVisible() is redundant here (both directions
      // required for mutual) but kept for clarity and future-proofing.
      return allOthers.filter(p => followingIds.has(p.authorId) && followerIds.has(p.authorId) && isVisible(p));
    }
    return allOthers.filter(p => p.sparkAudience === 'public');
  })();

  const featured = community.slice(0, 2);
  const rest     = community.slice(2);
  // Headline count: posts the current viewer can actually see (public posts
  // plus mutuals posts where the viewer has the mutual relationship),
  // plus the viewer's own post if they have answered today.
  const visibleOthers = allOthers.filter(p => isVisible(p));
  const total = visibleOthers.length + (hasAnsweredToday ? 1 : 0);

  const badges = streakBadges(streak);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* ── Unlock banner ───────────────────────────────────────────────────── */}
      <div
        className="mx-4 mb-5 px-4 py-4 rounded-[20px] flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(236,72,153,0.08))', border: '1px solid rgba(124,58,237,0.18)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
        >
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-[14px]">✨ Community responses unlocked!</p>
          <p className="text-[12px] text-[#BDBDBD] mt-0.5">
            {total > 1 ? `${total} people answered today's spark` : 'Be the first to inspire others!'}
          </p>
        </div>
        {streak > 1 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.25)' }}>
            <Flame size={12} className="text-orange-400" />
            <span className="text-orange-400 font-bold text-[12px]">{streak}</span>
          </div>
        )}
      </div>

      {/* ── Memory Lane ─────────────────────────────────────────────────────── */}
      {memoryLane && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-4 mb-4 px-4 py-3.5 rounded-[20px] flex items-start gap-3"
          style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.2)' }}
        >
          <span className="text-2xl leading-none mt-0.5">🌅</span>
          <div>
            <p className="text-[13px] font-bold" style={{ color: '#F5C542' }}>Memory Lane</p>
            <p className="text-[12px] text-[#BDBDBD] mt-0.5 leading-relaxed">
              You answered this same prompt {memoryLane.yearsAgo === 1 ? 'one year' : `${memoryLane.yearsAgo} years`} ago today!
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Streak badges ───────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <div className="px-4 mb-4 flex flex-wrap gap-2">
          {badges.map(b => (
            <span key={b} className="text-[11.5px] font-bold text-[#F5C542] bg-[rgba(245,197,66,0.08)] border border-[rgba(245,197,66,0.2)] px-3 py-1 rounded-full">
              {b}
            </span>
          ))}
        </div>
      )}

      {/* ── Section header + sort tabs ──────────────────────────────────────── */}
      <div className="px-4 mb-3">
        <h2 className="font-black text-[17px] text-white mb-3">Today's Community Sparks</h2>
        <div className="flex gap-2">
          {SORT_TABS.map(t => {
            const active = sort === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSort(t.key)}
                className="px-4 py-2 rounded-full text-[13px] font-bold transition-all"
                style={active
                  ? { border: '1.5px solid #EC4899', color: '#EC4899', background: 'rgba(236,72,153,0.08)' }
                  : { border: '1.5px solid #2a2a2a', color: 'rgba(255,255,255,0.45)', background: 'transparent' }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Responses ───────────────────────────────────────────────────────── */}
      {loading && community.length === 0 ? (
        (timedOut || error) ? (
          <div className="mx-4 mb-4 py-10 flex flex-col items-center gap-3 text-center">
            <span className="text-3xl">⏳</span>
            <p className="font-bold text-[#BDBDBD] text-[14px]">
              {error ? 'Could not load responses' : 'Taking longer than usual…'}
            </p>
            {error && import.meta.env.DEV && (
              <p className="text-[10.5px] text-red-400 font-mono max-w-[280px] break-all">{error}</p>
            )}
            <button
              onClick={retry}
              className="px-6 py-2.5 rounded-full text-[13px] font-bold text-white mt-1"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <SparkSkeletonCard index={0} />
            <SparkSkeletonCard index={1} />
          </>
        )
      ) : community.length === 0 ? (
        <div className="mx-4 mb-4 py-14 flex flex-col items-center gap-2 text-center">
          <span className="text-5xl mb-2">✨</span>
          <p className="font-bold text-[#BDBDBD] text-[15px]">
            {sort === 'everyone'
              ? 'No other responses yet'
              : sort === 'following'
              ? 'No responses from people you follow'
              : 'No responses from your mutuals yet'}
          </p>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)] max-w-[220px] leading-relaxed mt-1">
            {sort === 'everyone'
              ? "Share today's spark — invite your community!"
              : sort === 'following'
              ? 'Follow more people to see their sparks here.'
              : 'Mutuals are people you follow who also follow you back.'}
          </p>
        </div>
      ) : (
        <>
          {featured.map((post, idx) => (
            <PostCard
              key={post.id}
              post={post}
              index={idx}
              onOpenComments={onOpenComments}
              onOpenShare={onOpenShare}
              onReact={onReact}
              onSave={() => {}}
              onOpenMenu={onOpenMenu}
              onOpenPhoto={onOpenPhoto}
            />
          ))}
          {rest.length > 0 && (
            <>
              {featured.length > 0 && (
                <div className="px-4 my-2">
                  <span className="text-[10.5px] font-bold text-[rgba(255,255,255,0.35)] uppercase tracking-wider">More responses</span>
                </div>
              )}
              {rest.map((post, idx) => (
                <PostCard
                  key={post.id}
                  post={post}
                  index={featured.length + idx}
                  onOpenComments={onOpenComments}
                  onOpenShare={onOpenShare}
                  onReact={onReact}
                  onSave={() => {}}
                  onOpenMenu={onOpenMenu}
                  onOpenPhoto={onOpenPhoto}
                />
              ))}
            </>
          )}
          <div ref={sentinelRef} className="h-1 mt-1" aria-hidden />
        </>
      )}
    </motion.div>
  );
}

// ─── Post Composer ────────────────────────────────────────────────────────────

interface PostComposerProps {
  onPost: (content: string, imageUrl?: string, audience?: SparkAudience) => void;
}

export function PostComposer({ onPost }: PostComposerProps) {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [postAudience, setPostAudience] = useState<SparkAudience>('public');
  const [showAudiencePicker, setShowAudiencePicker] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canPost = content.trim().length > 0 || imageUrl.length > 0;

  function handlePost() {
    if (!canPost) return;
    onPost(content.trim(), imageUrl || undefined, postAudience);
    setContent('');
    setImageUrl('');
    setPostAudience('public');
    setShowAudiencePicker(false);
    setIsExpanded(false);
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const url = await uploadImage(file, 'posts');
      setImageUrl(url);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  return (
    <motion.div
      className="mx-4 mb-5 p-4 rounded-[24px] bg-[#111] border border-[#1a1a1a] transition-all duration-300"
      animate={{
        boxShadow: isExpanded
          ? '0 8px 32px rgba(107,115,255,0.10), 0 2px 8px rgba(0,0,0,0.04)'
          : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageFile}
      />

      <div className="flex gap-3">
        {currentUser && (
          <GradientAvatar
            name={currentUser.displayName}
            src={currentUser.avatarUrl || undefined}
            size={44}
            className="mt-0.5 flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <textarea
            placeholder="Share something kind… 💛"
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 500))}
            onFocus={() => setIsExpanded(true)}
            className="w-full bg-transparent resize-none outline-none text-white text-[15px] placeholder:text-[#555] min-h-[44px] pt-2.5 leading-relaxed"
            rows={isExpanded ? 3 : 1}
            maxLength={500}
          />
          {content.length > 400 && (
            <p className={`text-right text-[11px] font-medium mt-0.5 ${content.length >= 500 ? 'text-red-500' : 'text-amber-500'}`}>
              {500 - content.length} left
            </p>
          )}

          {/* Image preview */}
          {imageUrl && (
            <div className="relative mt-2 rounded-2xl overflow-hidden">
              <img src={imageUrl} alt="Post image" className="w-full max-h-64 object-cover rounded-2xl" />
              <button
                onClick={() => setImageUrl('')}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X size={13} className="text-white" />
              </button>
            </div>
          )}

          {/* Uploading indicator */}
          {imageUploading && (
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[rgba(255,255,255,0.45)]">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
              Uploading image…
            </div>
          )}

          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center justify-between mt-3 pt-3 border-t border-[#222]"
            >
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => isCloudinaryConfigured && imageInputRef.current?.click()}
                  disabled={imageUploading || !isCloudinaryConfigured}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    isCloudinaryConfigured ? 'hover:bg-[#111] cursor-pointer' : 'opacity-40 cursor-not-allowed'
                  )}
                  title={isCloudinaryConfigured ? 'Add image' : 'Image upload not configured'}
                >
                  <ImageIcon size={18} className={imageUrl ? 'text-[#F5C542]' : 'text-[#F5C542]'} />
                </button>
                <button className="p-2 hover:bg-[#111] rounded-full transition-colors" title="Add emoji">
                  <Smile size={18} className="text-yellow-400" />
                </button>
                <button className="p-2 hover:bg-[#111] rounded-full transition-colors" title="Add location">
                  <MapPin size={18} className="text-pink-400" />
                </button>
                {/* Audience picker */}
                <div className="relative ml-1.5">
                  <button
                    onClick={() => setShowAudiencePicker(v => !v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border border-[rgba(245,197,66,0.25)] text-[#F5C542] bg-[rgba(245,197,66,0.08)]/60 hover:bg-[rgba(245,197,66,0.15)] transition-colors"
                  >
                    {AUDIENCE_OPTIONS.find(o => o.value === postAudience)?.icon}
                    <span className="ml-0.5">{AUDIENCE_OPTIONS.find(o => o.value === postAudience)?.label}</span>
                    <ChevronDown size={10} className={cn('ml-0.5 transition-transform duration-150', showAudiencePicker && 'rotate-180')} />
                  </button>
                  <AnimatePresence>
                    {showAudiencePicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-full left-0 mb-1.5 bg-[#111] rounded-2xl shadow-xl border border-[#222] p-1.5 z-50 min-w-[130px]"
                      >
                        {AUDIENCE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => { setPostAudience(opt.value); setShowAudiencePicker(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors',
                              postAudience === opt.value ? 'bg-[rgba(245,197,66,0.08)] text-[#F5C542]' : 'text-[#BDBDBD] hover:bg-[#111]'
                            )}
                          >
                            {opt.icon}
                            <span>{opt.label}</span>
                            {postAudience === opt.value && <Check size={12} className="ml-auto text-[#F5C542]" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setContent(''); setImageUrl(''); setIsExpanded(false); }}
                  className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePost}
                  disabled={!canPost || imageUploading}
                  className={cn(
                    'px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-1.5',
                    (!canPost || imageUploading) && 'bg-[#1a1a1a] text-[rgba(255,255,255,0.45)]'
                  )}
                  style={
                    canPost && !imageUploading
                      ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', color: '#fff', boxShadow: '0 4px 14px rgba(245,197,66,0.35)' }
                      : {}
                  }
                >
                  <Send size={14} />
                  Post
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Post Menu ────────────────────────────────────────────────────────────────

type PostMenuStep = 'main' | 'confirmDelete' | 'confirmBlock' | 'confirmMute' | 'confirmUnfollow';

interface PostMenuProps {
  post: Post;
  isOwner: boolean;
  onClose: () => void;
  onDelete: (postId: string) => Promise<void>;
  onEdit: (post: Post) => void;
  onHide: (postId: string) => void;
  onSave: (postId: string, currentlySaved: boolean) => void;
  onOpenReport: () => void;
  onToggleComments: (postId: string, currentlyDisabled: boolean) => void;
  onUnfollow: (userId: string) => Promise<void>;
  isBlocked: boolean;
  isMuted: boolean;
  onBlock: () => Promise<void>;
  onMute: () => Promise<void>;
}

interface MenuRowProps {
  icon: React.ElementType;
  label: string;
  iconBg: string;
  iconColor: string;
  destructive?: boolean;
  onClick: () => void;
}
function MenuRow({ icon: Icon, label, iconBg, iconColor, destructive = false, onClick }: MenuRowProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-[#111] border-t border-gray-50 first:border-t-0"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        <Icon size={17} style={{ color: iconColor }} />
      </div>
      <span className={cn('text-[15px] font-medium flex-1 text-left', destructive ? 'text-red-500' : 'text-white')}>
        {label}
      </span>
    </motion.button>
  );
}

function PostMenu({
  post, isOwner, onClose,
  onDelete, onEdit, onHide, onSave,
  onOpenReport, onToggleComments, onUnfollow,
  isBlocked, isMuted, onBlock, onMute,
}: PostMenuProps) {
  const [step, setStep] = useState<PostMenuStep>('main');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(`https://noelaven.app/post/${post.id}`).catch(() => {});
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 1500);
  }

  async function handleDelete() {
    setLoading(true);
    await onDelete(post.id);
    setLoading(false);
    onClose();
  }

  async function handleUnfollow() {
    setLoading(true);
    await onUnfollow(post.authorId);
    setLoading(false);
    onClose();
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111] rounded-t-[28px] shadow-2xl"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#222]" />
        </div>

        {/* ── Main menu ────────────────────────────────────────────────── */}
        {step === 'main' && (
          <>
            <div className="flex items-center gap-3 px-5 pb-3">
              <UserAvatar userId={post.authorId} fallbackName={post.author.displayName} fallbackSrc={post.author.avatarUrl || undefined} size={38} />
              <div className="min-w-0">
                <p className="font-bold text-[14px] text-white truncate">{post.author.displayName}</p>
                <p className="text-[12px] text-[rgba(255,255,255,0.45)] line-clamp-1">{post.content.slice(0, 60)}{post.content.length > 60 ? '…' : ''}</p>
              </div>
            </div>
            <div className="border-t border-[#222]" />

            {isOwner ? (
              <>
                <MenuRow icon={Edit2}           label="Edit post"   iconBg="#EEF0FF" iconColor="#6B73FF" onClick={() => { onEdit(post); onClose(); }} />
                <MenuRow icon={Trash2}          label="Delete post" iconBg="#FFF0F0" iconColor="#FF5E5E" destructive onClick={() => setStep('confirmDelete')} />
                <MenuRow icon={Bookmark}        label={post.saved ? 'Unsave post' : 'Save post'} iconBg="#F5EEF8" iconColor="#9B59B6" onClick={() => { onSave(post.id, post.saved); onClose(); }} />
                <MenuRow
                  icon={post.commentsDisabled ? MessageCircle : MessageCircleOff}
                  label={post.commentsDisabled ? 'Turn comments on' : 'Turn comments off'}
                  iconBg="#F0F7FF" iconColor="#4F75FF"
                  onClick={() => { onToggleComments(post.id, post.commentsDisabled ?? false); onClose(); }}
                />
                <MenuRow icon={copied ? Check : ClipboardCopy} label={copied ? 'Copied!' : 'Copy link'} iconBg="#F3F4F6" iconColor="#6B7280" onClick={copyLink} />
              </>
            ) : (
              <>
                <MenuRow icon={Bookmark}  label={post.saved ? 'Unsave post' : 'Save post'} iconBg="#F5EEF8" iconColor="#9B59B6" onClick={() => { onSave(post.id, post.saved); onClose(); }} />
                <MenuRow icon={EyeOff}    label="Hide post"   iconBg="#F3F4F6" iconColor="#6B7280" onClick={() => { onHide(post.id); onClose(); }} />
                <MenuRow icon={VolumeX}   label={isMuted ? `Unmute @${post.author.handle}` : `Mute @${post.author.handle}`} iconBg="#EFF6FF" iconColor="#3B82F6" onClick={() => setStep('confirmMute')} />
                <MenuRow icon={UserX}     label={isBlocked ? `Unblock @${post.author.handle}` : `Block @${post.author.handle}`} iconBg="#FFF0F0" iconColor="#E74C3C" destructive onClick={() => setStep('confirmBlock')} />
                <MenuRow icon={Flag}      label="Report post" iconBg="#FFF0F0" iconColor="#FF5E5E" destructive onClick={() => { onOpenReport(); onClose(); }} />
                <MenuRow icon={UserMinus} label={`Unfollow @${post.author.handle}`} iconBg="#FFF8EE" iconColor="#FF8C42" destructive onClick={() => setStep('confirmUnfollow')} />
                <MenuRow icon={copied ? Check : ClipboardCopy} label={copied ? 'Copied!' : 'Copy link'} iconBg="#F3F4F6" iconColor="#6B7280" onClick={copyLink} />
              </>
            )}

            <div className="px-5 py-4">
              <button onClick={onClose} className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px] active:bg-[#222]">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── Confirm delete ───────────────────────────────────────────── */}
        {step === 'confirmDelete' && (
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 mb-5 pt-1">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-[16px] text-white">Delete this post?</p>
                <p className="text-[13px] text-[rgba(255,255,255,0.45)]">This action can't be undone.</p>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl mb-2.5 font-bold text-[15px] text-white bg-red-500 active:bg-red-600 flex items-center justify-center gap-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Trash2 size={16} />
              }
              Delete post
            </button>
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]">
              Cancel
            </button>
          </div>
        )}

        {/* ── Confirm block ──────────────────────────────────────────────── */}
        {step === 'confirmBlock' && (
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 mb-5 pt-1">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <UserX size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-[16px] text-white">{isBlocked ? 'Unblock' : 'Block'} @{post.author.handle}?</p>
                <p className="text-[13px] text-[rgba(255,255,255,0.45)]">{isBlocked ? 'They can see your content again.' : "They won't be able to see your posts or contact you."}</p>
              </div>
            </div>
            <button
              onClick={async () => { setLoading(true); await onBlock(); setLoading(false); onClose(); }}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl mb-2.5 font-bold text-[15px] text-white bg-red-500 active:bg-red-600 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserX size={16} />}
              {isBlocked ? 'Unblock' : 'Block'}
            </button>
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]">Cancel</button>
          </div>
        )}

        {/* ── Confirm mute ───────────────────────────────────────────────── */}
        {step === 'confirmMute' && (
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 mb-5 pt-1">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <VolumeX size={20} className="text-[#F5C542]" />
              </div>
              <div>
                <p className="font-bold text-[16px] text-white">{isMuted ? 'Unmute' : 'Mute'} @{post.author.handle}?</p>
                <p className="text-[13px] text-[rgba(255,255,255,0.45)]">{isMuted ? 'Their posts will reappear in your feed.' : "Their posts won't appear in your feed."}</p>
              </div>
            </div>
            <button
              onClick={async () => { setLoading(true); await onMute(); setLoading(false); onClose(); }}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl mb-2.5 font-bold text-[15px] text-white bg-blue-500 active:bg-blue-600 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <VolumeX size={16} />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]">Cancel</button>
          </div>
        )}

        {/* ── Confirm unfollow ─────────────────────────────────────────── */}
        {step === 'confirmUnfollow' && (
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 mb-5 pt-1">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                <UserMinus size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="font-bold text-[16px] text-white">Unfollow @{post.author.handle}?</p>
                <p className="text-[13px] text-[rgba(255,255,255,0.45)]">Their posts won't appear in your feed.</p>
              </div>
            </div>
            <button
              onClick={handleUnfollow}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl mb-2.5 font-bold text-[15px] text-white bg-orange-500 active:bg-orange-600 flex items-center justify-center gap-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <UserMinus size={16} />
              }
              Unfollow
            </button>
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]">
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Edit Post Sheet ──────────────────────────────────────────────────────────

interface EditPostSheetProps {
  post: Post;
  onSave: (postId: string, content: string, imageUrl: string | null) => void;
  onClose: () => void;
}

function EditPostSheet({ post, onSave, onClose }: EditPostSheetProps) {
  const { currentUser } = useAuth();
  const [content, setContent] = useState(post.content);
  const [imageUrl, setImageUrl] = useState(post.imageUrl ?? '');
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canSave = content.trim().length > 0 || imageUrl.length > 0;

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const url = await uploadImage(file, 'posts');
      setImageUrl(url);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  function handleSave() {
    if (!canSave) return;
    onSave(post.id, content.trim(), imageUrl || null);
    onClose();
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111] rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageFile}
        />

        {/* Handle + header */}
        <div className="flex-shrink-0">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[#222]" />
          </div>
          <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#222]">
            <button onClick={onClose} className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
              <X size={18} className="text-[#BDBDBD]" />
            </button>
            <span className="font-black text-[15px] text-white">Edit post</span>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={!canSave || imageUploading}
              className={cn(
                'px-4 py-1.5 rounded-full text-[13px] font-bold transition-all',
                canSave && !imageUploading ? 'text-white' : 'bg-[#1a1a1a] text-[rgba(255,255,255,0.45)]'
              )}
              style={canSave && !imageUploading ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' } : {}}
            >
              Save
            </motion.button>
          </div>
        </div>

        {/* Scrollable compose */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          <div className="flex gap-3">
            {currentUser && (
              <GradientAvatar
                name={currentUser.displayName}
                src={currentUser.avatarUrl || undefined}
                size={40}
                className="flex-shrink-0 mt-1"
              />
            )}
            <div className="flex-1 min-w-0">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={5}
                autoFocus
                className="w-full bg-transparent text-[14.5px] text-white placeholder:text-[#555] outline-none resize-none leading-relaxed"
              />
              {imageUrl && (
                <div className="relative mt-2 rounded-2xl overflow-hidden">
                  <img src={imageUrl} alt="Post" className="w-full max-h-52 object-cover rounded-2xl" />
                  <button
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X size={13} className="text-white" />
                  </button>
                </div>
              )}
              {imageUploading && (
                <div className="mt-2 flex items-center gap-2 text-[13px] text-[rgba(255,255,255,0.45)]">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                  Uploading…
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Photo row footer */}
        <div className="flex-shrink-0 px-5 pt-2 border-t border-[#222]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => isCloudinaryConfigured && imageInputRef.current?.click()}
            disabled={imageUploading || !isCloudinaryConfigured}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#111] active:bg-[#1a1a1a] transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ImageIcon size={18} className="text-[#F5C542]" />
            </div>
            <span className={cn('text-[14px] font-semibold', imageUrl ? 'text-[#F5C542]' : 'text-[#BDBDBD]')}>
              {imageUrl ? 'Replace photo' : 'Add a photo'}
            </span>
            {imageUrl && !imageUploading && (
              <span className="ml-auto text-[12px] text-[#F5C542] font-semibold">✓ Added</span>
            )}
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: Post;
  index: number;
  onOpenComments?: (post: Post) => void;
  onOpenShare?: (post: Post) => void;
  /** Called when the user picks or removes a reaction (emoji). */
  onReact?: (postId: string, emoji: string) => void;
  onSave?: (postId: string, newSaved: boolean) => void;
  /** Opens the post three-dot menu */
  onOpenMenu?: (post: Post) => void;
  /** Opens the full-screen photo viewer */
  onOpenPhoto?: (src: string) => void;
}

export function PostCard({ post, index, onOpenComments, onOpenShare, onReact, onSave, onOpenMenu, onOpenPhoto }: PostCardProps) {
  const [saved, setSaved] = useState(post.saved);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [sharesCount, setSharesCount] = useState(post.shares);

  // Live author name from the user cache — updates immediately when the author
  // renames themselves without any re-fetch of the post document.
  const cachedAuthor = useUserProfile(post.authorId);
  const authorDisplayName = cachedAuthor?.displayName ?? post.author.displayName;

  // Sync saved from Firestore updates
  useEffect(() => { setSaved(post.saved); }, [post.saved]);

  function handleSave() {
    const newSaved = !saved;
    setSaved(newSaved);
    onSave?.(post.id, newSaved);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.07, 0.35), duration: 0.3 }}
      className="mx-4 mb-4 p-4 rounded-[24px] bg-[#111] border border-[#1a1a1a] shadow-sm hover:shadow-md transition-all duration-200"
    >
      {/* Author */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.authorId}`}>
            <UserAvatar userId={post.authorId} fallbackName={post.author.displayName} fallbackSrc={post.author.avatarUrl || undefined} size={42} className="cursor-pointer hover:scale-105 transition-transform" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${post.authorId}`} className="font-bold text-[14px] text-white hover:underline">
                {authorDisplayName}
              </Link>
              <FounderBadge userId={post.authorId} size="sm" />
              {post.communityId && (
                <span className="text-[11px] font-semibold text-[#F5C542] bg-[rgba(245,197,66,0.08)] px-2 py-0.5 rounded-full">
                  Community
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[rgba(255,255,255,0.45)] font-medium mt-0.5">
              {formatRelativeTime(post.createdAt)}{post.mood && ` · Feeling ${post.mood}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => onOpenMenu?.(post)}
          className="p-1.5 hover:bg-[#111] rounded-full transition-colors"
        >
          <MoreHorizontal size={17} className="text-[rgba(255,255,255,0.45)]" />
        </button>
      </div>

      {/* Spark context badge */}
      {post.sparkPrompt && (
        <div className="mb-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl w-fit" style={{ background: 'linear-gradient(135deg, #EEF0FF, #FFF0F6)' }}>
          <Sparkles size={11} className="text-[#F5C542] flex-shrink-0" />
          <span className="text-[11.5px] font-semibold text-[#F5C542] truncate max-w-[230px]">"{post.sparkPrompt}"</span>
        </div>
      )}

      {/* Content */}
      <p className="text-[14.5px] leading-relaxed text-white mb-3 whitespace-pre-wrap">{post.content}</p>

      {post.imageUrl && (
        <div
          className="mb-3 overflow-hidden rounded-2xl cursor-pointer"
          onClick={() => onOpenPhoto?.(post.imageUrl!)}
        >
          <img src={post.imageUrl} alt="Post" className="w-full h-auto object-cover max-h-80" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <div className="flex items-center gap-0.5">
          {/* Reaction */}
          <ReactionButton
            reactions={post.reactions ?? {}}
            myReaction={post.myReaction ?? null}
            onReact={(emoji) => onReact?.(post.id, emoji)}
          />

          {/* Comment */}
          <button
            onClick={() => onOpenComments?.(post)}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-[rgba(255,255,255,0.45)] hover:bg-blue-50 hover:text-[#F5C542] transition-all"
          >
            <MessageCircle size={16} />
            <span>{commentsCount}</span>
          </button>

          {/* Share */}
          <button
            onClick={() => onOpenShare?.(post)}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-[rgba(255,255,255,0.45)] hover:bg-[rgba(245,197,66,0.08)] hover:text-[#F5C542] transition-all"
          >
            <Share2 size={16} />
            <span>{sharesCount}</span>
          </button>
        </div>

        {/* Save */}
        <motion.button
          whileTap={{ scale: 0.82 }}
          onClick={handleSave}
          className={cn(
            'p-2 rounded-full transition-all',
            saved ? 'text-[#F5C542] bg-[rgba(245,197,66,0.08)]' : 'text-[rgba(255,255,255,0.35)] hover:bg-[#111] hover:text-[#BDBDBD]'
          )}
        >
          <Bookmark size={16} className={cn(saved && 'fill-purple-500 stroke-purple-500')} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { currentUser } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = currentUser?.displayName.split(' ')[0] ?? 'there';

  const { posts, addPost, toggleReaction, toggleSave, deletePost, updatePost, hidePost, toggleCommentsDisabled } = useFeed();
  // unreadCount is shown in the global MobileHeader bell (AppShell) — not duplicated here
  // Single shared source of truth — reads from DailySparkContext which is
  // mounted once at app level.  Never calls useDailySpark directly here so
  // navigating away and back doesn't reset the answered state.
  const {
    prompt: sparkPrompt,
    hasAnsweredToday,
    statusConfirmed: sparkStatusConfirmed,
    streak,
    memoryLane,
    markAnswered,
  } = useDailySparkStatus();

  // Pre-warm the community cache as soon as we have a prompt — before the user
  // even answers today's spark.  When CommunityReveal mounts, the data is already
  // in the module-level memCache and renders with loading=false.
  const {
    posts: communityPosts,
    loading: communityLoading,
    hasMore: communityHasMore,
    loadMore: communityLoadMore,
    timedOut: communityTimedOut,
    error: communityError,
    retry: communityRetry,
  } = useSparkCommunity(sparkPrompt, !!sparkPrompt);

  const { groups: storyGroups, publishStory, markViewed, deleteStory } = useStories();

  // ── Story composer state ──────────────────────────────────────────────────
  // composerItems: files selected from the OS picker, passed into StoryComposer.
  // The picker fires from storyPickerRef.current.click() BEFORE StoryComposer
  // mounts, so no backdrop exists during selection → phantom clicks are impossible.
  const storyPickerRef = useRef<HTMLInputElement>(null);
  const [composerItems, setComposerItems] = useState<ComposerItem[]>([]);

  // After all stories publish, open StoryViewer for the user's own group.
  // We watch storyGroups reactively because Firestore may not have updated yet
  // by the time onAllPublished fires.
  const [openOwnStoriesAfterPublish, setOpenOwnStoriesAfterPublish] = useState(false);

  const { conversations: allConvs, openDirectConversation: _odc } = useConversations();
  const [convPickerPost, setConvPickerPost] = useState<Post | null>(null);
  const [convPickerSent, setConvPickerSent] = useState<Set<string>>(new Set());

  const [viewingGroupIdx, setViewingGroupIdx] = useState<number | null>(null);
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [sparkOpen, setSparkOpen] = useState(false);
  const [sparkJustCompleted, setSparkJustCompleted] = useState(false);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<{targetId: string; targetOwnerId: string; targetPreview?: string} | null>(null);
  const { blockedIds, mutedIds, isBlocked, isMuted, blockUser, muteUser } = useSafety();
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ src: string } | null>(null);
  const [toast, setToast] = useState('');
  const [toastVariant, setToastVariant] = useState<ToastVariant>('success');
  const [toastVisible, setToastVisible] = useState(false);

  // Auto-open SparkModal when navigated here with ?spark=1
  //
  // Race-condition fix: we MUST wait for `sparkStatusConfirmed` before reading
  // `hasAnsweredToday`.  Without this guard the empty-deps effect fires on
  // mount when `hasAnsweredToday` is still the initial `false` (the shared
  // context's localStorage read hasn't completed yet), opening the composer
  // even though the user already answered.
  //
  // `handledSparkParamRef` prevents firing more than once per mount even as
  // `sparkStatusConfirmed` changes on the first render cycle.
  const handledSparkParamRef = useRef(false);

  useEffect(() => {
    if (handledSparkParamRef.current) return;               // already handled this mount
    if (!window.location.search.includes('spark=1')) return; // no trigger param in URL
    if (!sparkStatusConfirmed) return;                       // wait until localStorage read completes

    handledSparkParamRef.current = true;
    window.history.replaceState({}, '', '/');
    if (!hasAnsweredToday) setSparkOpen(true);
    // If hasAnsweredToday is true, we intentionally do nothing — the Spark button
    // in AppShell already shows the "Already Answered" sheet before navigating,
    // so reaching here with hasAnsweredToday=true means the URL was typed manually
    // or the sheet was bypassed. Either way: do not open a blank composer.
  }, [sparkStatusConfirmed, hasAnsweredToday]);

  // After publishing, open StoryViewer for the user's own group.
  // We watch storyGroups reactively because the Firestore subscription may not
  // have delivered the new story yet when onAllPublished fires.
  useEffect(() => {
    if (!openOwnStoriesAfterPublish) return;
    const ownIdx = storyGroups.findIndex(g => g.isOwn);
    if (ownIdx >= 0) {
      setOpenOwnStoriesAfterPublish(false);
      setViewingGroupIdx(ownIdx);
    }
  }, [storyGroups, openOwnStoriesAfterPublish]);

  function showToast(msg: string, variant: ToastVariant = 'success') {
    setToast(msg);
    setToastVariant(variant);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }

  async function handleDeletePost(postId: string) {
    await deletePost(postId);
    showToast('Post deleted', 'info');
  }

  function handleEditPost(post: Post) {
    setEditPost(post);
  }

  function handleHidePost(postId: string) {
    hidePost(postId);
    showToast('Post hidden', 'info');
  }

  function handleSavePost(postId: string, currentlySaved: boolean) {
    toggleSave(postId, currentlySaved).catch(console.error);
    showToast(currentlySaved ? 'Post unsaved' : 'Post saved! 🔖');
  }

  function openReportSheet(post: Post) {
    setReportTarget({ targetId: post.id, targetOwnerId: post.authorId, targetPreview: post.content.slice(0, 120) });
    setMenuPost(null);
  }

  async function handleBlockUser(userId: string, handle: string) {
    await blockUser(userId);
    showToast(`@${handle} blocked`, 'info');
  }

  async function handleMuteUser(userId: string, handle: string) {
    await muteUser(userId);
    showToast(`@${handle} muted`, 'info');
  }

  function handleToggleComments(postId: string, currentlyDisabled: boolean) {
    toggleCommentsDisabled(postId, currentlyDisabled);
    showToast(currentlyDisabled ? 'Comments turned on' : 'Comments turned off', 'info');
  }

  async function handleUnfollowUser(userId: string) {
    if (isFirebaseConfigured && currentUser) {
      await fsUnfollowUser(currentUser.id, userId).catch(console.error);
    }
    showToast('Unfollowed', 'info');
  }

  function handleSaveEdit(postId: string, content: string, imageUrl: string | null) {
    updatePost(postId, content, imageUrl).catch(console.error);
    showToast('Post updated! ✨');
  }

  function handleNewPost(content: string, imageUrl?: string, audience?: SparkAudience) {
    if (!currentUser) return;
    addPost(content, { ...(imageUrl ? { imageUrl } : {}), postAudience: audience ?? 'public' }).catch(console.error);
    showToast('Post shared! ✨');
  }

  async function handleSparkPost(content: string, imageUrl?: string, audience?: SparkAudience) {
    if (!currentUser) return;
    // Client guard — the shared context is the primary protection.
    if (hasAnsweredToday) return;

    // Backend gate — write the deterministic gate doc BEFORE creating the post.
    // The Firestore transaction rejects duplicates server-side; Firestore rules
    // additionally enforce `create`-only (no overwrite).
    if (isFirebaseConfigured) {
      try {
        await recordSparkAnswer(currentUser.id, todayKeyET(), 'pending');
      } catch (gateErr) {
        const msg = String((gateErr as Error).message ?? '');
        if (msg === 'already_answered') {
          // Another device submitted simultaneously — sync local state and bail.
          markAnswered('done');
          showToast("You've already shared today's Spark! ✨");
          setSparkOpen(false);
          return;
        }
        // Network or other transient error — log but don't block the happy path.
        console.warn('[Spark] gate write non-fatal, proceeding:', gateErr);
      }
    }

    try {
      const postId = await addPost(content, {
        imageUrl,
        sparkPrompt,
        sparkAudience: audience ?? 'public',
      });
      markAnswered(postId ?? 'done');
      setSparkJustCompleted(true);
      // Brief "completed" card → then community reveal takes over
      setTimeout(() => setSparkJustCompleted(false), 2200);
      showToast('Spark shared with the world! ✨');
    } catch (err) {
      console.error('Spark post failed:', err);
      showToast('Failed to post spark — please try again.', 'error');
    }
  }

  function handleCommentAdded(_postId: string) {
    // Firestore listener updates the count; in demo mode the count is local only
  }

  function handleShared(_postId: string) {
    showToast('Shared! 🎉');
  }

  return (
    <div className="pb-24 min-h-screen">
      <Toast message={toast} visible={toastVisible} variant={toastVariant} />

      {/*
        Hidden story picker — fires BEFORE StoryComposer mounts.
        No backdrop exists while the OS dialog is open, so phantom clicks
        from dialog dismissal cannot close StoryComposer.
      */}
      <input
        ref={storyPickerRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          const items: ComposerItem[] = files.map(f => ({
            id:         makeComposerId(),
            file:       f,
            previewUrl: URL.createObjectURL(f),
            mediaType:  f.type.startsWith('video/') ? 'video' : 'image',
          }));
          setComposerItems(items);
          e.target.value = '';
        }}
      />

      <StoriesRow
        groups={storyGroups}
        onAddStory={() => {
          if (storyPickerRef.current) {
            storyPickerRef.current.value = '';
            storyPickerRef.current.click();
          }
        }}
        onViewGroup={(idx) => setViewingGroupIdx(idx)}
      />

      <AnimatePresence mode="wait">
        <DailySpark
          key="spark"
          onRespond={() => { if (!hasAnsweredToday) setSparkOpen(true); }}
          spark={sparkPrompt}
          hasAnsweredToday={hasAnsweredToday}
          justCompleted={sparkJustCompleted}
          streak={streak}
        />
      </AnimatePresence>

      {/* Community feed — shown as soon as we have a prompt (not gated behind answering).
          Everyone tab must display all public spark responses for today regardless of
          whether the current viewer has answered. The gate was previously `hasAnsweredToday`
          which meant Account B (who follows Account A) could never see Account A's public
          response until Account B also answered — confirmed root cause 2026-07-25. */}
      {!!sparkPrompt && (
        <CommunityReveal
          prompt={sparkPrompt}
          streak={streak}
          memoryLane={memoryLane}
          currentUserId={currentUser?.id}
          hasAnsweredToday={hasAnsweredToday}
          posts={communityPosts}
          loading={communityLoading}
          hasMore={communityHasMore}
          loadMore={communityLoadMore}
          timedOut={communityTimedOut}
          error={communityError}
          retry={communityRetry}
          onOpenComments={p => setCommentsPost(p)}
          onOpenShare={p => setSharePost(p)}
          onReact={(id, emoji) => toggleReaction(id, emoji).catch(console.error)}
          onOpenMenu={p => setMenuPost(p)}
          onOpenPhoto={src => setPhotoViewer({ src })}
        />
      )}

      <PostComposer onPost={handleNewPost} />

      <div>
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            index={index}
            onOpenComments={p => setCommentsPost(p)}
            onOpenShare={p => setSharePost(p)}
            onReact={(id, emoji) => {
              const isRemoving = post.myReaction === emoji;
              toggleReaction(id, emoji).catch(console.error);
              if (!isRemoving && post.authorId !== currentUser?.id && isFirebaseConfigured && currentUser) {
                fsWriteNotification(post.authorId, 'reaction', currentUser as unknown as User, {
                  postId: id,
                  message: `${currentUser.displayName} ${emoji} ${reactionPhrase(emoji)} your post`,
                }).catch(console.error);
              }
            }}
            onSave={(id, saved) => toggleSave(id, !saved).catch(console.error)}
            onOpenMenu={p => setMenuPost(p)}
            onOpenPhoto={src => setPhotoViewer({ src })}
          />
        ))}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {commentsPost && (
          <CommentsDrawer
            key="comments"
            post={commentsPost}
            onClose={() => setCommentsPost(null)}
            onCommentAdded={handleCommentAdded}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sharePost && !convPickerPost && (
          <ShareSheet
            key="share"
            post={sharePost}
            onClose={() => setSharePost(null)}
            onShared={handleShared}
            onSendToChats={() => {
              setConvPickerSent(new Set());
              setConvPickerPost(sharePost);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Conversation picker for "Send via Chats" ────────────────── */}
      <AnimatePresence>
        {convPickerPost && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
              onClick={() => { setConvPickerPost(null); setSharePost(null); }} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[75] bg-black rounded-t-[28px] shadow-2xl flex flex-col"
              style={{ maxHeight: '70vh' }}
              key="conv-picker"
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] flex-shrink-0">
                <button onClick={() => { setConvPickerPost(null); }}
                  className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
                  <X size={18} className="text-[#BDBDBD]" />
                </button>
                <span className="font-black text-[16px] text-white">Send to Chats</span>
                <button
                  disabled={convPickerSent.size === 0}
                  onClick={async () => {
                    if (!currentUser || !convPickerPost) return;
                    const sentCopy = new Set(convPickerSent);
                    for (const convId of sentCopy) {
                      if (isFirebaseConfigured) {
                        await fsSendMessage(convId, currentUser.id, '📌 Shared a post', 'post_share', {
                          sharedPost: {
                            postId: convPickerPost.id,
                            authorId: convPickerPost.authorId,
                            authorName: convPickerPost.author?.displayName ?? '',
                            content: convPickerPost.content,
                            imageUrl: convPickerPost.imageUrl ?? undefined,
                          }
                        });
                      }
                    }
                    setConvPickerPost(null);
                    setSharePost(null);
                    showToast(`Sent to ${sentCopy.size} chat${sentCopy.size > 1 ? 's' : ''}! 📌`);
                  }}
                  className={cn('text-[14px] font-black transition-colors', convPickerSent.size > 0 ? 'text-[#F5C542]' : 'text-[rgba(255,255,255,0.35)]')}
                >
                  Send{convPickerSent.size > 0 ? ` (${convPickerSent.size})` : ''}
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {allConvs.length === 0 ? (
                  <p className="text-center text-[rgba(255,255,255,0.45)] text-[14px] py-10">No conversations yet</p>
                ) : allConvs.map(conv => {
                  const other = conv.participants.find(p => p.id !== currentUser?.id) ?? conv.participants[0];
                  const name = conv.type === 'group' ? (conv.name ?? 'Group') : other.displayName;
                  const selected = convPickerSent.has(conv.id);
                  return (
                    <motion.button
                      key={conv.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setConvPickerSent(prev => {
                        const next = new Set(prev);
                        if (next.has(conv.id)) next.delete(conv.id); else next.add(conv.id);
                        return next;
                      })}
                      className={cn(
                        'w-full flex items-center gap-3.5 px-4 py-3 rounded-[18px] border transition-all text-left',
                        selected ? 'bg-[rgba(245,197,66,0.08)] border-[rgba(245,197,66,0.25)]' : 'bg-[#111] border-[#1a1a1a]'
                      )}
                    >
                      <UserAvatar userId={other.id} fallbackName={other.displayName} fallbackSrc={(other as any).avatarUrl || undefined} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[14.5px] text-white truncate">{name}</p>
                        <p className="text-[12px] text-[rgba(255,255,255,0.45)] truncate">{conv.lastMessage || 'No messages yet'}</p>
                      </div>
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        selected ? 'border-[#F5C542] bg-[#F5C542]' : 'border-gray-300'
                      )}>
                        {selected && <Check size={11} className="text-white" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sparkOpen && (
          <SparkModal
            key="spark-modal"
            spark={sparkPrompt}
            onClose={() => setSparkOpen(false)}
            onPosted={handleSparkPost}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menuPost && (
          <PostMenu
            key="post-menu"
            post={menuPost}
            isOwner={menuPost.authorId === currentUser?.id}
            onClose={() => setMenuPost(null)}
            onDelete={handleDeletePost}
            onEdit={handleEditPost}
            onHide={handleHidePost}
            onSave={handleSavePost}
            onOpenReport={() => openReportSheet(menuPost)}
            onToggleComments={handleToggleComments}
            onUnfollow={handleUnfollowUser}
            isBlocked={isBlocked(menuPost.authorId)}
            isMuted={isMuted(menuPost.authorId)}
            onBlock={() => handleBlockUser(menuPost.authorId, menuPost.author.handle)}
            onMute={() => handleMuteUser(menuPost.authorId, menuPost.author.handle)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editPost && (
          <EditPostSheet
            key="edit-post"
            post={editPost}
            onSave={handleSaveEdit}
            onClose={() => setEditPost(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {photoViewer && (
          <PhotoViewer
            key="photo-viewer"
            src={photoViewer.src}
            onClose={() => setPhotoViewer(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composerItems.length > 0 && (
          <StoryComposer
            key="story-composer"
            initialItems={composerItems}
            onCancel={() => setComposerItems([])}
            onPublishItem={async (item, editData, audience) => {
              let url: string          = item.previewUrl;
              let mediaType            = item.mediaType;
              let publicId: string | undefined;
              if (isCloudinaryConfigured) {
                const result = await uploadStoryMedia(item.file);
                url       = result.url;
                mediaType = result.mediaType;
                publicId  = result.publicId;
              }
              await publishStory(
                url, mediaType, '',
                editData.layers,
                editData.cropData,
                editData.trimData,
                editData.filterName,
                publicId,
                audience,
              );
            }}
            onAllPublished={() => {
              setComposerItems([]);
              // Open StoryViewer; if the Firestore update hasn't arrived yet,
              // openOwnStoriesAfterPublish will trigger as soon as it does.
              const ownIdx = storyGroups.findIndex(g => g.isOwn);
              if (ownIdx >= 0) {
                setViewingGroupIdx(ownIdx);
              } else {
                setOpenOwnStoriesAfterPublish(true);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingGroupIdx !== null && storyGroups.length > 0 && (
          <StoryViewer
            key="story-viewer"
            groups={storyGroups}
            initialGroupIdx={viewingGroupIdx}
            currentUserId={currentUser?.id}
            onClose={() => setViewingGroupIdx(null)}
            onMarkViewed={markViewed}
            onDeleteStory={deleteStory}
          />
        )}
      </AnimatePresence>

      {/* Report sheet — opened from post menu */}
      {reportTarget && currentUser && (
        <ReportSheet
          open
          targetId={reportTarget.targetId}
          targetType="post"
          targetOwnerId={reportTarget.targetOwnerId}
          targetPreview={reportTarget.targetPreview}
          reporterId={currentUser.id}
          onClose={() => setReportTarget(null)}
          onSubmitted={() => showToast('Report submitted. Thank you.', 'info')}
        />
      )}
    </div>
  );
}

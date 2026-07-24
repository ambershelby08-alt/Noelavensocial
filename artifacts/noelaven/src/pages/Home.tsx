import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Share2, Bookmark, Heart,
  Image as ImageIcon, Smile, MapPin, Send,
  Bell, MoreHorizontal, Sparkles, X,
  Link as LinkIcon, Users, MessageSquare, Check,
  ChevronDown, Trash2, Flag, EyeOff, UserMinus,
  Edit2, MessageCircleOff, ClipboardCopy,
  Globe, Lock, UserCircle, Flame, VolumeX, UserX,
} from 'lucide-react';
import { ReactionButton } from '@/components/ui/ReactionButton';
import { reactionPhrase } from '@/lib/reactions';
import { useAuth } from '@/contexts/AuthContext';
import { dailySparks, mockUsers } from '@/lib/mockData';
import type { Post, User, SparkAudience } from '@/lib/mockData';
import { useFeed } from '@/hooks/useFeed';
import { useDailySpark, streakBadges } from '@/hooks/useDailySpark';
import { useSparkCommunity, type CommunitySort } from '@/hooks/useSparkCommunity';
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
  toggleCommentLike as fsToggleCommentLike,
  addReply as fsAddReply,
  writeNotification as fsWriteNotification,
  sendMessage as fsSendMessage,
} from '@/lib/firestore';
import { useConversations } from '@/hooks/useConversations';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { useSafety } from '@/contexts/SafetyContext';
import { ReportSheet } from '@/components/ui/ReportSheet';
import { Link } from 'wouter';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { FounderBadge } from '@/components/ui/FounderBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Comment types ────────────────────────────────────────────────────────────

type CommentData = {
  id: string;
  authorId: string;
  author: User;
  text: string;
  likes: number;
  liked: boolean;
  replyCount: number;
  createdAt: Date;
};

const DEMO_COMMENTS: CommentData[] = [
  { id: 'c1', authorId: mockUsers[1].id, author: mockUsers[1], text: 'This is amazing! 🔥 Love the vibes.', likes: 3, liked: false, replyCount: 1, createdAt: new Date(Date.now() - 1800000) },
  { id: 'c2', authorId: mockUsers[3].id, author: mockUsers[3], text: 'Totally agree, so well done!', likes: 1, liked: false, replyCount: 0, createdAt: new Date(Date.now() - 3600000) },
  { id: 'c3', authorId: mockUsers[4].id, author: mockUsers[4], text: 'Wow, you always inspire me ✨', likes: 5, liked: false, replyCount: 2, createdAt: new Date(Date.now() - 7200000) },
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

  // Subscribe to real Firestore comments (or use demo data)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setComments(DEMO_COMMENTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribePostComments(post.id, raw => {
      setComments(prev =>
        raw.map(c => ({ ...c, liked: prev.find(p => p.id === c.id)?.liked ?? false }))
      );
      setLoading(false);
    });
    return unsub;
  }, [post.id]);

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
          likes: 0, liked: false, replyCount: 0, createdAt: new Date(),
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
          text: body, likes: 0, liked: false, replyCount: 0, createdAt: new Date(),
        }]);
      }
    }
  }

  function handleLikeComment(commentId: string) {
    if (!currentUser) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    const wasLiked = comment.liked;
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, liked: !wasLiked, likes: wasLiked ? c.likes - 1 : c.likes + 1 } : c
    ));
    if (isFirebaseConfigured) {
      fsToggleCommentLike(post.id, commentId, currentUser.id, wasLiked).catch(console.error);
      if (!wasLiked && comment.authorId !== currentUser.id) {
        fsWriteNotification(comment.authorId, 'like_comment', currentUser as unknown as User, {
          postId: post.id,
          message: `${currentUser.displayName} liked your comment`,
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
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(80dvh, 80vh)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-gray-100 flex-shrink-0">
          <span className="font-bold text-gray-900 text-[15px]">
            Comments{!loading && <span className="text-gray-400 font-normal ml-1">({comments.length})</span>}
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body — scrollable comment list */}
        {post.commentsDisabled ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-10 overflow-y-auto">
            <MessageCircleOff size={36} className="text-gray-200" />
            <p className="text-[14px] font-semibold text-gray-400">Comments are turned off</p>
            <p className="text-[12px] text-gray-300 text-center leading-relaxed">The author has disabled comments on this post.</p>
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
                <p className="text-[14px] text-gray-400 font-medium">No comments yet</p>
                <p className="text-[12px] text-gray-300">Be the first to share your thoughts!</p>
              </div>
            ) : comments.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="flex gap-3"
              >
                <UserAvatar userId={c.authorId} fallbackName={c.author.displayName} fallbackSrc={c.author.avatarUrl || undefined} size={34} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="font-semibold text-[13px] text-gray-900">{c.author.displayName}</p>
                      <FounderBadge userId={c.authorId} size="xs" />
                    </div>
                    <p className="text-[13.5px] text-gray-700 leading-relaxed">{c.text}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 px-1">
                    <span className="text-[11px] text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleLikeComment(c.id)}
                      className={cn(
                        'flex items-center gap-1 text-[11px] font-semibold transition-colors',
                        c.liked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'
                      )}
                    >
                      <Heart size={11} className={cn(c.liked && 'fill-pink-500')} />
                      {c.likes > 0 && <span>{c.likes}</span>}
                      <span>Like</span>
                    </motion.button>
                    <button
                      onClick={() => { setReplyingTo(c); setTimeout(() => inputRef.current?.focus(), 100); }}
                      className="text-[11px] text-gray-400 font-semibold hover:text-purple-500 transition-colors"
                    >
                      Reply
                    </button>
                    {c.replyCount > 0 && (
                      <span className="text-[11px] text-purple-400 font-medium">
                        {c.replyCount} {c.replyCount === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Composer — pinned above safe-area, always visible */}
        {!post.commentsDisabled && (
          <div
            className="px-4 pt-3 border-t border-gray-100 flex-shrink-0"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
          >
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <MessageCircle size={12} className="text-purple-400 flex-shrink-0" />
                <span className="flex-1 text-[12px] text-purple-500 font-semibold truncate">
                  Replying to @{replyingTo.author.handle}
                </span>
                <button onClick={() => setReplyingTo(null)} className="p-0.5 rounded-full hover:bg-gray-100">
                  <X size={13} className="text-gray-400" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2.5">
              {currentUser && <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={36} className="flex-shrink-0 mb-0.5" />}
              <div className="flex-1 bg-gray-50 rounded-2xl px-3.5 py-2.5 flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  placeholder={replyingTo ? `Reply to ${replyingTo.author.displayName}…` : 'Add a kind comment… 💛'}
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-[14px] text-gray-800 placeholder:text-gray-400 max-h-24"
                  style={{ lineHeight: '1.5' }}
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={submit}
                  disabled={!text.trim()}
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                    text.trim() ? 'text-white shadow-md' : 'bg-gray-200 text-gray-400'
                  )}
                  style={text.trim() ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.4)' } : {}}
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
      color: '#6B73FF',
      bg: '#EEF0FF',
      action: copyLink,
    },
    {
      icon: Users,
      label: 'Share to Circles',
      color: '#9B59B6',
      bg: '#F5EEF8',
      action: () => { onShared(post.id); onClose(); },
    },
    {
      icon: MessageSquare,
      label: 'Send via Chats',
      color: '#FF6B9D',
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
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[28px] shadow-2xl"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-2 pt-1">
          <p className="font-bold text-gray-900 text-[15px] mb-0.5">Share post</p>
          <p className="text-[13px] text-gray-400 truncate">"{post.content.slice(0, 60)}…"</p>
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
              <span className="text-[11px] text-gray-500 font-medium text-center leading-tight">{label}</span>
            </motion.button>
          ))}
        </div>

        <div className="px-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-[15px] hover:bg-gray-200 transition-colors"
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
  { value: 'public',   label: 'Public',   icon: <Globe      size={11} /> },
  { value: 'friends',  label: 'Friends',  icon: <Users      size={11} /> },
  { value: 'private',  label: 'Private',  icon: <Lock       size={11} /> },
  { value: 'only_me',  label: 'Only Me',  icon: <UserCircle size={11} /> },
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
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[28px] shadow-2xl flex flex-col"
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
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>
          <div className="flex items-center justify-between px-5 pt-2 pb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
              >
                <Sparkles size={13} className="text-white" />
              </div>
              <span className="font-black text-gray-900 text-[15px]">Daily Spark</span>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
          <div className="mx-5 mb-3 px-4 py-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #EEF0FF, #FFF0F6)' }}>
            <p className="text-[13px] font-semibold text-gray-500 mb-0.5">Today's prompt</p>
            <p className="text-[15px] font-bold text-gray-800">"{spark}"</p>
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
                onChange={e => setText(e.target.value)}
                placeholder="Share your spark with the world… ✨"
                rows={4}
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[14.5px] text-gray-800 placeholder:text-gray-400 outline-none resize-none leading-relaxed"
              />

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
        <div className="flex-shrink-0 px-5 pt-3 border-t border-gray-100" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          {/* Audience selector */}
          <div className="flex gap-1.5 mb-3">
            {AUDIENCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAudience(opt.value)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-bold transition-all flex-1 justify-center',
                  audience === opt.value ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
              isCloudinaryConfigured ? 'bg-gray-50 active:bg-gray-100' : 'bg-gray-50 opacity-50 cursor-not-allowed'
            )}
            title={isCloudinaryConfigured ? 'Add photo' : 'Image upload not configured'}
          >
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ImageIcon size={18} className={cn(imageUrl ? 'text-blue-500' : 'text-blue-400')} />
            </div>
            <span className={cn('text-[14px] font-semibold', imageUrl ? 'text-blue-500' : 'text-gray-500')}>
              {imageUrl ? 'Replace photo' : 'Add a photo'}
            </span>
            {imageUploading && (
              <div className="ml-auto w-4 h-4 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin" />
            )}
            {imageUrl && !imageUploading && (
              <span className="ml-auto text-[12px] text-blue-400 font-semibold">✓ Added</span>
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
                  canPost && !imageUploading ? 'text-white shadow-lg' : 'bg-gray-100 text-gray-400'
                )}
                style={
                  canPost && !imageUploading
                    ? { background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)', boxShadow: '0 4px 18px rgba(107,115,255,0.35)' }
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
  success: { bg: 'linear-gradient(135deg, #6B73FF, #FF6B9D)',  shadow: '0 8px 24px rgba(107,115,255,0.4)' },
  error:   { bg: 'linear-gradient(135deg, #FF5E5E, #FF8C42)',  shadow: '0 8px 24px rgba(255,94,94,0.4)'   },
  info:    { bg: 'linear-gradient(135deg, #6B73FF, #4F75FF)',  shadow: '0 8px 24px rgba(107,115,255,0.3)' },
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

  // Already answered (not the just-completed transition) or user skipped → hide
  if ((hasAnsweredToday && !justCompleted) || dismissed) return null;

  // ── Completion state ────────────────────────────────────────────────────────
  if (justCompleted) {
    return (
      <motion.div
        key="spark-done"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.88, y: -8 }}
        transition={{ type: 'spring', damping: 18, stiffness: 260 }}
        className="mx-4 mb-5 rounded-[28px] overflow-hidden relative shadow-lg"
        style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
      >
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-white/10 blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="relative z-10 p-6 flex items-center gap-4">
          <motion.div
            className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 220, delay: 0.08 }}
          >
            <Check size={28} className="text-white" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <motion.p
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="text-white font-black text-[17px] leading-tight"
            >
              Today's Spark completed!
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-white/80 text-[13px] font-medium mt-0.5"
            >
              {streak > 1 ? `🔥 ${streak}-day streak — keep it up!` : 'You\'re sparking! ✨'}
            </motion.p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Default: unanswered prompt card ─────────────────────────────────────────
  return (
    <motion.div
      key="spark-prompt"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mx-4 mb-5 rounded-[28px] overflow-hidden relative shadow-lg"
      style={{ background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 45%, #FF6B9D 100%)' }}
    >
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/10 blur-2xl -ml-10 -mb-10 pointer-events-none" />
      <div className="relative z-10 p-6">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
            <Sparkles size={12} className="text-yellow-200" />
            <span className="text-white/90 text-[10px] font-black uppercase tracking-[0.12em]">Daily Spark</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1">
              <Flame size={11} className="text-orange-200" />
              <span className="text-white/90 text-[10px] font-bold">{streak}d streak</span>
            </div>
          )}
        </div>
        <p className="text-white text-xl font-bold leading-snug mb-5">{spark ?? dailySparks[0]}</p>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onRespond}
            className="bg-white text-purple-600 px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-md"
          >
            Respond ✨
          </motion.button>
          <button
            onClick={() => setDismissed(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Community Reveal ─────────────────────────────────────────────────────────

interface CommunityRevealProps {
  prompt: string;
  streak: number;
  memoryLane: import('@/hooks/useDailySpark').MemoryLaneEntry | null;
  currentUserId?: string;
  onOpenComments: (post: Post) => void;
  onOpenShare: (post: Post) => void;
  onReact: (postId: string, emoji: string) => void;
  onOpenMenu: (post: Post) => void;
  onOpenPhoto: (src: string) => void;
}

function CommunityReveal({
  prompt, streak, memoryLane, currentUserId,
  onOpenComments, onOpenShare, onReact, onOpenMenu, onOpenPhoto,
}: CommunityRevealProps) {
  const [sort, setSort] = useState<CommunitySort>('everyone');
  const { posts, loading } = useSparkCommunity(prompt, true);

  const SORT_TABS: { key: CommunitySort; label: string }[] = [
    { key: 'friends',   label: 'Friends'   },
    { key: 'following', label: 'Following' },
    { key: 'everyone',  label: 'Everyone'  },
  ];

  // Exclude the current user (their post is already in the main feed)
  const community = posts.filter(p => p.authorId !== currentUserId);
  // Shuffle featured responses so the same users aren't always first
  const featured = community.slice(0, 2);
  const rest     = community.slice(2);
  const total    = community.length + 1; // +1 for the current user

  const badges = streakBadges(streak);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* ── Unlock banner ───────────────────────────────────────────────────── */}
      <div
        className="mx-4 mb-4 px-5 py-4 rounded-[24px] flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #6B73FF18, #FF6B9D12)', border: '1px solid #6B73FF22' }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
        >
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900 text-[14px] leading-snug">✨ Community responses unlocked!</p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {total > 1 ? `${total} people answered today's spark` : 'Be the first to inspire others!'}
          </p>
        </div>
        {streak > 1 && (
          <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5 flex-shrink-0">
            <Flame size={13} className="text-orange-500" />
            <span className="text-orange-600 font-bold text-[12px]">{streak}</span>
          </div>
        )}
      </div>

      {/* ── Memory Lane ─────────────────────────────────────────────────────── */}
      {memoryLane && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-4 mb-4 px-4 py-3.5 rounded-[20px] border border-purple-100 bg-purple-50/60 flex items-start gap-3"
        >
          <span className="text-2xl leading-none mt-0.5">🌅</span>
          <div>
            <p className="text-[13px] font-bold text-purple-700">Memory Lane</p>
            <p className="text-[12px] text-purple-600/80 mt-0.5 leading-relaxed">
              You answered this same prompt {memoryLane.yearsAgo === 1 ? 'one year' : `${memoryLane.yearsAgo} years`} ago today!
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Streak badges ───────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <div className="px-4 mb-4 flex flex-wrap gap-2">
          {badges.map(b => (
            <span key={b} className="text-[11.5px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-3 py-1 rounded-full">
              {b}
            </span>
          ))}
        </div>
      )}

      {/* ── Section header + sort tabs ──────────────────────────────────────── */}
      <div className="px-4 mb-3 flex items-center justify-between">
        <h2 className="font-black text-[16px] text-gray-900">Today's Community Sparks</h2>
        <div className="flex gap-1">
          {SORT_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSort(t.key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-bold transition-all',
                sort === t.key ? 'text-white' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
              )}
              style={sort === t.key ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Responses ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : community.length === 0 ? (
        <div className="mx-4 mb-4 py-10 flex flex-col items-center gap-2 text-center">
          <span className="text-3xl">🌱</span>
          <p className="font-bold text-gray-700 text-[14px]">No other responses yet</p>
          <p className="text-gray-400 text-[12.5px] max-w-[200px] leading-relaxed">Encourage your friends — share today's spark!</p>
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <div className="px-4 mb-2">
              <span className="text-[10.5px] font-bold text-amber-600 uppercase tracking-wider">✦ Featured</span>
            </div>
          )}
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
              <div className="px-4 my-2">
                <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">More responses</span>
              </div>
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
        </>
      )}

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div className="mx-4 mt-2 mb-5 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
    </motion.div>
  );
}

// ─── Post Composer ────────────────────────────────────────────────────────────

interface PostComposerProps {
  onPost: (content: string, imageUrl?: string) => void;
}

export function PostComposer({ onPost }: PostComposerProps) {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canPost = content.trim().length > 0 || imageUrl.length > 0;

  function handlePost() {
    if (!canPost) return;
    onPost(content.trim(), imageUrl || undefined);
    setContent('');
    setImageUrl('');
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
      className="mx-4 mb-5 p-4 rounded-[24px] bg-white border border-black/[0.04] transition-all duration-300"
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
            onChange={e => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            className="w-full bg-transparent resize-none outline-none text-gray-800 text-[15px] placeholder:text-gray-400 min-h-[44px] pt-2.5 leading-relaxed"
            rows={isExpanded ? 3 : 1}
          />

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
            <div className="mt-2 flex items-center gap-2 text-[13px] text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
              Uploading image…
            </div>
          )}

          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100"
            >
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => isCloudinaryConfigured && imageInputRef.current?.click()}
                  disabled={imageUploading || !isCloudinaryConfigured}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    isCloudinaryConfigured ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                  )}
                  title={isCloudinaryConfigured ? 'Add image' : 'Image upload not configured'}
                >
                  <ImageIcon size={18} className={imageUrl ? 'text-blue-500' : 'text-blue-400'} />
                </button>
                <button className="p-2 hover:bg-gray-50 rounded-full transition-colors" title="Add emoji">
                  <Smile size={18} className="text-yellow-400" />
                </button>
                <button className="p-2 hover:bg-gray-50 rounded-full transition-colors" title="Add location">
                  <MapPin size={18} className="text-pink-400" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setContent(''); setImageUrl(''); setIsExpanded(false); }}
                  className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePost}
                  disabled={!canPost || imageUploading}
                  className={cn(
                    'px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-1.5',
                    (!canPost || imageUploading) && 'bg-gray-100 text-gray-400'
                  )}
                  style={
                    canPost && !imageUploading
                      ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', color: '#fff', boxShadow: '0 4px 14px rgba(107,115,255,0.35)' }
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
      className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-gray-50 border-t border-gray-50 first:border-t-0"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        <Icon size={17} style={{ color: iconColor }} />
      </div>
      <span className={cn('text-[15px] font-medium flex-1 text-left', destructive ? 'text-red-500' : 'text-gray-800')}>
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
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[28px] shadow-2xl"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* ── Main menu ────────────────────────────────────────────────── */}
        {step === 'main' && (
          <>
            <div className="flex items-center gap-3 px-5 pb-3">
              <UserAvatar userId={post.authorId} fallbackName={post.author.displayName} fallbackSrc={post.author.avatarUrl || undefined} size={38} />
              <div className="min-w-0">
                <p className="font-bold text-[14px] text-gray-900 truncate">{post.author.displayName}</p>
                <p className="text-[12px] text-gray-400 line-clamp-1">{post.content.slice(0, 60)}{post.content.length > 60 ? '…' : ''}</p>
              </div>
            </div>
            <div className="border-t border-gray-100" />

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
              <button onClick={onClose} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-[15px] active:bg-gray-200">
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
                <p className="font-bold text-[16px] text-gray-900">Delete this post?</p>
                <p className="text-[13px] text-gray-400">This action can't be undone.</p>
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
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-[15px]">
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
                <p className="font-bold text-[16px] text-gray-900">{isBlocked ? 'Unblock' : 'Block'} @{post.author.handle}?</p>
                <p className="text-[13px] text-gray-400">{isBlocked ? 'They can see your content again.' : "They won't be able to see your posts or contact you."}</p>
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
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-[15px]">Cancel</button>
          </div>
        )}

        {/* ── Confirm mute ───────────────────────────────────────────────── */}
        {step === 'confirmMute' && (
          <div className="px-5 pb-6">
            <div className="flex items-center gap-3 mb-5 pt-1">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <VolumeX size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-[16px] text-gray-900">{isMuted ? 'Unmute' : 'Mute'} @{post.author.handle}?</p>
                <p className="text-[13px] text-gray-400">{isMuted ? 'Their posts will reappear in your feed.' : "Their posts won't appear in your feed."}</p>
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
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-[15px]">Cancel</button>
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
                <p className="font-bold text-[16px] text-gray-900">Unfollow @{post.author.handle}?</p>
                <p className="text-[13px] text-gray-400">Their posts won't appear in your feed.</p>
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
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-[15px]">
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
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[28px] shadow-2xl flex flex-col"
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
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>
          <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-gray-100">
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
            <span className="font-black text-[15px] text-gray-900">Edit post</span>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={!canSave || imageUploading}
              className={cn(
                'px-4 py-1.5 rounded-full text-[13px] font-bold transition-all',
                canSave && !imageUploading ? 'text-white' : 'bg-gray-100 text-gray-400'
              )}
              style={canSave && !imageUploading ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
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
                className="w-full bg-transparent text-[14.5px] text-gray-800 placeholder:text-gray-400 outline-none resize-none leading-relaxed"
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
                <div className="mt-2 flex items-center gap-2 text-[13px] text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                  Uploading…
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Photo row footer */}
        <div className="flex-shrink-0 px-5 pt-2 border-t border-gray-100" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => isCloudinaryConfigured && imageInputRef.current?.click()}
            disabled={imageUploading || !isCloudinaryConfigured}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ImageIcon size={18} className="text-blue-400" />
            </div>
            <span className={cn('text-[14px] font-semibold', imageUrl ? 'text-blue-500' : 'text-gray-500')}>
              {imageUrl ? 'Replace photo' : 'Add a photo'}
            </span>
            {imageUrl && !imageUploading && (
              <span className="ml-auto text-[12px] text-blue-400 font-semibold">✓ Added</span>
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
      className="mx-4 mb-4 p-4 rounded-[24px] bg-white border border-black/[0.04] shadow-sm hover:shadow-md transition-all duration-200"
    >
      {/* Author */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.authorId}`}>
            <UserAvatar userId={post.authorId} fallbackName={post.author.displayName} fallbackSrc={post.author.avatarUrl || undefined} size={42} className="cursor-pointer hover:scale-105 transition-transform" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${post.authorId}`} className="font-bold text-[14px] text-gray-900 hover:underline">
                {post.author.displayName}
              </Link>
              <FounderBadge userId={post.authorId} size="sm" />
              {post.communityId && (
                <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  Community
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-gray-400 font-medium mt-0.5">
              {formatRelativeTime(post.createdAt)}{post.mood && ` · Feeling ${post.mood}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => onOpenMenu?.(post)}
          className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
        >
          <MoreHorizontal size={17} className="text-gray-400" />
        </button>
      </div>

      {/* Spark context badge */}
      {post.sparkPrompt && (
        <div className="mb-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl w-fit" style={{ background: 'linear-gradient(135deg, #EEF0FF, #FFF0F6)' }}>
          <Sparkles size={11} className="text-purple-500 flex-shrink-0" />
          <span className="text-[11.5px] font-semibold text-purple-600 truncate max-w-[230px]">"{post.sparkPrompt}"</span>
        </div>
      )}

      {/* Content */}
      <p className="text-[14.5px] leading-relaxed text-gray-800 mb-3 whitespace-pre-wrap">{post.content}</p>

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
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-all"
          >
            <MessageCircle size={16} />
            <span>{commentsCount}</span>
          </button>

          {/* Share */}
          <button
            onClick={() => onOpenShare?.(post)}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-gray-400 hover:bg-purple-50 hover:text-purple-500 transition-all"
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
            saved ? 'text-purple-500 bg-purple-50' : 'text-gray-300 hover:bg-gray-50 hover:text-gray-500'
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
  const { unreadCount } = useNotifications();
  const { prompt: sparkPrompt, hasAnsweredToday, streak, memoryLane, markAnswered } = useDailySpark(currentUser?.id);
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

  // Auto-open SparkModal when navigated here with ?spark=1 (only if not yet answered)
  useEffect(() => {
    if (window.location.search.includes('spark=1')) {
      window.history.replaceState({}, '', '/');
      if (!hasAnsweredToday) setSparkOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleNewPost(content: string, imageUrl?: string) {
    if (!currentUser) return;
    addPost(content, imageUrl ? { imageUrl } : undefined).catch(console.error);
    showToast('Post shared! ✨');
  }

  async function handleSparkPost(content: string, imageUrl?: string, audience?: SparkAudience) {
    if (!currentUser) return;
    // Client guard — prevent double submission
    if (hasAnsweredToday) return;
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
    <div className="pb-32 min-h-screen">
      <Toast message={toast} visible={toastVisible} variant={toastVariant} />

      {/* Greeting header — mobile only */}
      <div className="px-4 pt-7 pb-5 md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-gray-400 mb-0.5">{greeting} 👋</p>
            <h1 className="text-[24px] font-black tracking-tight text-gray-900 leading-tight">
              Hey,{' '}
              <span style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {firstName}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications">
              <button className="relative w-10 h-10 rounded-full bg-white shadow-sm border border-black/[0.06] flex items-center justify-center">
                <Bell size={18} className="text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-pink-500 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </Link>
            {currentUser && (
              <Link href={`/profile/${currentUser.id}`}>
                <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={40} className="cursor-pointer hover:scale-105 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </div>

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

      {hasAnsweredToday && (
        <CommunityReveal
          prompt={sparkPrompt}
          streak={streak}
          memoryLane={memoryLane}
          currentUserId={currentUser?.id}
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
              className="fixed inset-x-0 bottom-0 z-[75] bg-[#FDF9F6] rounded-t-[28px] shadow-2xl flex flex-col"
              style={{ maxHeight: '70vh' }}
              key="conv-picker"
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] flex-shrink-0">
                <button onClick={() => { setConvPickerPost(null); }}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={18} className="text-gray-500" />
                </button>
                <span className="font-black text-[16px] text-gray-900">Send to Chats</span>
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
                  className={cn('text-[14px] font-black transition-colors', convPickerSent.size > 0 ? 'text-purple-600' : 'text-gray-300')}
                >
                  Send{convPickerSent.size > 0 ? ` (${convPickerSent.size})` : ''}
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {allConvs.length === 0 ? (
                  <p className="text-center text-gray-400 text-[14px] py-10">No conversations yet</p>
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
                        selected ? 'bg-purple-50 border-purple-200' : 'bg-white border-black/[0.05]'
                      )}
                    >
                      <UserAvatar userId={other.id} fallbackName={other.displayName} fallbackSrc={(other as any).avatarUrl || undefined} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[14.5px] text-gray-900 truncate">{name}</p>
                        <p className="text-[12px] text-gray-400 truncate">{conv.lastMessage || 'No messages yet'}</p>
                      </div>
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        selected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
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
            onPublishItem={async (item, editData) => {
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

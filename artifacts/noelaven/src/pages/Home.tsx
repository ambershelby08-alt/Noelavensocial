import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Bookmark,
  Image as ImageIcon, Smile, MapPin, Send,
  Bell, MoreHorizontal, Sparkles, X,
  Link as LinkIcon, Users, MessageSquare, Check,
  ChevronDown, Trash2, Flag, EyeOff, UserMinus,
  Edit2, MessageCircleOff, ClipboardCopy,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { dailySparks, mockUsers } from '@/lib/mockData';
import type { Post, User } from '@/lib/mockData';
import { useFeed } from '@/hooks/useFeed';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import {
  reportPost as fsReportPost, unfollowUser as fsUnfollowUser,
  subscribeComments as subscribePostComments,
  addComment as fsAddComment,
  toggleCommentLike as fsToggleCommentLike,
  addReply as fsAddReply,
  writeNotification as fsWriteNotification,
} from '@/lib/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { PhotoViewer } from '@/components/ui/PhotoViewer';

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
                <GradientAvatar name={c.author.displayName} src={c.author.avatarUrl || undefined} size={34} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <p className="font-semibold text-[13px] text-gray-900 mb-0.5">{c.author.displayName}</p>
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
}

function ShareSheet({ post, onClose, onShared }: ShareSheetProps) {
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
      action: () => { onShared(post.id); onClose(); },
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

interface SparkModalProps {
  spark: string;
  onClose: () => void;
  onPosted: (content: string, imageUrl?: string) => void;
}

function SparkModal({ spark, onClose, onPosted }: SparkModalProps) {
  const { currentUser } = useAuth();
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [posted, setPosted] = useState(false);
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
      onPosted(text.trim(), imageUrl || undefined);
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

// ─── Stories ─────────────────────────────────────────────────────────────────

function StoriesRow() {
  const { currentUser } = useAuth();
  const storyUsers = mockUsers.filter(u => u.id !== currentUser?.id).slice(0, 6);

  return (
    <div className="px-4 mb-5">
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {currentUser && (
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="relative">
              <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={56} />
              <div
                className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white"
                style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB)' }}
              >
                <span className="text-white text-[9px] font-black leading-none">+</span>
              </div>
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Your story</span>
          </div>
        )}
        {storyUsers.map((user) => {
          const [from, to] = getGradientPair(user.displayName);
          return (
            <button key={user.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
              <div className="p-[2.5px] rounded-full" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                <div className="p-[2px] bg-[#FDF9F6] rounded-full">
                  <GradientAvatar name={user.displayName} src={user.avatarUrl || undefined} size={50} />
                </div>
              </div>
              <span className="text-[10px] text-gray-400 font-medium max-w-[56px] truncate text-center">
                {user.displayName.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Daily Spark ──────────────────────────────────────────────────────────────

interface DailySparkProps {
  onRespond: () => void;
}

export function DailySpark({ onRespond }: DailySparkProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
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
        </div>
        <p className="text-white text-xl font-bold leading-snug mb-5">{dailySparks[0]}</p>
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

type PostMenuStep = 'main' | 'confirmDelete' | 'reportSelect' | 'confirmUnfollow';

interface PostMenuProps {
  post: Post;
  isOwner: boolean;
  onClose: () => void;
  onDelete: (postId: string) => Promise<void>;
  onEdit: (post: Post) => void;
  onHide: (postId: string) => void;
  onSave: (postId: string, currentlySaved: boolean) => void;
  onReport: (postId: string, reason: string) => Promise<void>;
  onToggleComments: (postId: string, currentlyDisabled: boolean) => void;
  onUnfollow: (userId: string) => Promise<void>;
}

const REPORT_REASONS = ['Spam', 'Harassment', 'Misinformation', 'Inappropriate content'];

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
  onReport, onToggleComments, onUnfollow,
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

  async function handleReport(reason: string) {
    setLoading(true);
    await onReport(post.id, reason);
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
              <GradientAvatar name={post.author.displayName} src={post.author.avatarUrl || undefined} size={38} />
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
                <MenuRow icon={Flag}      label="Report post" iconBg="#FFF0F0" iconColor="#FF5E5E" destructive onClick={() => setStep('reportSelect')} />
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

        {/* ── Report reasons ───────────────────────────────────────────── */}
        {step === 'reportSelect' && (
          <div className="px-5 pb-6">
            <p className="font-bold text-[16px] text-gray-900 mb-0.5 pt-1">Report this post</p>
            <p className="text-[13px] text-gray-400 mb-4">Why are you reporting this?</p>
            <div className="space-y-2 mb-3">
              {REPORT_REASONS.map(reason => (
                <motion.button
                  key={reason}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleReport(reason)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left"
                >
                  <Flag size={16} className="text-red-400 flex-shrink-0" />
                  <span className="text-[14px] font-medium text-gray-700 flex-1">{reason}</span>
                  {loading && <div className="w-4 h-4 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />}
                </motion.button>
              ))}
            </div>
            <button onClick={() => setStep('main')} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-[15px]">
              Cancel
            </button>
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
  onLike?: (postId: string, newLiked: boolean) => void;
  onSave?: (postId: string, newSaved: boolean) => void;
  /** Opens the post three-dot menu */
  onOpenMenu?: (post: Post) => void;
  /** Opens the full-screen photo viewer */
  onOpenPhoto?: (src: string) => void;
}

export function PostCard({ post, index, onOpenComments, onOpenShare, onLike, onSave, onOpenMenu, onOpenPhoto }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [saved, setSaved] = useState(post.saved);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [sharesCount, setSharesCount] = useState(post.shares);

  // Sync when post prop changes (Firestore updates)
  useEffect(() => { setLiked(post.liked); }, [post.liked]);
  useEffect(() => { setLikesCount(post.likes); }, [post.likes]);
  useEffect(() => { setSaved(post.saved); }, [post.saved]);

  function handleLike() {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    onLike?.(post.id, newLiked);
  }

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
            <GradientAvatar name={post.author.displayName} src={post.author.avatarUrl || undefined} size={42} className="cursor-pointer hover:scale-105 transition-transform" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${post.authorId}`} className="font-bold text-[14px] text-gray-900 hover:underline">
                {post.author.displayName}
              </Link>
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
        <div className="flex items-center gap-1">
          {/* Like */}
          <motion.button
            whileTap={{ scale: 0.82 }}
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-all',
              liked ? 'text-pink-500 bg-pink-50' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            )}
          >
            <motion.span animate={liked ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ duration: 0.25 }}>
              <Heart size={16} className={cn(liked && 'fill-pink-500 stroke-pink-500')} />
            </motion.span>
            <span>{likesCount}</span>
          </motion.button>

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

  const { posts, addPost, toggleLike, toggleSave, deletePost, updatePost, hidePost, toggleCommentsDisabled } = useFeed();
  const { unreadCount } = useNotifications();
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [sparkOpen, setSparkOpen] = useState(false);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ src: string } | null>(null);
  const [toast, setToast] = useState('');
  const [toastVariant, setToastVariant] = useState<ToastVariant>('success');
  const [toastVisible, setToastVisible] = useState(false);

  // Auto-open SparkModal when navigated here with ?spark=1
  useEffect(() => {
    if (window.location.search.includes('spark=1')) {
      setSparkOpen(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

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

  async function handleReportPost(postId: string, reason: string) {
    if (isFirebaseConfigured && currentUser) {
      await fsReportPost(postId, currentUser.id, reason).catch(console.error);
    }
    showToast('Report submitted. Thank you.', 'info');
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

  function handleSparkPost(content: string, imageUrl?: string) {
    if (!currentUser) return;
    addPost(content, { imageUrl, sparkPrompt: dailySparks[0] }).catch(console.error);
    showToast('Spark shared with the world! ✨');
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

      <StoriesRow />

      <AnimatePresence>
        <DailySpark key="spark" onRespond={() => setSparkOpen(true)} />
      </AnimatePresence>

      <PostComposer onPost={handleNewPost} />

      <div>
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            index={index}
            onOpenComments={p => setCommentsPost(p)}
            onOpenShare={p => setSharePost(p)}
            onLike={(id, liked) => {
              toggleLike(id, !liked).catch(console.error);
              if (!liked && post.authorId !== currentUser?.id && isFirebaseConfigured && currentUser) {
                fsWriteNotification(post.authorId, 'like', currentUser as unknown as User, {
                  postId: id,
                  message: `${currentUser.displayName} liked your post`,
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
        {sharePost && (
          <ShareSheet
            key="share"
            post={sharePost}
            onClose={() => setSharePost(null)}
            onShared={handleShared}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sparkOpen && (
          <SparkModal
            key="spark-modal"
            spark={dailySparks[0]}
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
            onReport={handleReportPost}
            onToggleComments={handleToggleComments}
            onUnfollow={handleUnfollowUser}
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
    </div>
  );
}

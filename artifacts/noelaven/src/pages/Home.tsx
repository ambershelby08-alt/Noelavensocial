import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Bookmark,
  Image as ImageIcon, Smile, MapPin, Send,
  Bell, MoreHorizontal, Sparkles, X,
  Link as LinkIcon, Users, MessageSquare, Check,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { dailySparks, mockPosts, mockUsers } from '@/lib/mockData';
import type { Post, User } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';

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

const MOCK_COMMENTS: Record<string, { author: User; text: string; ts: Date }[]> = {
  default: [
    { author: mockUsers[1], text: 'This is amazing! 🔥 Love the vibes.', ts: new Date(Date.now() - 1800000) },
    { author: mockUsers[3], text: 'Totally agree, so well done!', ts: new Date(Date.now() - 3600000) },
    { author: mockUsers[4], text: 'Wow, you always inspire me ✨', ts: new Date(Date.now() - 7200000) },
  ],
};

function getComments(postId: string) {
  return MOCK_COMMENTS[postId] ?? MOCK_COMMENTS.default;
}

// ─── Overlay backdrop ─────────────────────────────────────────────────────────

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
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
  const [comments, setComments] = useState(getComments(post.id));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  function submit() {
    if (!text.trim() || !currentUser) return;
    const newComment = { author: currentUser as unknown as User, text: text.trim(), ts: new Date() };
    setComments(prev => [newComment, ...prev]);
    onCommentAdded(post.id);
    setText('');
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[80vh] flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-gray-100 flex-shrink-0">
          <span className="font-bold text-gray-900 text-[15px]">
            Comments <span className="text-gray-400 font-normal">({comments.length + post.comments})</span>
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Comments list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
          {comments.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex gap-3"
            >
              <GradientAvatar name={c.author.displayName} size={34} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <p className="font-semibold text-[13px] text-gray-900 mb-0.5">{c.author.displayName}</p>
                  <p className="text-[13.5px] text-gray-700 leading-relaxed">{c.text}</p>
                </div>
                <div className="flex items-center gap-3 mt-1.5 px-1">
                  <span className="text-[11px] text-gray-400">{formatRelativeTime(c.ts)}</span>
                  <button className="text-[11px] text-gray-400 font-semibold hover:text-pink-500 transition-colors">Like</button>
                  <button className="text-[11px] text-gray-400 font-semibold hover:text-purple-500 transition-colors">Reply</button>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Older comments placeholder */}
          <button className="w-full text-center text-[13px] text-purple-500 font-semibold py-2 hover:text-purple-700 transition-colors">
            View {post.comments} more comments
          </button>
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 pb-safe">
          <div className="flex items-end gap-2.5">
            {currentUser && <GradientAvatar name={currentUser.displayName} size={36} className="flex-shrink-0 mb-0.5" />}
            <div className="flex-1 bg-gray-50 rounded-2xl px-3.5 py-2.5 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Add a kind comment… 💛"
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl"
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

        <div className="px-5 pb-6 pb-safe">
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
  onPosted: (content: string) => void;
}

function SparkModal({ spark, onClose, onPosted }: SparkModalProps) {
  const { currentUser } = useAuth();
  const [text, setText] = useState('');
  const [posted, setPosted] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 300);
  }, []);

  function submit() {
    if (!text.trim()) return;
    setPosted(true);
    setTimeout(() => {
      onPosted(text.trim());
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
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

        {/* Prompt */}
        <div className="mx-5 mb-4 px-4 py-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #EEF0FF, #FFF0F6)' }}>
          <p className="text-[13px] font-semibold text-gray-500 mb-0.5">Today's prompt</p>
          <p className="text-[15px] font-bold text-gray-800">"{spark}"</p>
        </div>

        {/* Compose */}
        <div className="px-5 pb-5 pb-safe">
          <div className="flex gap-3 mb-4">
            {currentUser && <GradientAvatar name={currentUser.displayName} size={40} className="flex-shrink-0 mt-1" />}
            <textarea
              ref={textRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Share your spark with the world… ✨"
              rows={4}
              className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-[14.5px] text-gray-800 placeholder:text-gray-400 outline-none resize-none leading-relaxed"
            />
          </div>

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
                disabled={!text.trim()}
                className={cn(
                  'w-full py-3.5 rounded-2xl font-bold text-[15px] transition-all',
                  text.trim() ? 'text-white shadow-lg' : 'bg-gray-100 text-gray-400'
                )}
                style={
                  text.trim()
                    ? { background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)', boxShadow: '0 4px 18px rgba(107,115,255,0.35)' }
                    : {}
                }
              >
                Spark it! ✨
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

// ─── Post Created Toast ───────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl text-white text-[13.5px] font-semibold shadow-xl flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 8px 24px rgba(107,115,255,0.4)' }}
        >
          <Check size={15} />
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
              <GradientAvatar name={currentUser.displayName} size={56} />
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
                  <GradientAvatar name={user.displayName} size={50} />
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
  onPost: (content: string) => void;
}

export function PostComposer({ onPost }: PostComposerProps) {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');

  function handlePost() {
    if (!content.trim()) return;
    onPost(content.trim());
    setContent('');
    setIsExpanded(false);
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
      <div className="flex gap-3">
        {currentUser && <GradientAvatar name={currentUser.displayName} size={44} className="mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <textarea
            placeholder="Share something kind… 💛"
            value={content}
            onChange={e => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            className="w-full bg-transparent resize-none outline-none text-gray-800 text-[15px] placeholder:text-gray-400 min-h-[44px] pt-2.5 leading-relaxed"
            rows={isExpanded ? 3 : 1}
          />
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100"
            >
              <div className="flex items-center gap-0.5">
                <button className="p-2 hover:bg-gray-50 rounded-full transition-colors" title="Add image">
                  <ImageIcon size={18} className="text-blue-400" />
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
                  onClick={() => { setContent(''); setIsExpanded(false); }}
                  className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePost}
                  disabled={!content.trim()}
                  className={cn(
                    'px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-1.5',
                    !content.trim() && 'bg-gray-100 text-gray-400'
                  )}
                  style={
                    content.trim()
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

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: Post;
  index: number;
  onOpenComments?: (post: Post) => void;
  onOpenShare?: (post: Post) => void;
}

export function PostCard({ post, index, onOpenComments, onOpenShare }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [saved, setSaved] = useState(post.saved);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [sharesCount, setSharesCount] = useState(post.shares);

  function handleLike() {
    setLiked(prev => !prev);
    setLikesCount(prev => liked ? prev - 1 : prev + 1);
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
            <GradientAvatar name={post.author.displayName} size={42} className="cursor-pointer hover:scale-105 transition-transform" />
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
        <button className="p-1.5 hover:bg-gray-50 rounded-full transition-colors">
          <MoreHorizontal size={17} className="text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <p className="text-[14.5px] leading-relaxed text-gray-800 mb-3 whitespace-pre-wrap">{post.content}</p>

      {post.imageUrl && (
        <div className="mb-3 overflow-hidden rounded-2xl">
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
          onClick={() => setSaved(prev => !prev)}
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

  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [sparkOpen, setSparkOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Auto-open SparkModal when navigated here with ?spark=1
  useEffect(() => {
    if (window.location.search.includes('spark=1')) {
      setSparkOpen(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }

  function handleNewPost(content: string) {
    if (!currentUser) return;
    const newPost: Post = {
      id: `post-new-${Date.now()}`,
      authorId: currentUser.id,
      author: currentUser as unknown as User,
      content,
      likes: 0,
      comments: 0,
      shares: 0,
      liked: false,
      saved: false,
      createdAt: new Date(),
    };
    setPosts(prev => [newPost, ...prev]);
    showToast('Post shared! ✨');
  }

  function handleSparkPost(content: string) {
    handleNewPost(`✨ Daily Spark response:\n"${dailySparks[0]}"\n\n${content}`);
    showToast('Spark shared with the world! ✨');
  }

  function handleCommentAdded(postId: string) {
    setPosts(prev =>
      prev.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p)
    );
  }

  function handleShared(postId: string) {
    setPosts(prev =>
      prev.map(p => p.id === postId ? { ...p, shares: p.shares + 1 } : p)
    );
    showToast('Shared! 🎉');
  }

  return (
    <div className="pb-32 min-h-screen">
      <Toast message={toast} visible={toastVisible} />

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
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-500 ring-2 ring-white" />
              </button>
            </Link>
            {currentUser && (
              <Link href={`/profile/${currentUser.id}`}>
                <GradientAvatar name={currentUser.displayName} size={40} className="cursor-pointer hover:scale-105 transition-transform" />
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
    </div>
  );
}

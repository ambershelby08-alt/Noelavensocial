import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Bookmark,
  Image as ImageIcon, Smile, MapPin, Send,
  Bell, MoreHorizontal, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { dailySparks, mockPosts, mockUsers } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';

// ─── Stories ────────────────────────────────────────────────────────────────

function StoriesRow() {
  const { currentUser } = useAuth();
  const storyUsers = mockUsers.filter(u => u.id !== currentUser?.id).slice(0, 6);

  return (
    <div className="px-4 mb-5">
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {/* Your story */}
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

        {/* Friends' stories */}
        {storyUsers.map((user) => {
          const [from, to] = getGradientPair(user.displayName);
          return (
            <button key={user.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
              <div
                className="p-[2.5px] rounded-full"
                style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
              >
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

// ─── Daily Spark ─────────────────────────────────────────────────────────────

export function DailySpark() {
  const [responded, setResponded] = useState(false);
  const todaySpark = dailySparks[0];

  if (responded) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="spark"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mx-4 mb-5 rounded-[28px] overflow-hidden relative shadow-lg"
        style={{ background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 45%, #FF6B9D 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/10 blur-2xl -ml-10 -mb-10 pointer-events-none" />

        <div className="relative z-10 p-6">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <Sparkles size={12} className="text-yellow-200" />
              <span className="text-white/90 text-[10px] font-black uppercase tracking-[0.12em]">Daily Spark</span>
            </div>
          </div>
          <p className="text-white text-xl font-bold leading-snug mb-5">{todaySpark}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setResponded(true)}
              className="bg-white text-purple-600 px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-md"
            >
              Respond ✨
            </button>
            <button
              onClick={() => setResponded(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Post Composer ────────────────────────────────────────────────────────────

export function PostComposer() {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');

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
        {currentUser && <GradientAvatar name={currentUser.displayName} size={44} className="mt-0.5" />}
        <div className="flex-1">
          <textarea
            placeholder="Share something kind… 💛"
            value={content}
            onChange={(e) => setContent(e.target.value)}
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
                <button className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <ImageIcon size={18} className="text-blue-400" />
                </button>
                <button className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Smile size={18} className="text-yellow-400" />
                </button>
                <button className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <MapPin size={18} className="text-pink-400" />
                </button>
              </div>
              <button
                className={cn(
                  'px-5 py-2 rounded-full font-bold text-sm transition-all active:scale-95 flex items-center gap-1.5',
                  content.trim().length === 0 && 'bg-gray-100 text-gray-400'
                )}
                style={
                  content.trim().length > 0
                    ? {
                        background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)',
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(107,115,255,0.35)',
                      }
                    : {}
                }
                disabled={content.trim().length === 0}
                onClick={() => {
                  setContent('');
                  setIsExpanded(false);
                }}
              >
                <Send size={15} />
                <span>Post</span>
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

export function PostCard({ post, index }: { post: any; index: number }) {
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [saved, setSaved] = useState(post.saved);

  const handleLike = () => {
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      className="mx-4 mb-4 p-4 rounded-[24px] bg-white border border-black/[0.04] shadow-sm hover:shadow-md transition-all duration-200"
    >
      {/* Author */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.authorId}`}>
            <GradientAvatar
              name={post.author.displayName}
              size={42}
              className="cursor-pointer hover:scale-105 transition-transform"
            />
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
              2 hours ago{post.mood && ` · Feeling ${post.mood}`}
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
          <img
            src={post.imageUrl}
            alt="Post"
            className="w-full h-auto object-cover max-h-80"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <div className="flex items-center gap-1">
          <button
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-all',
              liked ? 'text-pink-500 bg-pink-50' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            )}
          >
            <motion.span whileTap={{ scale: 0.7 }} animate={liked ? { scale: [1, 1.3, 1] } : {}}>
              <Heart size={16} className={cn(liked && 'fill-pink-500 stroke-pink-500')} />
            </motion.span>
            <span>{likesCount}</span>
          </button>

          <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all">
            <MessageCircle size={16} />
            <span>{post.comments}</span>
          </button>

          <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all">
            <Share2 size={16} />
            <span>{post.shares}</span>
          </button>
        </div>

        <button
          onClick={() => setSaved(!saved)}
          className={cn(
            'p-2 rounded-full transition-all',
            saved ? 'text-purple-500 bg-purple-50' : 'text-gray-300 hover:bg-gray-50'
          )}
        >
          <Bookmark size={16} className={cn(saved && 'fill-purple-500 stroke-purple-500')} />
        </button>
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

  return (
    <div className="pb-32 min-h-screen">
      {/* Greeting header — mobile only */}
      <div className="px-4 pt-7 pb-5 md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-gray-400 mb-0.5">{greeting} 👋</p>
            <h1 className="text-[24px] font-black tracking-tight text-gray-900 leading-tight">
              Hey,{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
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
      <DailySpark />
      <PostComposer />

      <div>
        {mockPosts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}
      </div>
    </div>
  );
}

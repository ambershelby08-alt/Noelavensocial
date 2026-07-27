import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, Link } from 'wouter';
import {
  Search, X, TrendingUp, Users, UserPlus, UserCheck, Loader2,
  Bookmark, BookmarkCheck, MessageCircle, Clock, Sparkles,
  Star, ChevronRight, Hash, Zap, Flame,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  followUser as fsFollow, unfollowUser as fsUnfollow,
  togglePostSave, togglePostReaction as fsToggleReaction,
  writeNotification as fsWriteNotification,
  subscribeIsFollowing,
} from '@/lib/firestore';
import { mockCommunities } from '@/lib/mockData';
import type { Post, User } from '@/lib/mockData';
import { PostCard } from '@/pages/Home';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { getGradientPair } from '@/components/ui/GradientAvatar';
import { cn } from '@/lib/utils';
import { usePersonalization } from '@/hooks/usePersonalization';
import { useDiscover } from '@/hooks/useDiscover';
import { useFollowingIds } from '@/hooks/useFollowingIds';
import { reactionPhrase } from '@/lib/reactions';

// ─── 50 Categories ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { emoji: '🌟', label: 'For You',           slug: 'for-you' },
  { emoji: '🔥', label: 'Trending',          slug: 'trending' },
  { emoji: '💄', label: 'Beauty',            slug: 'beauty' },
  { emoji: '💅', label: 'Nails',             slug: 'nails' },
  { emoji: '💇', label: 'Hair',              slug: 'hair' },
  { emoji: '🧴', label: 'Skincare',          slug: 'skincare' },
  { emoji: '👗', label: 'Fashion',           slug: 'fashion' },
  { emoji: '👠', label: 'Style',             slug: 'style' },
  { emoji: '💍', label: 'Jewelry',           slug: 'jewelry' },
  { emoji: '👜', label: 'Accessories',       slug: 'accessories' },
  { emoji: '🏡', label: 'Lifestyle',         slug: 'lifestyle' },
  { emoji: '🌿', label: 'Wellness',          slug: 'wellness' },
  { emoji: '🧘', label: 'Self Care',         slug: 'self-care' },
  { emoji: '💪', label: 'Fitness',           slug: 'fitness' },
  { emoji: '🥗', label: 'Health',            slug: 'health' },
  { emoji: '🍳', label: 'Food',              slug: 'food' },
  { emoji: '☕', label: 'Coffee',            slug: 'coffee' },
  { emoji: '🍰', label: 'Baking',            slug: 'baking' },
  { emoji: '🍹', label: 'Drinks',            slug: 'drinks' },
  { emoji: '✈️', label: 'Travel',           slug: 'travel' },
  { emoji: '🏖️', label: 'Vacation',         slug: 'vacation' },
  { emoji: '📸', label: 'Photography',       slug: 'photography' },
  { emoji: '🎥', label: 'Videography',       slug: 'videography' },
  { emoji: '🎨', label: 'Art',               slug: 'art' },
  { emoji: '🎵', label: 'Music',             slug: 'music' },
  { emoji: '🎬', label: 'Movies & TV',       slug: 'movies-tv' },
  { emoji: '🎮', label: 'Gaming',            slug: 'gaming' },
  { emoji: '📚', label: 'Books',             slug: 'books' },
  { emoji: '🎓', label: 'Education',         slug: 'education' },
  { emoji: '💼', label: 'Business',          slug: 'business' },
  { emoji: '💻', label: 'Technology',        slug: 'technology' },
  { emoji: '🤖', label: 'AI',               slug: 'ai' },
  { emoji: '🏠', label: 'Home Decor',        slug: 'home-decor' },
  { emoji: '🛏️', label: 'Interior Design',  slug: 'interior-design' },
  { emoji: '🌸', label: 'Gardening',         slug: 'gardening' },
  { emoji: '🐶', label: 'Pets',              slug: 'pets' },
  { emoji: '🐱', label: 'Animals',           slug: 'animals' },
  { emoji: '👶', label: 'Parenting',         slug: 'parenting' },
  { emoji: '💍', label: 'Weddings',          slug: 'weddings' },
  { emoji: '🎉', label: 'Events',            slug: 'events' },
  { emoji: '🛍️', label: 'Shopping',         slug: 'shopping' },
  { emoji: '💰', label: 'Finance',           slug: 'finance' },
  { emoji: '🚗', label: 'Cars',              slug: 'cars' },
  { emoji: '🏀', label: 'Sports',            slug: 'sports' },
  { emoji: '🧵', label: 'DIY & Crafts',      slug: 'diy-crafts' },
  { emoji: '🌎', label: 'Nature',            slug: 'nature' },
  { emoji: '🌙', label: 'Spirituality',      slug: 'spirituality' },
  { emoji: '❤️', label: 'Relationships',    slug: 'relationships' },
  { emoji: '🎭', label: 'Culture',           slug: 'culture' },
  { emoji: '😂', label: 'Memes & Humor',     slug: 'memes' },
] as const;

// ─── Static demo data ─────────────────────────────────────────────────────────

const DEMO_TRENDING_HASHTAGS = [
  { tag: '#NoelavenVibes', count: 1240 },
  { tag: '#SelfCare',      count: 980  },
  { tag: '#Photography',   count: 754  },
  { tag: '#Design2025',    count: 631  },
  { tag: '#MorningRoutine',count: 590  },
  { tag: '#GoldenHour',    count: 488  },
  { tag: '#TechNews',      count: 412  },
  { tag: '#Wellness',      count: 387  },
  { tag: '#Minimalist',    count: 334  },
  { tag: '#ArtEveryDay',   count: 292  },
  { tag: '#FoodPhotography',count: 261 },
  { tag: '#FitnessMotivation',count: 234},
];

const DEMO_TRENDING_SEARCHES = [
  'Photography tips',
  'Daily Spark ideas',
  'Self care Sunday',
  'Creative process',
  'Digital art',
  'Morning routine',
  'Skincare essentials',
  '#NoelavenVibes',
];

const DEMO_TRENDING_SPARKS = [
  { prompt: "What's one habit that changed your life?",       count: 142 },
  { prompt: 'Describe your perfect creative day.',            count: 118 },
  { prompt: 'What are you most proud of this week?',          count: 97  },
  { prompt: 'Share a place that feels like home to you.',     count: 84  },
  { prompt: 'What book has shaped who you are?',              count: 71  },
];

// ─── Gradient generator for text-only explore cards ───────────────────────────

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
];
function cardGradient(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CARD_GRADIENTS[n % CARD_GRADIENTS.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

function SectionHeader({
  emoji, title, subtitle,
}: { emoji?: string; title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="font-black text-[16px] text-gray-900 flex items-center gap-1.5">
        {emoji && <span className="text-[18px]">{emoji}</span>}
        {title}
      </h2>
      {subtitle && <p className="text-[12px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── FollowButton ─────────────────────────────────────────────────────────────

function FollowButton({
  userId, currentUserId, size = 'md',
}: { userId: string; currentUserId?: string; size?: 'sm' | 'md' }) {
  const { currentUser } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync real-time follow state from Firestore so the button is accurate even
  // when the creator list includes people the user already follows.
  useEffect(() => {
    if (!currentUserId || !isFirebaseConfigured) return;
    const unsub = subscribeIsFollowing(currentUserId, userId, setFollowing);
    return unsub;
  }, [currentUserId, userId]);

  async function handle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!currentUserId || loading) return;
    setLoading(true);
    try {
      if (following) {
        if (isFirebaseConfigured) await fsUnfollow(currentUserId, userId);
        setFollowing(false);
      } else {
        if (isFirebaseConfigured) {
          await fsFollow(currentUserId, userId);
          if (currentUser) {
            fsWriteNotification(userId, 'follow', currentUser, { message: `${currentUser.displayName} started following you` }).catch(() => {});
          }
        }
        setFollowing(true);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={handle}
      disabled={loading}
      className={cn(
        'flex-shrink-0 flex items-center gap-1 rounded-full font-bold transition-all disabled:opacity-60',
        size === 'sm' ? 'px-3 py-1 text-[11px]' : 'px-3.5 py-1.5 text-[12.5px]',
        following ? 'bg-gray-100 text-gray-500' : 'text-white',
      )}
      style={!following ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
    >
      {loading ? <Loader2 size={11} className="animate-spin" />
        : following ? <><UserCheck size={11} />Following</>
        : <><UserPlus size={11} />Follow</>}
    </motion.button>
  );
}

// ─── UserRow (search results / suggested list) ────────────────────────────────

function UserRow({
  user, index, currentUserId,
}: { user: User; index: number; currentUserId?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-[18px] bg-white border border-black/[0.05] shadow-sm"
    >
      <Link href={`/profile/${user.id}`} className="flex-shrink-0">
        <UserAvatar userId={user.id} fallbackName={user.displayName}
          fallbackSrc={user.avatarUrl || undefined} size={46} />
      </Link>
      <Link href={`/profile/${user.id}`} className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-gray-900 truncate">{user.displayName}</p>
        <p className="text-[12px] text-gray-400">@{user.handle}</p>
        {user.interests.length > 0 && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">
            {user.interests.slice(0, 2).join(' · ')}
          </p>
        )}
      </Link>
      {currentUserId && user.id !== currentUserId && (
        <FollowButton userId={user.id} currentUserId={currentUserId} />
      )}
    </motion.div>
  );
}

// ─── UserCard (horizontal carousel) ──────────────────────────────────────────

function UserCard({
  user, index, currentUserId,
}: { user: User; index: number; currentUserId?: string }) {
  const [from] = getGradientPair(user.displayName);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex-shrink-0 w-[148px] p-4 rounded-[22px] bg-white border border-black/[0.05] shadow-sm flex flex-col items-center text-center"
    >
      <Link href={`/profile/${user.id}`}>
        <UserAvatar userId={user.id} fallbackName={user.displayName}
          fallbackSrc={user.avatarUrl || undefined} size={60} className="mb-3 cursor-pointer" />
      </Link>
      <Link href={`/profile/${user.id}`}>
        <p className="font-bold text-[13.5px] text-gray-900 truncate w-full">{user.displayName}</p>
      </Link>
      <p className="text-[11px] text-gray-400 mb-1">@{user.handle}</p>
      <p className="text-[10.5px] text-gray-400 mb-3">{fmt(user.followers)} followers</p>
      {currentUserId && user.id !== currentUserId && (
        <FollowButton userId={user.id} currentUserId={currentUserId} size="sm" />
      )}
    </motion.div>
  );
}

// ─── CommunityRow ─────────────────────────────────────────────────────────────

/** Generic community shape — works with both Firestore data and mock fallback. */
interface DiscoverCommunity {
  id: string;
  name: string;
  emoji: string;
  category: string;
  memberCount: number;
  isJoined?: boolean;
}

function CommunityRow({ community, index }: { community: DiscoverCommunity; index: number }) {
  const [joined, setJoined] = useState(community.isJoined);
  const [from] = getGradientPair(community.name);
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3.5 rounded-[20px] bg-white border border-black/[0.05] shadow-sm hover:shadow-md transition-all"
    >
      <Link href={`/communities/${community.id}`} className="flex-shrink-0">
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center text-xl shadow-sm"
          style={{ background: `linear-gradient(135deg, ${from}33, ${from}18)` }}
        >
          {community.emoji}
        </div>
      </Link>
      <Link href={`/communities/${community.id}`} className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-gray-900 truncate">{community.name}</p>
        <p className="text-[11.5px] text-gray-400 truncate">
          {community.category} · {fmt(community.memberCount)} members
        </p>
      </Link>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setJoined(v => !v)}
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black transition-all',
          joined ? 'bg-gray-100 text-gray-500' : 'text-white',
        )}
        style={!joined ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
      >
        {joined ? '✓' : '+'}
      </motion.button>
    </motion.div>
  );
}

// ─── ExploreCard (compact masonry card) ───────────────────────────────────────

interface ExploreCardProps {
  post: Post;
  onReact: (postId: string, emoji: string) => void;
  onSave: (postId: string, saved: boolean) => void;
}

function ExploreCard({ post, onReact, onSave }: ExploreCardProps) {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const [localMyReaction, setLocalMyReaction] = useState<string | null>(post.myReaction ?? null);
  const [localReactions, setLocalReactions] = useState<Record<string, string[]>>(post.reactions ?? {});
  const [localSaved, setLocalSaved] = useState(post.saved);

  // Sync from parent when post updates
  useEffect(() => { setLocalMyReaction(post.myReaction ?? null); }, [post.myReaction]);
  useEffect(() => { setLocalReactions(post.reactions ?? {}); }, [post.reactions]);
  useEffect(() => { setLocalSaved(post.saved); }, [post.saved]);

  const totalReactions = Object.values(localReactions).reduce((n, arr) => n + arr.length, 0);
  const hasImage = !!post.imageUrl;
  // Variable text card height based on post id for masonry variety
  const textHeight = 120 + (post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 90);

  function handleVibe(e: React.MouseEvent) {
    e.stopPropagation();
    const emoji = '🌊';
    const wasMyReaction = localMyReaction === emoji;
    const nextEmoji = wasMyReaction ? null : emoji;
    const newReactions = { ...localReactions };
    if (currentUser) {
      if (wasMyReaction) {
        newReactions[emoji] = (newReactions[emoji] ?? []).filter(id => id !== currentUser.id);
      } else {
        if (localMyReaction) {
          newReactions[localMyReaction] = (newReactions[localMyReaction] ?? []).filter(id => id !== currentUser.id);
        }
        newReactions[emoji] = [...(newReactions[emoji] ?? []).filter(id => id !== currentUser.id), currentUser.id];
      }
    }
    setLocalMyReaction(nextEmoji);
    setLocalReactions(newReactions);
    onReact(post.id, emoji);
  }

  function handleSaveClick(e: React.MouseEvent) {
    e.stopPropagation();
    setLocalSaved(v => !v);
    onSave(post.id, localSaved);
  }

  return (
    <motion.div
      onClick={() => navigate(`/post/${post.id}`)}
      className="relative overflow-hidden rounded-[18px] cursor-pointer bg-gray-100 group"
      style={{ marginBottom: '8px', breakInside: 'avoid', display: 'block' }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
    >
      {hasImage ? (
        <img
          src={post.imageUrl}
          alt=""
          className="w-full object-cover block"
          loading="lazy"
          style={{ display: 'block' }}
        />
      ) : (
        <div
          className="w-full flex items-center justify-center p-4"
          style={{ minHeight: textHeight, background: cardGradient(post.id) }}
        >
          <p className="text-white font-bold text-[14px] leading-snug text-center drop-shadow-sm">
            {post.content.length > 90 ? post.content.slice(0, 90) + '…' : post.content}
          </p>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />

      {/* Author */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 pointer-events-none">
        <UserAvatar
          userId={post.authorId} fallbackName={post.author.displayName}
          fallbackSrc={post.author.avatarUrl || undefined} size={22}
        />
        <span className="text-white text-[10.5px] font-bold drop-shadow truncate max-w-[80px]">
          {post.author.displayName}
        </span>
      </div>

      {/* Comment count */}
      {post.comments > 0 && (
        <div className="absolute bottom-2.5 right-2 flex items-center gap-0.5 pointer-events-none">
          <MessageCircle size={10} className="text-white/70" />
          <span className="text-[10px] text-white/70 font-medium">{post.comments}</span>
        </div>
      )}

      {/* Reaction + Save controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleVibe}
          className={cn(
            'flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm transition-all',
            localMyReaction ? 'bg-purple-500/90 text-white' : 'bg-black/30 text-white hover:bg-black/45',
          )}
        >
          <span className="text-[12px] leading-none">{localMyReaction ?? '🌊'}</span>
          {totalReactions > 0 && <span className="tabular-nums">{fmt(totalReactions)}</span>}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleSaveClick}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-all',
            localSaved ? 'bg-purple-500/90 text-white' : 'bg-black/30 text-white hover:bg-black/45',
          )}
        >
          {localSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── ExploreGrid (masonry + skeleton + infinite scroll) ───────────────────────

function SkeletonCard({ tall }: { tall: boolean }) {
  return (
    <div
      className="rounded-[18px] bg-gray-100 animate-pulse"
      style={{ height: tall ? 210 : 140, marginBottom: 8, breakInside: 'avoid', display: 'block' }}
    />
  );
}

interface ExploreGridProps {
  posts: Post[];
  hasMore: boolean;
  loadMore: () => void;
  loading: boolean;
  onReact: (postId: string, emoji: string) => void;
  onSave: (postId: string, saved: boolean) => void;
}

function ExploreGrid({ posts, hasMore, loadMore, loading, onReact, onSave }: ExploreGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore) loadMore(); },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (loading) {
    return (
      <div style={{ columns: 2, columnGap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} tall={i % 3 !== 2} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center px-4">
        <span className="text-4xl mb-3">🔍</span>
        <p className="font-black text-[16px] text-gray-700 mb-1">Nothing here yet</p>
        <p className="text-[13px] text-gray-400">Try a different category or check back later.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ columns: 2, columnGap: 8 }}>
        {posts.map(post => (
          <ExploreCard key={post.id} post={post} onReact={onReact} onSave={onSave} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-4" />
      {hasMore && (
        <div className="flex justify-center py-6">
          <Loader2 size={22} className="text-purple-400 animate-spin" />
        </div>
      )}
    </>
  );
}

// ─── HashtagPill ──────────────────────────────────────────────────────────────

function HashtagPill({
  tag, count, index, onClick,
}: { tag: string; count: number; index: number; onClick: () => void }) {
  const gradients = [
    'linear-gradient(135deg, #6B73FF22, #FF6B9D22)',
    'linear-gradient(135deg, #F59E0B22, #EF444422)',
    'linear-gradient(135deg, #10B98122, #06B6D422)',
    'linear-gradient(135deg, #8B5CF622, #EC489922)',
  ];
  const bg = gradients[index % gradients.length];
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] border border-black/[0.06] hover:shadow-md transition-all"
      style={{ background: bg }}
    >
      <span className="text-[13.5px] font-black text-gray-800">{tag}</span>
      <span className="text-[11px] font-bold text-gray-400">{fmt(count)}</span>
    </motion.button>
  );
}

// ─── SparkCard ────────────────────────────────────────────────────────────────

function SparkCard({ prompt, count }: { prompt: string; count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-[20px] border border-purple-100 flex items-start gap-3"
      style={{ background: 'linear-gradient(135deg, #EEF0FF 0%, #FFF0F6 100%)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
      >
        <Sparkles size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-gray-800 leading-snug">"{prompt}"</p>
        <p className="text-[11.5px] text-purple-400 font-bold mt-1">{count} answers today</p>
      </div>
    </motion.div>
  );
}

// ─── CategoryChips ────────────────────────────────────────────────────────────

function CategoryChips({
  active, onSelect,
}: { active: string; onSelect: (slug: string) => void }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto py-3 px-4"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {CATEGORIES.map(cat => {
        const isActive = active === cat.slug;
        return (
          <motion.button
            key={cat.slug}
            whileTap={{ scale: 0.92 }}
            onClick={() => onSelect(cat.slug)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition-all',
              isActive ? 'text-white shadow-md' : 'bg-white text-gray-500 border border-black/[0.07] hover:border-purple-200',
            )}
            style={isActive ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
          >
            <span className="text-[14px]">{cat.emoji}</span>
            <span>{cat.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── PostSearchRow ────────────────────────────────────────────────────────────

function PostSearchRow({ post }: { post: Post }) {
  const [, navigate] = useLocation();
  return (
    <motion.button
      onClick={() => navigate(`/post/${post.id}`)}
      className="w-full flex items-start gap-3 p-3 rounded-[16px] bg-white border border-black/[0.05] shadow-sm hover:shadow-md transition-all text-left"
    >
      {post.imageUrl ? (
        <img src={post.imageUrl} alt="" className="w-12 h-12 rounded-[10px] object-cover flex-shrink-0" />
      ) : (
        <div
          className="w-12 h-12 rounded-[10px] flex-shrink-0"
          style={{ background: cardGradient(post.id) }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[12px] text-purple-500">@{post.author.handle}</p>
        <p className="text-[13.5px] text-gray-700 leading-snug truncate mt-0.5">{post.content}</p>
        <p className="text-[11px] text-gray-400 mt-1">{post.likes} reactions · {post.comments} comments</p>
      </div>
    </motion.button>
  );
}

// ─── SearchView ───────────────────────────────────────────────────────────────

interface SearchViewProps {
  query: string;
  onSearch: (term: string) => void;
  currentUserId?: string;
  discoverSearch: (q: string) => Promise<{ users: User[]; posts: Post[]; hashtags: string[] }>;
  recentSearches: string[];
  onRemoveSearch: (term: string) => void;
  onClearSearches: () => void;
  /** Live trending hashtags derived from fetched posts — used as trending search terms. */
  trendingHashtags: Array<{ tag: string; count: number }>;
}

function SearchView({
  query, onSearch, currentUserId, discoverSearch,
  recentSearches, onRemoveSearch, onClearSearches, trendingHashtags,
}: SearchViewProps) {
  // Build trending search terms from live hashtags; fall back to demo list when empty.
  const trendingSearchTerms: string[] = trendingHashtags.length >= 3
    ? trendingHashtags.slice(0, 8).map(h => h.tag)
    : DEMO_TRENDING_SEARCHES;
  const [results, setResults] = useState<{ users: User[]; posts: Post[]; hashtags: string[] }>({
    users: [], posts: [], hashtags: [],
  });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults({ users: [], posts: [], hashtags: [] }); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await discoverSearch(query);
        setResults(r);
      } catch {
        setResults({ users: [], posts: [], hashtags: [] });
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const hasQuery = query.trim().length > 0;

  if (!hasQuery) {
    return (
      <motion.div
        key="search-empty"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="px-4 pt-2 space-y-6"
      >
        {/* Recent searches */}
        {recentSearches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-[12.5px] text-gray-400 uppercase tracking-wider">Recent</h3>
              <button onClick={onClearSearches} className="text-[12px] text-purple-500 font-bold">
                Clear all
              </button>
            </div>
            <div className="space-y-0.5">
              {recentSearches.map(term => (
                <div key={term} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-gray-50 transition-colors group">
                  <Clock size={13} className="text-gray-300 flex-shrink-0" />
                  <button
                    className="flex-1 text-left text-[14px] text-gray-700 font-medium"
                    onClick={() => onSearch(term)}
                  >
                    {term}
                  </button>
                  <button
                    onClick={() => onRemoveSearch(term)}
                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={13} className="text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending searches */}
        <section>
          <h3 className="font-black text-[12.5px] text-gray-400 uppercase tracking-wider mb-3">
            Trending Searches
          </h3>
          <div className="space-y-0.5">
            {trendingSearchTerms.map((term, i) => (
              <motion.button
                key={term}
                onClick={() => onSearch(term)}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="w-full flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <span className="text-[12px] font-black text-gray-300 w-4 text-center">{i + 1}</span>
                <TrendingUp size={13} className="text-purple-400 flex-shrink-0" />
                <span className="text-[14px] text-gray-700 font-medium flex-1 text-left">{term}</span>
                <ChevronRight size={13} className="text-gray-300" />
              </motion.button>
            ))}
          </div>
        </section>
      </motion.div>
    );
  }

  if (searching) {
    return (
      <div className="flex flex-col items-center py-24 gap-3">
        <Loader2 size={26} className="text-purple-400 animate-spin" />
        <p className="text-[14px] text-gray-400">Searching…</p>
      </div>
    );
  }

  const { users, posts, hashtags } = results;
  const hasResults = users.length + posts.length + hashtags.length > 0;

  if (!hasResults) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center py-24 text-center px-4"
      >
        <div
          className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #6B73FF22, #FF6B9D22)' }}
        >
          <Search size={28} className="text-purple-400" />
        </div>
        <h3 className="font-black text-[17px] text-gray-800 mb-1.5">No results for "{query}"</h3>
        <p className="text-[13.5px] text-gray-400 max-w-[220px] leading-relaxed">
          Try searching for a person, post, topic, or interest.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="search-results"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="px-4 pt-2 space-y-7"
    >
      {users.length > 0 && (
        <section>
          <SectionHeader emoji="👥" title="People" />
          <div className="mt-3 space-y-2">
            {users.map((u, i) => (
              <UserRow key={u.id} user={u} index={i} currentUserId={currentUserId} />
            ))}
          </div>
        </section>
      )}
      {posts.length > 0 && (
        <section>
          <SectionHeader emoji="📝" title="Posts" />
          <div className="mt-3 space-y-2">
            {posts.map(p => <PostSearchRow key={p.id} post={p} />)}
          </div>
        </section>
      )}
      {hashtags.length > 0 && (
        <section>
          <SectionHeader emoji="#️⃣" title="Topics" />
          <div className="mt-3 flex flex-wrap gap-2">
            {hashtags.map((tag, i) => (
              <motion.button
                key={tag}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onSearch(tag)}
                className="px-4 py-2 rounded-xl bg-white border border-black/[0.06] text-[13.5px] font-bold text-gray-700 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm"
              >
                {tag}
              </motion.button>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}

// ─── ForYouView ───────────────────────────────────────────────────────────────

interface ForYouViewProps {
  posts: Post[];
  loading: boolean;
  onReact: (postId: string, emoji: string) => void;
  onSave: (postId: string, saved: boolean) => void;
  onOpenPhoto: (src: string) => void;
}

function ForYouView({ posts, loading, onReact, onSave, onOpenPhoto }: ForYouViewProps) {
  const [, navigate] = useLocation();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleShare(postId: string) {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(postId);
    setTimeout(() => setCopiedId(prev => prev === postId ? null : prev), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4 px-4 pt-2">
        {[0, 1, 2].map(i => (
          <div key={i} className={cn('rounded-[24px] bg-gray-100 animate-pulse', i === 0 ? 'h-52' : 'h-44')} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 px-6 text-center">
        <span className="text-4xl mb-3">🌊</span>
        <p className="font-black text-[16px] text-gray-700 mb-2">Your feed is waiting</p>
        <p className="text-[13px] text-gray-400 leading-relaxed max-w-[220px]">
          Follow people, react to posts, and select interests in the Suggested tab to personalize your feed.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2">
      {posts.map((post, index) => (
        <div key={post.id} className="relative">
          <PostCard
            post={post}
            index={index}
            onReact={onReact}
            onOpenComments={() => navigate(`/post/${post.id}`)}
            onOpenShare={() => handleShare(post.id)}
            onSave={(id, saved) => onSave(id, !saved)}
            onOpenMenu={() => navigate(`/post/${post.id}`)}
            onOpenPhoto={onOpenPhoto}
          />
          <AnimatePresence>
            {copiedId === post.id && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-full bg-gray-900/90 text-white text-[12px] font-semibold pointer-events-none"
              >
                Link copied!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ─── TrendingView ─────────────────────────────────────────────────────────────

interface TrendingViewProps {
  hashtags: Array<{ tag: string; count: number }>;
  sparks: Array<{ prompt: string; count: number }>;
  creators: User[];
  posts: Post[];
  currentUserId?: string;
  onSearch: (term: string) => void;
  onReact: (postId: string, emoji: string) => void;
  onSave: (postId: string, saved: boolean) => void;
}

const TRENDING_PAGE_SIZE = 12;

function TrendingView({
  hashtags, sparks, creators, posts, currentUserId, onSearch, onReact, onSave,
}: TrendingViewProps) {
  const displayHashtags = hashtags.length >= 4 ? hashtags : DEMO_TRENDING_HASHTAGS;
  const displaySparks   = sparks.length  >= 1 ? sparks   : DEMO_TRENDING_SPARKS;

  // Paginated top-posts — reset page when posts list changes (e.g. category filter)
  const [pageCount, setPageCount] = useState(TRENDING_PAGE_SIZE);
  useEffect(() => { setPageCount(TRENDING_PAGE_SIZE); }, [posts]);
  const pagedPosts = posts.slice(0, pageCount);
  const hasMore    = pageCount < posts.length;
  const loadMore   = useCallback(() =>
    setPageCount(n => Math.min(n + TRENDING_PAGE_SIZE, posts.length)),
  [posts.length]);

  return (
    <motion.div
      key="trending"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="pt-3 pb-6 space-y-8"
    >
      {/* Trending Hashtags */}
      <section className="px-4">
        <SectionHeader emoji="🔥" title="Trending Topics" />
        <div className="mt-3 flex flex-wrap gap-2">
          {displayHashtags.map(({ tag, count }, i) => (
            <HashtagPill key={tag} tag={tag} count={count} index={i} onClick={() => onSearch(tag)} />
          ))}
        </div>
      </section>

      {/* Daily Sparks */}
      <section className="px-4">
        <SectionHeader emoji="✨" title="Trending Daily Sparks"
          subtitle="What people are answering today" />
        <div className="mt-3 space-y-3">
          {displaySparks.map(s => <SparkCard key={s.prompt} {...s} />)}
        </div>
      </section>

      {/* Rising Creators */}
      {creators.length > 0 && (
        <section>
          <div className="px-4">
            <SectionHeader emoji="⭐" title="Rising Creators" />
          </div>
          <div
            className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2"
            style={{ scrollbarWidth: 'none' }}
          >
            {creators.slice(0, 8).map((u, i) => (
              <UserCard key={u.id} user={u} index={i} currentUserId={currentUserId} />
            ))}
          </div>
        </section>
      )}

      {/* Top Posts Grid — infinite scroll via ExploreGrid */}
      {posts.length > 0 && (
        <section className="px-4">
          <SectionHeader emoji="📈" title="Top Posts" />
          <div className="mt-3">
            <ExploreGrid
              posts={pagedPosts}
              hasMore={hasMore}
              loadMore={loadMore}
              loading={false}
              onReact={onReact}
              onSave={onSave}
            />
          </div>
        </section>
      )}
    </motion.div>
  );
}

// ─── SuggestedView ────────────────────────────────────────────────────────────

interface SuggestedViewProps {
  creators: User[];
  currentUserId?: string;
  selectedInterests: string[];
  onToggleInterest: (interest: string) => void;
  onInterestToggled?: () => void;
  liveHashtags: Array<{ tag: string; count: number }>;
}

function SuggestedView({
  creators, currentUserId, selectedInterests, onToggleInterest, onInterestToggled, liveHashtags,
}: SuggestedViewProps) {
  const [communities, setCommunities] = useState<DiscoverCommunity[]>(() =>
    mockCommunities.filter(c => !c.isJoined) as DiscoverCommunity[]
  );

  // Fetch communities from Firestore, ordered by member count.
  // Falls back to mock data when Firebase is not configured or the collection is empty.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    import('@/lib/firebase').then(({ db }) => {
      if (!db) return;
      import('firebase/firestore').then(({ getDocs, collection, query, orderBy, limit }) => {
        getDocs(query(collection(db, 'communities'), orderBy('memberCount', 'desc'), limit(12)))
          .then(snap => {
            if (snap.empty) return; // keep mock fallback
            const fetched: DiscoverCommunity[] = snap.docs.map(d => {
              const data = d.data();
              return {
                id:          d.id,
                name:        data.name        ?? '',
                emoji:       data.emoji       ?? '🌐',
                category:    data.category    ?? '',
                memberCount: data.memberCount ?? 0,
                isJoined:    data.isJoined    ?? false,
              };
            });
            setCommunities(fetched.filter(c => !c.isJoined));
          })
          .catch(() => {}); // silently keep mock fallback
      });
    });
  }, []);

  return (
    <motion.div
      key="suggested"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="pt-3 pb-6 space-y-8"
    >
      {/* People You May Know */}
      {creators.length > 0 && (
        <section>
          <div className="px-4">
            <SectionHeader emoji="👥" title="People You May Know" />
          </div>
          <div
            className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2"
            style={{ scrollbarWidth: 'none' }}
          >
            {creators.map((u, i) => (
              <UserCard key={u.id} user={u} index={i} currentUserId={currentUserId} />
            ))}
          </div>
        </section>
      )}

      {/* Circles to Join */}
      {communities.length > 0 && (
        <section className="px-4">
          <SectionHeader emoji="🌐" title="Circles to Join"
            subtitle="Communities that match your vibe" />
          <div className="mt-3 space-y-2">
            {communities.slice(0, 6).map((c, i) => (
              <CommunityRow key={c.id} community={c} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Topics to Follow */}
      <section className="px-4">
        <SectionHeader emoji="🏷️" title="Topics to Follow" />
        <div className="mt-3 flex flex-wrap gap-2">
          {(liveHashtags.length >= 4 ? liveHashtags : DEMO_TRENDING_HASHTAGS).map(({ tag }) => (
            <button
              key={tag}
              className="px-4 py-2 rounded-xl bg-white border border-black/[0.06] text-[13px] font-bold text-gray-700 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm"
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Your Interests */}
      <section className="px-4">
        <SectionHeader
          emoji="💫"
          title="Your Interests"
          subtitle="Tap to personalize your For You feed"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.filter(c => c.slug !== 'for-you' && c.slug !== 'trending').map(cat => {
            const selected = selectedInterests.includes(cat.label);
            return (
              <motion.button
                key={cat.slug}
                whileTap={{ scale: 0.92 }}
                onClick={() => { onToggleInterest(cat.label); onInterestToggled?.(); }}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-bold transition-all border',
                  selected
                    ? 'text-white border-transparent shadow-md'
                    : 'bg-white text-gray-600 border-black/[0.07] hover:border-purple-200',
                )}
                style={selected ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
              >
                <span className="text-[13px]">{cat.emoji}</span>
                <span>{cat.label}</span>
                {selected && <span className="text-[11px] opacity-80">✓</span>}
              </motion.button>
            );
          })}
        </div>
        {selectedInterests.length > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-[12px] text-purple-500 font-semibold text-center"
          >
            ✓ {selectedInterests.length} interest{selectedInterests.length !== 1 ? 's' : ''} selected — your For You feed is being personalised
          </motion.p>
        )}
      </section>
    </motion.div>
  );
}

// ─── Main Discover Page ────────────────────────────────────────────────────────

const TABS = ['For You', 'Trending', 'Suggested', 'Search'] as const;
type Tab = typeof TABS[number];

export default function Discover() {
  const { currentUser } = useAuth();
  const personalization = usePersonalization();
  const followingIds    = useFollowingIds(currentUser?.id);

  // ── Search state ───────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Tab + category state ───────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState<Tab>('For You');
  const [prevTab,   setPrevTab]       = useState<Tab>('For You');
  const [activeCategory, setActiveCategory] = useState('for-you');
  const isSearchMode = activeTab === 'Search';

  // ── Data ───────────────────────────────────────────────────────────────────
  const discover = useDiscover(activeCategory);

  // Filter suggested creators: exclude self and anyone already followed
  const unfollowedCreators = useMemo(
    () => discover.suggestedCreators.filter(
      u => u.id !== currentUser?.id && !followingIds.has(u.id)
    ),
    [discover.suggestedCreators, currentUser?.id, followingIds],
  );

  // ── Local optimistic overrides for reactions + saves ───────────────────────
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Post>>>({});

  const mergedPosts = useMemo(
    () => discover.allPosts.map(p => ({ ...p, ...localOverrides[p.id] })),
    [discover.allPosts, localOverrides],
  );

  const rankedForYou = useMemo(
    () => personalization.rankPosts(mergedPosts, currentUser?.interests ?? []),
    [mergedPosts, currentUser?.interests, personalization.signals],
  );

  // ── Photo viewer ──────────────────────────────────────────────────────────
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  // ── Reaction handler ───────────────────────────────────────────────────────
  function handleReact(postId: string, emoji: string) {
    if (!currentUser) return;
    const base = discover.allPosts.find(p => p.id === postId);
    if (!base) return;

    const current   = { ...base, ...localOverrides[postId] };
    const prevEmoji = current.myReaction ?? null;
    const toggledOff = prevEmoji === emoji;
    const nextEmoji = toggledOff ? null : emoji;

    const newReactions: Record<string, string[]> = { ...current.reactions ?? {} };
    if (prevEmoji && newReactions[prevEmoji]) {
      newReactions[prevEmoji] = newReactions[prevEmoji].filter(id => id !== currentUser.id);
    }
    if (!toggledOff) {
      newReactions[emoji] = [
        ...(newReactions[emoji] ?? []).filter(id => id !== currentUser.id),
        currentUser.id,
      ];
    }
    const newTotal = Object.values(newReactions).reduce((n, arr) => n + arr.length, 0);

    setLocalOverrides(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        reactions: newReactions,
        myReaction: nextEmoji,
        likes: newTotal,
        liked: nextEmoji !== null,
      },
    }));

    if (isFirebaseConfigured) {
      fsToggleReaction(postId, currentUser.id, emoji).catch(console.error);
      if (!toggledOff && base.authorId !== currentUser.id) {
        fsWriteNotification(base.authorId, 'reaction', currentUser as Parameters<typeof fsWriteNotification>[2], {
          postId,
          message: `${currentUser.displayName} ${emoji} ${reactionPhrase(emoji)} your post`,
        }).catch(console.error);
      }
    }
    personalization.trackReaction(postId);
  }

  // ── Save handler ───────────────────────────────────────────────────────────
  function handleSave(postId: string, currentlySaved: boolean) {
    setLocalOverrides(prev => ({
      ...prev,
      [postId]: { ...prev[postId], saved: !currentlySaved },
    }));
    if (currentUser && isFirebaseConfigured) {
      togglePostSave(postId, currentUser.id, currentlySaved).catch(console.error);
    }
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  function handleSearch(term: string) {
    setSearchQuery(term);
    personalization.trackSearch(term);
    if (activeTab !== 'Search') {
      setPrevTab(activeTab);
      setActiveTab('Search');
    }
    inputRef.current?.focus();
  }

  function dismissSearch() {
    setSearchQuery('');
    inputRef.current?.blur();
    setActiveTab(prevTab !== 'Search' ? prevTab : 'For You');
  }

  // ── Category tap ──────────────────────────────────────────────────────────
  function handleCategorySelect(slug: string) {
    setActiveCategory(slug);
    personalization.trackCategory(slug);
    if (slug === 'trending') setActiveTab('Trending');
    else setActiveTab('For You');
  }

  // ── Tab switch ────────────────────────────────────────────────────────────
  function handleTabSelect(tab: Tab) {
    if (tab === 'Search') {
      setPrevTab(activeTab !== 'Search' ? activeTab : prevTab);
      setActiveTab('Search');
      // Delay focus so the tab animation can settle first
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    setSearchQuery('');
    setActiveTab(tab);
    if (tab === 'Trending') setActiveCategory('trending');
    else if (activeCategory === 'trending') setActiveCategory('for-you');
  }

  // ── Filtered posts for trending/explore (use merged for accuracy) ─────────
  const trendingPosts = useMemo(
    () => [...mergedPosts]
      .filter(p => !p.sparkAudience || p.sparkAudience === 'public')
      .sort((a, b) => (b.likes + b.comments * 1.5) - (a.likes + a.comments * 1.5))
      .slice(0, 24),
    [mergedPosts],
  );

  return (
    <div className="min-h-screen pb-32" style={{ background: '#FDF9F6' }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30" style={{ background: 'rgba(253,249,246,0.96)', backdropFilter: 'blur(16px)' }}>
        <div className="px-4 pt-6 pb-3">
          <AnimatePresence mode="wait">
            {activeTab !== 'Search' && (
              <motion.h1
                key="title"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-[28px] font-black tracking-tight mb-3 bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 50%, #FF6B9D 100%)' }}
              >
                Discover
              </motion.h1>
            )}
          </AnimatePresence>

          {/* Search bar */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search people, posts, topics…"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== 'Search') {
                    setPrevTab(activeTab);
                    setActiveTab('Search');
                  }
                }}
                onFocus={() => {
                  if (activeTab !== 'Search') {
                    setPrevTab(activeTab);
                    setActiveTab('Search');
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    personalization.trackSearch(searchQuery);
                  }
                  if (e.key === 'Escape') dismissSearch();
                }}
                className="w-full bg-white border border-black/[0.06] rounded-2xl pl-10 pr-10 py-3 text-[14.5px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                >
                  <X size={15} className="text-gray-400" />
                </button>
              )}
            </div>
            <AnimatePresence>
              {isSearchMode && (
                <motion.button
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  onClick={dismissSearch}
                  className="text-[13.5px] font-bold text-purple-500 whitespace-nowrap"
                >
                  Cancel
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tab bar — always visible */}
        <div className="flex border-b border-black/[0.05]">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => handleTabSelect(tab)}
              className={cn(
                'flex-1 py-2.5 text-[12px] font-bold transition-all relative',
                activeTab === tab ? 'text-gray-900' : 'text-gray-400',
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 inset-x-3 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #6B73FF, #FF6B9D)' }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'Search' ? (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SearchView
              query={searchQuery}
              onSearch={handleSearch}
              currentUserId={currentUser?.id}
              discoverSearch={discover.search}
              recentSearches={personalization.signals.recentSearches}
              onRemoveSearch={personalization.removeSearch}
              onClearSearches={personalization.clearSearches}
              trendingHashtags={discover.trendingHashtags}
            />
          </motion.div>
        ) : (
          <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Category chips */}
            <CategoryChips active={activeCategory} onSelect={handleCategorySelect} />

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === 'For You' && (
                <motion.div key="foryou" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <ForYouView
                    posts={rankedForYou}
                    loading={discover.loading}
                    onReact={handleReact}
                    onSave={handleSave}
                    onOpenPhoto={src => setPhotoSrc(src)}
                  />
                </motion.div>
              )}

              {activeTab === 'Trending' && (
                <motion.div key="trending" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <TrendingView
                    hashtags={discover.trendingHashtags}
                    sparks={discover.trendingSparks}
                    creators={unfollowedCreators}
                    posts={trendingPosts}
                    currentUserId={currentUser?.id}
                    onSearch={handleSearch}
                    onReact={handleReact}
                    onSave={handleSave}
                  />
                </motion.div>
              )}

              {activeTab === 'Suggested' && (
                <motion.div key="suggested" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <SuggestedView
                    creators={unfollowedCreators}
                    currentUserId={currentUser?.id}
                    selectedInterests={personalization.signals.interests}
                    onToggleInterest={personalization.toggleInterest}
                    onInterestToggled={() => setTimeout(() => setActiveTab('For You'), 600)}
                    liveHashtags={discover.trendingHashtags}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Photo viewer ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {photoSrc && (
          <PhotoViewer
            src={photoSrc}
            onClose={() => setPhotoSrc(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Users, Zap, X, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { mockUsers, mockCommunities } from '@/lib/mockData';
import type { User } from '@/lib/mockData';
import { Link } from 'wouter';
import { getGradientPair } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { searchUsers as fsSearchUsers, followUser as fsFollow, unfollowUser as fsUnfollow } from '@/lib/firestore';

const TRENDING_TAGS = [
  '#Design2025', '#TechNews', '#Photography',
  '#WorkoutRoutine', '#MusicProduction', '#AIArt', '#WebDev',
];

// ─── Follow button (slim, for list rows) ─────────────────────────────────────

function FollowButton({ userId, currentUserId }: { userId: string; currentUserId?: string }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!currentUserId || loading) return;
    setLoading(true);
    try {
      if (following) {
        if (isFirebaseConfigured) await fsUnfollow(currentUserId, userId);
        setFollowing(false);
      } else {
        if (isFirebaseConfigured) await fsFollow(currentUserId, userId);
        setFollowing(true);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={handle}
      disabled={loading}
      className={cn(
        'flex-shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition-all disabled:opacity-60',
        following ? 'bg-gray-100 text-gray-500' : 'text-white'
      )}
      style={!following ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : following
        ? <><UserCheck size={12} /> Following</>
        : <><UserPlus size={12} /> Follow</>}
    </motion.button>
  );
}

// ─── User card ────────────────────────────────────────────────────────────────

function UserCard({ user, index, currentUserId }: { user: User; index: number; currentUserId?: string }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFollow() {
    if (!currentUserId || loading) return;
    setLoading(true);
    try {
      if (following) {
        if (isFirebaseConfigured) await fsUnfollow(currentUserId, user.id);
        setFollowing(false);
      } else {
        if (isFirebaseConfigured) await fsFollow(currentUserId, user.id);
        setFollowing(true);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="min-w-[164px] p-4 rounded-[22px] bg-white border border-black/[0.05] shadow-sm flex flex-col items-center text-center shrink-0"
    >
      <Link href={`/profile/${user.id}`}>
        <div className="mb-3 cursor-pointer hover:opacity-90 transition-opacity">
          <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={64} />
        </div>
      </Link>
      <Link href={`/profile/${user.id}`}>
        <p className="font-bold text-[14.5px] text-gray-900 truncate w-full hover:text-purple-600 transition-colors cursor-pointer">
          {user.displayName}
        </p>
      </Link>
      <p className="text-[12px] text-gray-400 mb-1">@{user.handle}</p>
      <p className="text-[11.5px] text-gray-400 mb-4">
        {user.interests.slice(0, 2).join(' · ')}
      </p>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handleFollow}
        disabled={loading}
        className={cn(
          'w-full py-2 rounded-full text-[12.5px] font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60',
          following ? 'bg-gray-100 text-gray-500' : 'text-white'
        )}
        style={!following ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 2px 10px rgba(107,115,255,0.30)' } : {}}
      >
        {loading
          ? <Loader2 size={13} className="animate-spin" />
          : following
          ? <><UserCheck size={13} /> Following</>
          : <><UserPlus size={13} /> Follow</>}
      </motion.button>
    </motion.div>
  );
}

// ─── Community row ────────────────────────────────────────────────────────────

function CommunityRow({ community, index }: { community: typeof mockCommunities[number]; index: number }) {
  const [joined, setJoined] = useState(community.isJoined);
  const [from] = getGradientPair(community.name);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3.5 p-3.5 rounded-[20px] bg-white border border-black/[0.05] shadow-sm hover:shadow-md transition-all"
    >
      <Link href={`/communities/${community.id}`} className="flex-shrink-0">
        <div
          className="w-14 h-14 rounded-[16px] flex items-center justify-center text-2xl shadow-sm"
          style={{ background: `linear-gradient(135deg, ${from}33, ${from}18)` }}
        >
          {community.emoji}
        </div>
      </Link>
      <Link href={`/communities/${community.id}`} className="flex-1 min-w-0">
        <h3 className="font-bold text-[14.5px] text-gray-900 truncate">{community.name}</h3>
        <p className="text-[12px] text-gray-400 truncate">
          {community.category} · {(community.memberCount / 1000).toFixed(1)}k members
        </p>
      </Link>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setJoined(v => !v)}
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black transition-all',
          joined ? 'bg-gray-100 text-gray-500' : 'text-white'
        )}
        style={!joined ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 2px 10px rgba(107,115,255,0.30)' } : {}}
      >
        {joined ? '✓' : '+'}
      </motion.button>
    </motion.div>
  );
}

// ─── Search results ───────────────────────────────────────────────────────────

function SearchResults({ query, currentUserId }: { query: string; currentUserId?: string }) {
  const [liveUsers, setLiveUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    if (isFirebaseConfigured) {
      setSearching(true);
      fsSearchUsers(q)
        .then(results => setLiveUsers(results.filter(u => u.id !== currentUserId)))
        .catch(() => setLiveUsers([]))
        .finally(() => setSearching(false));
    } else {
      setLiveUsers(mockUsers.filter(u =>
        (u.displayName.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q) || u.bio?.toLowerCase().includes(q))
        && u.id !== currentUserId
      ));
    }
  }, [query, currentUserId]);

  const q = query.toLowerCase();
  const users = isFirebaseConfigured ? liveUsers : liveUsers;
  const communities = mockCommunities.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.category.toLowerCase().includes(q) ||
    c.description?.toLowerCase().includes(q)
  );
  const tags = TRENDING_TAGS.filter(t => t.toLowerCase().includes(q));

  if (searching) {
    return (
      <div className="flex flex-col items-center py-24 gap-3">
        <Loader2 size={28} className="text-purple-400 animate-spin" />
        <p className="text-[14px] text-gray-400">Searching…</p>
      </div>
    );
  }

  const hasResults = users.length || communities.length || tags.length;

  if (!hasResults) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center py-24 text-center"
      >
        <div
          className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #6B73FF22, #FF6B9D22)' }}
        >
          <Search size={28} className="text-purple-400" />
        </div>
        <h3 className="font-black text-[17px] text-gray-800 mb-1.5">No results for "{query}"</h3>
        <p className="text-[14px] text-gray-400 max-w-[220px] leading-relaxed">
          Try searching for a person, circle, or topic.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* People */}
      {users.length > 0 && (
        <section>
          <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-wider mb-3 px-1">
            People
          </h2>
          <div className="space-y-2">
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-[18px] bg-white border border-black/[0.05] shadow-sm"
              >
                <Link href={`/profile/${user.id}`} className="flex-shrink-0">
                  <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={48} />
                </Link>
                <Link href={`/profile/${user.id}`} className="flex-1 min-w-0">
                  <p className="font-bold text-[14.5px] text-gray-900 truncate">{user.displayName}</p>
                  <p className="text-[12.5px] text-gray-400">@{user.handle}</p>
                </Link>
                <FollowButton userId={user.id} currentUserId={currentUserId} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Circles */}
      {communities.length > 0 && (
        <section>
          <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-wider mb-3 px-1">
            Circles
          </h2>
          <div className="space-y-2">
            {communities.map((c, i) => (
              <CommunityRow key={c.id} community={c} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Topics */}
      {tags.length > 0 && (
        <section>
          <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-wider mb-3 px-1">
            Topics
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag}
                className="px-4 py-2 rounded-xl bg-white border border-black/[0.06] text-[13.5px] font-bold text-gray-700 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Discover() {
  const [search, setSearch] = useState('');
  const { currentUser } = useAuth();

  return (
    <div className="pb-32 min-h-screen bg-[#FDF9F6]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#FDF9F6]/95 backdrop-blur-md px-4 pt-6 pb-4 border-b border-black/[0.05]">
        <h1 className="text-[26px] font-black text-gray-900 tracking-tight mb-4">Discover</h1>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search people, circles, topics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-black/[0.06] rounded-2xl pl-10 pr-10 py-3.5 text-[14.5px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-6">
        <AnimatePresence mode="wait">
          {search ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SearchResults query={search} currentUserId={currentUser?.id} />
            </motion.div>
          ) : (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-10">

              {/* Trending Topics */}
              <section>
                <h2 className="text-[16px] font-black text-gray-900 flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-purple-500" />
                  Trending Topics
                </h2>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_TAGS.map(tag => (
                    <motion.button
                      key={tag}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setSearch(tag)}
                      className="px-4 py-2 rounded-xl bg-white border border-black/[0.06] text-[13.5px] font-bold text-gray-700 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm"
                    >
                      {tag}
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* Suggested Friends */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-black text-gray-900 flex items-center gap-2">
                    <Users size={18} className="text-pink-400" />
                    Suggested Friends
                  </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
                  {mockUsers.filter(u => u.id !== currentUser?.id).map((user, i) => (
                    <UserCard key={user.id} user={user} index={i} currentUserId={currentUser?.id} />
                  ))}
                </div>
              </section>

              {/* Growing Communities */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-black text-gray-900 flex items-center gap-2">
                    <Zap size={18} className="text-amber-400" />
                    Growing Circles
                  </h2>
                  <Link href="/communities">
                    <span className="text-[13px] font-bold text-purple-500 hover:text-purple-700 transition-colors">
                      See all →
                    </span>
                  </Link>
                </div>
                <div className="space-y-2">
                  {mockCommunities.slice(0, 5).map((c, i) => (
                    <CommunityRow key={c.id} community={c} index={i} />
                  ))}
                </div>
              </section>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

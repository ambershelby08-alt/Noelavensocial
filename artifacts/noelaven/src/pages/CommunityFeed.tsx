import React, { useState, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Share2, Users, Flame, Globe, Lock, Shield,
  Check, Plus, Search, X, Heart, MessageCircle, Bookmark,
  Calendar, MoreHorizontal, UserPlus, UserCheck, ChevronRight,
  Sparkles, Image as ImageIcon, LayoutGrid,
} from 'lucide-react';
import { mockCommunities, mockPosts, mockUsers } from '@/lib/mockData';
import type { Community, Post, User } from '@/lib/mockData';
import { isFirebaseConfigured } from '@/lib/firebase';
import { followUser as fsFollow, unfollowUser as fsUnfollow } from '@/lib/firestore';
import { useCommunities } from '@/hooks/useCommunities';
import { PostCard } from '@/pages/Home';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const CAT_GRADIENT: Record<string, [string, string]> = {
  'Design':      ['#F5C542', '#C44FDB'],
  'Technology':  ['#4F75FF', '#6EC6F5'],
  'Photography': ['#FF8C42', '#F5C542'],
  'Music':       ['#FFD93D', '#FF8C42'],
  'Travel':      ['#3CC2A8', '#4F75FF'],
  'Fitness':     ['#2ECC71', '#3CC2A8'],
  'Gaming':      ['#F5C542', '#4F75FF'],
  'Reading':     ['#FF8C42', '#C44FDB'],
  'Food':        ['#F5C542', '#FFD93D'],
  'Wellness':    ['#3CC2A8', '#C44FDB'],
};

function getCatGradient(cat: string): [string, string] {
  return CAT_GRADIENT[cat] ?? getGradientPair(cat);
}

// ─── Quick post composer ──────────────────────────────────────────────────────

function QuickComposer({
  user,
  communityName,
  onPost,
}: {
  user: User;
  communityName: string;
  onPost: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    await new Promise(r => setTimeout(r, 600));
    onPost(text.trim());
    setText('');
    setPosting(false);
    setFocused(false);
  }

  return (
    <div className="mx-4 mb-4 bg-[#111] rounded-[22px] border border-[#1a1a1a] shadow-sm overflow-hidden">
      <div className="flex gap-3 p-4">
        <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={40} className="flex-shrink-0" />
        <div className="flex-1">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={`Share something with ${communityName}…`}
            rows={focused ? 3 : 1}
            className="w-full bg-[#111] rounded-xl px-3.5 py-2.5 text-[14px] text-white placeholder:text-[#555] outline-none resize-none leading-relaxed transition-all focus:bg-[#111] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)]"
          />
          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between mt-2.5"
              >
                <div className="flex gap-1">
                  <button className="p-2 rounded-full text-[rgba(255,255,255,0.45)] hover:text-[#EC4899] hover:bg-[rgba(236,72,153,0.08)] transition-all">
                    <ImageIcon size={16} />
                  </button>
                  <button className="p-2 rounded-full text-[rgba(255,255,255,0.45)] hover:text-[#EC4899] hover:bg-[rgba(236,72,153,0.08)] transition-all">
                    <Sparkles size={16} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setFocused(false); setText(''); }}
                    className="px-4 py-1.5 rounded-full text-[13px] font-semibold text-[#BDBDBD] hover:bg-[#1a1a1a] transition-all"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handlePost}
                    disabled={!text.trim() || posting}
                    className="px-5 py-1.5 rounded-full text-[13px] font-black text-white disabled:opacity-40 flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 2px 10px rgba(124,58,237,0.35)' }}
                  >
                    {posting
                      ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : 'Post'
                    }
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Moderator card ───────────────────────────────────────────────────────────

function ModCard({ userId, from, to }: { userId: string; from: string; to: string }) {
  const user = mockUsers.find(u => u.id === userId);
  const name = user?.displayName ?? userId;
  return (
    <Link href={user ? `/profile/${user.id}` : '#'}>
      <div className="flex items-center gap-3 py-2.5 cursor-pointer group">
        <UserAvatar userId={userId} fallbackName={name} fallbackSrc={user?.avatarUrl || undefined} size={44} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14px] text-white group-hover:text-[#EC4899] transition-colors truncate">{name}</p>
          <p className="text-[12px] text-[rgba(255,255,255,0.45)] truncate">@{user?.handle ?? userId}</p>
        </div>
        <span
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          <Shield size={10} /> Mod
        </span>
      </div>
    </Link>
  );
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ user, currentUserId }: { user: User; currentUserId?: string }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const isMe = user.id === currentUserId;

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
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={`/profile/${user.id}`}>
        <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={46} className="cursor-pointer hover:scale-105 transition-transform flex-shrink-0" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${user.id}`}>
          <p className="font-bold text-[14px] text-white hover:text-[#EC4899] transition-colors truncate cursor-pointer">{user.displayName}</p>
        </Link>
        <p className="text-[12px] text-[rgba(255,255,255,0.45)] truncate">@{user.handle} · {fmtNum(user.followers)} followers</p>
      </div>
      {!isMe && (
        <motion.button
          whileTap={{ scale: 0.92 }}
          disabled={loading}
          onClick={handleFollow}
          className={cn(
            'flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[12.5px] font-bold flex-shrink-0 transition-all disabled:opacity-60',
            following ? 'bg-[#1a1a1a] text-[#BDBDBD]' : 'text-white shadow-sm'
          )}
          style={!following ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 2px 10px rgba(107,115,255,0.25)' } : {}}
        >
          {loading
            ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : following ? <><UserCheck size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
        </motion.button>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-28 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-white font-bold text-[13.5px] shadow-xl whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
        >
          <Check size={15} /> {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Feed', 'About', 'Members', 'Rules'] as const;
type TabId = typeof TABS[number];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommunityFeed() {
  const [, params] = useRoute('/communities/:id');
  const { currentUser } = useAuth();
  const { toggleJoin } = useCommunities();

  const base = mockCommunities.find(c => c.id === params?.id) ?? mockCommunities[0];
  const [community, setCommunity] = useState<Community>(base);

  const [activeTab, setActiveTab]   = useState<TabId>('Feed');
  const [memberSearch, setMemberSearch] = useState('');
  const [toast, setToast]           = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Local posts state (allows composing new ones)
  const communityPosts = mockPosts.filter(p => p.communityId === community.id || !p.communityId);
  const [extraPosts, setExtraPosts] = useState<Post[]>([]);
  const allPosts = [...extraPosts, ...communityPosts];

  const [from, to] = getCatGradient(community.category);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }

  async function handleJoin() {
    const joining = !community.isJoined;
    setCommunity(prev => ({
      ...prev,
      isJoined: joining,
      memberCount: joining ? prev.memberCount + 1 : Math.max(0, prev.memberCount - 1),
    }));
    showToast(joining ? `Joined ${community.name}! 🎉` : `Left ${community.name}`);
    try {
      await toggleJoin(community.id);
    } catch {
      // revert on error
      setCommunity(prev => ({
        ...prev,
        isJoined: !joining,
        memberCount: joining ? Math.max(0, prev.memberCount - 1) : prev.memberCount + 1,
      }));
    }
  }

  function handleNewPost(text: string) {
    if (!currentUser) return;
    const newPost: Post = {
      id: `post-live-${Date.now()}`,
      authorId: currentUser.id,
      author: currentUser,
      content: text,
      communityId: community.id,
      likes: 0,
      comments: 0,
      shares: 0,
      liked: false,
      saved: false,
      createdAt: new Date(),
    };
    setExtraPosts(prev => [newPost, ...prev]);
    setCommunity(prev => ({ ...prev, postCount: prev.postCount + 1 }));
    showToast('Posted! ✨');
  }

  // Members: mods first, then others
  const modUsers  = mockUsers.filter(u => community.moderatorIds.includes(u.id));
  const otherUsers = mockUsers.filter(u => !community.moderatorIds.includes(u.id));
  const allMembers = [...modUsers, ...otherUsers];
  const filteredMembers = memberSearch
    ? allMembers.filter(u => u.displayName.toLowerCase().includes(memberSearch.toLowerCase()) || u.handle.toLowerCase().includes(memberSearch.toLowerCase()))
    : allMembers;

  return (
    <div className="min-h-screen bg-black pb-36">

      {/* ── Banner ──────────────────────────────────────────────────── */}
      <div className="relative h-56 overflow-hidden">
        {/* Gradient base */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${from}ee 0%, ${to}ee 100%)` }}
        />
        {/* Banner image overlay */}
        {community.bannerUrl && (
          <img
            src={community.bannerUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay"
          />
        )}
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />

        {/* Back + share */}
        <div className="absolute top-4 left-4">
          <Link href="/communities">
            <button className="w-10 h-10 bg-black/25 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/40 transition-colors">
              <ArrowLeft size={18} className="text-white" />
            </button>
          </Link>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <button className="w-10 h-10 bg-black/25 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/40 transition-colors">
            <Share2 size={16} className="text-white" />
          </button>
          <button className="w-10 h-10 bg-black/25 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/40 transition-colors">
            <MoreHorizontal size={18} className="text-white" />
          </button>
        </div>

        {/* Category badge */}
        <div className="absolute top-14 left-4">
          <span className="flex items-center gap-1 bg-black/30 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full">
            {community.isPrivate ? <><Lock size={9} /> Private</> : <><Globe size={9} /> Public</>}
            {' · '}
            {community.category}
          </span>
        </div>

        {/* Emoji at bottom */}
        <div className="absolute bottom-8 left-4">
          <div
            className="w-14 h-14 rounded-[18px] flex items-center justify-center text-3xl shadow-lg border-2 border-white/30"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            {community.emoji}
          </div>
        </div>
      </div>

      {/* ── Info section ─────────────────────────────────────────────── */}
      <div className="px-4 -mt-4 mb-5">
        <h1 className="text-[24px] font-black text-white tracking-tight mb-0.5">{community.name}</h1>
        <p className="text-[14px] text-[#BDBDBD] leading-relaxed mb-4 line-clamp-2">{community.description}</p>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-[13px] text-[#BDBDBD] font-medium">
            <Users size={14} className="text-[#EC4899]" />
            <span><strong className="text-white font-black">{fmtNum(community.memberCount)}</strong> members</span>
          </div>
          <div className="w-px h-4 bg-[#222]" />
          <div className="flex items-center gap-1.5 text-[13px] text-[#BDBDBD] font-medium">
            <Flame size={14} className="text-pink-400" />
            <span><strong className="text-white font-black">{fmtNum(community.postCount)}</strong> posts</span>
          </div>
          <div className="w-px h-4 bg-[#222]" />
          <div className="flex items-center gap-1.5 text-[13px] text-[#BDBDBD] font-medium">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span><strong className="text-white font-black">{community.onlineCount}</strong> online</span>
          </div>
        </div>

        {/* Join / Joined */}
        {community.isJoined ? (
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111] border border-[#2a2a2a] text-[#BDBDBD] font-black text-[14px]">
              <Check size={15} className="text-green-500" /> Joined
            </div>
            <button
              onClick={handleJoin}
              className="px-5 py-2.5 rounded-full bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[13px] hover:bg-red-50 hover:text-red-400 transition-all"
            >
              Leave
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleJoin}
            className="w-full py-3.5 rounded-2xl text-[16px] font-black text-white shadow-lg flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 4px 18px ${from}55` }}
          >
            <Plus size={18} /> Join Circle
          </motion.button>
        )}
      </div>

      {/* ── Sticky tabs ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a] px-2">
        <div className="flex">
          {TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-3.5 text-[13.5px] font-semibold relative transition-colors',
                  active ? 'text-white' : 'text-[rgba(255,255,255,0.45)] hover:text-[#BDBDBD]'
                )}
              >
                {tab}
                {active && (
                  <motion.div
                    layoutId="circleTabIndicator"
                    className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                    style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.17 }}
          className="mt-4"
        >

          {/* Feed */}
          {activeTab === 'Feed' && (
            <div>
              {community.isJoined && currentUser && (
                <QuickComposer
                  user={currentUser}
                  communityName={community.name}
                  onPost={handleNewPost}
                />
              )}
              {!community.isJoined && (
                <div className="mx-4 mb-4 flex items-center gap-3 bg-[#111] rounded-[20px] border border-[#1a1a1a] p-4">
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 text-xl"
                    style={{ background: `linear-gradient(135deg, ${from}22, ${to}22)` }}
                  >
                    {community.emoji}
                  </div>
                  <p className="text-[13.5px] text-[#BDBDBD] flex-1">
                    Join this circle to post and engage with the community.
                  </p>
                  <button
                    onClick={handleJoin}
                    className="px-4 py-2 rounded-full text-[12.5px] font-black text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                  >
                    Join
                  </button>
                </div>
              )}
              {allPosts.length > 0
                ? allPosts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)
                : (
                  <div className="flex flex-col items-center py-20 text-center px-6">
                    <p className="text-5xl mb-4">{community.emoji}</p>
                    <h3 className="font-black text-[17px] text-white mb-1.5">No posts yet</h3>
                    <p className="text-[14px] text-[rgba(255,255,255,0.45)] max-w-[200px] leading-relaxed">Be the first to share something with this circle!</p>
                  </div>
                )
              }
            </div>
          )}

          {/* About */}
          {activeTab === 'About' && (
            <div className="px-4 space-y-4">
              {/* Description */}
              <div className="bg-[#111] rounded-[22px] border border-[#1a1a1a] shadow-sm p-5">
                <h3 className="font-black text-[15px] text-white mb-3">About this Circle</h3>
                <p className="text-[14.5px] text-[#BDBDBD] leading-relaxed">{community.description}</p>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    { label: 'Members', value: fmtNum(community.memberCount), icon: Users, color: '#EC4899' },
                    { label: 'Posts',   value: fmtNum(community.postCount),   icon: LayoutGrid, color: '#EC4899' },
                    { label: 'Online',  value: String(community.onlineCount),  icon: Flame, color: '#2ECC71' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex flex-col items-center py-4 rounded-[16px] border border-[#1a1a1a]" style={{ background: `${color}0d` }}>
                      <Icon size={16} style={{ color }} className="mb-1.5" />
                      <span className="font-black text-[18px] text-white">{value}</span>
                      <span className="text-[11px] text-[rgba(255,255,255,0.45)] font-medium">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Founded */}
                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[#1a1a1a] text-[13px] text-[rgba(255,255,255,0.45)]">
                  <Calendar size={14} />
                  <span>Founded {format(community.createdAt, 'MMMM yyyy')}</span>
                  <span>·</span>
                  {community.isPrivate
                    ? <><Lock size={12} /> Private</>
                    : <><Globe size={12} /> Public</>
                  }
                </div>
              </div>

              {/* Moderators */}
              <div className="bg-[#111] rounded-[22px] border border-[#1a1a1a] shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-7 h-7 rounded-[10px] flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${from}33, ${to}33)` }}
                  >
                    <Shield size={14} style={{ color: from }} />
                  </div>
                  <h3 className="font-black text-[15px] text-white">Moderators</h3>
                  <span className="ml-auto text-[12px] text-[rgba(255,255,255,0.45)]">{community.moderatorIds.length}</span>
                </div>
                <div className="divide-y divide-[#1a1a1a]">
                  {community.moderatorIds.map(id => (
                    <ModCard key={id} userId={id} from={from} to={to} />
                  ))}
                </div>
              </div>

              {/* Rules preview */}
              {community.rules.length > 0 && (
                <button
                  onClick={() => setActiveTab('Rules')}
                  className="w-full bg-[#111] rounded-[22px] border border-[#1a1a1a] shadow-sm p-5 text-left"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-[15px] text-white">Rules</h3>
                    <div className="flex items-center gap-1 text-[13px] text-[#EC4899] font-bold">
                      View all <ChevronRight size={14} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {community.rules.slice(0, 2).map((rule, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5"
                          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-[13.5px] text-[#BDBDBD] leading-relaxed">{rule}</p>
                      </div>
                    ))}
                    {community.rules.length > 2 && (
                      <p className="text-[12.5px] text-[rgba(255,255,255,0.45)] pl-8">+{community.rules.length - 2} more rules</p>
                    )}
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Members */}
          {activeTab === 'Members' && (
            <div className="px-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.45)]" />
                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search members…"
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded-2xl pl-10 pr-4 py-3 text-[14px] placeholder:text-[#555] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)] transition-all shadow-sm"
                />
                {memberSearch && (
                  <button onClick={() => setMemberSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={15} className="text-[rgba(255,255,255,0.45)]" />
                  </button>
                )}
              </div>

              {/* Mods section */}
              {!memberSearch && modUsers.length > 0 && (
                <div className="mb-2">
                  <p className="text-[11.5px] font-black uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-1 px-1">Moderators</p>
                  <div className="bg-[#111] rounded-[20px] border border-[#1a1a1a] shadow-sm px-4 divide-y divide-[#1a1a1a]">
                    {modUsers.map(u => (
                      <div key={u.id} className="relative">
                        <MemberCard user={u} currentUserId={currentUser?.id} />
                        <span
                          className="absolute top-3 right-0 flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                        >
                          <Shield size={8} /> MOD
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All members */}
              <div>
                {!memberSearch && (
                  <p className="text-[11.5px] font-black uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-1 px-1 mt-3">
                    Members · {fmtNum(community.memberCount)}
                  </p>
                )}
                <div className="bg-[#111] rounded-[20px] border border-[#1a1a1a] shadow-sm px-4 divide-y divide-[#1a1a1a]">
                  {filteredMembers.length > 0
                    ? filteredMembers.map(u => (
                        <MemberCard key={u.id} user={u} currentUserId={currentUser?.id} />
                      ))
                    : (
                      <div className="py-12 text-center">
                        <p className="text-[14px] text-[rgba(255,255,255,0.45)]">No members match your search.</p>
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
          )}

          {/* Rules */}
          {activeTab === 'Rules' && (
            <div className="px-4">
              {community.rules.length > 0 ? (
                <div className="space-y-3">
                  {/* Header card */}
                  <div
                    className="rounded-[22px] p-5 flex items-center gap-4"
                    style={{ background: `linear-gradient(135deg, ${from}18, ${to}12)` }}
                  >
                    <div
                      className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                    >
                      {community.emoji}
                    </div>
                    <div>
                      <p className="font-black text-[15px] text-white">{community.name} Rules</p>
                      <p className="text-[12.5px] text-[#BDBDBD] mt-0.5">Please read before posting.</p>
                    </div>
                  </div>

                  {/* Rule cards */}
                  {community.rules.map((rule, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="bg-[#111] rounded-[20px] border border-[#1a1a1a] shadow-sm p-5 flex items-start gap-4"
                    >
                      <div
                        className="w-9 h-9 rounded-[12px] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 3px 10px ${from}44` }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-[14.5px] text-white leading-relaxed font-medium">{rule}</p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Footer note */}
                  <p className="text-[12px] text-[rgba(255,255,255,0.45)] text-center py-4 px-6 leading-relaxed">
                    Violations may result in post removal or ban. Mods have final say.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-20 text-center">
                  <p className="text-4xl mb-4">📋</p>
                  <h3 className="font-black text-[17px] text-white mb-1.5">No rules yet</h3>
                  <p className="text-[14px] text-[rgba(255,255,255,0.45)]">This circle is running on vibes alone.</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <Toast message={toast} visible={toastVisible} />
    </div>
  );
}

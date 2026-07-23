import React, { useState, useRef, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3, Camera, X, Check, Sparkles, Users, MessageCircle,
  Grid3X3, Heart, Bookmark, Calendar, Share2, UserPlus,
  UserCheck, ChevronRight, AtSign, FileText, Star, Plus,
  ArrowLeft,
} from 'lucide-react';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import { CoverPhotoEditor, type CoverSavePayload } from '@/components/profile/CoverPhotoEditor';
import { mockUsers, mockConversations } from '@/lib/mockData';
import type { User, Post, Community } from '@/lib/mockData';
import { useProfile } from '@/hooks/useProfile';
import { useCommunities } from '@/hooks/useCommunities';
import { PostCard } from '@/pages/Home';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const INTEREST_GRADIENTS: Record<string, [string, string]> = {
  'Art & Design':   ['#FF6B9D', '#C44FDB'],
  'Technology':     ['#4F75FF', '#6EC6F5'],
  'Photography':    ['#FF8C42', '#FF6B9D'],
  'Travel':         ['#3CC2A8', '#4F75FF'],
  'Music':          ['#FFD93D', '#FF8C42'],
  'Food & Cooking': ['#FF6B9D', '#FFD93D'],
  'Fitness':        ['#2ECC71', '#3CC2A8'],
  'Gaming':         ['#9B59B6', '#4F75FF'],
  'Reading':        ['#FF8C42', '#C44FDB'],
  'Nature':         ['#2ECC71', '#4F75FF'],
  'Movies & TV':    ['#C44FDB', '#FF6B9D'],
  'Science':        ['#4F75FF', '#2ECC71'],
  'Fashion':        ['#FF6B9D', '#FFD93D'],
  'DIY & Making':   ['#FF8C42', '#2ECC71'],
  'Wellness':       ['#3CC2A8', '#C44FDB'],
  'Pets':           ['#FFD93D', '#FF6B9D'],
};

const ALL_INTERESTS = [
  { label: 'Art & Design', emoji: '🎨' },
  { label: 'Technology',   emoji: '💻' },
  { label: 'Music',        emoji: '🎵' },
  { label: 'Travel',       emoji: '✈️' },
  { label: 'Photography',  emoji: '📷' },
  { label: 'Food & Cooking', emoji: '🍳' },
  { label: 'Fitness',      emoji: '💪' },
  { label: 'Gaming',       emoji: '🎮' },
  { label: 'Reading',      emoji: '📚' },
  { label: 'Nature',       emoji: '🌿' },
  { label: 'Movies & TV',  emoji: '🎬' },
  { label: 'Science',      emoji: '🔬' },
  { label: 'Fashion',      emoji: '👗' },
  { label: 'DIY & Making', emoji: '🛠️' },
  { label: 'Wellness',     emoji: '🧘' },
  { label: 'Pets',         emoji: '🐾' },
];

const BADGE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  'Verified':      { bg: '#EEF0FF', text: '#6B73FF', icon: '✓' },
  'Top Creator':   { bg: '#FFF0F6', text: '#FF6B9D', icon: '🌟' },
  'Early Adopter': { bg: '#FFF8EE', text: '#FF8C42', icon: '🚀' },
  'Hero':          { bg: '#EEF8F0', text: '#2ECC71', icon: '🦸' },
  'Community Builder': { bg: '#F5EEF8', text: '#9B59B6', icon: '🏘️' },
  'New Member':    { bg: '#F0FAFF', text: '#4F75FF', icon: '👋' },
};

const MOCK_SPARKS = [
  {
    id: 'spark-1',
    prompt: 'What made you smile today?',
    response: "Found a butterfly landing on my camera lens while shooting in the park. Those unexpected moments are the best! 🦋",
    likes: 87, liked: false,
    date: new Date(Date.now() - 86400000),
  },
  {
    id: 'spark-2',
    prompt: "Share a song that's been stuck in your head.",
    response: "Been humming 'Vienna' by Billy Joel all week. Some songs just age like fine wine. 🎵",
    likes: 54, liked: true,
    date: new Date(Date.now() - 86400000 * 3),
  },
  {
    id: 'spark-3',
    prompt: "What's a small win you had this week?",
    response: "Finally finished that photography course I started 6 months ago. Better late than never — now I feel unstoppable! 📷✨",
    likes: 102, liked: false,
    date: new Date(Date.now() - 86400000 * 5),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relDate(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return format(d, 'MMM d');
}

function getInterestGradient(label: string): [string, string] {
  return INTEREST_GRADIENTS[label] ?? getGradientPair(label);
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      onClick={onClose}
    />
  );
}

// ─── Followers / Following sheet ──────────────────────────────────────────────

interface UserListSheetProps {
  title: string;
  users: User[];
  currentUserId?: string;
  onClose: () => void;
}

function UserListSheet({ title, users, currentUserId, onClose }: UserListSheetProps) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[75vh] flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="font-bold text-[16px] text-gray-900">{title}</span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1">
          {users.map((u, i) => {
            const isMe = u.id === currentUserId;
            const isFollowing = followed.has(u.id);
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 py-2.5 px-1"
              >
                <Link href={`/profile/${u.id}`} onClick={onClose}>
                  <GradientAvatar name={u.displayName} size={46} className="cursor-pointer hover:scale-105 transition-transform flex-shrink-0" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${u.id}`} onClick={onClose}>
                    <p className="font-bold text-[14px] text-gray-900 hover:underline truncate">{u.displayName}</p>
                  </Link>
                  <p className="text-[12px] text-gray-400 truncate">@{u.handle} · {fmtNum(u.followers)} followers</p>
                </div>
                {!isMe && (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setFollowed(prev => {
                      const s = new Set(prev);
                      s.has(u.id) ? s.delete(u.id) : s.add(u.id);
                      return s;
                    })}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all flex-shrink-0',
                      isFollowing
                        ? 'bg-gray-100 text-gray-600'
                        : 'text-white shadow-sm'
                    )}
                    style={!isFollowing ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 2px 10px rgba(107,115,255,0.30)' } : {}}
                  >
                    {isFollowing ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

// ─── Edit Profile Drawer ──────────────────────────────────────────────────────

interface EditDrawerProps {
  user: User;
  onSave: (updates: Partial<User>) => void;
  onClose: () => void;
}

function EditProfileDrawer({ user, onSave, onClose }: EditDrawerProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [handle, setHandle]           = useState(user.handle);
  const [bio, setBio]                 = useState(user.bio);
  const [interests, setInterests]     = useState<string[]>(user.interests);
  const [saving, setSaving]           = useState(false);
  const [avatarUrl, setAvatarUrl]     = useState(user.avatarUrl ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function toggleInterest(label: string) {
    setInterests(prev => prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]);
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await uploadImage(file, 'avatars');
      setAvatarUrl(url);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!displayName.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSave({
      displayName: displayName.trim(),
      handle: handle.trim() || user.handle,
      bio: bio.trim(),
      interests,
      ...(avatarUrl !== (user.avatarUrl ?? '') ? { avatarUrl } : {}),
    });
    setSaving(false);
    onClose();
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-[#FDF9F6] rounded-t-[32px] shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] flex-shrink-0">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
          <span className="font-black text-[16px] text-gray-900">Edit Profile</span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={!displayName.trim() || saving}
            className="px-5 py-2 rounded-full text-[14px] font-bold text-white disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.35)' }}
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={14} /> Save</>}
          </motion.button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6 pb-safe">
          {/* Hidden file input for avatar upload */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarFile}
          />

          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={isCloudinaryConfigured ? () => avatarInputRef.current?.click() : undefined}
              className={`relative group ${isCloudinaryConfigured ? 'cursor-pointer' : 'cursor-default'}`}
              title={isCloudinaryConfigured ? 'Upload profile photo' : undefined}
            >
              <GradientAvatar
                name={displayName || user.displayName}
                src={avatarUrl || undefined}
                size={88}
              />
              {avatarUploading ? (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              ) : isCloudinaryConfigured ? (
                <div className="absolute inset-0 rounded-full bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
              ) : null}
              <div
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
              >
                <Camera size={14} className="text-white" />
              </div>
            </button>
            <p className="text-[12px] text-gray-400">
              {isCloudinaryConfigured
                ? (avatarUrl && avatarUrl !== (user.avatarUrl ?? '') ? 'Photo ready — save to apply' : 'Tap to upload a profile photo')
                : 'Your avatar updates as you type your name'}
            </p>
          </div>

          {/* Display name */}
          <div>
            <label className="text-[13px] font-semibold text-gray-600 ml-1 block mb-1.5">Display Name</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder="Your name"
              className="w-full bg-white border border-black/[0.08] rounded-2xl px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>

          {/* Handle */}
          <div>
            <label className="text-[13px] font-semibold text-gray-600 ml-1 block mb-1.5">Username</label>
            <div className="flex items-center bg-white border border-black/[0.08] rounded-2xl px-4 py-3.5 gap-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
              <AtSign size={16} className="text-purple-400 flex-shrink-0" />
              <input
                value={handle}
                onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={30}
                placeholder="yourhandle"
                className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 outline-none"
              />
              <span className="text-[12px] text-gray-400">{handle.length}/30</span>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-[13px] font-semibold text-gray-600 ml-1 block mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={160}
              rows={4}
              placeholder="Tell the world what makes you, you… ✨"
              className="w-full bg-white border border-black/[0.08] rounded-2xl px-4 py-3.5 text-[14.5px] text-gray-900 placeholder:text-gray-400 outline-none resize-none leading-relaxed focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            />
            <p className="text-[12px] text-gray-400 text-right mt-1 mr-1">{bio.length}/160</p>
          </div>

          {/* Interests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-gray-600 ml-1">Interests</label>
              <span className="text-[12px] text-purple-500 font-semibold">{interests.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_INTERESTS.map(({ label, emoji }) => {
                const sel = interests.includes(label);
                const [from, to] = getInterestGradient(label);
                return (
                  <motion.button
                    key={label}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => toggleInterest(label)}
                    className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all border',
                      sel ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-black/[0.08] hover:border-purple-200'
                    )}
                    style={sel ? { background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 2px 10px ${from}44` } : {}}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                    {sel && <Check size={11} strokeWidth={3} />}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Interest chip ────────────────────────────────────────────────────────────

function InterestChip({ label }: { label: string }) {
  const emoji = ALL_INTERESTS.find(i => i.label === label)?.emoji ?? '✨';
  const [from, to] = getInterestGradient(label);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 2px 8px ${from}44` }}
    >
      <span>{emoji}</span>
      {label}
    </span>
  );
}

// ─── Badge chip ───────────────────────────────────────────────────────────────

function BadgeChip({ label }: { label: string }) {
  const style = BADGE_STYLES[label] ?? { bg: '#F3F4F6', text: '#6B7280', icon: '🏅' };
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-bold"
      style={{ background: style.bg, color: style.text }}
    >
      <span className="text-[10px]">{style.icon}</span>
      {label}
    </span>
  );
}

// ─── Circle card (community) ──────────────────────────────────────────────────

function CircleCard({ community }: { community: Community }) {
  const [joined, setJoined] = useState(community.isJoined);
  const [from, to] = getGradientPair(community.name);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[20px] shadow-sm border border-black/[0.04] overflow-hidden"
    >
      {/* Mini banner */}
      <div className="h-16 relative" style={{ background: `linear-gradient(135deg, ${from}cc, ${to}cc)` }}>
        {community.bannerUrl && (
          <img src={community.bannerUrl} alt="" className="w-full h-full object-cover opacity-60 mix-blend-overlay" />
        )}
      </div>
      <div className="px-3.5 pt-2.5 pb-3.5">
        <p className="font-bold text-[14px] text-gray-900 truncate">{community.name}</p>
        <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1">{fmtNum(community.memberCount)} members</p>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setJoined(v => !v)}
          className={cn(
            'mt-3 w-full py-2 rounded-full text-[12.5px] font-bold transition-all',
            joined ? 'bg-gray-100 text-gray-500' : 'text-white shadow-sm'
          )}
          style={!joined ? { background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 2px 8px ${from}55` } : {}}
        >
          {joined ? '✓ Joined' : '+ Join'}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Spark card ───────────────────────────────────────────────────────────────

interface SparkItem { id: string; prompt: string; response: string; imageUrl?: string; likes: number; liked: boolean; date: Date; }

function SparkCard({ spark, user, onOpenPhoto }: { spark: SparkItem; user: User; onOpenPhoto?: (src: string) => void }) {
  const [liked, setLiked] = useState(spark.liked);
  const [likes, setLikes] = useState(spark.likes);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 bg-white rounded-[24px] border border-black/[0.04] shadow-sm overflow-hidden"
    >
      {/* Gradient spark header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg, #6B73FF22, #FF6B9D15)' }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
        >
          <Sparkles size={12} className="text-white" />
        </div>
        <p className="text-[12px] font-semibold text-purple-600 flex-1 truncate">"{spark.prompt}"</p>
        <span className="text-[11px] text-gray-400 flex-shrink-0">{relDate(spark.date)}</span>
      </div>

      {/* Response */}
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <GradientAvatar name={user.displayName} src={user.avatarUrl || undefined} size={34} className="flex-shrink-0 mt-0.5" />
          <p className="text-[14.5px] text-gray-800 leading-relaxed flex-1">{spark.response}</p>
        </div>
        {spark.imageUrl && (
          <div
            className="mt-3 rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => onOpenPhoto?.(spark.imageUrl!)}
          >
            <img src={spark.imageUrl} alt="Spark photo" className="w-full max-h-56 object-cover" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-3.5 flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.82 }}
          onClick={() => { setLiked(v => !v); setLikes(n => liked ? n - 1 : n + 1); }}
          className={cn(
            'flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-all',
            liked ? 'text-pink-500 bg-pink-50' : 'text-gray-400 hover:bg-gray-50'
          )}
        >
          <motion.span animate={liked ? { scale: [1, 1.4, 1] } : {}}>
            <Heart size={15} className={cn(liked && 'fill-pink-500 stroke-pink-500')} />
          </motion.span>
          <span>{likes}</span>
        </motion.button>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-gray-400 hover:bg-gray-50 transition-all">
          <MessageCircle size={15} />
          <span>Reply</span>
        </button>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-gray-400 hover:bg-gray-50 transition-all ml-auto">
          <Share2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="font-bold text-[17px] text-gray-800 mb-1.5">{title}</h3>
      <p className="text-[14px] text-gray-400 leading-relaxed max-w-[220px]">{subtitle}</p>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS_OWN    = ['Posts', 'Circles', 'Sparks', 'Liked', 'Saved'] as const;
const TABS_OTHER  = ['Posts', 'Circles', 'Sparks'] as const;
type TabLabel = typeof TABS_OWN[number];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  const [, params]   = useRoute('/profile/:userId');
  const { currentUser, updateUser } = useAuth();
  const userId = params?.userId;

  // Resolve displayed user via hook (handles Firebase + demo mode)
  const { user: hookUser, posts: hookPosts } = useProfile(userId);
  const isOwnProfile = currentUser?.id === userId;
  const user: User = hookUser ?? (isOwnProfile && currentUser ? currentUser : mockUsers[0]);

  const { communities } = useCommunities();

  const [activeTab, setActiveTab]       = useState<TabLabel>('Posts');
  const [editOpen, setEditOpen]             = useState(false);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [followersOpen, setFollowersOpen]   = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [isFollowing, setIsFollowing]   = useState(false);
  const [followerCount, setFollowerCount] = useState(user.followers);
  const [photoViewer, setPhotoViewer] = useState<{ src: string } | null>(null);

  const tabs = (isOwnProfile ? TABS_OWN : TABS_OTHER) as readonly TabLabel[];
  const tabIcons: Record<TabLabel, React.ReactNode> = {
    Posts:   <Grid3X3 size={15} />,
    Circles: <Users size={15} />,
    Sparks:  <Sparkles size={15} />,
    Liked:   <Heart size={15} />,
    Saved:   <Bookmark size={15} />,
  };

  // Data for each tab
  const userPosts    = hookPosts;
  const likedPosts   = hookPosts.filter(p => p.liked);
  const savedPosts   = hookPosts.filter(p => p.saved);
  const userCircles  = communities.filter(c => c.isJoined || c.moderatorIds.includes(user.id));
  const sparks: SparkItem[] = userPosts
    .filter(p => p.sparkPrompt)
    .map(p => ({
      id: p.id,
      prompt: p.sparkPrompt!,
      response: p.content,
      imageUrl: p.imageUrl,
      likes: p.likes,
      liked: p.liked,
      date: p.createdAt,
    }));

  // Followers/following lists (mock for now)
  const followersList = mockUsers.filter(u => u.id !== user.id);
  const followingList = mockUsers.filter(u => u.id !== user.id).slice(0, 3);

  const [from, to] = getGradientPair(user.displayName);

  function handleFollow() {
    setIsFollowing(v => !v);
    setFollowerCount(n => isFollowing ? n - 1 : n + 1);
  }

  function handleSave(updates: Partial<User>) {
    if (isOwnProfile) updateUser(updates);
  }

  async function handleCoverSave(payload: CoverSavePayload) {
    if (isOwnProfile) updateUser({ coverUrl: payload.coverUrl, coverPosition: payload.coverPosition });
  }

  return (
    <div className="min-h-screen bg-[#FDF9F6] pb-32">

      {/* ── Cover ───────────────────────────────────────────────────────── */}
      <div className="relative h-48 overflow-hidden">
        {/* Gradient fallback (always shown underneath) */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${from}55 0%, ${to}44 50%, ${from}33 100%)` }}
        />
        {user.coverUrl && (
          <img
            src={user.coverUrl}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
            style={{ objectPosition: `${user.coverPosition?.x ?? 50}% ${user.coverPosition?.y ?? 50}%` }}
          />
        )}
        {/* Bottom fade to page bg */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FDF9F6] to-transparent" />

        {/* Top action row */}
        {!isOwnProfile && (
          <button
            onClick={() => window.history.back()}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-all z-10"
          >
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
        )}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {isOwnProfile ? (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold bg-white/85 backdrop-blur-sm text-gray-700 shadow-sm hover:bg-white transition-all"
            >
              <Edit3 size={14} /> Edit
            </button>
          ) : (
            <button className="w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-all">
              <Share2 size={16} className="text-gray-700" />
            </button>
          )}
        </div>

        {/* Edit Cover button — own profile only */}
        {isOwnProfile && (
          <button
            onClick={() => setCoverEditorOpen(true)}
            className="absolute bottom-6 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold bg-black/40 backdrop-blur-sm text-white shadow-sm hover:bg-black/55 active:scale-95 transition-all"
          >
            <Camera size={13} /> Edit Cover
          </button>
        )}
      </div>

      {/* ── Avatar row ──────────────────────────────────────────────────── */}
      <div className="px-4 -mt-12 flex items-end justify-between">
        {/* Avatar */}
        <div className="relative">
          <div className="ring-4 ring-[#FDF9F6] rounded-full shadow-xl">
            <GradientAvatar name={user.displayName} src={user.avatarUrl || undefined} size={88} />
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setEditOpen(true)}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#FDF9F6] shadow-md"
              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
            >
              <Camera size={12} className="text-white" />
            </button>
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex items-center gap-2 mb-1">
          {isOwnProfile ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setEditOpen(true)}
              className="px-5 py-2.5 rounded-full bg-white border border-black/[0.08] text-gray-700 font-bold text-[13.5px] shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
            >
              <Edit3 size={14} /> Edit Profile
            </motion.button>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={handleFollow}
                className={cn(
                  'px-5 py-2.5 rounded-full font-bold text-[13.5px] transition-all flex items-center gap-1.5',
                  isFollowing ? 'bg-white border border-black/[0.08] text-gray-700 shadow-sm' : 'text-white shadow-md'
                )}
                style={!isFollowing ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 14px rgba(107,115,255,0.35)' } : {}}
              >
                {isFollowing ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
              </motion.button>
              <Link href={(() => {
                const conv = mockConversations.find(c =>
                  c.type === 'direct' && c.participants.some(p => p.id === user.id)
                );
                return conv ? `/messages/${conv.id}` : '/messages';
              })()}>
                <button className="w-10 h-10 rounded-full bg-white border border-black/[0.08] flex items-center justify-center shadow-sm hover:shadow-md transition-all">
                  <MessageCircle size={17} className="text-purple-500" />
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Profile info ─────────────────────────────────────────────────── */}
      <div className="px-4 mt-4">
        {/* Name + badges */}
        <div className="flex items-start gap-2 flex-wrap mb-0.5">
          <h1 className="text-[22px] font-black text-gray-900 tracking-tight leading-tight">{user.displayName}</h1>
        </div>
        <p className="text-[14px] text-gray-400 font-medium mb-1">@{user.handle}</p>

        {/* Badges */}
        {user.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {user.badges.map(b => <BadgeChip key={b} label={b} />)}
          </div>
        )}

        {/* Bio */}
        {user.bio ? (
          <p className="text-[14.5px] text-gray-700 leading-relaxed mb-3 max-w-sm">{user.bio}</p>
        ) : isOwnProfile ? (
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 text-[13.5px] text-purple-400 font-semibold mb-3 hover:text-purple-600 transition-colors"
          >
            <Plus size={14} /> Add a bio
          </button>
        ) : null}

        {/* Joined date */}
        <div className="flex items-center gap-1.5 text-[12.5px] text-gray-400 mb-4">
          <Calendar size={13} />
          <span>Joined {format(user.joinedAt, 'MMMM yyyy')}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5 mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-[18px] font-black text-gray-900">{fmtNum(user.postCount || userPosts.length)}</span>
            <span className="text-[13px] text-gray-400 font-medium">Posts</span>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={() => setFollowersOpen(true)}
            className="flex items-baseline gap-1 hover:opacity-75 transition-opacity"
          >
            <span className="text-[18px] font-black text-gray-900">{fmtNum(followerCount)}</span>
            <span className="text-[13px] text-gray-400 font-medium">Followers</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={() => setFollowingOpen(true)}
            className="flex items-baseline gap-1 hover:opacity-75 transition-opacity"
          >
            <span className="text-[18px] font-black text-gray-900">{fmtNum(user.following)}</span>
            <span className="text-[13px] text-gray-400 font-medium">Following</span>
          </button>
        </div>

        {/* Interests */}
        {user.interests.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {user.interests.map(i => <InterestChip key={i} label={i} />)}
            {isOwnProfile && (
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-purple-500 border border-purple-200 bg-white hover:bg-purple-50 transition-colors"
              >
                <Plus size={11} /> Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky tab bar ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#FDF9F6]/95 backdrop-blur-md border-b border-black/[0.06] px-2">
        <div className="flex overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3.5 text-[13.5px] font-semibold whitespace-nowrap relative flex-shrink-0 transition-colors',
                  active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {tabIcons[tab]}
                {tab}
                {active && (
                  <motion.div
                    layoutId="profileTabIndicator"
                    className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6B73FF, #FF6B9D)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="mt-4"
        >
          {/* Posts */}
          {activeTab === 'Posts' && (
            userPosts.length > 0
              ? userPosts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)
              : <EmptyState emoji="📝" title="No posts yet" subtitle={isOwnProfile ? "Share your first thought with the world!" : "This user hasn't posted yet."} />
          )}

          {/* Circles */}
          {activeTab === 'Circles' && (
            userCircles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 px-4">
                {userCircles.map(c => <CircleCard key={c.id} community={c} />)}
              </div>
            ) : (
              <EmptyState emoji="🌐" title="No circles yet" subtitle={isOwnProfile ? "Join a Circle to connect with people who share your interests!" : "This user hasn't joined any Circles yet."} />
            )
          )}

          {/* Sparks */}
          {activeTab === 'Sparks' && (
            sparks.length > 0
              ? sparks.map(s => <SparkCard key={s.id} spark={s} user={user} onOpenPhoto={src => setPhotoViewer({ src })} />)
              : <EmptyState emoji="✨" title="No sparks yet" subtitle="Respond to today's Daily Spark to light up your profile!" />
          )}

          {/* Liked (own only) */}
          {activeTab === 'Liked' && (
            likedPosts.length > 0
              ? likedPosts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)
              : <EmptyState emoji="❤️" title="No liked posts" subtitle="Posts you like will appear here." />
          )}

          {/* Saved (own only) */}
          {activeTab === 'Saved' && (
            savedPosts.length > 0
              ? savedPosts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)
              : <EmptyState emoji="🔖" title="No saved posts" subtitle="Tap the bookmark on any post to save it here." />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editOpen && (
          <EditProfileDrawer
            key="edit"
            user={user}
            onSave={handleSave}
            onClose={() => setEditOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {followersOpen && (
          <UserListSheet
            key="followers"
            title={`Followers · ${fmtNum(followerCount)}`}
            users={followersList}
            currentUserId={currentUser?.id}
            onClose={() => setFollowersOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {followingOpen && (
          <UserListSheet
            key="following"
            title={`Following · ${fmtNum(user.following)}`}
            users={followingList}
            currentUserId={currentUser?.id}
            onClose={() => setFollowingOpen(false)}
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
        {coverEditorOpen && isOwnProfile && (
          <CoverPhotoEditor
            key="cover-editor"
            currentCoverUrl={user.coverUrl ?? ''}
            currentPosition={user.coverPosition ?? { x: 50, y: 50 }}
            gradientFrom={from}
            gradientTo={to}
            onSave={handleCoverSave}
            onClose={() => setCoverEditorOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

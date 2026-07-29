import React, { useState, useRef, useEffect } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3, Camera, X, Check, Sparkles, Users, MessageCircle,
  Grid3X3, Heart, Bookmark, Calendar, Share2, UserPlus,
  UserCheck, ChevronRight, ChevronDown, AtSign, FileText, Star, Plus,
  ArrowLeft, Globe, Lock, UserCircle, Flame, MoreHorizontal,
  VolumeX, UserX, Shield, EyeOff, Settings2, CheckCircle2,
} from 'lucide-react';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import { CoverPhotoEditor, type CoverSavePayload } from '@/components/profile/CoverPhotoEditor';
import { mockUsers, mockConversations } from '@/lib/mockData';
import type { User, Post, Community, SparkAudience } from '@/lib/mockData';
import { useProfile } from '@/hooks/useProfile';
import { useCommunities } from '@/hooks/useCommunities';
import { PostCard } from '@/pages/Home';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { streakBadges } from '@/hooks/useDailySpark';
import { useDailySparkStatus } from '@/contexts/DailySparkContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { updatePostSparkAudience, followUser as fsFollow, unfollowUser as fsUnfollow, subscribeIsFollowing, getUserDoc, getOrCreateDirectConversation } from '@/lib/firestore';
import { notifyFollow } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { FounderBadge } from '@/components/ui/FounderBadge';
import { format } from 'date-fns';
import { normalizeDate, safeGetTime } from '@/lib/timestamp';
import { useSafety } from '@/contexts/SafetyContext';
import { ReportSheet } from '@/components/ui/ReportSheet';

// ─── Audience helpers ─────────────────────────────────────────────────────────

const SPARK_AUDIENCE_OPTIONS: { value: SparkAudience; label: string; icon: React.ReactNode }[] = [
  { value: 'public',  label: '🌍 Public',   icon: <Globe      size={11} /> },
  { value: 'mutuals', label: '👥 Mutuals',  icon: <Users      size={11} /> },
  { value: 'private', label: '🔒 Private',  icon: <Lock       size={11} /> },
  { value: 'onlyMe',  label: '🙋 Only Me',  icon: <UserCircle size={11} /> },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const INTEREST_GRADIENTS: Record<string, [string, string]> = {
  'Art & Design':   ['#F5C542', '#C44FDB'],
  'Technology':     ['#4F75FF', '#6EC6F5'],
  'Photography':    ['#FF8C42', '#F5C542'],
  'Travel':         ['#3CC2A8', '#4F75FF'],
  'Music':          ['#FFD93D', '#FF8C42'],
  'Food & Cooking': ['#F5C542', '#FFD93D'],
  'Fitness':        ['#2ECC71', '#3CC2A8'],
  'Gaming':         ['#F5C542', '#4F75FF'],
  'Reading':        ['#FF8C42', '#C44FDB'],
  'Nature':         ['#2ECC71', '#4F75FF'],
  'Movies & TV':    ['#C44FDB', '#F5C542'],
  'Science':        ['#4F75FF', '#2ECC71'],
  'Fashion':        ['#F5C542', '#FFD93D'],
  'DIY & Making':   ['#FF8C42', '#2ECC71'],
  'Wellness':       ['#3CC2A8', '#C44FDB'],
  'Pets':           ['#FFD93D', '#F5C542'],
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
  'Verified':      { bg: '#EEF0FF', text: '#F5C542', icon: '✓' },
  'Top Creator':   { bg: '#FFF0F6', text: '#F5C542', icon: '🌟' },
  'Early Adopter': { bg: '#FFF8EE', text: '#FF8C42', icon: '🚀' },
  'Hero':          { bg: '#EEF8F0', text: '#2ECC71', icon: '🦸' },
  'Community Builder': { bg: '#F5EEF8', text: '#F5C542', icon: '🏘️' },
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

function relDate(d: unknown) {
  const date = normalizeDate(d);
  if (!date) return 'Today';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return format(date, 'MMM d');
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
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleFollowToggle(userId: string, isFollowing: boolean) {
    if (!currentUserId || loadingId) return;
    setLoadingId(userId);
    try {
      if (isFollowing) {
        if (isFirebaseConfigured) await fsUnfollow(currentUserId, userId);
        setFollowed(prev => { const s = new Set(prev); s.delete(userId); return s; });
      } else {
        if (isFirebaseConfigured) await fsFollow(currentUserId, userId);
        setFollowed(prev => new Set([...prev, userId]));
      }
    } catch { /* ignore */ } finally { setLoadingId(null); }
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] rounded-t-[28px] shadow-2xl max-h-[75vh] flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#222]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#222] flex-shrink-0">
          <span className="font-bold text-[16px] text-white">{title}</span>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
            <X size={18} className="text-[#BDBDBD]" />
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
                  <UserAvatar userId={u.id} fallbackName={u.displayName} fallbackSrc={u.avatarUrl || undefined} size={46} className="cursor-pointer hover:scale-105 transition-transform flex-shrink-0" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${u.id}`} onClick={onClose}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-bold text-[14px] text-white hover:underline truncate">{u.displayName}</p>
                      <FounderBadge userId={u.id} size="xs" />
                    </div>
                  </Link>
                  <p className="text-[12px] text-[rgba(255,255,255,0.45)] truncate">@{u.handle} · {fmtNum(u.followers)} followers</p>
                </div>
                {!isMe && (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    disabled={loadingId === u.id}
                    onClick={() => handleFollowToggle(u.id, isFollowing)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all flex-shrink-0 disabled:opacity-60',
                      isFollowing ? 'bg-[#1a1a1a] text-[#BDBDBD]' : 'text-white shadow-sm'
                    )}
                    style={!isFollowing ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 2px 10px rgba(245,197,66,0.30)' } : {}}
                  >
                    {loadingId === u.id
                      ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                      : isFollowing ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
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
  onSave: (updates: Partial<User>) => Promise<void>;
  onClose: () => void;
}

function EditProfileDrawer({ user, onSave, onClose }: EditDrawerProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [handle, setHandle]           = useState(user.handle);
  const [bio, setBio]                 = useState(user.bio);
  const [interests, setInterests]     = useState<string[]>(user.interests);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
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
    setSaveError(null);
    try {
      const url = await uploadImage(file, 'avatars');
      setAvatarUrl(url);
    } catch (err) {
      setSaveError('Photo upload failed. Please try again.');
      console.error('Avatar upload failed:', err);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function handleSave() {
    const trimmedName   = displayName.trim();
    const trimmedHandle = handle.trim();
    // Both fields must be at least 2 characters — never allow clearing either.
    if (trimmedName.length < 2) return;
    if (trimmedHandle.length < 2) return;

    setSaving(true);
    setSaveError(null);

    // Check handle uniqueness only if the user changed their handle
    if (trimmedHandle !== user.handle) {
      try {
        const { checkHandleAvailable } = await import('@/lib/firestore');
        const { isFirebaseConfigured } = await import('@/lib/firebase');
        if (isFirebaseConfigured) {
          const available = await checkHandleAvailable(trimmedHandle.toLowerCase(), user.id);
          if (!available) {
            setSaveError('That username is already taken — try another');
            setSaving(false);
            return;
          }
        }
      } catch {
        // If check fails, proceed — Firestore write will be attempted
      }
    }

    // Build a partial update — only include fields whose value actually changed.
    // This ensures that editing the display name never silently overwrites the
    // @handle and vice versa.  Each field is independent.
    const updates: Partial<User> = {};
    if (trimmedName !== user.displayName)     updates.displayName = trimmedName;
    if (trimmedHandle !== user.handle)         updates.handle      = trimmedHandle;
    if (bio.trim() !== (user.bio ?? ''))       updates.bio         = bio.trim();
    // Interests comparison is order-sensitive by design; re-write only if different.
    if (JSON.stringify(interests) !== JSON.stringify(user.interests)) updates.interests = interests;
    if (avatarUrl !== (user.avatarUrl ?? '')) updates.avatarUrl   = avatarUrl;

    // Nothing changed — just close without a Firestore round-trip.
    if (Object.keys(updates).length === 0) { onClose(); return; }

    try {
      // Await the full Firestore write — close only after it confirms.
      await onSave(updates);
      onClose();
    } catch (err) {
      setSaveError((err as Error).message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-black rounded-t-[32px] shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <button onClick={onClose} className="p-2 hover:bg-[#1a1a1a] rounded-full transition-colors">
            <X size={20} className="text-[#BDBDBD]" />
          </button>
          <span className="font-black text-[16px] text-white">Edit Profile</span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={displayName.trim().length < 2 || handle.trim().length < 2 || saving}
            className="px-5 py-2 rounded-full text-[14px] font-bold text-white disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 3px 12px rgba(124,58,237,0.4)' }}
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={14} /> Save</>}
          </motion.button>
        </div>

        {/* Save error banner */}
        {saveError && (
          <div className="mx-5 mt-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-2xl text-[12.5px] text-red-600 font-medium flex-shrink-0">
            {saveError}
          </div>
        )}

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
                style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
              >
                <Camera size={14} className="text-white" />
              </div>
            </button>
            <p className="text-[12px] text-[rgba(255,255,255,0.45)]">
              {isCloudinaryConfigured
                ? (avatarUrl && avatarUrl !== (user.avatarUrl ?? '') ? 'Photo ready — save to apply' : 'Tap to upload a profile photo')
                : 'Your avatar updates as you type your name'}
            </p>
          </div>

          {/* Display name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1">Display Name</label>
              <span className={`text-[12px] font-medium mr-1 ${displayName.length > 36 ? 'text-orange-400' : 'text-[rgba(255,255,255,0.45)]'}`}>
                {displayName.length}/40
              </span>
            </div>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="Your name"
              className={`w-full bg-[#111] border rounded-2xl px-4 py-3.5 text-[15px] text-white placeholder:text-[#555] outline-none focus:ring-2 transition-all ${
                displayName.trim().length > 0 && displayName.trim().length < 2
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                  : 'border-[#2a2a2a] focus:border-[#7C3AED] focus:ring-[rgba(124,58,237,0.2)]'
              }`}
            />
            {displayName.trim().length > 0 && displayName.trim().length < 2 && (
              <p className="text-[12px] text-red-500 font-medium mt-1.5 ml-1">Display name must be at least 2 characters</p>
            )}
          </div>

          {/* Handle */}
          <div>
            <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1 block mb-1.5">Username</label>
            <div className={`flex items-center bg-[#111] border rounded-2xl px-4 py-3.5 gap-2 focus-within:ring-2 transition-all ${
              handle.trim().length > 0 && handle.trim().length < 2
                ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100'
                : 'border-[#2a2a2a] focus-within:border-[#F5C542] focus-within:ring-purple-100'
            }`}>
              <AtSign size={16} className="text-[#F5C542] flex-shrink-0" />
              <input
                value={handle}
                onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={30}
                placeholder="yourhandle"
                className="flex-1 bg-transparent text-[15px] text-white placeholder:text-[#555] outline-none"
              />
              <span className="text-[12px] text-[rgba(255,255,255,0.45)]">{handle.length}/30</span>
            </div>
            {handle.trim().length > 0 && handle.trim().length < 2 && (
              <p className="text-[12px] text-red-500 font-medium mt-1.5 ml-1">Username must be at least 2 characters</p>
            )}
            {handle.trim().length === 0 && (
              <p className="text-[12px] text-red-500 font-medium mt-1.5 ml-1">Username cannot be empty</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1 block mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={160}
              rows={4}
              placeholder="Tell the world what makes you, you… ✨"
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-2xl px-4 py-3.5 text-[14.5px] text-white placeholder:text-[#555] outline-none resize-none leading-relaxed focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)] transition-all"
            />
            <p className="text-[12px] text-[rgba(255,255,255,0.45)] text-right mt-1 mr-1">{bio.length}/160</p>
          </div>

          {/* Interests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1">Interests</label>
              <span className="text-[12px] text-[#F5C542] font-semibold">{interests.length} selected</span>
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
                      sel ? 'text-white border-transparent shadow-sm' : 'bg-[#111] text-[#BDBDBD] border-[#2a2a2a] hover:border-[rgba(245,197,66,0.25)]'
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
      className="bg-[#111] rounded-[20px] shadow-sm border border-[#1a1a1a] overflow-hidden"
    >
      {/* Mini banner */}
      <div className="h-16 relative" style={{ background: `linear-gradient(135deg, ${from}cc, ${to}cc)` }}>
        {community.bannerUrl && (
          <img src={community.bannerUrl} alt="" className="w-full h-full object-cover opacity-60 mix-blend-overlay" />
        )}
      </div>
      <div className="px-3.5 pt-2.5 pb-3.5">
        <p className="font-bold text-[14px] text-white truncate">{community.name}</p>
        <p className="text-[12px] text-[rgba(255,255,255,0.45)] mt-0.5 line-clamp-1">{fmtNum(community.memberCount)} members</p>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setJoined(v => !v)}
          className={cn(
            'mt-3 w-full py-2 rounded-full text-[12.5px] font-bold transition-all',
            joined ? 'bg-[#1a1a1a] text-[#BDBDBD]' : 'text-white shadow-sm'
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

interface SparkItem {
  id: string;
  prompt: string;
  response: string;
  imageUrl?: string;
  likes: number;
  liked: boolean;
  date: Date;
  audience: SparkAudience;
  isOwn: boolean;
}

function SparkCard({ spark, user, onOpenPhoto }: { spark: SparkItem; user: User; onOpenPhoto?: (src: string) => void }) {
  const [liked,    setLiked]    = useState(spark.liked);
  const [likes,    setLikes]    = useState(spark.likes);
  const [audience, setAudience] = useState<SparkAudience>(spark.audience);
  const [showAudience, setShowAudience] = useState(false);

  async function changeAudience(next: SparkAudience) {
    setAudience(next);
    setShowAudience(false);
    if (isFirebaseConfigured) {
      await updatePostSparkAudience(spark.id, next).catch(console.error);
    }
  }

  const audienceMeta = SPARK_AUDIENCE_OPTIONS.find(o => o.value === audience) ?? SPARK_AUDIENCE_OPTIONS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 bg-[#111] rounded-[24px] border border-[#1a1a1a] shadow-sm overflow-hidden"
    >
      {/* Gradient spark header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg, #6B73FF22, #FF6B9D15)' }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
        >
          <Sparkles size={12} className="text-white" />
        </div>
        <p className="text-[12px] font-semibold text-[#F5C542] flex-1 truncate">"{spark.prompt}"</p>
        <span className="text-[11px] text-[rgba(255,255,255,0.45)] flex-shrink-0 mr-1">{relDate(spark.date)}</span>
      </div>

      {/* Response */}
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={34} className="flex-shrink-0 mt-0.5" />
          <p className="text-[14.5px] text-white leading-relaxed flex-1">{spark.response}</p>
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
            liked ? 'text-[#F5C542] bg-pink-50' : 'text-[rgba(255,255,255,0.45)] hover:bg-[#111]'
          )}
        >
          <motion.span animate={liked ? { scale: [1, 1.4, 1] } : {}}>
            <Heart size={15} className={cn(liked && 'fill-pink-500 stroke-pink-500')} />
          </motion.span>
          <span>{likes}</span>
        </motion.button>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] transition-all">
          <MessageCircle size={15} />
          <span>Reply</span>
        </button>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] transition-all ml-auto">
          <Share2 size={15} />
        </button>

        {/* Audience picker — own sparks only */}
        {spark.isOwn && (
          <div className="relative ml-1">
            <button
              onClick={() => setShowAudience(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#111] hover:bg-[#1a1a1a] transition-colors text-[11px] font-bold text-[#BDBDBD]"
            >
              {audienceMeta.icon}
              <span className="ml-0.5">{audienceMeta.label.split(' ')[1]}</span>
            </button>
            <AnimatePresence>
              {showAudience && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  exit={{   opacity: 0, scale: 0.92, y: -6  }}
                  className="absolute bottom-full right-0 mb-2 bg-[#111] rounded-2xl shadow-xl border border-[#222] overflow-hidden z-20 min-w-[140px]"
                >
                  {SPARK_AUDIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => changeAudience(opt.value)}
                      className={cn(
                        'w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-[#111]',
                        audience === opt.value ? 'text-[#F5C542] bg-[rgba(245,197,66,0.08)]/60' : 'text-[#BDBDBD]'
                      )}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                      {audience === opt.value && <Check size={12} className="ml-auto text-[#F5C542]" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Spark Tab Content (streak banner + archived responses) ──────────────────

function SparkTabContent({
  sparks, user, isOwn, onOpenPhoto,
}: {
  sparks: SparkItem[];
  user: User;
  isOwn: boolean;
  onOpenPhoto?: (src: string) => void;
}) {
  const { streak } = useDailySparkStatus();
  const badges = streakBadges(streak);

  if (sparks.length === 0) {
    return (
      <EmptyState
        emoji="✨"
        title="No sparks yet"
        subtitle={isOwn ? 'Respond to today\'s Daily Spark to light up your profile!' : 'This user hasn\'t answered any Daily Sparks yet.'}
      />
    );
  }

  return (
    <>
      {/* Streak banner — own profile only */}
      {isOwn && streak > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 px-4 py-3.5 rounded-[20px] flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)', border: '1px solid #FDE68A' }}
        >
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Flame size={20} className="text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-orange-700 text-[14px]">🔥 {streak}-day streak!</p>
            <p className="text-orange-600/70 text-[12px] mt-0.5">Keep answering to grow your streak</p>
          </div>
          {badges.length > 0 && (
            <div className="flex flex-col gap-1 items-end">
              {badges.slice(-1).map(b => (
                <span key={b} className="text-[10.5px] font-bold text-orange-600 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {b}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* All-time badges */}
      {isOwn && badges.length > 0 && (
        <div className="px-4 mb-4 flex flex-wrap gap-2">
          {badges.map(b => (
            <span key={b} className="text-[11.5px] font-bold text-[#F5C542] bg-[rgba(245,197,66,0.08)] border border-[rgba(245,197,66,0.2)] px-3 py-1 rounded-full">
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="px-4 mb-3">
        <p className="text-[11px] font-bold text-[rgba(255,255,255,0.45)] uppercase tracking-wider">
          {sparks.length} {sparks.length === 1 ? 'response' : 'responses'} · newest first
        </p>
      </div>

      {sparks.map(s => (
        <SparkCard key={s.id} spark={s} user={user} onOpenPhoto={onOpenPhoto} />
      ))}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="font-bold text-[17px] text-white mb-1.5">{title}</h3>
      <p className="text-[14px] text-[rgba(255,255,255,0.45)] leading-relaxed max-w-[220px]">{subtitle}</p>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS_OWN    = ['Posts', 'About', 'Sparks', 'Stories', 'Friends', 'Groups'] as const;
const TABS_OTHER  = ['Posts', 'About', 'Sparks', 'Stories', 'Friends', 'Groups'] as const;
type TabLabel = typeof TABS_OWN[number];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  const [, params]   = useRoute('/profile/:userId');
  const { currentUser, updateUser } = useAuth();
  const userId = params?.userId;

  // Resolve displayed user via hook (handles Firebase + demo mode)
  const { user: hookUser, posts: hookPosts, likedPosts, savedPosts } = useProfile(userId);
  const isOwnProfile = currentUser?.id === userId;
  const user: User = hookUser ?? (isOwnProfile && currentUser ? currentUser : mockUsers[0]);

  const { communities } = useCommunities();

  const [activeTab, setActiveTab]       = useState<TabLabel>('Posts');
  // Reset to Posts tab whenever we navigate to a different user's profile
  useEffect(() => { setActiveTab('Posts'); }, [userId]);
  const [editOpen, setEditOpen]             = useState(false);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [followersOpen, setFollowersOpen]   = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [isFollowing, setIsFollowing]   = useState(false);
  const [followerCount, setFollowerCount] = useState(user.followers);

  // ── Real-time follow status ─────────────────────────────────────────────────
  // Profile.tsx previously hardcoded isFollowing = false and never read Firestore,
  // causing the Follow button to reset to "Follow" on every navigation.
  // We now subscribe to users/{currentUser.id}/following/{userId} so the button
  // always reflects the true Firestore state, across navigations and account switches.
  useEffect(() => {
    if (!currentUser || isOwnProfile || !isFirebaseConfigured) {
      setIsFollowing(false);
      return;
    }
    const unsub = subscribeIsFollowing(currentUser.id, userId!, (following) => {
      setIsFollowing(following);
    });
    return unsub;
  }, [currentUser?.id, userId, isOwnProfile]);

  // Keep followerCount in sync with Firestore (user.followers updates when
  // followUser/unfollowUser increments the counter on the target's user doc).
  useEffect(() => {
    setFollowerCount(user.followers ?? 0);
  }, [user.followers]);
  const [photoViewer, setPhotoViewer] = useState<{ src: string } | null>(null);
  const [safetySheetOpen, setSafetySheetOpen] = useState(false);
  const [profileReportOpen, setProfileReportOpen] = useState(false);
  const {
    isBlocked, isMuted, isRestricted,
    blockUser: doBlock, unblockUser: doUnblock,
    muteUser: doMute, unmuteUser: doUnmute,
    restrictUser: doRestrict, unrestrictUser: doUnrestrict,
  } = useSafety();

  const tabs = (isOwnProfile ? TABS_OWN : TABS_OTHER) as readonly TabLabel[];
  const tabIcons: Record<TabLabel, React.ReactNode> = {
    Posts:   <Grid3X3 size={15} />,
    About:   <FileText size={15} />,
    Sparks:  <Sparkles size={15} />,
    Stories: <Star size={15} />,
    Friends: <Users size={15} />,
    Groups:  <Users size={15} />,
  };

  // Data for each tab
  // likedPosts and savedPosts come directly from useProfile, which subscribes
  // to the users/{uid}/liked_posts and users/{uid}/saved_posts Firestore indexes.
  const userPosts = hookPosts;
  const userCircles  = communities.filter(c => c.isJoined || c.moderatorIds.includes(user.id));
  const sparks: SparkItem[] = userPosts
    .filter(p => p.sparkPrompt)
    .sort((a, b) => safeGetTime(b.createdAt) - safeGetTime(a.createdAt))
    .map(p => ({
      id:       p.id,
      prompt:   p.sparkPrompt!,
      response: p.content,
      imageUrl: p.imageUrl,
      likes:    p.likes,
      liked:    p.liked,
      date:     p.createdAt,
      audience: (p.sparkAudience ?? 'public') as SparkAudience,
      isOwn:    isOwnProfile,
    }));

  // Real followers/following lists loaded from Firestore on demand
  const [followersList, setFollowersList] = useState<User[]>([]);
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);

  async function loadFollowLists() {
    if (listsLoaded) return;
    setListsLoaded(true);
    if (!isFirebaseConfigured || !userId) {
      // Demo fallback
      setFollowersList(mockUsers.filter(u => u.id !== user.id));
      setFollowingList(mockUsers.filter(u => u.id !== user.id).slice(0, 3));
      return;
    }
    try {
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');
      const db = getFirestore();
      const [follSnap, folwSnap] = await Promise.all([
        getDocs(collection(db, 'users', userId, 'followers')),
        getDocs(collection(db, 'users', userId, 'following')),
      ]);
      const [followers, following] = await Promise.all([
        Promise.all(follSnap.docs.map(d => getUserDoc(d.id).catch(() => null))),
        Promise.all(folwSnap.docs.map(d => getUserDoc(d.id).catch(() => null))),
      ]);
      setFollowersList(followers.filter(Boolean) as User[]);
      setFollowingList(following.filter(Boolean) as User[]);
    } catch {
      setFollowersList(mockUsers.filter(u => u.id !== user.id));
      setFollowingList(mockUsers.filter(u => u.id !== user.id).slice(0, 3));
    }
  }

  const [from, to] = getGradientPair(user.displayName);
  const [followLoading, setFollowLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [, setLocation] = useLocation();

  async function handleFollow() {
    if (!currentUser || followLoading) return;
    setFollowLoading(true);

    // Optimistic update — button responds instantly.
    // The subscribeIsFollowing listener will confirm the real state once
    // the Firestore write propagates (typically < 200 ms on good connectivity).
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount(n => wasFollowing ? Math.max(0, n - 1) : n + 1);

    try {
      if (wasFollowing) {
        if (isFirebaseConfigured) await fsUnfollow(currentUser.id, user.id);
      } else {
        if (isFirebaseConfigured) {
          // Pass currentUser as actor so fsFollow's internal writeNotification fires.
          // No separate notifyFollow call needed — that would create a duplicate.
          await fsFollow(currentUser.id, user.id, currentUser as unknown as import('@/lib/mockData').User);
        } else {
          // Demo mode: fsFollow is a no-op, so write the demo localStorage notification.
          notifyFollow(user.id, currentUser).catch(console.error);
        }
      }
    } catch {
      // Revert optimistic update on failure — the subscription will also
      // correct the state, but reverting immediately avoids a stale button.
      setIsFollowing(wasFollowing);
      setFollowerCount(n => wasFollowing ? n + 1 : Math.max(0, n - 1));
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleSave(updates: Partial<User>): Promise<void> {
    if (isOwnProfile) await updateUser(updates);
  }

  async function handleCoverSave(payload: CoverSavePayload): Promise<void> {
    if (isOwnProfile) await updateUser({ coverUrl: payload.coverUrl, coverPosition: payload.coverPosition });
  }

  return (
    <div className="min-h-screen bg-black pb-32">

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
            style={{
              objectPosition: `${user.coverPosition?.x ?? 50}% ${user.coverPosition?.y ?? 50}%`,
              transform: `scale(${user.coverPosition?.zoom ?? 1})`,
              transformOrigin: `${user.coverPosition?.x ?? 50}% ${user.coverPosition?.y ?? 50}%`,
            }}
          />
        )}
        {/* Bottom fade to page bg */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black to-transparent" />

        {/* Top action row */}
        {!isOwnProfile && (
          <button
            onClick={() => window.history.back()}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-black/90 transition-all z-10"
          >
            <ArrowLeft size={18} className="text-[#BDBDBD]" />
          </button>
        )}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {isOwnProfile ? (
            <>
              <Link href="/settings">
                <button
                  aria-label="Settings"
                  className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-black/90 transition-all"
                >
                  <Settings2 size={16} className="text-[#BDBDBD]" />
                </button>
              </Link>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold bg-[#111]/85 backdrop-blur-sm text-[#BDBDBD] shadow-sm hover:bg-[#1a1a1a] transition-all"
              >
                <Edit3 size={14} /> Edit
              </button>
            </>
          ) : (
            <>
              <button className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-black/90 transition-all">
                <Share2 size={16} className="text-[#BDBDBD]" />
              </button>
              <button
                onClick={() => setSafetySheetOpen(true)}
                className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-black/90 transition-all"
              >
                <MoreHorizontal size={16} className="text-[#BDBDBD]" />
              </button>
            </>
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

      {/* ── Profile header ──────────────────────────────────────────────── */}
      <div className="px-4 -mt-10">
        {/* Two-column: avatar LEFT + name/handle/bio RIGHT */}
        <div className="flex items-start gap-4 mb-5">
          {/* Avatar with rainbow ring */}
          <div className="relative flex-shrink-0">
            <div className="p-[3px] rounded-full"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
              <div className="p-[2px] rounded-full bg-black">
                <GradientAvatar name={user.displayName} src={user.avatarUrl || undefined} size={88} />
              </div>
            </div>
            {/* Online dot */}
            <div className="absolute bottom-2 right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-black" />
            {/* Crown badge */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: '#F5C542', border: '2.5px solid #000' }}>
              <span className="text-[12px]">👑</span>
            </div>
            {/* Edit avatar — own profile */}
            {isOwnProfile && (
              <button onClick={() => setEditOpen(true)}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-black shadow-md z-10"
                style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
                <Camera size={12} className="text-white" />
              </button>
            )}
          </div>

          {/* Name / handle / FOUNDER / bio */}
          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <h1 className="text-[19px] font-black text-white tracking-tight leading-tight">{user.displayName}</h1>
              <CheckCircle2 size={17} style={{ color: '#3B82F6' }} />
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[13px] text-[rgba(255,255,255,0.45)]">@{user.handle}</span>
              <FounderBadge userId={user.id} size="sm" showLabel />
            </div>
            {user.bio ? (
              <p className="text-[13px] text-[#BDBDBD] leading-relaxed line-clamp-3 mb-2">{user.bio}</p>
            ) : isOwnProfile ? (
              <button onClick={() => setEditOpen(true)}
                className="flex items-center gap-1 text-[13px] text-[#EC4899] font-semibold mb-2">
                <Plus size={13} /> Add a bio
              </button>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              <span className="text-[12px] text-[rgba(255,255,255,0.4)]">📍 Atlanta, GA</span>
              <div className="flex items-center gap-1 text-[12px] text-[rgba(255,255,255,0.4)]">
                <Calendar size={11} />
                <span>Joined {format(user.joinedAt, 'MMM yyyy')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between mb-4 py-1 border-y border-[#1a1a1a]">
          <div className="flex flex-col items-center flex-1">
            <span className="text-[18px] font-black text-white">{fmtNum(user.postCount || userPosts.length)}</span>
            <span className="text-[11px] text-[rgba(255,255,255,0.45)] font-medium">Posts</span>
          </div>
          <div className="w-px h-8 bg-[#1e1e1e]" />
          <button onClick={() => { setFollowersOpen(true); loadFollowLists(); }}
            className="flex flex-col items-center flex-1 hover:opacity-75 transition-opacity">
            <span className="text-[18px] font-black text-white">{fmtNum(followerCount)}</span>
            <span className="text-[11px] text-[rgba(255,255,255,0.45)] font-medium">Followers</span>
          </button>
          <div className="w-px h-8 bg-[#1e1e1e]" />
          <button onClick={() => { setFollowingOpen(true); loadFollowLists(); }}
            className="flex flex-col items-center flex-1 hover:opacity-75 transition-opacity">
            <span className="text-[18px] font-black text-white">{fmtNum(user.following)}</span>
            <span className="text-[11px] text-[rgba(255,255,255,0.45)] font-medium">Following</span>
          </button>
          <div className="w-px h-8 bg-[#1e1e1e]" />
          <div className="flex flex-col items-center flex-1">
            <span className="text-[18px] font-black text-white">{fmtNum((user as any).likes ?? 0)}</span>
            <span className="text-[11px] text-[rgba(255,255,255,0.45)] font-medium">Likes</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-4">
          {isOwnProfile ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setEditOpen(true)}
              className="flex-1 py-2.5 rounded-full font-bold text-[14px] flex items-center justify-center gap-2 transition-all"
              style={{ border: '1.5px solid #EC4899', background: 'transparent' }}
            >
              <Edit3 size={15} style={{ color: '#EC4899' }} />
              <span style={{ color: '#EC4899' }}>Edit Profile</span>
            </motion.button>
          ) : (
            <>
              {/* Message */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                disabled={msgLoading}
                onClick={async () => {
                  if (!currentUser || msgLoading) return;
                  setMsgLoading(true);
                  try {
                    if (isFirebaseConfigured) {
                      const convId = await getOrCreateDirectConversation(currentUser.id, user.id, currentUser, user);
                      setLocation(`/messages/${convId}`);
                    } else {
                      const conv = mockConversations.find(c =>
                        c.type === 'direct' && c.participants.some(p => p.id === user.id)
                      );
                      setLocation(conv ? `/messages/${conv.id}` : '/messages');
                    }
                  } catch { setLocation('/messages'); } finally { setMsgLoading(false); }
                }}
                className="flex-1 py-2.5 rounded-full font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ border: '1.5px solid #EC4899', background: 'transparent' }}
              >
                {msgLoading
                  ? <span className="w-4 h-4 border-2 border-[#EC4899] border-t-transparent rounded-full animate-spin" />
                  : <><MessageCircle size={15} style={{ color: '#EC4899' }} /><span style={{ color: '#EC4899' }}>Message</span></>
                }
              </motion.button>
              {/* Add Friend / Following */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleFollow}
                disabled={followLoading}
                className="flex-1 py-2.5 rounded-full font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ border: '1.5px solid #EC4899', background: 'transparent' }}
              >
                {followLoading
                  ? <span className="w-4 h-4 border-2 border-[#EC4899] border-t-transparent rounded-full animate-spin" />
                  : isFollowing
                  ? <><UserCheck size={15} style={{ color: '#EC4899' }} /><span style={{ color: '#EC4899' }}>Following</span></>
                  : <><UserPlus size={15} style={{ color: '#EC4899' }} /><span style={{ color: '#EC4899' }}>Add Friend</span></>
                }
              </motion.button>
              {/* More options */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setSafetySheetOpen(true)}
                className="w-[44px] py-2.5 rounded-full flex items-center justify-center"
                style={{ border: '1.5px solid #333', background: 'transparent' }}
              >
                <ChevronDown size={16} className="text-white" />
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* ── Sticky tab bar ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a] px-2">
        <div className="flex overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3.5 text-[13.5px] font-semibold whitespace-nowrap relative flex-shrink-0 transition-colors',
                  active ? 'text-[#EC4899]' : 'text-[rgba(255,255,255,0.45)] hover:text-[#BDBDBD]'
                )}
              >
                {tabIcons[tab]}
                {tab}
                {active && (
                  <motion.div
                    layoutId="profileTabIndicator"
                    className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                    style={{ background: '#EC4899' }}
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

          {/* About */}
          {activeTab === 'About' && (
            <div className="px-4 space-y-3 mt-2 pb-6">
              {user.bio && (
                <div className="bg-[#111] rounded-[18px] p-4 border border-[#1a1a1a]">
                  <h3 className="font-black text-white text-[13px] mb-2 uppercase tracking-wide opacity-60">About</h3>
                  <p className="text-[14px] text-[#BDBDBD] leading-relaxed">{user.bio}</p>
                </div>
              )}
              {user.interests.length > 0 && (
                <div className="bg-[#111] rounded-[18px] p-4 border border-[#1a1a1a]">
                  <h3 className="font-black text-white text-[13px] mb-3 uppercase tracking-wide opacity-60">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {user.interests.map(i => <InterestChip key={i} label={i} />)}
                    {isOwnProfile && (
                      <button onClick={() => setEditOpen(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-[#F5C542] border border-[rgba(245,197,66,0.25)] bg-[#111]">
                        <Plus size={11} /> Edit
                      </button>
                    )}
                  </div>
                </div>
              )}
              {user.badges.length > 0 && (
                <div className="bg-[#111] rounded-[18px] p-4 border border-[#1a1a1a]">
                  <h3 className="font-black text-white text-[13px] mb-3 uppercase tracking-wide opacity-60">Badges</h3>
                  <div className="flex flex-wrap gap-2">{user.badges.map(b => <BadgeChip key={b} label={b} />)}</div>
                </div>
              )}
              <div className="bg-[#111] rounded-[18px] p-4 border border-[#1a1a1a] flex items-center gap-2 text-[13px] text-[rgba(255,255,255,0.45)]">
                <Calendar size={14} />
                <span>Joined {format(user.joinedAt, 'MMMM yyyy')}</span>
              </div>
            </div>
          )}

          {/* Sparks */}
          {activeTab === 'Sparks' && (
            <SparkTabContent
              sparks={sparks}
              user={user}
              isOwn={isOwnProfile}
              onOpenPhoto={(src: string) => setPhotoViewer({ src })}
            />
          )}

          {/* Stories */}
          {activeTab === 'Stories' && (
            <EmptyState emoji="📸" title="Stories" subtitle="Stories posted by this user will appear here." />
          )}

          {/* Friends */}
          {activeTab === 'Friends' && (
            <div className="px-4 mt-2 space-y-2 pb-6">
              <button
                onClick={() => { setFollowersOpen(true); loadFollowLists(); }}
                className="w-full flex items-center justify-between bg-[#111] rounded-[18px] p-4 border border-[#1a1a1a]"
              >
                <span className="font-black text-white text-[15px]">Followers <span className="text-[#EC4899]">{fmtNum(followerCount)}</span></span>
                <ChevronRight size={16} className="text-[rgba(255,255,255,0.45)]" />
              </button>
              <button
                onClick={() => { setFollowingOpen(true); loadFollowLists(); }}
                className="w-full flex items-center justify-between bg-[#111] rounded-[18px] p-4 border border-[#1a1a1a]"
              >
                <span className="font-black text-white text-[15px]">Following <span className="text-[#EC4899]">{fmtNum(user.following)}</span></span>
                <ChevronRight size={16} className="text-[rgba(255,255,255,0.45)]" />
              </button>
            </div>
          )}

          {/* Groups */}
          {activeTab === 'Groups' && (
            userCircles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 px-4">
                {userCircles.map(c => <CircleCard key={c.id} community={c} />)}
              </div>
            ) : (
              <EmptyState emoji="🌐" title="No groups yet" subtitle={isOwnProfile ? "Join a Group to connect with people who share your interests!" : "This user hasn't joined any groups yet."} />
            )
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
            currentPosition={user.coverPosition ?? { x: 50, y: 50, zoom: 1 }}
            onSave={handleCoverSave}
            onClose={() => setCoverEditorOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Safety action sheet (non-own profiles) ──────────────────────── */}
      <AnimatePresence>
        {safetySheetOpen && !isOwnProfile && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setSafetySheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[65] bg-[#111] rounded-t-[28px] shadow-2xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#222]" />
              </div>
              <div className="px-5 pt-2 pb-3 flex items-center gap-3 border-b border-gray-50">
                <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={38} />
                <div>
                  <p className="font-bold text-[14px] text-white">{user.displayName}</p>
                  <p className="text-[12px] text-[rgba(255,255,255,0.45)]">@{user.handle}</p>
                </div>
              </div>

              {/* Mute */}
              <button
                onClick={async () => {
                  if (isMuted(user.id)) await doUnmute(user.id);
                  else await doMute(user.id);
                  setSafetySheetOpen(false);
                }}
                className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-[#111] border-t border-gray-50"
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                  <VolumeX size={17} className="text-[#F5C542]" />
                </div>
                <span className="text-[15px] font-medium text-white flex-1 text-left">
                  {isMuted(user.id) ? `Unmute @${user.handle}` : `Mute @${user.handle}`}
                </span>
              </button>

              {/* Restrict */}
              <button
                onClick={async () => {
                  if (isRestricted(user.id)) await doUnrestrict(user.id);
                  else await doRestrict(user.id);
                  setSafetySheetOpen(false);
                }}
                className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-[#111] border-t border-gray-50"
              >
                <div className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                  <EyeOff size={17} className="text-[#BDBDBD]" />
                </div>
                <span className="text-[15px] font-medium text-white flex-1 text-left">
                  {isRestricted(user.id) ? `Unrestrict @${user.handle}` : `Restrict @${user.handle}`}
                </span>
              </button>

              {/* Block */}
              <button
                onClick={async () => {
                  if (isBlocked(user.id)) await doUnblock(user.id);
                  else await doBlock(user.id);
                  setSafetySheetOpen(false);
                }}
                className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-[#111] border-t border-gray-50"
              >
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                  <UserX size={17} className="text-red-500" />
                </div>
                <span className="text-[15px] font-medium text-red-500 flex-1 text-left">
                  {isBlocked(user.id) ? `Unblock @${user.handle}` : `Block @${user.handle}`}
                </span>
              </button>

              {/* Report */}
              <button
                onClick={() => { setSafetySheetOpen(false); setProfileReportOpen(true); }}
                className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-[#111] border-t border-gray-50"
              >
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                  <Shield size={17} className="text-red-500" />
                </div>
                <span className="text-[15px] font-medium text-red-500 flex-1 text-left">
                  Report @{user.handle}
                </span>
              </button>

              <div className="px-5 py-4 border-t border-[#222]">
                <button
                  onClick={() => setSafetySheetOpen(false)}
                  className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Report profile sheet */}
      {profileReportOpen && currentUser && (
        <ReportSheet
          open
          targetId={user.id}
          targetType="profile"
          targetOwnerId={user.id}
          targetPreview={`${user.displayName} (@${user.handle})`}
          reporterId={currentUser.id}
          onClose={() => setProfileReportOpen(false)}
        />
      )}
    </div>
  );
}

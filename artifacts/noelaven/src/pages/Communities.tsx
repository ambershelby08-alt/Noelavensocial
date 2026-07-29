import React, { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Users, Lock, X, Check, ChevronRight,
  Shield, Sparkles, Globe, AtSign,
} from 'lucide-react';
import type { Community } from '@/lib/mockData';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunities } from '@/hooks/useCommunities';
import { cn } from '@/lib/utils';

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'All',         emoji: '🌐' },
  { label: 'Design',      emoji: '🎨' },
  { label: 'Technology',  emoji: '💻' },
  { label: 'Photography', emoji: '📷' },
  { label: 'Music',       emoji: '🎵' },
  { label: 'Travel',      emoji: '✈️' },
  { label: 'Fitness',     emoji: '💪' },
  { label: 'Gaming',      emoji: '🎮' },
  { label: 'Reading',     emoji: '📚' },
  { label: 'Food',        emoji: '🍳' },
];

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

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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

// ─── My Circle card (horizontal scroll) ──────────────────────────────────────

function MyCircleCard({ community }: { community: Community }) {
  const [from, to] = getCatGradient(community.category);
  return (
    <Link href={`/communities/${community.id}`}>
      <motion.div
        whileTap={{ scale: 0.95 }}
        className="relative flex-shrink-0 w-36 h-24 rounded-[20px] overflow-hidden cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${from}dd, ${to}dd)` }}
      >
        {community.bannerUrl && (
          <img
            src={community.bannerUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
          />
        )}
        <div className="absolute inset-0 flex flex-col justify-between p-3">
          <span className="text-2xl">{community.emoji}</span>
          <div>
            <p className="text-white font-black text-[12px] leading-tight line-clamp-1">{community.name}</p>
            <p className="text-white/70 text-[10px] font-medium mt-0.5">{fmtNum(community.memberCount)} members</p>
          </div>
        </div>
        {/* Online dot */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Community grid card ──────────────────────────────────────────────────────

interface CircleCardProps {
  community: Community;
  onJoin: (id: string) => void;
}

function CircleGridCard({ community, onJoin }: CircleCardProps) {
  const [from, to] = getCatGradient(community.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111] rounded-[24px] border border-[#1a1a1a] shadow-sm overflow-hidden flex flex-col"
    >
      {/* Banner */}
      <Link href={`/communities/${community.id}`}>
        <div className="relative h-28 overflow-hidden cursor-pointer">
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${from}cc, ${to}cc)` }}
          />
          {community.bannerUrl && (
            <img
              src={community.bannerUrl}
              alt=""
              className="w-full h-full object-cover opacity-60 mix-blend-overlay"
            />
          )}
          {/* Category + privacy badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="flex items-center gap-1 bg-black/30 backdrop-blur-md text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full">
              {CATEGORIES.find(c => c.label === community.category)?.emoji} {community.category}
            </span>
            {community.isPrivate && (
              <span className="flex items-center gap-1 bg-black/30 backdrop-blur-md text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full">
                <Lock size={9} /> Private
              </span>
            )}
          </div>
          {/* Big emoji */}
          <div className="absolute bottom-3 left-3 text-3xl">{community.emoji}</div>
        </div>
      </Link>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/communities/${community.id}`}>
          <p className="font-black text-[15px] text-white hover:text-[#F5C542] transition-colors line-clamp-1 cursor-pointer">
            {community.name}
          </p>
        </Link>
        <p className="text-[12.5px] text-[rgba(255,255,255,0.45)] leading-relaxed mt-1 line-clamp-2 flex-1">
          {community.description}
        </p>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-1 text-[12px] text-[rgba(255,255,255,0.45)] font-medium">
            <Users size={12} />
            <span>{fmtNum(community.memberCount)}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => onJoin(community.id)}
            className={cn(
              'px-4 py-1.5 rounded-full text-[12.5px] font-black transition-all',
              community.isJoined
                ? 'bg-[#1a1a1a] text-[#BDBDBD]'
                : 'text-white shadow-sm'
            )}
            style={!community.isJoined
              ? { background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 2px 10px ${from}55` }
              : {}
            }
          >
            {community.isJoined ? '✓ Joined' : '+ Join'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Create Circle drawer ─────────────────────────────────────────────────────

const CATEGORY_OPTIONS = CATEGORIES.filter(c => c.label !== 'All');

interface NewCircleData {
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  rules: string[];
}

function CreateCircleDrawer({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: NewCircleData) => void;
}) {
  const [step, setStep]               = useState<1 | 2>(1);
  const [name, setName]               = useState('');
  const [description, setDesc]        = useState('');
  const [category, setCategory]       = useState('');
  const [isPrivate, setIsPrivate]     = useState(false);
  const [rules, setRules]             = useState<string[]>(['Be kind and respectful.', 'No spam or self-promotion.']);
  const [newRule, setNewRule]         = useState('');
  const [saving, setSaving]           = useState(false);

  const [from, to] = getCatGradient(category || 'Design');

  function addRule() {
    if (newRule.trim() && rules.length < 5) {
      setRules(r => [...r, newRule.trim()]);
      setNewRule('');
    }
  }

  function removeRule(i: number) {
    setRules(r => r.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    if (!name.trim() || !description.trim() || !category) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    onCreate({ name: name.trim(), description: description.trim(), category, isPrivate, rules });
    setSaving(false);
  }

  const step1Valid = name.trim().length >= 3 && description.trim().length >= 10 && !!category;

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[32px] shadow-2xl flex flex-col"
        style={{ background: '#000', maxHeight: '92vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <button
            onClick={step === 2 ? () => setStep(1) : onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded-full transition-colors"
          >
            <X size={20} className="text-[#BDBDBD]" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[1, 2].map(s => (
                <div
                  key={s}
                  className={cn(
                    'rounded-full transition-all',
                    s === step ? 'w-6 h-2' : 'w-2 h-2 bg-[#222]'
                  )}
                  style={s === step ? { background: 'linear-gradient(90deg, #C9982A, #F5C542)', borderRadius: 99 } : {}}
                />
              ))}
            </div>
            <span className="font-black text-[16px] text-white">Create Circle</span>
          </div>
          {step === 2 ? (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleCreate}
              disabled={saving}
              className="px-5 py-2 rounded-full text-[14px] font-black text-white flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 3px 12px rgba(124,58,237,0.4)' }}
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Sparkles size={14} /> Create</>
              }
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => step1Valid && setStep(2)}
              disabled={!step1Valid}
              className="px-5 py-2 rounded-full text-[14px] font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
            >
              Next →
            </motion.button>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5 pb-10">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">

                {/* Live preview */}
                <div
                  className="w-full h-28 rounded-[20px] relative overflow-hidden flex items-end p-4"
                  style={{ background: `linear-gradient(135deg, ${from}cc, ${to}cc)` }}
                >
                  <div>
                    <p className="text-3xl mb-1">{CATEGORIES.find(c => c.label === category)?.emoji || '✨'}</p>
                    <p className="text-white font-black text-[16px]">{name || 'Circle Name'}</p>
                    <p className="text-white/70 text-[11px]">{category || 'Category'}</p>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1 block mb-1.5">Circle Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={50}
                    placeholder="e.g. Midnight Readers"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-2xl px-4 py-3.5 text-[15px] text-white placeholder:text-[#555] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)] transition-all"
                  />
                  <p className="text-[11px] text-[rgba(255,255,255,0.45)] mt-1 ml-1">{name.length}/50</p>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1 block mb-1.5">Description *</label>
                  <textarea
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="What's this circle about? Who should join?"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-2xl px-4 py-3.5 text-[14px] text-white placeholder:text-[#555] outline-none resize-none leading-relaxed focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)] transition-all"
                  />
                  <p className="text-[11px] text-[rgba(255,255,255,0.45)] mt-1 ml-1">{description.length}/300</p>
                </div>

                {/* Category */}
                <div>
                  <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1 block mb-2">Category *</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_OPTIONS.map(c => {
                      const sel = category === c.label;
                      const [f, t] = getCatGradient(c.label);
                      return (
                        <motion.button
                          key={c.label}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setCategory(c.label)}
                          className={cn(
                            'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all border',
                            sel ? 'text-white border-transparent' : 'bg-[#111] text-[#BDBDBD] border-[#2a2a2a]'
                          )}
                          style={sel ? { background: `linear-gradient(135deg, ${f}, ${t})`, boxShadow: `0 2px 10px ${f}44` } : {}}
                        >
                          {c.emoji} {c.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Privacy */}
                <div className="flex items-center justify-between bg-[#111] rounded-2xl px-4 py-4 border border-[#1a1a1a]">
                  <div className="flex items-center gap-3">
                    {isPrivate ? <Lock size={18} className="text-[#F5C542]" /> : <Globe size={18} className="text-[#F5C542]" />}
                    <div>
                      <p className="font-bold text-[14px] text-white">{isPrivate ? 'Private Circle' : 'Public Circle'}</p>
                      <p className="text-[12px] text-[rgba(255,255,255,0.45)]">{isPrivate ? 'Members must be approved' : 'Anyone can join and post'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPrivate(v => !v)}
                    className={cn(
                      'w-12 h-6.5 rounded-full relative transition-colors flex-shrink-0',
                      isPrivate ? 'bg-[#7C3AED]' : 'bg-[#222]'
                    )}
                    style={{ height: 26 }}
                  >
                    <motion.div
                      animate={{ x: isPrivate ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-1 w-4.5 h-4.5 bg-[#111] rounded-full shadow"
                      style={{ width: 18, height: 18 }}
                    />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">

                {/* Header preview */}
                <div className="flex items-center gap-3 p-4 bg-[#111] rounded-2xl border border-[#1a1a1a]">
                  <div
                    className="w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                  >
                    {CATEGORIES.find(c => c.label === category)?.emoji}
                  </div>
                  <div>
                    <p className="font-black text-[15px] text-white">{name}</p>
                    <p className="text-[12px] text-[rgba(255,255,255,0.45)]">{category} · {isPrivate ? '🔒 Private' : '🌐 Public'}</p>
                  </div>
                </div>

                {/* Rules */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[13px] font-semibold text-[#BDBDBD] ml-1">Community Rules</label>
                    <span className="text-[12px] text-[rgba(255,255,255,0.45)]">{rules.length}/5</span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {rules.map((rule, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 bg-[#111] rounded-xl px-4 py-3 border border-[#1a1a1a]"
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5"
                          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-[13.5px] text-[#BDBDBD] flex-1 leading-relaxed">{rule}</p>
                        <button
                          onClick={() => removeRule(i)}
                          className="flex-shrink-0 text-[rgba(255,255,255,0.35)] hover:text-red-400 transition-colors mt-0.5"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>

                  {rules.length < 5 && (
                    <div className="flex gap-2">
                      <input
                        value={newRule}
                        onChange={e => setNewRule(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addRule()}
                        placeholder="Add a rule…"
                        maxLength={100}
                        className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-[#555] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)] transition-all"
                      />
                      <button
                        onClick={addRule}
                        disabled={!newRule.trim()}
                        className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 flex-shrink-0 self-center"
                        style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
                      >
                        <Plus size={16} className="text-white" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[12px] text-[rgba(255,255,255,0.45)] text-center pb-4">You'll be the first member and moderator of this circle.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Communities() {
  const { currentUser } = useAuth();
  const { communities, toggleJoin, createCircle } = useCommunities();
  const [search, setSearch]           = useState('');
  const [category, setCategory]       = useState('All');
  const [createOpen, setCreateOpen]   = useState(false);
  const [toast, setToast]             = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }

  function handleJoin(id: string) {
    const comm = communities.find(c => c.id === id);
    if (comm) showToast(comm.isJoined ? `Left ${comm.name}` : `Joined ${comm.name}! 🎉`);
    toggleJoin(id);
  }

  async function handleCreate(data: NewCircleData) {
    const catEmoji = CATEGORIES.find(c => c.label === data.category)?.emoji ?? '✨';
    try {
      await createCircle(data);
      setCreateOpen(false);
      showToast(`${catEmoji} ${data.name} created!`);
    } catch {
      showToast('Failed to create circle. Please try again.');
    }
  }

  const myCircles = communities.filter(c => c.isJoined);

  const filtered = communities.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    const matchCat = category === 'All' || c.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-black pb-36">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a] px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[26px] font-black text-white tracking-tight">Circles</h1>
            <p className="text-[13px] text-[rgba(255,255,255,0.45)] font-medium">Find your people</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13.5px] font-black text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 3px 14px rgba(124,58,237,0.4)' }}
          >
            <Plus size={15} /> Create
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.45)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search circles…"
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-2xl pl-10 pr-4 py-3 text-[14px] text-white placeholder:text-[#555] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)] transition-all shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={15} className="text-[rgba(255,255,255,0.45)]" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">

        {/* ── My Circles ──────────────────────────────────────────────── */}
        {myCircles.length > 0 && !search && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-black text-white">My Circles</h2>
              <span className="text-[12px] text-[rgba(255,255,255,0.45)] font-medium">{myCircles.length} joined</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
              {myCircles.map(c => <MyCircleCard key={c.id} community={c} />)}
            </div>
          </section>
        )}

        {/* ── Category pills ───────────────────────────────────────────── */}
        {!search && (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
            {CATEGORIES.map(cat => {
              const active = category === cat.label;
              const [f, t] = getCatGradient(cat.label);
              return (
                <motion.button
                  key={cat.label}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setCategory(cat.label)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all flex-shrink-0',
                    active ? 'text-white shadow-sm' : 'bg-[#111] text-[#BDBDBD] border border-[#1a1a1a]'
                  )}
                  style={active ? { background: `linear-gradient(135deg, ${f}, ${t})`, boxShadow: `0 2px 10px ${f}44` } : {}}
                >
                  {cat.emoji} {cat.label}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* ── Grid ────────────────────────────────────────────────────── */}
        <section>
          {search ? (
            <p className="text-[13px] text-[rgba(255,255,255,0.45)] font-medium mb-3">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "<span className="text-[#BDBDBD]">{search}</span>"
            </p>
          ) : (
            <h2 className="text-[15px] font-black text-white mb-3">
              {category === 'All' ? 'Discover Circles' : `${CATEGORIES.find(c => c.label === category)?.emoji} ${category}`}
            </h2>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-4xl mb-4">🔍</p>
              <h3 className="font-black text-[17px] text-white mb-1.5">No circles found</h3>
              <p className="text-[14px] text-[rgba(255,255,255,0.45)] max-w-[200px] leading-relaxed">
                {search ? 'Try a different search.' : 'Be the first — create this circle!'}
              </p>
              {!search && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-6 px-6 py-3 rounded-full text-[14px] font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
                >
                  + Create Circle
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((c, i) => (
                <motion.div key={c.id} transition={{ delay: i * 0.04 }}>
                  <CircleGridCard community={c} onJoin={handleJoin} />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <CreateCircleDrawer
            key="create"
            onClose={() => setCreateOpen(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>

      <Toast message={toast} visible={toastVisible} />
    </div>
  );
}

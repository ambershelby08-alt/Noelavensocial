import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AtSign, ChevronRight, Camera } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { NoelavenLogo } from '@/components/ui/NoelavenLogo';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERESTS = [
  { label: 'Art & Design',   emoji: '🎨' },
  { label: 'Technology',     emoji: '💻' },
  { label: 'Music',          emoji: '🎵' },
  { label: 'Travel',         emoji: '✈️' },
  { label: 'Photography',    emoji: '📷' },
  { label: 'Food & Cooking', emoji: '🍳' },
  { label: 'Fitness',        emoji: '💪' },
  { label: 'Gaming',         emoji: '🎮' },
  { label: 'Reading',        emoji: '📚' },
  { label: 'Nature',         emoji: '🌿' },
  { label: 'Movies & TV',    emoji: '🎬' },
  { label: 'Science',        emoji: '🔬' },
  { label: 'Fashion',        emoji: '👗' },
  { label: 'DIY & Making',   emoji: '🛠️' },
  { label: 'Wellness',       emoji: '🧘' },
  { label: 'Pets',           emoji: '🐾' },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex gap-2 justify-center mb-8">
      {[1, 2].map(n => (
        <motion.div
          key={n}
          animate={{ width: step === n ? 24 : 8 }}
          className="h-2 rounded-full"
          style={{ background: step >= n ? 'linear-gradient(90deg, #6B73FF, #FF6B9D)' : '#E5E7EB' }}
        />
      ))}
    </div>
  );
}

// ─── Step 1: Handle + avatar preview ─────────────────────────────────────────

interface Step1Props {
  displayName: string;
  handle: string;
  setHandle: (v: string) => void;
  handleError: string;
  onNext: () => void;
  avatarUrl: string;
  avatarUploading: boolean;
  onAvatarClick: () => void;
}

function Step1({ displayName, handle, setHandle, handleError, onNext, avatarUrl, avatarUploading, onAvatarClick }: Step1Props) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="flex flex-col flex-1"
    >
      <StepDots step={1} />

      <h2 className="text-[26px] font-black text-gray-900 tracking-tight leading-tight mb-1.5">
        Make it yours
      </h2>
      <p className="text-[14px] text-gray-400 font-medium mb-8">
        Choose how you'll appear on Noelaven.
      </p>

      {/* Avatar preview */}
      <div className="flex flex-col items-center mb-8">
        <button
          type="button"
          onClick={isCloudinaryConfigured ? onAvatarClick : undefined}
          className={cn('relative group', isCloudinaryConfigured && 'cursor-pointer')}
          title={isCloudinaryConfigured ? 'Upload profile photo' : undefined}
        >
          <GradientAvatar name={displayName} src={avatarUrl || undefined} size={96} />
          {/* Upload spinner */}
          {avatarUploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {/* Hover overlay */}
          {isCloudinaryConfigured && !avatarUploading && (
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={22} className="text-white" />
            </div>
          )}
          <div
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', width: 32, height: 32, borderRadius: '50%', border: '3px solid white' }}
          >
            {avatarUrl ? <Check size={14} className="text-white" /> : <Camera size={14} className="text-white" />}
          </div>
        </button>
        <p className="mt-3 text-[13px] text-gray-400 font-medium">
          {isCloudinaryConfigured
            ? (avatarUrl ? 'Tap to change photo' : 'Tap to add a profile photo')
            : 'Your gradient avatar is auto-generated'}
        </p>
      </div>

      {/* Display name (read-only) */}
      <div className="mb-4">
        <label className="text-[13px] font-semibold text-gray-600 ml-1 block mb-1.5">Display Name</label>
        <div className="flex items-center bg-gray-50 border border-black/[0.06] rounded-2xl px-4 py-3.5 gap-3">
          <span className="text-[15px] text-gray-800 font-medium">{displayName}</span>
          <span className="ml-auto text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {pendingUser?.avatarUrl ? 'from Google' : 'from sign-up'}
          </span>
        </div>
      </div>

      {/* Handle input */}
      <div className="mb-8">
        <label className="text-[13px] font-semibold text-gray-600 ml-1 block mb-1.5">Username (handle)</label>
        <div className={cn(
          'flex items-center bg-white/80 backdrop-blur-sm border rounded-2xl px-4 py-3.5 gap-2 transition-all',
          handleError ? 'border-red-300 ring-2 ring-red-100' : 'border-black/[0.08] focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100'
        )}>
          <AtSign size={17} className="text-purple-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="yourhandle"
            value={handle}
            onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={30}
            className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 outline-none"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="text-[12px] text-gray-400">{handle.length}/30</span>
        </div>
        {handleError
          ? <p className="text-[12px] text-red-500 font-medium mt-1 ml-1">{handleError}</p>
          : <p className="text-[12px] text-gray-400 mt-1 ml-1">Letters, numbers, and underscores only</p>
        }
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onNext}
        className="w-full text-white font-bold py-4 rounded-2xl text-[15px] flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)', boxShadow: '0 4px 18px rgba(107,115,255,0.35)' }}
      >
        Continue
        <ChevronRight size={18} strokeWidth={2.5} />
      </motion.button>
    </motion.div>
  );
}

// ─── Step 2: Bio + interests ──────────────────────────────────────────────────

interface Step2Props {
  displayName: string;
  bio: string;
  setBio: (v: string) => void;
  interests: string[];
  toggleInterest: (label: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}

function Step2({ displayName, bio, setBio, interests, toggleInterest, onBack, onSubmit, isLoading }: Step2Props) {
  const MIN_INTERESTS = 3;
  const canSubmit = interests.length >= MIN_INTERESTS;

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="flex flex-col flex-1"
    >
      <StepDots step={2} />

      <h2 className="text-[26px] font-black text-gray-900 tracking-tight leading-tight mb-1.5">
        What are you into?
      </h2>
      <p className="text-[14px] text-gray-400 font-medium mb-6">
        Pick at least {MIN_INTERESTS} interests to personalise your feed.
      </p>

      {/* Bio */}
      <div className="mb-6">
        <label className="text-[13px] font-semibold text-gray-600 ml-1 block mb-1.5">
          Bio <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          placeholder={`Hey, I'm ${displayName.split(' ')[0]}! Tell people what makes you, you… ✨`}
          value={bio}
          onChange={e => setBio(e.target.value)}
          maxLength={160}
          rows={3}
          className="w-full bg-white/80 backdrop-blur-sm border border-black/[0.08] rounded-2xl px-4 py-3.5 text-[14.5px] text-gray-900 placeholder:text-gray-400 outline-none resize-none leading-relaxed focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
        />
        <p className="text-[12px] text-gray-400 mt-1 ml-1 text-right">{bio.length}/160</p>
      </div>

      {/* Interests */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-gray-600 ml-1">Your interests</p>
          <p className={cn('text-[12px] font-semibold', interests.length >= MIN_INTERESTS ? 'text-emerald-500' : 'text-gray-400')}>
            {interests.length}/{MIN_INTERESTS} min
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map(({ label, emoji }) => {
            const selected = interests.includes(label);
            return (
              <motion.button
                key={label}
                whileTap={{ scale: 0.93 }}
                onClick={() => toggleInterest(label)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all border',
                  selected
                    ? 'text-white border-transparent shadow-md'
                    : 'bg-white text-gray-600 border-black/[0.08] hover:border-purple-200'
                )}
                style={selected ? {
                  background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)',
                  boxShadow: '0 3px 10px rgba(107,115,255,0.30)',
                } : {}}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                {selected && <Check size={12} strokeWidth={3} />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-auto pt-4">
        <button
          onClick={onBack}
          className="px-5 py-4 rounded-2xl font-semibold text-[15px] text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Back
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onSubmit}
          disabled={!canSubmit || isLoading}
          className={cn(
            'flex-1 text-white font-bold py-4 rounded-2xl text-[15px] flex items-center justify-center gap-2 transition-all',
            !canSubmit && 'opacity-50'
          )}
          style={{
            background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)',
            boxShadow: canSubmit ? '0 4px 18px rgba(107,115,255,0.35)' : 'none',
          }}
        >
          {isLoading
            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <>Let's go! ✨</>}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateProfile() {
  const { pendingUser, completeProfile, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const displayName = pendingUser?.displayName ?? 'New User';

  const [step, setStep]               = useState<1 | 2>(1);
  const [handle, setHandle]           = useState('');
  const [handleError, setHandleError] = useState('');
  const [bio, setBio]                 = useState('');
  const [interests, setInterests]     = useState<string[]>([]);
  // Seed from Google/OAuth photo if available; user can override by uploading.
  const [avatarUrl, setAvatarUrl]     = useState(pendingUser?.avatarUrl ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Auto-suggest handle from display name
  useEffect(() => {
    const suggested = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setHandle(suggested);
  }, [displayName]);

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

  function goToStep2() {
    if (!handle.trim()) { setHandleError('Username is required'); return; }
    if (handle.length < 3) { setHandleError('At least 3 characters'); return; }
    setHandleError('');
    setStep(2);
  }

  function toggleInterest(label: string) {
    setInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  }

  async function handleSubmit() {
    await completeProfile({ handle, bio, interests, avatarUrl: avatarUrl || undefined });
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-[#FDF9F6] relative overflow-hidden flex flex-col">
      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarFile}
      />

      {/* Background blobs */}
      <div className="absolute top-[-15%] right-[-20%] w-[75%] h-[75%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,107,157,0.18) 0%, rgba(196,79,219,0.10) 40%, transparent 70%)' }} />
      <div className="absolute bottom-[-20%] left-[-20%] w-[70%] h-[70%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(107,115,255,0.18) 0%, rgba(60,194,168,0.08) 40%, transparent 70%)' }} />
      <div className="absolute top-[45%] right-[-5%] w-[35%] h-[35%] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,217,61,0.12) 0%, transparent 70%)' }} />

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-14 pb-8 max-w-sm mx-auto w-full overflow-y-auto">
        {/* Top wordmark */}
        <div className="flex items-center gap-2 mb-8">
          <NoelavenLogo variant="full" size="sm" />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <Step1
              key="step1"
              displayName={displayName}
              handle={handle}
              setHandle={v => { setHandle(v); setHandleError(''); }}
              handleError={handleError}
              onNext={goToStep2}
              avatarUrl={avatarUrl}
              avatarUploading={avatarUploading}
              onAvatarClick={() => avatarInputRef.current?.click()}
            />
          ) : (
            <Step2
              key="step2"
              displayName={displayName}
              bio={bio}
              setBio={setBio}
              interests={interests}
              toggleInterest={toggleInterest}
              onBack={() => setStep(1)}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

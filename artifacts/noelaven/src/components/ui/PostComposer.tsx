/**
 * PostComposer — full-featured post creation component.
 *
 * Features
 * ─────────
 *  • Text input with 500-char limit
 *  • Image upload (Cloudinary)
 *  • @mention autocomplete → notification dispatch on post
 *  • Emoji picker (inserts at exact cursor position)
 *  • Location picker (GPS current + place-name search via Nominatim)
 *  • Audience / privacy selector
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Smile, MapPin, Send, X, ChevronDown,
  Globe, Users, Lock, UserCircle, AtSign, Navigation, Loader2, Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import { searchUsers } from '@/lib/firestore';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import type { User, SparkAudience } from '@/lib/mockData';

// ─── Static emoji data ────────────────────────────────────────────────────────

const EMOJI_TABS: { label: string; emojis: string[] }[] = [
  {
    label: '😊',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇',
      '🥰','😍','🤩','😘','🥲','😋','😜','🤪','😝','🤑','🤗','🤭','🤫',
      '🤔','🤨','😐','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','😴',
      '🥳','😎','🤓','😕','🙁','😮','😲','😳','🥺','😢','😭','😱','😩','🥱',
    ],
  },
  {
    label: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞',
      '💓','💗','💖','💘','💝','💟','🫶','✌️','☮️',
    ],
  },
  {
    label: '👋',
    emojis: [
      '👍','👎','👌','🤌','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️',
      '👋','🤚','🖐️','✋','🖖','🤲','👐','🙌','👏','🤝','🙏','✍️','💅','💪','🦾',
    ],
  },
  {
    label: '🌿',
    emojis: [
      '🌈','⭐','🌟','💫','✨','🔥','🌊','🌸','🌺','🌻','🌹','🍀','🌿',
      '🍃','🌙','☀️','⚡','❄️','🌍','🌎','🌏','🦋','🐾','🌵','🍄','🌾','💐','🌷',
    ],
  },
  {
    label: '🎉',
    emojis: [
      '🎉','🎊','🎈','🎁','🏆','🥇','🎯','🎮','🎨','🎵','🎶','🎤','🎧',
      '🎭','🎪','🎠','🎡','🎢','🎲','🎳','🎱',
    ],
  },
  {
    label: '🍕',
    emojis: [
      '🍕','🍔','🌮','🌯','🥗','🍜','🍣','🍱','🥩','🍗','🥚','🧀','🥞',
      '🧁','🎂','🍰','🍩','🍪','🍫','🍬','🍭','🍺','🥂','☕','🧋','🍵','🍹',
    ],
  },
];

// ─── Audience options (exported for re-use in SparkModal etc.) ─────────────────

export const AUDIENCE_OPTIONS: { value: SparkAudience; label: string; icon: React.ReactNode }[] = [
  { value: 'public',  label: 'Public',    icon: <Globe      size={11} /> },
  { value: 'mutuals', label: 'Mutuals',   icon: <Users      size={11} /> },
  { value: 'private', label: 'Followers', icon: <Lock       size={11} /> },
  { value: 'onlyMe',  label: 'Only Me',   icon: <UserCircle size={11} /> },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PostLocation = { name: string; lat?: number; lng?: number };

export interface PostComposerProps {
  onPost: (
    content: string,
    imageUrl?: string,
    audience?: SparkAudience,
    mentionedUserIds?: string[],
    location?: PostLocation,
  ) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PostComposer({ onPost }: PostComposerProps) {
  const { currentUser } = useAuth();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded]         = useState(false);
  const [content, setContent]               = useState('');
  const [imageUrl, setImageUrl]             = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [postAudience, setPostAudience]     = useState<SparkAudience>('public');
  const [showAudiencePicker, setShowAudiencePicker] = useState(false);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Emoji picker ────────────────────────────────────────────────────────────
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab]               = useState(0);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmojiPicker) return;
    function onOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showEmojiPicker]);

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setContent(prev => (prev + emoji).slice(0, 500));
      return;
    }
    const start = ta.selectionStart ?? content.length;
    const end   = ta.selectionEnd   ?? start;
    const next  = (content.slice(0, start) + emoji + content.slice(end)).slice(0, 500);
    setContent(next);
    // Restore cursor after the inserted emoji (emoji.length = UTF-16 code units)
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  // ── @Mention autocomplete ───────────────────────────────────────────────────
  const [mentionQuery, setMentionQuery]             = useState('');
  const [showMentionList, setShowMentionList]       = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionedUsers, setMentionedUsers]         = useState<{ id: string; handle: string }[]>([]);
  const mentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val    = e.target.value.slice(0, 500);
    const cursor = e.target.selectionStart ?? val.length;
    setContent(val);

    const before = val.slice(0, cursor);
    const match  = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1];
      setMentionQuery(q);
      setShowMentionList(true);
      if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
      mentionTimerRef.current = setTimeout(async () => {
        try {
          const res = await searchUsers(q);
          setMentionSuggestions(res.slice(0, 6));
        } catch { setMentionSuggestions([]); }
      }, 200);
    } else {
      setShowMentionList(false);
      setMentionQuery('');
      setMentionSuggestions([]);
    }
  }

  function insertMention(user: User) {
    const ta     = textareaRef.current;
    const cursor = ta?.selectionStart ?? content.length;
    const before = content.slice(0, cursor);
    const atIdx  = before.lastIndexOf('@');
    const insertion = `@${user.handle} `;
    const next   = (content.slice(0, atIdx) + insertion + content.slice(cursor)).slice(0, 500);
    setContent(next);
    setShowMentionList(false);
    setMentionSuggestions([]);
    setMentionedUsers(prev =>
      prev.find(u => u.id === user.id) ? prev : [...prev, { id: user.id, handle: user.handle }]
    );
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = atIdx + insertion.length;
      ta?.setSelectionRange(pos, pos);
    });
  }

  function handleMentionButton() {
    const ta  = textareaRef.current;
    const pos = ta?.selectionStart ?? content.length;
    const next = (content.slice(0, pos) + '@' + content.slice(pos)).slice(0, 500);
    setContent(next);
    setMentionQuery('');
    setShowMentionList(true);
    // Show suggestions immediately (empty query → recent users)
    searchUsers('').then(r => setMentionSuggestions(r.slice(0, 6))).catch(() => {});
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(pos + 1, pos + 1);
    });
  }

  // ── Location picker ─────────────────────────────────────────────────────────
  const [location, setLocation]                       = useState<PostLocation | null>(null);
  const [showLocationPicker, setShowLocationPicker]   = useState(false);
  const [locationSearch, setLocationSearch]           = useState('');
  const [locationResults, setLocationResults]         = useState<PostLocation[]>([]);
  const [locationLoading, setLocationLoading]         = useState(false);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json() as { address?: Record<string, string> };
      const addr = data.address ?? {};
      const name = addr.city || addr.town || addr.village ||
                   addr.county || addr.state ||
                   `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      setLocation({ name, lat, lng });
      setShowLocationPicker(false);
    } catch {
      // Keep picker open so user can type manually
    } finally {
      setLocationLoading(false);
    }
  }

  function handleLocationSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setLocationSearch(q);
    setLocationResults([]);
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    if (!q.trim()) return;
    locationTimerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json() as Array<{ display_name: string; lat: string; lon: string }>;
        setLocationResults(
          data.map(d => ({
            name: d.display_name.split(',').slice(0, 2).join(', '),
            lat:  parseFloat(d.lat),
            lng:  parseFloat(d.lon),
          }))
        );
      } catch { setLocationResults([]); }
    }, 400);
  }

  function pickLocation(loc: PostLocation) {
    setLocation(loc);
    setShowLocationPicker(false);
    setLocationSearch('');
    setLocationResults([]);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const canPost = content.trim().length > 0 || imageUrl.length > 0;

  function handlePost() {
    if (!canPost) return;
    const finalContent = content.trim();
    // Only notify users who were picked from autocomplete AND whose @handle
    // still appears in the final post text.
    const confirmedIds = mentionedUsers
      .filter(u => finalContent.includes(`@${u.handle}`))
      .map(u => u.id);
    onPost(finalContent, imageUrl || undefined, postAudience, confirmedIds, location ?? undefined);
    // Reset all state
    setContent('');       setImageUrl('');     setPostAudience('public');
    setIsExpanded(false); setMentionedUsers([]); setLocation(null);
    setShowAudiencePicker(false); setShowEmojiPicker(false); setShowLocationPicker(false);
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="mx-4 mb-5 p-4 rounded-[24px] bg-[#111] border border-[#1a1a1a]"
      animate={{
        boxShadow: isExpanded
          ? '0 8px 32px rgba(107,115,255,0.10), 0 2px 8px rgba(0,0,0,0.04)'
          : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Hidden file input */}
      <input ref={imageInputRef} type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden" onChange={handleImageFile} />

      <div className="flex gap-3">
        {currentUser && (
          <GradientAvatar
            name={currentUser.displayName} src={currentUser.avatarUrl || undefined}
            size={44} className="mt-0.5 flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0 relative">

          {/* ── Mention suggestions ─────────────────────────────────────── */}
          <AnimatePresence>
            {showMentionList && mentionSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] shadow-xl z-[60] overflow-hidden"
              >
                {mentionSuggestions.map(user => (
                  <button
                    key={user.id}
                    onMouseDown={e => { e.preventDefault(); insertMention(user); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#252525] transition-colors text-left"
                  >
                    <UserAvatar
                      userId={user.id} fallbackName={user.displayName}
                      fallbackSrc={user.avatarUrl || undefined} size={28}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{user.displayName}</p>
                      <p className="text-[11.5px] text-[rgba(255,255,255,0.45)] truncate">@{user.handle}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Textarea ────────────────────────────────────────────────── */}
          <textarea
            ref={textareaRef}
            placeholder="Share something kind… 💛"
            value={content}
            onChange={handleTextChange}
            onFocus={() => setIsExpanded(true)}
            className="w-full bg-transparent resize-none outline-none text-white text-[15px] placeholder:text-[#555] min-h-[44px] pt-2.5 leading-relaxed"
            rows={isExpanded ? 3 : 1}
            maxLength={500}
          />
          {content.length > 400 && (
            <p className={`text-right text-[11px] font-medium mt-0.5 ${content.length >= 500 ? 'text-red-500' : 'text-amber-500'}`}>
              {500 - content.length} left
            </p>
          )}

          {/* ── Image preview ────────────────────────────────────────────── */}
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
          {imageUploading && (
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[rgba(255,255,255,0.45)]">
              <div className="w-4 h-4 border-2 border-[#333] border-t-purple-500 rounded-full animate-spin" />
              Uploading image…
            </div>
          )}

          {/* ── Location badge ───────────────────────────────────────────── */}
          {location && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[rgba(236,72,153,0.10)] rounded-xl border border-[rgba(236,72,153,0.20)]">
              <MapPin size={12} className="text-pink-400 flex-shrink-0" />
              <span className="text-[12px] font-semibold text-pink-300 max-w-[200px] truncate">{location.name}</span>
              <button onClick={() => setLocation(null)} className="ml-0.5 text-[rgba(255,255,255,0.35)] hover:text-white transition-colors">
                <X size={11} />
              </button>
            </div>
          )}

          {/* ── Toolbar (visible when expanded) ──────────────────────────── */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center justify-between mt-3 pt-3 border-t border-[#222]"
            >
              <div className="flex items-center gap-0.5">

                {/* Gallery */}
                <button
                  onClick={() => isCloudinaryConfigured && imageInputRef.current?.click()}
                  disabled={imageUploading || !isCloudinaryConfigured}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    isCloudinaryConfigured
                      ? 'hover:bg-[rgba(245,197,66,0.08)] cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  )}
                  title={isCloudinaryConfigured ? 'Add image' : 'Image upload not configured'}
                >
                  <ImageIcon size={18} className={imageUrl ? 'text-[#F5C542]' : 'text-[rgba(255,255,255,0.45)]'} />
                </button>

                {/* Emoji */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    onClick={() => {
                      setShowEmojiPicker(v => !v);
                      setShowLocationPicker(false);
                      setShowAudiencePicker(false);
                    }}
                    className={cn(
                      'p-2 rounded-full transition-colors',
                      showEmojiPicker
                        ? 'bg-[rgba(250,204,21,0.12)]'
                        : 'hover:bg-[rgba(250,204,21,0.08)]'
                    )}
                    title="Add emoji"
                  >
                    <Smile size={18} className="text-yellow-400" />
                  </button>

                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-full left-0 mb-2 w-[272px] bg-[#181818] rounded-2xl border border-[#2a2a2a] shadow-2xl z-[60] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Category tabs */}
                        <div className="flex border-b border-[#252525]">
                          {EMOJI_TABS.map((tab, i) => (
                            <button
                              key={i}
                              onClick={() => setEmojiTab(i)}
                              className={cn(
                                'flex-1 py-2.5 text-[17px] transition-colors',
                                emojiTab === i ? 'bg-[#232323]' : 'hover:bg-[#1e1e1e]'
                              )}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        {/* Emoji grid */}
                        <div className="p-2 grid grid-cols-8 gap-0.5 max-h-[160px] overflow-y-auto">
                          {EMOJI_TABS[emojiTab].emojis.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => insertEmoji(emoji)}
                              className="w-8 h-8 flex items-center justify-center text-[18px] hover:bg-[#2a2a2a] rounded-lg transition-colors active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mention */}
                <button
                  onClick={handleMentionButton}
                  className="p-2 hover:bg-[rgba(107,115,255,0.10)] rounded-full transition-colors"
                  title="Mention someone (@)"
                >
                  <AtSign size={18} className="text-[#6B73FF]" />
                </button>

                {/* Location */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowLocationPicker(v => !v);
                      setShowEmojiPicker(false);
                      setShowAudiencePicker(false);
                    }}
                    className={cn(
                      'p-2 rounded-full transition-colors',
                      location
                        ? 'text-pink-400 bg-[rgba(236,72,153,0.12)]'
                        : showLocationPicker
                          ? 'bg-[rgba(236,72,153,0.10)]'
                          : 'hover:bg-[rgba(236,72,153,0.08)]'
                    )}
                    title="Add location"
                  >
                    <MapPin size={18} className="text-pink-400" />
                  </button>

                  <AnimatePresence>
                    {showLocationPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-full left-0 mb-2 w-[272px] bg-[#181818] rounded-2xl border border-[#2a2a2a] shadow-2xl z-[60] p-3"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-[11px] font-bold text-[rgba(255,255,255,0.45)] uppercase tracking-wide mb-2.5">
                          Add Location
                        </p>

                        {/* Current location */}
                        <button
                          onClick={useCurrentLocation}
                          disabled={locationLoading}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#222] hover:bg-[#2a2a2a] transition-colors mb-2 disabled:opacity-60"
                        >
                          {locationLoading
                            ? <Loader2 size={15} className="text-pink-400 animate-spin flex-shrink-0" />
                            : <Navigation size={15} className="text-pink-400 flex-shrink-0" />
                          }
                          <span className="text-[13px] font-semibold text-white">Use current location</span>
                        </button>

                        {/* Search input */}
                        <div className="relative">
                          <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)]" />
                          <input
                            value={locationSearch}
                            onChange={handleLocationSearch}
                            placeholder="Search a place…"
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#222] border border-[#2a2a2a] text-[13px] text-white outline-none focus:border-[#7C3AED] transition-colors placeholder:text-[rgba(255,255,255,0.3)]"
                          />
                        </div>

                        {/* Search results */}
                        {locationResults.length > 0 && (
                          <div className="mt-1.5 space-y-0.5 max-h-[140px] overflow-y-auto">
                            {locationResults.map((r, i) => (
                              <button
                                key={i}
                                onClick={() => pickLocation(r)}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[#2a2a2a] transition-colors text-left"
                              >
                                <MapPin size={12} className="text-pink-400 flex-shrink-0" />
                                <span className="text-[12.5px] text-[#BDBDBD] truncate">{r.name}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Fallback: use typed text as-is */}
                        {locationSearch.trim() && locationResults.length === 0 && (
                          <button
                            onClick={() => pickLocation({ name: locationSearch.trim() })}
                            className="w-full mt-1.5 px-3 py-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] transition-colors text-[13px] text-white text-left"
                          >
                            Use "{locationSearch.trim()}"
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Audience */}
                <div className="relative ml-1">
                  <button
                    onClick={() => {
                      setShowAudiencePicker(v => !v);
                      setShowEmojiPicker(false);
                      setShowLocationPicker(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border border-[rgba(245,197,66,0.25)] text-[#F5C542] bg-[rgba(245,197,66,0.08)] hover:bg-[rgba(245,197,66,0.15)] transition-colors"
                  >
                    {AUDIENCE_OPTIONS.find(o => o.value === postAudience)?.icon}
                    <span className="ml-0.5">{AUDIENCE_OPTIONS.find(o => o.value === postAudience)?.label}</span>
                    <ChevronDown size={10} className={cn('ml-0.5 transition-transform duration-150', showAudiencePicker && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {showAudiencePicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}
                        className="absolute bottom-full left-0 mb-1.5 bg-[#181818] rounded-2xl shadow-xl border border-[#2a2a2a] p-1.5 z-[60] min-w-[130px]"
                      >
                        {AUDIENCE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => { setPostAudience(opt.value); setShowAudiencePicker(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors',
                              postAudience === opt.value
                                ? 'bg-[rgba(245,197,66,0.08)] text-[#F5C542]'
                                : 'text-[#BDBDBD] hover:bg-[#222]'
                            )}
                          >
                            {opt.icon}
                            <span>{opt.label}</span>
                            {postAudience === opt.value && <Check size={12} className="ml-auto text-[#F5C542]" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Cancel + Post */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setContent(''); setImageUrl(''); setIsExpanded(false);
                    setMentionedUsers([]); setLocation(null);
                    setShowEmojiPicker(false); setShowLocationPicker(false);
                    setShowAudiencePicker(false);
                  }}
                  className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePost}
                  disabled={!canPost || imageUploading}
                  className={cn(
                    'px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-1.5',
                    (!canPost || imageUploading) && 'bg-[#1a1a1a] text-[rgba(255,255,255,0.45)]'
                  )}
                  style={
                    canPost && !imageUploading
                      ? {
                          background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)',
                          color: '#fff',
                          boxShadow: '0 4px 14px rgba(245,197,66,0.35)',
                        }
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

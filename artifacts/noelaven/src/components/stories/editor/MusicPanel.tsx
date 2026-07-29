/**
 * MusicPanel — preset music track picker.
 *
 * Tapping a track adds a moveable music-badge TextLayer to the canvas (uses
 * the existing gesture layer system, no extra data fields needed).
 * The badge looks like the "Now Playing" chips on Instagram stories.
 */

import React, { useState } from 'react';
import { Music, Check } from 'lucide-react';

interface Track {
  id: string;
  emoji: string;
  title: string;
  artist: string;
}

const MUSIC_CATEGORIES: { label: string; tracks: Track[] }[] = [
  {
    label: '🔥 Trending',
    tracks: [
      { id: 't1', emoji: '🎵', title: 'Blinding Lights', artist: 'The Weeknd' },
      { id: 't2', emoji: '💜', title: 'As It Was',       artist: 'Harry Styles' },
      { id: 't3', emoji: '🌊', title: 'Watermelon Sugar', artist: 'Harry Styles' },
      { id: 't4', emoji: '🦋', title: 'Levitating',      artist: 'Dua Lipa' },
      { id: 't5', emoji: '✨', title: 'Anti-Hero',       artist: 'Taylor Swift' },
      { id: 't6', emoji: '🌸', title: 'Flowers',         artist: 'Miley Cyrus' },
    ],
  },
  {
    label: '😌 Chill',
    tracks: [
      { id: 'c1', emoji: '☁️', title: 'Golden Hour',     artist: 'JVKE' },
      { id: 'c2', emoji: '🌙', title: 'I Love You So',   artist: 'The Walters' },
      { id: 'c3', emoji: '🍃', title: 'Sunroof',         artist: 'Nicky Youre' },
      { id: 'c4', emoji: '🫶', title: 'Slow Dancing',    artist: 'V' },
      { id: 'c5', emoji: '🌿', title: 'Lofi Dreaming',   artist: 'Various Artists' },
      { id: 'c6', emoji: '🌅', title: 'Sunset Lover',    artist: 'Petit Biscuit' },
    ],
  },
  {
    label: '🎉 Party',
    tracks: [
      { id: 'p1', emoji: '🎊', title: 'Heat Waves',      artist: 'Glass Animals' },
      { id: 'p2', emoji: '💃', title: 'Unholy',          artist: 'Sam Smith' },
      { id: 'p3', emoji: '🕺', title: 'Escapism.',       artist: 'RAYE' },
      { id: 'p4', emoji: '🔊', title: 'Sure Thing',      artist: 'Miguel' },
      { id: 'p5', emoji: '⚡', title: 'Vibe (If I Back It Up)', artist: 'Cookiee Kawaii' },
      { id: 'p6', emoji: '🥳', title: 'Good 4 U',        artist: 'Olivia Rodrigo' },
    ],
  },
];

interface MusicPanelProps {
  onAdd: (text: string) => void;  // adds a music TextLayer to the canvas
}

export function MusicPanel({ onAdd }: MusicPanelProps) {
  const [activeCat, setActiveCat] = useState(0);
  const [selected,  setSelected]  = useState<string | null>(null);

  function handlePick(track: Track) {
    setSelected(track.id);
    // Build the badge text — same format as Instagram "Now Playing"
    const badge = `${track.emoji} ${track.title}\n${track.artist}`;
    onAdd(badge);
  }

  const category = MUSIC_CATEGORIES[activeCat];

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {MUSIC_CATEGORIES.map((c, i) => (
          <button
            key={i}
            onClick={() => setActiveCat(i)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: activeCat === i ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              color: 'white',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Track list */}
      <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
        {category.tracks.map((track) => {
          const isActive = selected === track.id;
          return (
            <button
              key={track.id}
              onClick={() => handlePick(track)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl active:bg-[#111]/10 transition-colors text-left"
              style={{ background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                {isActive ? <Check size={16} className="text-white" /> : track.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold leading-tight truncate">{track.title}</p>
                <p className="text-white/50 text-[10px] leading-tight truncate">{track.artist}</p>
              </div>
              <Music size={12} className="text-white/30 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-white/30 text-center px-2 pb-0.5">
        Tap a track to add it as a moveable badge · music doesn't play in viewer
      </p>
    </div>
  );
}

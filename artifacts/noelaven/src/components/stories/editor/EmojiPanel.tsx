/**
 * EmojiPanel — curated emoji grid organised by category.
 * Tapping any item fires onPick, which places it as a StickerLayer on the canvas.
 */

import React, { useState } from 'react';

const CATEGORIES: { label: string; items: string[] }[] = [
  {
    label: '✨ Top',
    items: [
      '❤️','😍','🔥','✨','💫','🌟','😂','🥹',
      '💕','🫶','🙌','👏','🎉','🥳','💯','🤩',
    ],
  },
  {
    label: '😀 Faces',
    items: [
      '😀','😊','😎','🤗','😜','🥰','😇','🤯',
      '😴','🥸','🤭','😏','🫡','🫠','😤','😭',
    ],
  },
  {
    label: '🌿 Nature',
    items: [
      '🌸','🌺','🌻','🌈','⭐','🌙','☀️','🌊',
      '🍀','🦋','🐝','🌴','🌵','🏔️','🌅','🍃',
    ],
  },
  {
    label: '🎵 Vibes',
    items: [
      '🎵','🎶','💃','🕺','🎨','📸','🎬','🏄',
      '🚀','💎','👑','🦄','🌮','☕','🍕','🎂',
    ],
  },
  {
    label: '🤙 Hands',
    items: [
      '👍','👎','✌️','🤞','🤟','🤘','👌','🤌',
      '🫰','💪','🙏','👋','🫂','❤️‍🔥','💥','⚡',
    ],
  },
];

interface EmojiPanelProps {
  onPick: (emoji: string) => void;
}

export function EmojiPanel({ onPick }: EmojiPanelProps) {
  const [activeCat, setActiveCat] = useState(0);

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {CATEGORIES.map((c, i) => (
          <button
            key={i}
            onClick={() => setActiveCat(i)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: activeCat === i ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              color: 'white',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 gap-0.5">
        {CATEGORIES[activeCat].items.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onPick(emoji)}
            className="text-2xl h-10 flex items-center justify-center rounded-xl transition-transform active:scale-90 hover:bg-[#111]/10"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

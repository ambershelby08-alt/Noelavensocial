import React from 'react';

const GRADIENT_PAIRS: [string, string][] = [
  ['#FF6B9D', '#C44FDB'],   // pink → purple
  ['#4F75FF', '#6EC6F5'],   // blue → sky
  ['#FF8C42', '#FF6B9D'],   // coral → pink
  ['#3CC2A8', '#4F75FF'],   // teal → blue
  ['#FFD93D', '#FF8C42'],   // yellow → orange
  ['#9B59B6', '#E056A4'],   // purple → magenta
  ['#2ECC71', '#3CC2A8'],   // green → teal
];

export function getGradientPair(name: string): [string, string] {
  const idx = ((name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0)) % GRADIENT_PAIRS.length;
  return GRADIENT_PAIRS[idx];
}

interface GradientAvatarProps {
  name: string;
  /** If provided and non-empty, renders a photo instead of the gradient initials. */
  src?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function GradientAvatar({ name, src, size = 40, className = '', style }: GradientAvatarProps) {
  const [from, to] = getGradientPair(name);
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover flex-shrink-0 select-none ${className}`}
        style={{ width: size, height: size, boxShadow: `0 3px 10px rgba(0,0,0,0.15)`, ...style }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: Math.round(size * 0.36),
        boxShadow: `0 3px 10px ${from}55`,
        ...style,
      }}
    >
      {initials}
    </div>
  );
}

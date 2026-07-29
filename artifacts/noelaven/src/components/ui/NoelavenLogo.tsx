import React from 'react';
import { cn } from '@/lib/utils';

// ─── Premium Lighthouse Mark ──────────────────────────────────────────────────
// White lighthouse, gold heart, wide gold beam, thin rainbow ring, small waves.

function LighthouseMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        {/* Rainbow ring — thin decorative accent only */}
        <linearGradient id="nlv-ring" x1="80" y1="20" x2="18" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4899"/>
          <stop offset="0.33" stopColor="#F5C542"/>
          <stop offset="0.66" stopColor="#2563EB"/>
          <stop offset="1" stopColor="#06B6D4"/>
        </linearGradient>
        {/* Gold gradient for beam & accents */}
        <linearGradient id="nlv-gold" x1="50" y1="10" x2="90" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE08A"/>
          <stop offset="1" stopColor="#F5C542"/>
        </linearGradient>
        {/* Rainbow waves */}
        <linearGradient id="nlv-wave" x1="10" y1="80" x2="90" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4899"/>
          <stop offset="0.5" stopColor="#F5C542"/>
          <stop offset="1" stopColor="#2563EB"/>
        </linearGradient>
      </defs>

      {/* Thin rainbow ring — opens at bottom */}
      <path
        d="M 17,75 A 36,36 0 1 1 83,75"
        stroke="url(#nlv-ring)"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Wide gold light beam */}
      <path d="M 50,35 L 88,10 L 82,42" fill="url(#nlv-gold)" opacity="0.75"/>

      {/* Lighthouse roof — white */}
      <polygon points="50,28 39,40 61,40" fill="#FFFFFF"/>
      {/* Lantern housing — white */}
      <rect x="41" y="40" width="18" height="11" rx="2" fill="#FFFFFF"/>
      {/* Lantern glow — gold */}
      <circle cx="50" cy="45.5" r="4.5" fill="#F5C542"/>
      <circle cx="50" cy="45.5" r="2.5" fill="#FFF9E6"/>
      {/* Tower — white */}
      <rect x="43" y="51" width="14" height="20" rx="2" fill="#FFFFFF"/>
      {/* Base — white */}
      <path d="M 40,71 L 41,76 L 59,76 L 60,71 Z" fill="#FFFFFF"/>

      {/* Gold heart on tower */}
      <path
        d="M50,59 C50,59 46,55.5 46,57.8 C46,60 50,63 50,63 C50,63 54,60 54,57.8 C54,55.5 50,59 50,59Z"
        fill="#F5C542"
      />

      {/* Small rainbow waves */}
      <path
        d="M12,79 Q24,74 36,78 Q48,82 60,77 Q72,72 88,76 L88,84 Q72,82 60,86 Q48,90 36,86 Q24,82 12,86Z"
        fill="url(#nlv-wave)"
        opacity="0.7"
      />

      {/* Tiny sparkle accents */}
      <path d="M28,30 L29.3,27 L30.6,30 L33.6,31.3 L30.6,32.6 L29.3,35.6 L28,32.6 L25,31.3Z" fill="#F5C542" opacity="0.9"/>
      <path d="M72,25 L73,22.5 L74,25 L76.5,26 L74,27 L73,29.5 L72,27 L69.5,26Z" fill="#EC4899" opacity="0.8"/>
      <circle cx="21" cy="52" r="1.8" fill="#F5C542" opacity="0.7"/>
    </svg>
  );
}

// ─── White wordmark ───────────────────────────────────────────────────────────
// All-white for premium black background. Gold heart accent.

function WhiteWordmark({ fontSize }: { fontSize: number }) {
  return (
    <span className="leading-none select-none font-black tracking-tight flex items-center gap-0.5" style={{ fontSize }}>
      <span style={{ color: '#FFFFFF' }}>Noelaven</span>
      <span style={{ color: '#F5C542', fontSize: fontSize * 0.7, marginLeft: 2 }}>♥</span>
    </span>
  );
}

// ─── Size scale ───────────────────────────────────────────────────────────────

const SIZES = {
  sm: { mark: 28, wordmark: 17 },
  md: { mark: 36, wordmark: 20 },
  lg: { mark: 48, wordmark: 26 },
  xl: { mark: 72, wordmark: 38 },
} as const;

// ─── Public component ─────────────────────────────────────────────────────────

interface NoelavenLogoProps {
  variant?: 'mark' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function NoelavenLogo({ variant = 'full', size = 'md', className }: NoelavenLogoProps) {
  const { mark, wordmark } = SIZES[size];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LighthouseMark size={mark} />
      {variant === 'full' && <WhiteWordmark fontSize={wordmark} />}
    </div>
  );
}

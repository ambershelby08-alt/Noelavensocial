/**
 * NoelavenLogo — official brand logo component.
 *
 * ─── HOW TO SWAP WITH A FILE ASSET LATER ─────────────────────────────────────
 *
 * Option A — replace just the mark SVG:
 *   Swap the <LighthouseMark> SVG with an <img src={markSrc} /> or an imported
 *   SVG component. The layout and wordmark stay as-is.
 *
 * Option B — replace the whole component with a single image:
 *   import logoSrc from '@/assets/noelaven-logo.svg';
 *   export function NoelavenLogo({ className }: { className?: string }) {
 *     return <img src={logoSrc} alt="Noelaven" className={cn('h-8', className)} />;
 *   }
 *
 * The `variant` and `size` props stay so every call-site keeps working untouched.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ─── Lighthouse SVG mark ──────────────────────────────────────────────────────
// Single source of truth for the brand mark. Swap the SVG content here when
// the official artwork arrives; nothing else needs to change.

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
        <linearGradient id="nlv-ring" x1="80" y1="25" x2="18" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4899"/>
          <stop offset=".5" stopColor="#7C3AED"/>
          <stop offset="1" stopColor="#2563EB"/>
        </linearGradient>
        <linearGradient id="nlv-wave" x1="14" y1="80" x2="86" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB"/>
          <stop offset="1" stopColor="#06B6D4"/>
        </linearGradient>
      </defs>

      {/* Ring arc: pink → purple → blue, opens at bottom */}
      <path d="M 19,76 A 35,35 0 1 1 81,76"
            stroke="url(#nlv-ring)" strokeWidth="5.5" strokeLinecap="round"/>

      {/* Light beam */}
      <path d="M 55,34 L 86,14 L 80,39" fill="#F59E0B" opacity="0.52"/>

      {/* Lighthouse roof */}
      <polygon points="50,30 41,40 59,40" fill="#1A1B4B"/>
      {/* Lantern housing */}
      <rect x="42" y="40" width="16" height="10" rx="2" fill="#1A1B4B"/>
      {/* Lantern glow */}
      <circle cx="50" cy="45" r="4" fill="#FCD34D"/>
      <circle cx="50" cy="45" r="2.2" fill="#FEFCE8"/>
      {/* Tower */}
      <rect x="44" y="49" width="12" height="21" rx="2" fill="#1A1B4B"/>
      {/* Base */}
      <path d="M 42,70 L 43,74 L 57,74 L 58,70 Z" fill="#1A1B4B"/>

      {/* Heart */}
      <path d="M50,57 C50,57 46.5,54 46.5,56.2 C46.5,58.2 50,61 50,61 C50,61 53.5,58.2 53.5,56.2 C53.5,54 50,57 50,57Z"
            fill="white" opacity="0.88"/>

      {/* Waves */}
      <path d="M14,78 Q26,73 38,77 Q50,81 62,76 Q74,71 86,75 L86,85 Q74,82 62,86 Q50,90 38,86 Q26,82 14,85Z"
            fill="url(#nlv-wave)" opacity="0.88"/>

      {/* Sparkle stars */}
      <path d="M29,32 L30.2,29.2 L31.4,32 L34.2,33.2 L31.4,34.4 L30.2,37.2 L29,34.4 L26.2,33.2Z" fill="#EC4899"/>
      <path d="M71,27 L71.9,24.8 L72.8,27 L75,27.9 L72.8,28.8 L71.9,31 L71,28.8 L68.8,27.9Z" fill="#7C3AED"/>
      <circle cx="23" cy="54" r="1.8" fill="#2563EB" opacity="0.85"/>
      <circle cx="67" cy="34" r="1.4" fill="#EC4899" opacity="0.70"/>
    </svg>
  );
}

// ─── Colorful wordmark ────────────────────────────────────────────────────────
// Per-letter colors match the official brand wordmark.
// Swap the LETTER_COLORS array when the final brand guide arrives.

const LETTER_COLORS = ['#1A1B4B', '#2563EB', '#7C3AED', '#EC4899', '#F59E0B', '#06B6D4', '#10B981', '#1A1B4B'];
const LETTERS       = ['N', 'o', 'e', 'l', 'a', 'v', 'e', 'n'];

function ColorWordmark({ fontSize }: { fontSize: number }) {
  return (
    <span className="leading-none select-none font-black tracking-tight flex" style={{ fontSize }}>
      {LETTERS.map((ch, i) => (
        <span key={i} style={{ color: LETTER_COLORS[i] }}>{ch}</span>
      ))}
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
  /**
   * `mark`  — lighthouse icon only.
   * `full`  — lighthouse + colorful wordmark side by side (default).
   */
  variant?: 'mark' | 'full';
  /** Overall scale. Default: `md`. `xl` is used on auth/splash screens. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function NoelavenLogo({ variant = 'full', size = 'md', className }: NoelavenLogoProps) {
  const { mark, wordmark } = SIZES[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LighthouseMark size={mark} />
      {variant === 'full' && <ColorWordmark fontSize={wordmark} />}
    </div>
  );
}

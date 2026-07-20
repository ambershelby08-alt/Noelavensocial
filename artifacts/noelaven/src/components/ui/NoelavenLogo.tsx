/**
 * NoelavenLogo — placeholder logo component.
 *
 * ─── HOW TO SWAP IN THE OFFICIAL LOGO ───────────────────────────────────────
 *
 * Option A — Image file (PNG / SVG)
 *   Replace the contents of <LogoMark> and <LogoWordmark> with a single <img>:
 *
 *     import logoSrc from '@/assets/noelaven-logo.svg';
 *     // inside NoelavenLogo:
 *     return <img src={logoSrc} alt="Noelaven" className={cn('h-8', className)} />;
 *
 * Option B — Inline SVG
 *   Paste the SVG markup directly inside NoelavenLogo and delete <LogoMark>
 *   and <LogoWordmark>. The parent layout in AppShell / Sidebar doesn't change.
 *
 * The `variant` and `size` props are convenience helpers for the layout —
 * feel free to remove them once you have the real asset.
 * ────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ─── Sub-pieces (placeholder only) ───────────────────────────────────────────

/** The square icon mark — the "N" badge. */
function LogoMark({ px }: { px: number }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-[28%] font-black text-white select-none"
      style={{
        width: px,
        height: px,
        background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 50%, #FF6B9D 100%)',
        boxShadow: '0 2px 10px rgba(107,115,255,0.40)',
        fontSize: px * 0.52,
        letterSpacing: '-0.02em',
      }}
    >
      N
    </div>
  );
}

/** The text wordmark — "Noelaven". */
function LogoWordmark({ fontSize }: { fontSize: number }) {
  return (
    <span
      className="font-black tracking-tight leading-none select-none"
      style={{
        fontSize,
        background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      Noelaven
    </span>
  );
}

// ─── Size scale ───────────────────────────────────────────────────────────────

const SIZES = {
  sm: { mark: 28, wordmark: 17 },
  md: { mark: 36, wordmark: 20 },
  lg: { mark: 48, wordmark: 26 },
} as const;

// ─── Public component ─────────────────────────────────────────────────────────

interface NoelavenLogoProps {
  /**
   * `mark`  — icon only (the "N" badge).
   * `full`  — icon + wordmark side by side (default).
   */
  variant?: 'mark' | 'full';
  /** Controls overall scale. Default: `md`. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function NoelavenLogo({
  variant = 'full',
  size = 'md',
  className,
}: NoelavenLogoProps) {
  const { mark, wordmark } = SIZES[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark px={mark} />
      {variant === 'full' && <LogoWordmark fontSize={wordmark} />}
    </div>
  );
}

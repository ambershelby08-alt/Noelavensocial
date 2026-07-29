import React from 'react';
import { cn } from '@/lib/utils';

// ─── Official Noelaven Logo ────────────────────────────────────────────────────
// Uses the approved brand PNG asset directly — do NOT redraw or approximate.
// The asset includes: white lighthouse, gold heart cutout, gold beam,
// thin rainbow halo/ring, and rainbow waves beneath.

const SIZES = {
  sm: { img: 28,  fontSize: 17 },
  md: { img: 38,  fontSize: 20 },
  lg: { img: 52,  fontSize: 26 },
  xl: { img: 76,  fontSize: 38 },
} as const;

interface NoelavenLogoProps {
  variant?: 'mark' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function NoelavenLogo({ variant = 'full', size = 'md', className }: NoelavenLogoProps) {
  const { img, fontSize } = SIZES[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Official approved brand asset — exact PNG, not a recreation */}
      <img
        src="/noelaven-logo.png"
        alt="Noelaven"
        width={img}
        height={img}
        style={{ objectFit: 'contain', flexShrink: 0 }}
        draggable={false}
      />
      {variant === 'full' && (
        <span
          className="leading-none select-none font-black tracking-tight"
          style={{
            fontSize,
            background: 'linear-gradient(135deg, #FFFFFF 60%, rgba(255,255,255,0.7))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Noelaven
        </span>
      )}
    </div>
  );
}

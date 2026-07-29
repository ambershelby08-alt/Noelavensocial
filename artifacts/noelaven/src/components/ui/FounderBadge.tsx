/**
 * FounderBadge — exclusive purple-and-gold crown badge for the Founder account.
 *
 * Authorization is checked against the hardcoded FOUNDER_UID — it is
 * NEVER based on editable profile data such as displayName or badges[].
 */
import { useState } from 'react';
import { Crown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { FOUNDER_UID } from '@/lib/founder';

interface FounderBadgeProps {
  /** Firebase UID of the user to check — renders nothing if not the Founder. */
  userId: string | undefined | null;
  /** Visual size of the badge icon. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Show the word "Founder" inline next to the crown. */
  showLabel?: boolean;
  className?: string;
}

const GRADIENT = 'linear-gradient(135deg, #F5C542 0%, #A855F7 40%, #D4AF37 100%)';

export function FounderBadge({
  userId, size = 'sm', showLabel = false, className = '',
}: FounderBadgeProps) {
  const [tip, setTip] = useState(false);

  if (userId !== FOUNDER_UID) return null;

  const dim = {
    xs: { box: 14, icon: 7,  text: 'text-[8.5px]' },
    sm: { box: 17, icon: 9,  text: 'text-[10px]'  },
    md: { box: 20, icon: 11, text: 'text-[11px]'  },
    lg: { box: 24, icon: 13, text: 'text-[12px]'  },
  }[size];

  return (
    <span
      className={`relative inline-flex items-center gap-1 flex-shrink-0 ${className}`}
      aria-label="Founder"
    >
      {/* Crown icon pill */}
      <button
        type="button"
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
        onClick={e => { e.stopPropagation(); setTip(v => !v); }}
        className="rounded-full flex items-center justify-center shadow-sm ring-1 ring-white/20 focus:outline-none"
        style={{
          background: GRADIENT,
          width: dim.box,
          height: dim.box,
        }}
      >
        <Crown size={dim.icon} className="text-white drop-shadow" />
      </button>

      {/* Inline "Founder" label */}
      {showLabel && (
        <span
          className={`font-black leading-none ${dim.text}`}
          style={{
            background: GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Founder
        </span>
      )}

      {/* Tooltip on hover/tap */}
      <AnimatePresence>
        {tip && (
          <motion.span
            initial={{ opacity: 0, scale: 0.75, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[200] pointer-events-none"
          >
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-xl whitespace-nowrap text-white text-[11px] font-black ring-1 ring-white/20"
              style={{ background: GRADIENT }}
            >
              <Crown size={9} className="text-yellow-200" />
              Founder
            </span>
            {/* Tiny caret */}
            <span
              className="block w-2 h-2 mx-auto -mt-1 rotate-45"
              style={{ background: '#D4AF37' }}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

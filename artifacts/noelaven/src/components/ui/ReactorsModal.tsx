/**
 * ReactorsModal — bottom sheet showing who reacted and with which reaction.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { getLabelForEmoji, getTopReactions } from '@/lib/reactions';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface Reactor {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

interface ReactorsModalProps {
  reactions: Record<string, string[]>;
  resolveUser?: (userId: string) => Reactor | undefined;
  onClose: () => void;
}

export function ReactorsModal({ reactions, resolveUser, onClose }: ReactorsModalProps) {
  const topReactions = getTopReactions(reactions, 20);
  const [activeEmoji, setActiveEmoji] = useState<string>('all');

  const items: Array<{ emoji: string; userId: string }> = [];
  for (const { emoji } of topReactions) {
    for (const userId of reactions[emoji] ?? []) {
      items.push({ emoji, userId });
    }
  }

  const displayed = activeEmoji === 'all' ? items : items.filter(i => i.emoji === activeEmoji);
  const totalCount = items.length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed inset-x-0 bottom-0 z-[85] bg-[#111] rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: '72dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#222]" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <p className="font-black text-[17px] text-white">
            {totalCount} {totalCount === 1 ? 'Reaction' : 'Reactions'}
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center hover:bg-[#222] transition-colors"
          >
            <X size={15} className="text-[#BDBDBD]" />
          </button>
        </div>

        {/* Reaction filter tabs */}
        {topReactions.length > 0 && (
          <div className="flex gap-2 px-5 pb-3 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {['all', ...topReactions.map(r => r.emoji)].map(emoji => {
              const isAll = emoji === 'all';
              const count = isAll ? totalCount : (reactions[emoji]?.length ?? 0);
              const active = activeEmoji === emoji;
              return (
                <button
                  key={emoji}
                  onClick={() => setActiveEmoji(emoji)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                    active
                      ? 'bg-[rgba(245,197,66,0.15)] text-purple-700 ring-1 ring-purple-300'
                      : 'bg-[#1a1a1a] text-[#BDBDBD] hover:bg-[#222]'
                  }`}
                >
                  <span className="text-[15px]">{isAll ? '✦' : emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="h-px bg-[#1a1a1a] flex-shrink-0" />

        <div className="flex-1 overflow-y-auto px-5 py-2">
          <AnimatePresence mode="popLayout">
            {displayed.length === 0 ? (
              <motion.p
                key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center text-[rgba(255,255,255,0.45)] text-[14px] py-10"
              >
                No reactions yet
              </motion.p>
            ) : (
              displayed.map(({ emoji, userId }, i) => {
                const user = resolveUser?.(userId);
                return (
                  <motion.div
                    key={`${emoji}-${userId}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.025, duration: 0.18 }}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div className="relative flex-shrink-0">
                      <UserAvatar
                        userId={userId}
                        fallbackName={user?.displayName ?? '?'}
                        fallbackSrc={user?.avatarUrl}
                        size={40}
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 text-[13px] leading-none"
                        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}>
                        {emoji}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[14px] text-white truncate">
                        {user?.displayName ?? 'Someone'}
                      </p>
                      <p className="text-[12px] text-[#F5C542] font-medium">
                        {emoji} {getLabelForEmoji(emoji)}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
          <div style={{ height: 'max(env(safe-area-inset-bottom), 20px)' }} />
        </div>
      </motion.div>
    </>
  );
}

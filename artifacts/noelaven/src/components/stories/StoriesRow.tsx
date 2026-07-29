import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { StoryGroup } from '@/lib/stories';

interface StoriesRowProps {
  groups: StoryGroup[];
  onAddStory: () => void;
  onViewGroup: (groupIdx: number) => void;
}

export function StoriesRow({ groups, onAddStory, onViewGroup }: StoriesRowProps) {
  const { currentUser } = useAuth();
  const ownIdx = groups.findIndex((g) => g.isOwn);
  const ownGroup = ownIdx >= 0 ? groups[ownIdx] : null;
  const others = groups.filter((g) => !g.isOwn);

  return (
    <div className="px-4 mb-5">
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {/* ── Add / own story ── */}
        {currentUser && (
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            {/* Avatar — tap to VIEW existing stories (only when user has some) */}
            <div className="relative">
              <button
                className="active:opacity-80 transition-opacity"
                onClick={ownGroup ? () => onViewGroup(ownIdx) : onAddStory}
                aria-label={ownGroup ? 'View your story' : 'Add story'}
              >
                {ownGroup ? (
                  /* Has own story → gradient ring */
                  <div
                    className="p-[2.5px] rounded-full"
                    style={{ background: 'linear-gradient(135deg, #EC4899, #F5C542, #2563EB)' }}
                  >
                    <div className="p-[2px] bg-black rounded-full">
                      <GradientAvatar
                        name={currentUser.displayName}
                        src={currentUser.avatarUrl || undefined}
                        size={50}
                      />
                    </div>
                  </div>
                ) : (
                  /* No story yet → plain avatar */
                  <GradientAvatar
                    name={currentUser.displayName}
                    src={currentUser.avatarUrl || undefined}
                    size={56}
                  />
                )}
              </button>

              {/* + badge — ALWAYS visible, ALWAYS opens the picker → StoryComposer */}
              <button
                onClick={onAddStory}
                aria-label="Add story"
                className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center border-2 border-white active:scale-90 transition-transform"
                style={{ background: '#F5C542', border: '2px solid #000' }}
              >
                <span className="text-white text-[10px] font-black leading-none">+</span>
              </button>
            </div>

            <span className="text-[10px] text-[rgba(255,255,255,0.45)] font-medium">Your story</span>
          </div>
        )}

        {/* ── Other users' stories ── */}
        {others.map((group) => {
          const idx = groups.indexOf(group);
          return (
            <button
              key={group.authorId}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 active:opacity-80 transition-opacity"
              onClick={() => onViewGroup(idx)}
            >
              <div
                className="p-[2.5px] rounded-full"
                style={{
                  background: group.hasUnseen
                    ? 'linear-gradient(135deg, #EC4899 0%, #F5C542 50%, #2563EB 100%)'
                    : '#333333',
                }}
              >
                <div className="p-[2px] bg-black rounded-full">
                  <UserAvatar
                    userId={group.authorId}
                    fallbackName={group.authorName}
                    fallbackSrc={group.authorAvatarUrl || undefined}
                    size={50}
                  />
                </div>
              </div>
              <span className="text-[10px] text-[rgba(255,255,255,0.45)] font-medium max-w-[56px] truncate text-center">
                {group.authorName.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

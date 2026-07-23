/**
 * UserAvatar — always shows the live profile photo for a userId.
 *
 * Subscribes to UserCacheContext so it automatically updates when the user
 * changes their profile picture — no logout/refresh required.
 *
 * Drop-in replacement for the pattern:
 *   <GradientAvatar name={user.displayName} src={user.avatarUrl || undefined} size={42} />
 *
 * Use:
 *   <UserAvatar userId={post.authorId} fallbackName={post.author.displayName} size={42} />
 *
 * `fallbackName` — used for gradient colour + initials while the cache warms.
 * `fallbackSrc`  — shown as the image while the cache is still loading
 *                  (prevents a flicker from gradient → photo on first render).
 */

import React from 'react';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { useUserProfile } from '@/contexts/UserCacheContext';

interface UserAvatarProps {
  userId:       string;
  fallbackName: string;
  fallbackSrc?: string;
  size?:        number;
  className?:   string;
  style?:       React.CSSProperties;
}

export function UserAvatar({
  userId,
  fallbackName,
  fallbackSrc,
  size,
  className,
  style,
}: UserAvatarProps) {
  const cached = useUserProfile(userId);

  // Prefer live cache data; fall back gracefully while loading.
  const name = cached?.displayName || fallbackName;
  const src  = (cached?.avatarUrl ?? fallbackSrc) || undefined;

  return (
    <GradientAvatar
      name={name}
      src={src}
      size={size}
      className={className}
      style={style}
    />
  );
}

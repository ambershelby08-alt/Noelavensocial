import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeCommunities,
  toggleCommunityMembership as fsToggle,
  createCommunity as fsCreate,
} from '@/lib/firestore';
import { mockCommunities } from '@/lib/mockData';
import type { Community } from '@/lib/mockData';

interface NewCircleData {
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  rules: string[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  Design: '🎨', Technology: '💻', Photography: '📷', Music: '🎵',
  Travel: '✈️', Fitness: '💪', Gaming: '🎮', Reading: '📚', Food: '🍳', Wellness: '🧘',
};

export function useCommunities() {
  const { currentUser } = useAuth();
  const [communities, setCommunities] = useState<Community[]>(
    isFirebaseConfigured ? [] : mockCommunities
  );
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) { setIsLoading(false); return; }
    setIsLoading(true);
    const unsub = subscribeCommunities(currentUser?.id, newComms => {
      setCommunities(newComms);
      setIsLoading(false);
    });
    return unsub;
  }, [currentUser?.id]);

  const toggleJoin = useCallback(async (id: string) => {
    if (!currentUser) return;
    const comm = communities.find(c => c.id === id);
    if (!comm) return;
    const wasJoined = comm.isJoined;

    // Optimistic update
    setCommunities(prev => prev.map(c =>
      c.id === id
        ? { ...c, isJoined: !wasJoined, memberCount: wasJoined ? c.memberCount - 1 : c.memberCount + 1 }
        : c
    ));

    if (isFirebaseConfigured) {
      try {
        await fsToggle(id, currentUser.id, wasJoined);
      } catch {
        // Revert
        setCommunities(prev => prev.map(c =>
          c.id === id ? { ...c, isJoined: wasJoined, memberCount: comm.memberCount } : c
        ));
      }
    }
  }, [communities, currentUser]);

  const createCircle = useCallback(async (data: NewCircleData): Promise<string> => {
    if (!currentUser) throw new Error('Not signed in');
    const emoji = CATEGORY_EMOJI[data.category] ?? '✨';

    if (!isFirebaseConfigured) {
      const newComm: Community = {
        id: `comm-new-${Date.now()}`,
        name: data.name,
        description: data.description,
        bannerUrl: '',
        emoji,
        memberCount: 1,
        postCount: 0,
        onlineCount: 1,
        category: data.category,
        rules: data.rules,
        moderatorIds: [currentUser.id],
        isJoined: true,
        isPrivate: data.isPrivate,
        createdAt: new Date(),
      };
      setCommunities(prev => [newComm, ...prev]);
      return newComm.id;
    }

    const id = await fsCreate(data, currentUser.id, emoji);
    return id;
  }, [currentUser]);

  return { communities, isLoading, toggleJoin, createCircle };
}

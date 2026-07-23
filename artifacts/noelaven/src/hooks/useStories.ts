import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  type Story, type StoryGroup, type StoryMediaType,
  subscribeStories, createStory as fsCreateStory,
  markStoryViewed, groupStories,
} from '@/lib/stories';
import { mockUsers } from '@/lib/mockData';
import type { User } from '@/lib/mockData';

// ─── Demo-mode mock stories ───────────────────────────────────────────────────

const DEMO_MEDIA = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600&q=80',
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80',
  'https://images.unsplash.com/photo-1476611338391-6f395a0ebc7b?w=600&q=80',
];
const DEMO_CAPTIONS = [
  'Good morning! ☀️',
  'Living the dream 🌊',
  'Golden hour 🌅',
  '',
  "Can't stop smiling today 🌸",
];

function buildDemoStories(): Story[] {
  const now = Date.now();
  return mockUsers.slice(0, 5).map((u, i) => ({
    id: `demo-story-${i}`,
    authorId: u.id,
    authorName: u.displayName,
    authorHandle: u.handle,
    authorAvatarUrl: u.avatarUrl,
    mediaUrl: DEMO_MEDIA[i],
    mediaType: 'image' as StoryMediaType,
    caption: DEMO_CAPTIONS[i],
    createdAt: new Date(now - i * 3_600_000),
    expiresAt: new Date(now + (24 - i) * 3_600_000),
    viewerIds: [],
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStories() {
  const { currentUser } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStories(buildDemoStories());
      setLoading(false);
      return;
    }
    const unsub = subscribeStories((s) => {
      setStories(s);
      setLoading(false);
    });
    return unsub;
  }, []);

  const groups: StoryGroup[] = useMemo(
    () => groupStories(stories, currentUser?.id),
    [stories, currentUser?.id],
  );

  /** Upload media to Cloudinary and persist a new Story to Firestore. */
  async function publishStory(
    mediaUrl: string,
    mediaType: StoryMediaType,
    caption: string,
  ): Promise<void> {
    if (!currentUser) return;
    if (!isFirebaseConfigured) return; // demo mode — skip persistence
    await fsCreateStory(currentUser as unknown as User, mediaUrl, mediaType, caption);
  }

  /** Mark a single story as viewed by the current user. */
  async function markViewed(storyId: string): Promise<void> {
    if (!currentUser || !isFirebaseConfigured) return;
    await markStoryViewed(storyId, currentUser.id);
  }

  const ownGroup = groups.find((g) => g.isOwn) ?? null;

  return { groups, ownGroup, loading, publishStory, markViewed };
}

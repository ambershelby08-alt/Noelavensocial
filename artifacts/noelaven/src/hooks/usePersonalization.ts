/**
 * usePersonalization — localStorage-backed signals that power "For You" ranking.
 */
import { useState } from 'react';
import type { Post } from '@/lib/mockData';

export interface PersonalizationSignals {
  interests: string[];
  recentSearches: string[];
  recentCategories: string[];
  reactedPostIds: string[];
}

const STORAGE_KEY = 'noelaven-personalization-v2';
const MAX_RECENT = 12;

function defaultSignals(): PersonalizationSignals {
  return { interests: [], recentSearches: [], recentCategories: [], reactedPostIds: [] };
}

function loadSignals(): PersonalizationSignals {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSignals();
    return { ...defaultSignals(), ...JSON.parse(raw) };
  } catch { return defaultSignals(); }
}

export function usePersonalization() {
  const [signals, setSignals] = useState<PersonalizationSignals>(loadSignals);

  function persist(next: PersonalizationSignals) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
    setSignals(next);
  }

  function toggleInterest(interest: string) {
    const next = { ...signals };
    next.interests = next.interests.includes(interest)
      ? next.interests.filter(i => i !== interest)
      : [...next.interests, interest];
    persist(next);
  }

  function trackCategory(slug: string) {
    const cats = [slug, ...signals.recentCategories.filter(s => s !== slug)].slice(0, MAX_RECENT);
    persist({ ...signals, recentCategories: cats });
  }

  function trackSearch(term: string) {
    if (!term.trim()) return;
    const searches = [term, ...signals.recentSearches.filter(s => s !== term)].slice(0, MAX_RECENT);
    persist({ ...signals, recentSearches: searches });
  }

  function removeSearch(term: string) {
    persist({ ...signals, recentSearches: signals.recentSearches.filter(s => s !== term) });
  }

  function clearSearches() {
    persist({ ...signals, recentSearches: [] });
  }

  function trackReaction(postId: string) {
    const ids = [postId, ...signals.reactedPostIds.filter(id => id !== postId)].slice(0, 50);
    persist({ ...signals, reactedPostIds: ids });
  }

  /**
   * Rank posts for the "For You" feed.
   * Factors: recency, engagement, interest match, category match, prior reactions.
   */
  function rankPosts(posts: Post[], currentUserInterests: string[] = []): Post[] {
    const allInterests = [...new Set([...currentUserInterests, ...signals.interests])];
    const recentCatWords = signals.recentCategories.slice(0, 5).join(' ').toLowerCase();
    const reactedSet = new Set(signals.reactedPostIds);

    return [...posts]
      .filter(p => !p.sparkAudience || p.sparkAudience === 'public')
      .map(post => {
        let score = 0;
        // Recency: lose 1 pt per 8 h, floor at 0
        // post.createdAt is typed as Date but may arrive as a Firestore Timestamp.
        // Use duck-typed extraction so the hook never crashes on .getTime().
        const rawMs = (post.createdAt as unknown as { toDate?: () => Date })?.toDate
          ? (post.createdAt as unknown as { toDate: () => Date }).toDate().getTime()
          : post.createdAt instanceof Date ? post.createdAt.getTime() : Date.now();
        const ageH = (Date.now() - rawMs) / 3_600_000;
        score += Math.max(0, 10 - ageH / 8);
        // Engagement (0–8)
        score += Math.min(8, ((post.likes ?? 0) + (post.comments ?? 0) * 1.5) / 60);
        // Interest match (+2 per hit)
        const postText = [
          ...(post.author.interests ?? []),
          post.content, post.sparkPrompt ?? '', post.mood ?? '',
        ].join(' ').toLowerCase();
        for (const interest of allInterests) {
          if (postText.includes(interest.toLowerCase())) score += 2;
        }
        // Recent category match
        if (recentCatWords && postText.split(' ').some(w => recentCatWords.includes(w))) score += 3;
        // Prior reaction (shows social proof)
        if (reactedSet.has(post.id)) score += 1;
        // Jitter for variety
        score += Math.random() * 0.4;
        return { post, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ post }) => post);
  }

  return {
    signals,
    toggleInterest,
    trackCategory,
    trackSearch,
    removeSearch,
    clearSearches,
    trackReaction,
    rankPosts,
  };
}

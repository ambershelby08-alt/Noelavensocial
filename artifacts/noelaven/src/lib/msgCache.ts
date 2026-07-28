/**
 * Thin localStorage cache for messages and conversations.
 *
 * Keys are scoped to the current user so multiple accounts on the same
 * device never see each other's data.
 *
 * Dates are stored as ISO strings and revived on read.
 * All operations are synchronous and wrapped in try/catch — a quota
 * error or parse failure is silently ignored so the app keeps working.
 */

import type { Message, Conversation } from '@/lib/mockData';

const PREFIX = 'nlv_';
const MAX_MSGS = 50; // keep the most-recent N messages per conversation

// ─── Key helpers ─────────────────────────────────────────────────────────────

function msgsKey(userId: string, convId: string) {
  return `${PREFIX}msgs_${userId}_${convId}`;
}

function convsKey(userId: string) {
  return `${PREFIX}convs_${userId}`;
}

// ─── Date revival ────────────────────────────────────────────────────────────

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_RE.test(value)) return new Date(value);
  return value;
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw, reviver) as T;
  } catch {
    return null;
  }
}

// ─── Messages ────────────────────────────────────────────────────────────────

/** Write the most-recent `MAX_MSGS` messages to cache. */
export function cacheMessages(userId: string, convId: string, msgs: Message[]): void {
  try {
    const slice = msgs.slice(-MAX_MSGS);
    localStorage.setItem(msgsKey(userId, convId), JSON.stringify(slice));
  } catch {
    // quota exceeded — ignore
  }
}

/** Read cached messages; returns [] if nothing is cached. */
export function readCachedMessages(userId: string, convId: string): Message[] {
  return parse<Message[]>(localStorage.getItem(msgsKey(userId, convId))) ?? [];
}

/** Evict cached messages for a single conversation (e.g. after leave). */
export function evictMessages(userId: string, convId: string): void {
  try { localStorage.removeItem(msgsKey(userId, convId)); } catch { /* ignore */ }
}

/**
 * Evict ALL message caches for a user — call on sign-out / account switch so
 * the next user on this device never briefly sees another account's messages.
 */
export function evictAllMessages(userId: string): void {
  try {
    const prefix = `${PREFIX}msgs_${userId}_`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ─── Conversations ────────────────────────────────────────────────────────────

/** Write conversations list to cache. */
export function cacheConversations(userId: string, convs: Conversation[]): void {
  try {
    localStorage.setItem(convsKey(userId), JSON.stringify(convs));
  } catch {
    // quota exceeded — ignore
  }
}

/** Read cached conversations; returns null if nothing is cached. */
export function readCachedConversations(userId: string): Conversation[] | null {
  return parse<Conversation[]>(localStorage.getItem(convsKey(userId)));
}

/** Evict cached conversations (e.g. on sign-out). */
export function evictConversations(userId: string): void {
  try { localStorage.removeItem(convsKey(userId)); } catch { /* ignore */ }
}

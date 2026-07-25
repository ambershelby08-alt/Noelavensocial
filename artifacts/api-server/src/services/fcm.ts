/**
 * FCM Send Service — api-server
 *
 * Uses Firebase Admin SDK to:
 *  1. Look up the recipient's enabled device tokens from Firestore.
 *  2. Check notification preferences and mute/block status.
 *  3. Send a multicast FCM message to all valid tokens.
 *  4. Delete invalid/expired tokens from Firestore automatically.
 */

import { adminDb, adminMessaging, isAdminConfigured } from '../lib/firebaseAdmin';
import { logger } from '../lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  /** Firestore UID of the notification recipient */
  recipientId: string;
  /** Notification type — must match NotificationType on the client */
  type: string;
  title: string;
  body: string;
  /** Arbitrary string→string data forwarded to the SW for deep-link routing */
  data?: Record<string, string>;
  /** UID of the sender — used to respect block rules */
  senderId?: string;
}

// ─── Main send function ───────────────────────────────────────────────────────

export async function sendPushNotification(payload: PushPayload): Promise<void> {
  if (!isAdminConfigured || !adminDb || !adminMessaging) return;

  const { recipientId, type, title, body, data = {}, senderId } = payload;

  try {
    // 1. Skip if sender is blocked by recipient
    if (senderId && senderId !== recipientId) {
      const blockSnap = await adminDb
        .doc(`users/${recipientId}/blocked/${senderId}`)
        .get()
        .catch(() => null);
      if (blockSnap?.exists) return;

      // Also skip if recipient has muted the sender (for message notifications)
      if (type === 'message') {
        const muteSnap = await adminDb
          .doc(`users/${recipientId}/muted/${senderId}`)
          .get()
          .catch(() => null);
        if (muteSnap?.exists) return;
      }
    }

    // 2. Respect per-type notification preferences
    const prefSnap = await adminDb
      .doc(`users/${recipientId}/preferences/notifications`)
      .get()
      .catch(() => null);
    const prefs = (prefSnap?.data() ?? {}) as Record<string, unknown>;

    const prefKey = typeToPrefKey(type);
    if (prefKey && prefs[prefKey] === false) return;

    // 3. Fetch enabled device tokens
    const devicesSnap = await adminDb
      .collection(`users/${recipientId}/devices`)
      .where('enabled', '==', true)
      .get()
      .catch(() => null);

    if (!devicesSnap || devicesSnap.empty) return;

    const tokens: string[] = devicesSnap.docs
      .map(d => (d.data() as { token?: string }).token ?? '')
      .filter(Boolean);

    if (!tokens.length) return;

    // 4. Send
    const deepLink = buildDeepLink(type, data);

    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { ...data, type },
      webpush: {
        notification: {
          icon:  '/favicon.svg',
          badge: '/favicon.svg',
          requireInteraction: false,
          tag:   type,
          renotify: false,
        },
        fcmOptions: deepLink ? { link: deepLink } : undefined,
      },
    });

    logger.info(
      { recipientId, type, successCount: response.successCount, failureCount: response.failureCount },
      '[FCM] send result'
    );

    // 5. Clean up invalid tokens
    const deleteOps: Promise<unknown>[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? '';
        const isInvalid =
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token';

        if (isInvalid) {
          const deviceDoc = devicesSnap.docs[i];
          if (deviceDoc) {
            deleteOps.push(deviceDoc.ref.delete().catch(console.error));
          }
        }
      }
    });

    await Promise.allSettled(deleteOps);
  } catch (err) {
    logger.error({ err, recipientId, type }, '[FCM] sendPushNotification error');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps notification type → user preference key */
function typeToPrefKey(type: string): string | null {
  const map: Record<string, string> = {
    message:      'messages',
    reaction:     'reactions',
    like:         'reactions',
    comment:      'comments',
    reply:        'comments',
    follow:       'follows',
    mention:      'mentions',
    story_reply:  'comments',
    spark_reaction: 'reactions',
    story_reaction: 'reactions',
  };
  return map[type] ?? null;
}

/** Builds the deep-link URL included in the push (used when app is closed) */
function buildDeepLink(type: string, data: Record<string, string>): string | null {
  if (type === 'message'  && data['convId'])  return `/messages/${data['convId']}`;
  if (type === 'follow'   && data['actorId']) return `/profile/${data['actorId']}`;
  if (
    (type === 'comment' || type === 'reply' || type === 'reaction' || type === 'like' || type === 'mention')
    && data['postId']
  ) return `/`;
  if (type === 'story_reply' && data['storyId']) return `/`;
  return null;
}

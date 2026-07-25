/**
 * POST /api/push/send
 *
 * Accepts a notification event from the Noelaven client and delivers it as
 * an FCM push notification to the recipient's registered devices.
 *
 * Security note: FCM messages are sent exclusively from this server using the
 * Firebase Admin SDK with a private service-account credential. The client
 * never has access to the service account and never calls FCM directly.
 *
 * Request body:
 *   recipientId  — string  (required) recipient Firebase UID
 *   senderId     — string            sender UID (for block/mute checks)
 *   type         — string  (required) notification type
 *   title        — string  (required)
 *   body         — string  (required)
 *   data         — object            arbitrary key/value pairs for routing
 */

import { Router } from 'express';
import { sendPushNotification } from '../services/fcm';
import { isAdminConfigured } from '../lib/firebaseAdmin';

const router = Router();

router.post('/push/send', async (req, res) => {
  if (!isAdminConfigured) {
    // FCM not configured — respond 200 so the client doesn't retry
    res.json({ ok: false, reason: 'fcm_not_configured' });
    return;
  }

  const { recipientId, senderId, type, title, body, data } = req.body as {
    recipientId?: string;
    senderId?: string;
    type?: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
  };

  if (!recipientId || !type || !title || !body) {
    res.status(400).json({ error: 'recipientId, type, title and body are required' });
    return;
  }

  // Fire-and-forget — the client shouldn't wait for FCM delivery
  sendPushNotification({ recipientId, senderId, type, title, body, data }).catch(console.error);

  res.json({ ok: true });
});

export default router;

/**
 * GET /api/ice-config
 *
 * Returns a short-lived ICE server configuration including STUN and,
 * when configured, time-limited TURN credentials.
 *
 * Authorization: Bearer <Firebase ID token>
 *
 * The endpoint always returns 200. If TURN is not configured it returns
 * STUN-only. If the auth token is invalid it returns 401 (prevents
 * unauthenticated use of the TURN relay).
 */

import { Router } from 'express';
import { adminAuth, isAdminConfigured } from '../lib/firebaseAdmin';
import { buildIceConfig } from '../lib/turnCredentials';

const router = Router();

router.get('/ice-config', async (req, res) => {
  // --- Authenticate -------------------------------------------------------
  // When Firebase Admin is available we verify the caller's ID token so
  // only authenticated app users can obtain TURN credentials.
  const authHeader = req.headers.authorization ?? '';
  let uid = 'anonymous';

  if (isAdminConfigured && adminAuth) {
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      uid = decoded.uid;
    } catch {
      res.status(401).json({ error: 'Invalid or expired auth token' });
      return;
    }
  }

  // --- Build and return ICE config ----------------------------------------
  const payload = buildIceConfig(uid);
  res.json(payload);
});

export default router;

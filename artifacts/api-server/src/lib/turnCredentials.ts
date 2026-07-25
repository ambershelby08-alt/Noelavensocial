/**
 * Short-lived TURN credential generator (coturn REST API format).
 *
 * Algorithm:
 *   username  = "${expiresAt}:${userId}"
 *   credential = base64(HMAC-SHA1(TURN_SECRET, username))
 *
 * Compatible with coturn, Xirsys, Metered, and any server implementing
 * the Traversal Using Relays around NAT (TURN) REST API.
 *
 * Environment variables:
 *   TURN_URLS    – comma-separated TURN server URLs
 *                  e.g. "turn:myserver:3478,turn:myserver:3478?transport=tcp,turns:myserver:5349"
 *   TURN_SECRET  – shared secret configured on the TURN server
 *   TURN_TTL     – credential lifetime in seconds (default: 86400 = 24 h)
 */

import crypto from 'node:crypto';

export interface TurnCredentials {
  username: string;
  credential: string;
  expiresAt: number;
}

export interface IceServerEntry {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceConfigPayload {
  iceServers: IceServerEntry[];
  expiresAt: number;
}

export const STUN_SERVERS: IceServerEntry[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export function isTurnConfigured(): boolean {
  return !!(process.env.TURN_URLS && process.env.TURN_SECRET);
}

/**
 * Generate a time-limited TURN username + credential for the given user.
 * Throws if TURN_URLS or TURN_SECRET are not set.
 */
export function generateTurnCredentials(userId: string): TurnCredentials {
  const secret = process.env.TURN_SECRET;
  if (!secret) throw new Error('TURN_SECRET is not configured');

  const ttl       = parseInt(process.env.TURN_TTL ?? '86400', 10);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const username  = `${expiresAt}:${userId}`;
  const credential = crypto
    .createHmac('sha1', secret)
    .update(username)
    .digest('base64');

  return { username, credential, expiresAt };
}

/**
 * Build the full ICE server list for the given user.
 * Always includes Google STUN; adds TURN if configured.
 */
export function buildIceConfig(userId: string): IceConfigPayload {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // STUN-only TTL: 1 h
  const iceServers: IceServerEntry[] = [...STUN_SERVERS];

  if (isTurnConfigured()) {
    try {
      const creds    = generateTurnCredentials(userId);
      const turnUrls = process.env.TURN_URLS!.split(',').map(u => u.trim()).filter(Boolean);
      iceServers.push({ urls: turnUrls, username: creds.username, credential: creds.credential });
      return { iceServers, expiresAt: creds.expiresAt };
    } catch (err) {
      console.error('[TURN] credential generation failed — falling back to STUN:', err);
    }
  }

  return { iceServers, expiresAt };
}

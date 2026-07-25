/**
 * ICE / TURN credential builder.
 *
 * Supports two modes — detected automatically from environment variables:
 *
 * ── Static credentials (Metered, Twilio, Xirsys, etc.) ───────────────────────
 *   TURN_URLS       comma-separated list of STUN/TURN URLs from your provider
 *                   e.g. "stun:stun.metered.ca:80,turn:standard.relay.metered.ca:80,
 *                         turn:standard.relay.metered.ca:80?transport=tcp,
 *                         turn:standard.relay.metered.ca:443,
 *                         turn:standard.relay.metered.ca:443?transport=tcp,
 *                         turns:standard.relay.metered.ca:443?transport=tcp"
 *   TURN_USERNAME   static username from your provider dashboard
 *   TURN_CREDENTIAL static credential (password) from your provider dashboard
 *
 * ── HMAC short-lived credentials (coturn REST API) ───────────────────────────
 *   TURN_URLS       comma-separated TURN URLs
 *   TURN_SECRET     shared secret configured on the TURN server
 *   TURN_TTL        credential lifetime in seconds (default 86400)
 *
 * Static mode takes priority when both TURN_USERNAME and TURN_CREDENTIAL are set.
 * Google STUN is always included as a fallback.
 */

import crypto from 'node:crypto';

export interface IceServerEntry {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceConfigPayload {
  iceServers: IceServerEntry[];
  expiresAt: number;
}

/** Google STUN — always included as a baseline fallback. */
export const STUN_SERVERS: IceServerEntry[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export function isTurnConfigured(): boolean {
  if (!process.env.TURN_URLS) return false;
  // Static mode
  if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) return true;
  // HMAC mode
  if (process.env.TURN_SECRET) return true;
  return false;
}

// ── HMAC helper (coturn REST API format) ──────────────────────────────────────

interface HmacCreds { username: string; credential: string; expiresAt: number; }

function generateHmacCredentials(userId: string): HmacCreds {
  const secret = process.env.TURN_SECRET!;
  const ttl       = parseInt(process.env.TURN_TTL ?? '86400', 10);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const username  = `${expiresAt}:${userId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential, expiresAt };
}

// ── Public builder ─────────────────────────────────────────────────────────────

/**
 * Build the full ICE server list for the given user.
 * Always includes Google STUN; adds provider STUN + TURN when configured.
 */
export function buildIceConfig(userId: string): IceConfigPayload {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // default 1 h for STUN-only

  if (!process.env.TURN_URLS) {
    return { iceServers: [...STUN_SERVERS], expiresAt };
  }

  const allUrls  = process.env.TURN_URLS.split(',').map(u => u.trim()).filter(Boolean);
  const stunUrls = allUrls.filter(u => u.startsWith('stun:'));
  const turnUrls = allUrls.filter(u => u.startsWith('turn:') || u.startsWith('turns:'));

  // Start with Google STUN
  const iceServers: IceServerEntry[] = [...STUN_SERVERS];

  // Add provider STUN servers (no credentials needed)
  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  }

  if (turnUrls.length === 0) {
    return { iceServers, expiresAt };
  }

  // ── Static credentials mode (Metered / Twilio / Xirsys) ──────────────────
  const staticUser = process.env.TURN_USERNAME;
  const staticCred = process.env.TURN_CREDENTIAL;

  if (staticUser && staticCred) {
    iceServers.push({ urls: turnUrls, username: staticUser, credential: staticCred });
    // Static creds don't expire on our side; return a generous TTL for cache purposes
    return { iceServers, expiresAt: Math.floor(Date.now() / 1000) + 86400 };
  }

  // ── HMAC short-lived credentials mode (coturn REST API) ──────────────────
  if (process.env.TURN_SECRET) {
    try {
      const creds = generateHmacCredentials(userId);
      iceServers.push({ urls: turnUrls, username: creds.username, credential: creds.credential });
      return { iceServers, expiresAt: creds.expiresAt };
    } catch (err) {
      console.error('[TURN] HMAC credential generation failed — falling back to STUN:', err);
    }
  }

  return { iceServers, expiresAt };
}

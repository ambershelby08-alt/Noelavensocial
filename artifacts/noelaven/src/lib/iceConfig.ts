/**
 * Client-side ICE config fetcher.
 *
 * Calls GET /api/ice-config with the current user's Firebase ID token.
 * The response is cached until the credentials are about to expire.
 * Falls back to STUN-only on any error.
 */

import { getAuth } from 'firebase/auth';

export interface IceServerEntry {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceConfigResponse {
  iceServers: IceServerEntry[];
  expiresAt: number;
}

export const STUN_ONLY: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

let cache: { config: RTCConfiguration; expiresAt: number } | null = null;

/**
 * Fetch (or return cached) ICE server configuration.
 * Always resolves — returns STUN-only on any network/auth error.
 */
export async function getIceConfig(): Promise<RTCConfiguration> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached config with 2-minute buffer so we never use near-expired creds
  if (cache && cache.expiresAt > now + 120) {
    return cache.config;
  }

  try {
    const auth  = getAuth();
    const token = await auth.currentUser?.getIdToken().catch(() => undefined);

    const res = await fetch('/api/ice-config', { // proxy: /api → api-server, route: /ice-config
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000), // don't block call setup
    });

    if (!res.ok) return STUN_ONLY;

    const data: IceConfigResponse = await res.json();
    const rtcConfig: RTCConfiguration = {
      iceServers: data.iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    cache = { config: rtcConfig, expiresAt: data.expiresAt };
    return rtcConfig;
  } catch {
    // Network failure, timeout, or no user — continue with STUN
    return STUN_ONLY;
  }
}

/** Call on sign-out so the next user always gets fresh credentials. */
export function clearIceConfigCache(): void {
  cache = null;
}

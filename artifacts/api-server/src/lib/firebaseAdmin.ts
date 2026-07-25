/**
 * Firebase Admin SDK initialisation — api-server
 *
 * Initialises once from the FIREBASE_SERVICE_ACCOUNT_JSON environment variable.
 * All other modules import `adminDb`, `adminMessaging`, and `isAdminConfigured`.
 *
 * FIREBASE_SERVICE_ACCOUNT_JSON should contain the full JSON of a Firebase
 * service account private key, downloaded from:
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { logger } from './logger';

function createAdminApp(): App | null {
  // Return existing app if already initialised
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const json = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
  if (!json) {
    logger.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(json) as object;
    return initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
  } catch (err) {
    logger.error({ err }, '[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON');
    return null;
  }
}

const adminApp = createAdminApp();

export const isAdminConfigured = Boolean(adminApp);

export const adminDb: Firestore | null = adminApp
  ? getFirestore(adminApp)
  : null;

export const adminMessaging: Messaging | null = adminApp
  ? getMessaging(adminApp)
  : null;

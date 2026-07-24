/**
 * Founder authorization — single source of truth for the Founder UID.
 *
 * Authorization is stored by Firebase Auth UID, not by display name,
 * @handle, or any editable profile field.  The UID is hardcoded here
 * AND in firestore.rules so that no client-side code can bypass it.
 */

export const FOUNDER_UID = 'OJzzcq17QLRreaEINhQ2czxhtQ23';

/** True only for the exact Firebase Auth UID of the Founder account. */
export function isFounderUid(uid: string | null | undefined): boolean {
  return uid === FOUNDER_UID;
}

/**
 * Initialize the Founder's role document and user-doc role fields in
 * Firestore.  Safe to call multiple times — uses merge so existing data
 * is preserved.  Only runs in production (Firebase configured) mode.
 */
export async function ensureFounderRole(): Promise<void> {
  const { db, isFirebaseConfigured } = await import('./firebase');
  if (!isFirebaseConfigured || !db) return;

  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

  // Protected roles document — readable only by Founder/admins per Security Rules
  await setDoc(
    doc(db, 'roles', 'founder'),
    { uid: FOUNDER_UID, setAt: serverTimestamp() },
    { merge: true }
  );

  // User document role fields — not editable via normal profile updates per Security Rules
  await setDoc(
    doc(db, 'users', FOUNDER_UID),
    {
      role:        'founder',
      isFounder:   true,
      isAdmin:     true,
      isModerator: true,
    },
    { merge: true }
  );

  // admins collection entry — checked by checkIsAdmin in safety.ts
  await setDoc(
    doc(db, 'admins', FOUNDER_UID),
    { uid: FOUNDER_UID, role: 'founder', grantedAt: serverTimestamp() },
    { merge: true }
  );
}

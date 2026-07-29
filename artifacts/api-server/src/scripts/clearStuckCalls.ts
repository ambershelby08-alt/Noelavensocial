/**
 * One-shot cleanup: expire every stuck 'ringing' call document to 'missed'.
 * Run with: npx tsx src/scripts/clearStuckCalls.ts
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT_JSON not set'); process.exit(1); }

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]) });
}

const db = getFirestore();

async function main() {
  const snap = await db.collection('calls').where('status', '==', 'ringing').get();

  if (snap.empty) {
    console.log('✅ No stuck ringing calls — database is clean.');
    return;
  }

  console.log(`Found ${snap.size} stuck ringing call(s). Expiring to "missed"...`);

  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { status: 'missed' }));
  await batch.commit();

  console.log('✅ Done. Expired call IDs:');
  snap.docs.forEach(d => console.log(' •', d.id, '— caller:', d.data().callerId, '→ callee:', d.data().calleeId));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

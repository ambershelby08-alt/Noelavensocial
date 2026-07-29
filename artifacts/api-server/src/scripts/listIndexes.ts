import * as crypto from 'crypto';

const PROJECT_ID = 'noelaven-511ad';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(svc: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: svc.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));
  const sig = base64url(crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), crypto.createPrivateKey(svc.private_key)));
  const jwt = `${header}.${payload}.${sig}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function main() {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!) as Record<string, string>;
  const token = await getAccessToken(svc);

  // Try listing all indexes
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/-/indexes`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json() as { indexes?: { name: string; fields: { fieldPath: string; order?: string; arrayConfig?: string }[]; state: string }[]; error?: unknown };
  
  if (data.error) {
    console.log('LIST ERROR:', JSON.stringify(data.error, null, 2));
    return;
  }

  const indexes = data.indexes ?? [];
  console.log(`Found ${indexes.length} indexes:`);
  for (const idx of indexes) {
    const coll = idx.name.split('/collectionGroups/')[1]?.split('/')[0];
    const fields = idx.fields.map(f => `${f.fieldPath}:${f.arrayConfig ?? f.order}`).join(', ');
    console.log(`  [${idx.state}] ${coll} — ${fields}`);
  }

  // Specifically check for the conversations index
  const convIdx = indexes.find(idx => {
    const coll = idx.name.split('/collectionGroups/')[1]?.split('/')[0];
    if (coll !== 'conversations') return false;
    const clean = idx.fields.filter(f => f.fieldPath !== '__name__');
    return clean.length === 2 &&
      clean[0].fieldPath === 'participantIds' && clean[0].arrayConfig === 'CONTAINS' &&
      clean[1].fieldPath === 'lastMessageAt' && clean[1].order === 'DESCENDING';
  });
  console.log('\nConversations (participantIds CONTAINS, lastMessageAt DESC):', convIdx ? `EXISTS — ${convIdx.state}` : 'MISSING');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

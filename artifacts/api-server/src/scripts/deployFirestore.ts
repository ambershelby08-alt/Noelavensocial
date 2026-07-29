/**
 * Deploy Firestore security rules + composite indexes.
 * Run with: node --require ... (see esbuild step in package.json or shell)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const PROJECT_ID = 'noelaven-511ad';
const WORKSPACE = process.env.WORKSPACE_ROOT ?? path.resolve('/home/runner/workspace');
const RULES_PATH = path.join(WORKSPACE, 'firestore.rules');
const INDEXES_PATH = path.join(WORKSPACE, 'artifacts/noelaven/firestore.indexes.json');

// ── JWT / OAuth ──────────────────────────────────────────────────────────────

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
  const sigInput = `${header}.${payload}`;
  const key = crypto.createPrivateKey(svc.private_key);
  const sig = base64url(crypto.sign('RSA-SHA256', Buffer.from(sigInput), key));
  const jwt = `${sigInput}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Rules deployment ─────────────────────────────────────────────────────────

async function deployRules(token: string) {
  console.log('\n📋 Deploying Firestore security rules...');
  const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');

  // Create a new ruleset
  const createRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }),
    }
  );
  const ruleset = await createRes.json() as { name?: string; error?: unknown };
  if (!ruleset.name) throw new Error(`Ruleset creation failed: ${JSON.stringify(ruleset)}`);
  console.log('  Ruleset created:', ruleset.name);

  // Point the release at the new ruleset
  const patchRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ release: { name: `projects/${PROJECT_ID}/releases/cloud.firestore`, rulesetName: ruleset.name } }),
    }
  );
  const release = await patchRes.json() as { name?: string; error?: unknown };
  if (!release.name) throw new Error(`Release patch failed: ${JSON.stringify(release)}`);
  console.log('✅ Rules deployed:', release.name);
}

// ── Index deployment ─────────────────────────────────────────────────────────

interface IndexField { fieldPath: string; order?: string; arrayConfig?: string; }
interface IndexDef { collectionGroup: string; queryScope: string; fields: IndexField[]; }

async function listExistingIndexes(token: string): Promise<{ name: string; fields: IndexField[]; collectionGroup: string; state: string }[]> {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/-/indexes`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json() as { indexes?: { name: string; fields: IndexField[]; queryScope: string; state: string }[] };
  return (data.indexes ?? []).map(idx => ({
    name: idx.name,
    state: idx.state,
    collectionGroup: idx.name.split('/collectionGroups/')[1]?.split('/')[0] ?? '',
    fields: idx.fields ?? [],
  }));
}

function indexesMatch(a: IndexField[], b: IndexField[]): boolean {
  // Ignore the __name__ sentinel field Firebase auto-appends
  const clean = (f: IndexField[]) => f.filter(x => x.fieldPath !== '__name__');
  const ca = clean(a);
  const cb = clean(b);
  if (ca.length !== cb.length) return false;
  return ca.every((af, i) => {
    const bf = cb[i];
    return af.fieldPath === bf.fieldPath &&
      (af.order ?? '') === (bf.order ?? '') &&
      (af.arrayConfig ?? '') === (bf.arrayConfig ?? '');
  });
}

async function deployIndexes(token: string) {
  console.log('\n📑 Deploying Firestore composite indexes...');
  const { indexes } = JSON.parse(fs.readFileSync(INDEXES_PATH, 'utf8')) as { indexes: IndexDef[] };
  const existing = await listExistingIndexes(token);

  let created = 0;
  let skipped = 0;

  for (const idx of indexes) {
    const already = existing.find(e =>
      e.collectionGroup === idx.collectionGroup &&
      indexesMatch(e.fields, idx.fields)
    );
    if (already) {
      console.log(`  ⏭  ${idx.collectionGroup} [${idx.fields.map(f => f.fieldPath).join(', ')}] — already exists (${already.state})`);
      skipped++;
      continue;
    }

    // Build field specs
    const fields = idx.fields.map(f => {
      const spec: Record<string, unknown> = { fieldPath: f.fieldPath };
      if (f.arrayConfig) spec.arrayConfig = f.arrayConfig;
      else if (f.order) spec.order = f.order;
      return spec;
    });

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${idx.collectionGroup}/indexes`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryScope: idx.queryScope, fields }),
      }
    );
    const result = await res.json() as { name?: string; error?: { message?: string; status?: string } };
    if (result.error) {
      // ALREADY_EXISTS is fine — our existence check might miss some formats
      if (result.error.status === 'ALREADY_EXISTS') {
        console.log(`  ⏭  ${idx.collectionGroup} [${idx.fields.map(f => f.fieldPath).join(', ')}] — already exists (server)`);
        skipped++;
      } else {
        console.error(`  ❌ ${idx.collectionGroup} — ${result.error.message}`);
      }
    } else {
      console.log(`  ✅ ${idx.collectionGroup} [${idx.fields.map(f => f.fieldPath).join(', ')}] — created: ${result.name}`);
      created++;
    }
  }

  console.log(`\nIndexes: ${created} created, ${skipped} already existed`);
  if (created > 0) console.log('⏳ New indexes build in the background — ready in ~1–2 min');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not set');
  const svc = JSON.parse(raw) as Record<string, string>;

  const token = await getAccessToken(svc);
  await deployRules(token);
  await deployIndexes(token);
  console.log('\n🎉 Done');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

/**
 * Multi-account session store.
 *
 * Firebase Auth only supports one signed-in user per auth instance, so we
 * persist account *metadata* (never credentials) in localStorage.  Switching
 * accounts signs out the current Firebase user and pre-fills the Login screen
 * with the target account's email so the user only has to enter their
 * password.
 */

export interface SavedAccount {
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
}

const ACCOUNTS_KEY    = 'nlv_saved_accounts';
const SWITCH_EMAIL_KEY = 'nlv_switch_email';

// ─── Saved accounts list ──────────────────────────────────────────────────────

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

export function upsertSavedAccount(account: SavedAccount): void {
  try {
    const accounts = getSavedAccounts();
    const idx = accounts.findIndex(a => a.uid === account.uid);
    if (idx >= 0) accounts[idx] = account;
    else accounts.push(account);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch { /* ignore storage errors */ }
}

export function removeSavedAccount(uid: string): void {
  try {
    const accounts = getSavedAccounts().filter(a => a.uid !== uid);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch { /* ignore */ }
}

// ─── Switch-account email pre-fill ───────────────────────────────────────────

/** Called before signing out to pre-fill the Login screen with the target email. */
export function setPendingSwitchEmail(email: string): void {
  try { localStorage.setItem(SWITCH_EMAIL_KEY, email); } catch { /* ignore */ }
}

export function getPendingSwitchEmail(): string | null {
  try { return localStorage.getItem(SWITCH_EMAIL_KEY); } catch { return null; }
}

export function clearPendingSwitchEmail(): void {
  try { localStorage.removeItem(SWITCH_EMAIL_KEY); } catch { /* ignore */ }
}

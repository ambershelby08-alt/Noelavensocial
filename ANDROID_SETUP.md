# Noelaven — Google Play Store Setup Guide

This guide walks you through getting Noelaven onto the Google Play Store using the Android project that has been set up in `artifacts/noelaven/android/`.

---

## How it works

The Android app uses **Capacitor** in remote-URL mode. The WebView loads `https://noelaven.com` directly — so users always see the live web app, and you don't need to rebuild the Android app every time you update the website.

The signed `.aab` (Android App Bundle) is built automatically by **GitHub Actions** whenever you trigger a release workflow.

---

## Prerequisites

- [ ] A **Google Play Developer account** — register at https://play.google.com/console ($25 one-time fee)
- [ ] Your repo pushed to **GitHub**
- [ ] **GitHub Actions enabled** for the repo (free for public repos; included in GitHub plans for private repos)

---

## Step 1 — Add GitHub Secrets

Your release keystore credentials are stored locally in `.local/android-signing-credentials.md` (never committed to git). You need to add them as GitHub Secrets so the Actions workflow can sign the build.

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each of the following:

| Secret Name | Where to find the value |
|-------------|------------------------|
| `KEYSTORE_B64` | Run `base64 -w 0 artifacts/noelaven/android/app/noelaven-release.keystore` in the Replit shell |
| `KEYSTORE_PASSWORD` | See `.local/android-signing-credentials.md` |
| `KEY_ALIAS` | `noelaven-key` |
| `KEY_PASSWORD` | See `.local/android-signing-credentials.md` |

---

## Step 2 — Build the signed AAB

1. On GitHub, go to **Actions** → **Android Release Build**
2. Click **Run workflow**
3. Enter:
   - **Version code**: `1` (increment by 1 for every release, e.g. 2, 3, 4…)
   - **Version name**: `1.0.0` (human-readable, e.g. `1.1.0`, `2.0.0`)
4. Click **Run workflow** and wait ~5–10 minutes
5. When it finishes, click the workflow run → scroll to **Artifacts** → download `noelaven-1.0.0-(1).aab`

---

## Step 3 — Create the app in Google Play Console

1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - **App name**: Noelaven
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: your choice
4. Accept the declarations and click **Create app**

---

## Step 4 — Set up Internal Testing track

1. In the left sidebar → **Testing** → **Internal testing**
2. Click **Create new release**
3. Under **App bundles**, click **Upload** and select the `.aab` you downloaded
4. Add release notes (e.g. "Initial internal test build")
5. Click **Save** → **Review release** → **Start rollout to Internal testing**

---

## Step 5 — Fill in the Store Listing

Before promoting beyond internal testing, complete these required sections:

### App content (required)
- **Privacy policy URL** — you must provide one (create a simple page at `noelaven.com/privacy`)
- **App access** — if login is required, provide test account credentials
- **Ads** — declare whether the app contains ads
- **Content rating** — complete the questionnaire
- **Target audience** — select appropriate age group

### Main store listing (required)
- **Short description** — max 80 characters
- **Full description** — max 4000 characters
- **App icon** — 512×512 PNG (a 512px version of the logo is saved at `/tmp/play-store-icon-512.png` — download it from the Replit shell: `cp /tmp/play-store-icon-512.png .` then download via Files panel)
- **Feature graphic** — 1024×500 PNG (create a banner image for the store listing)
- **Screenshots** — at least 2 phone screenshots (take them from your app at noelaven.com)

---

## Step 6 — Promote to Production

Once internal testers confirm everything works:
1. Go to **Production** track → **Create new release**
2. **Promote** the internal testing release, or upload a new AAB with an incremented version code
3. Submit for review (typically 1–3 days for new apps)

---

## Releasing Updates

Every time you want to push an update:
1. Trigger the GitHub Actions workflow with an **incremented version code** (must always go up: 1, 2, 3…)
2. Download the new `.aab`
3. Upload it to the Play Console under the appropriate track

---

## ⚠️ Keystore Backup — Critical

The release keystore is at `artifacts/noelaven/android/app/noelaven-release.keystore` and is **gitignored**. If you lose it, you cannot publish updates under the same Play Store listing.

**Back it up immediately:**
```bash
# In the Replit shell — copy output and save to a password manager or encrypted storage
base64 -w 0 artifacts/noelaven/android/app/noelaven-release.keystore
```

Certificate fingerprints (for your records):
- **SHA-1**: `1A:E8:5C:0D:3A:DD:58:05:AF:9C:A9:78:27:C9:68:B4:63:24:1A:C7`
- **SHA-256**: `F2:84:4B:79:52:DC:85:55:05:F6:F4:B5:8F:D4:DD:05:11:BC:84:8F:C4:A1:C8:26:5A:3D:04:1B:FE:60:3F:DF`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails with "keystore not found" | The KEYSTORE_B64 secret is wrong or empty — re-run `base64 -w 0 ...` and update the secret |
| Build fails with "wrong password" | Double-check KEYSTORE_PASSWORD and KEY_PASSWORD match `.local/android-signing-credentials.md` |
| App shows blank screen on device | Make sure `https://noelaven.com` is publicly accessible and the device has internet |
| App rejected for "WebView only" | Add a Privacy Policy URL to the store listing; some reviewers flag thin-wrapper apps — be ready to describe the unique value |
| Play Console rejects AAB | Ensure version code is higher than the last uploaded build |

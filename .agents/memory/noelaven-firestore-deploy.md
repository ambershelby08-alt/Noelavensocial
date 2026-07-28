---
name: Noelaven Firestore rules deployment
description: How to deploy firestore.rules without firebase CLI
---

## Rule
There is no `.firebaserc` and firebase CLI is not installed. Deploy via the Firebase Security Rules REST API.

**Project ID:** `noelaven-511ad` (from `FIREBASE_SERVICE_ACCOUNT_JSON`)

## How to apply
Use a Node.js script that:
1. Reads `FIREBASE_SERVICE_ACCOUNT_JSON` env var
2. Mints a JWT + exchanges for an OAuth2 access token via `https://oauth2.googleapis.com/token`
3. POST `https://firebaserules.googleapis.com/v1/projects/noelaven-511ad/rulesets` with the rules file content
4. PATCH `https://firebaserules.googleapis.com/v1/projects/noelaven-511ad/releases/cloud.firestore` with the new ruleset name

Rules file location: `/home/runner/workspace/firestore.rules`
Firebase project config: `firebase.json`

## Missing rule added
The `replies` subcollection (nested under `posts/{postId}/comments/{commentId}/replies/{replyId}`) was missing and was added in the same session as the deployment.

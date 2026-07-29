import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// ── Global Firestore / async error diagnostics ─────────────────────────────────
// Vite's runtime-error-plugin overlay appears for ANY unhandled Promise rejection.
// By listening here we:
//   1. Log a structured trace so the exact failing operation is identifiable
//      even when Firebase strips the original stack (it creates synthetic Errors).
//   2. Prevent the raw overlay for FirebaseErrors — we surface friendly UI
//      errors in the relevant component instead (see Chat.tsx / useMessages.ts).
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const err = event.reason as { name?: string; code?: string; message?: string; stack?: string } | null;
  if (!err) return;

  const isFirestore =
    err.name === 'FirebaseError' ||
    (typeof err.code === 'string' && err.code.startsWith('firestore/'));

  // Always log with full context so developers can identify the source.
  console.error('[unhandled-rejection]', {
    name:    err.name,
    code:    err.code,
    message: err.message,
    // stack is often empty for Firestore errors — that is expected because Firebase
    // creates errors asynchronously on the server side and strips the local trace.
    stack:   err.stack || '(empty — typical for Firestore permission errors)',
  });

  if (isFirestore) {
    // Prevent Vite's overlay from appearing for Firestore errors.
    // The component that initiated the operation is responsible for showing a
    // friendly error to the user (see subscriptionError in useMessages).
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);

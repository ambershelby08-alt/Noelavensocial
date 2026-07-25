import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const PLACEHOLDER_KEYS = ['placeholder', '000000000000', '1:000000000000:web:placeholder'];

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    !PLACEHOLDER_KEYS.some(p => firebaseConfig.apiKey?.startsWith(p)) &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'placeholder' &&
    firebaseConfig.appId &&
    !PLACEHOLDER_KEYS.includes(firebaseConfig.appId),
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  // Messaging is only available in browsers that support service workers
  isSupported().then(supported => {
    if (supported && app) messaging = getMessaging(app);
  }).catch(() => {});
}

export { app, auth, db, storage, messaging };
export { firebaseConfig };

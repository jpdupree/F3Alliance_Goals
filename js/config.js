// ── Your Firebase project ─────────────────────────────────────────────────
//
// Paste the config object from:
//   Firebase console → Project settings → Your apps → Web app → SDK setup
//
// These values are not secrets — they identify your project to Google, and
// every web Firebase app ships them in the page. What actually keeps the crew's
// data private is firestore.rules plus the authorized-domains list in
// Authentication → Settings. See README.md.

export const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY',
  authDomain: 'PASTE_YOUR_PROJECT.firebaseapp.com',
  projectId: 'PASTE_YOUR_PROJECT_ID',
  storageBucket: 'PASTE_YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'PASTE_YOUR_SENDER_ID',
  appId: 'PASTE_YOUR_APP_ID',
};

// Bump this if you want a newer Firebase JS SDK. Any 10.x/11.x/12.x modular
// release works — the API surface this app uses hasn't changed across them.
export const FIREBASE_VERSION = '11.6.0';

export function isConfigured() {
  return !String(firebaseConfig.apiKey || '').startsWith('PASTE_') &&
         !String(firebaseConfig.projectId || '').startsWith('PASTE_');
}

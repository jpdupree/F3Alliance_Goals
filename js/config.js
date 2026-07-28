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
  apiKey: 'AIzaSyCyoW_PwdUR-_gN5rzD-8VtpIYLppF9Hco',
  authDomain: 'f3alliancegoals.firebaseapp.com',
  projectId: 'f3alliancegoals',
  storageBucket: 'f3alliancegoals.firebasestorage.app',
  messagingSenderId: '825910867508',
  appId: '1:825910867508:web:02c2979158e41adb877c61',
};

// The console also hands out a measurementId for Google Analytics. This app
// doesn't load Analytics, so it's left out on purpose — add it back along with
// getAnalytics() in js/data.js if you ever want the traffic numbers.

// Bump this if you want a newer Firebase JS SDK. Any 10.x/11.x/12.x modular
// release works — the API surface this app uses hasn't changed across them.
// js/data.js falls back to other known-good releases if this one won't load.
export const FIREBASE_VERSION = '11.6.0';

export function isConfigured() {
  return !String(firebaseConfig.apiKey || '').startsWith('PASTE_') &&
         !String(firebaseConfig.projectId || '').startsWith('PASTE_');
}

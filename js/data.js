// Firebase wiring: Google auth + the crew's shared Firestore documents.
//
// Data shape
//   crews/{crewId}                     { name, createdBy, createdAt }
//   crews/{crewId}/members/{uid}       { uid, f3Name, displayName, photoURL,
//                                        shapeKey, joinedAt }
//   crews/{crewId}/goals/{goalId}      { uid, title, target, createdAt,
//                                        achieved, achievedAt, order }
//
// Ownership is the uid field on each doc, and firestore.rules is what actually
// enforces it — this module just keeps the UI honest.

import { firebaseConfig, FIREBASE_VERSION as V } from './config.js';

// Try the pinned SDK first, then known-good releases. The app only uses long
// stable APIs, so any of these work — this just means a version that has been
// pulled from the CDN degrades to "loads a different build" instead of a dead
// white page.
const VERSIONS = [...new Set([V, '11.6.0', '12.3.0', '10.14.1'])];

async function loadSdk() {
  let lastErr;
  for (const v of VERSIONS) {
    const base = `https://www.gstatic.com/firebasejs/${v}`;
    try {
      return await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`),
      ]);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `Couldn't load the Firebase SDK from Google's CDN (tried ${VERSIONS.join(', ')}). ` +
    `Check the connection, or set FIREBASE_VERSION in js/config.js. ${lastErr?.message || ''}`,
  );
}

const [appMod, authMod, dbMod] = await loadSdk();

const app = appMod.initializeApp(firebaseConfig);
const auth = authMod.getAuth(app);
const db = dbMod.getFirestore(app);

const {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut: fbSignOut, onAuthStateChanged, setPersistence, browserLocalPersistence,
} = authMod;

const {
  collection, doc, addDoc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch,
} = dbMod;

await setPersistence(auth, browserLocalPersistence).catch(() => {});
getRedirectResult(auth).catch(() => {});

// ── auth ──────────────────────────────────────────────────────────────────
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

function installedAsApp() {
  return matchMedia('(display-mode: standalone)').matches ||
         matchMedia('(display-mode: minimal-ui)').matches ||
         navigator.standalone === true;
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // Installed to a home screen, a popup opens the system browser in a separate
  // context that can't hand the result back. Redirect keeps it in the app.
  if (installedAsApp()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // Blockers and embedded webviews — fall back to the redirect flow.
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment',
         'auth/cancelled-popup-request'].includes(err?.code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (err?.code === 'auth/popup-closed-by-user') return;
    throw err;
  }
}

export function signOut() {
  return fbSignOut(auth);
}

export function currentUser() {
  return auth.currentUser;
}

// ── crew ──────────────────────────────────────────────────────────────────
export async function createCrew(name) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const ref = await addDoc(collection(db, 'crews'), {
    name: name.trim().slice(0, 40),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCrew(crewId) {
  const snap = await getDoc(doc(db, 'crews', crewId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function joinCrew(crewId, { f3Name, shapeKey, customShape }) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  return setDoc(
    doc(db, 'crews', crewId, 'members', user.uid),
    {
      uid: user.uid,
      f3Name: f3Name.trim().slice(0, 28),
      shapeKey,
      customShape: customShape || null,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      joinedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Just your own member doc. The rules let you read this before you've joined
 * (it's keyed by your uid) whereas the full member list is members-only, so
 * this is what decides between "show the F3 name form" and "go to the fire".
 */
export async function getMyMembership(crewId) {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'crews', crewId, 'members', user.uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function watchMembers(crewId, cb) {
  return onSnapshot(
    query(collection(db, 'crews', crewId, 'members'), orderBy('joinedAt', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => cb(null, err),
  );
}

// ── goals ─────────────────────────────────────────────────────────────────
/** Save (or clear, with null) this member's hand-drawn constellation. */
export function saveConstellation(crewId, customShape) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  return updateDoc(doc(db, 'crews', crewId, 'members', user.uid), {
    customShape: customShape || null,
  });
}

export function watchGoals(crewId, cb) {
  return onSnapshot(
    query(collection(db, 'crews', crewId, 'goals'), orderBy('order', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => cb(null, err),
  );
}

export function addGoal(crewId, { title, target, order }) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  return addDoc(collection(db, 'crews', crewId, 'goals'), {
    uid: user.uid,
    title: title.trim().slice(0, 80),
    target: (target || '').trim().slice(0, 24),
    order,
    achieved: false,
    achievedAt: null,
    createdAt: serverTimestamp(),
  });
}

export function setGoalAchieved(crewId, goalId, achieved) {
  return updateDoc(doc(db, 'crews', crewId, 'goals', goalId), {
    achieved,
    achievedAt: achieved ? serverTimestamp() : null,
  });
}

export function removeGoal(crewId, goalId) {
  return deleteDoc(doc(db, 'crews', crewId, 'goals', goalId));
}

// ── crew owner tools ──────────────────────────────────────────────────────
// Only the guy who lit the fire can use these, and firestore.rules is what
// enforces that. Note this removes a man from *this crew* — it does not touch
// his Google account or his Firebase Auth record, which can only be deleted
// with the Admin SDK or from the Firebase console.

/** Delete a batch of goals by id. Chunked to stay under the 500-write limit. */
export async function removeGoals(crewId, goalIds) {
  for (let i = 0; i < goalIds.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of goalIds.slice(i, i + 400)) {
      batch.delete(doc(db, 'crews', crewId, 'goals', id));
    }
    await batch.commit();
  }
}

/** Take a man's seat back: his goals go first, then his membership. */
export async function removeMember(crewId, uid, goalIds = []) {
  if (goalIds.length) await removeGoals(crewId, goalIds);
  await deleteDoc(doc(db, 'crews', crewId, 'members', uid));
}

// Demo mode: a fake crew, mid-season, entirely in memory.
//
// Same module surface as data.js, so app.js can swap this in and everything
// downstream — the sky, the dock, the member card, Manage crew — behaves as it
// does for real. Nothing here touches Firebase and nothing is saved: reload and
// it's back to this same starting point.
//
// Reached with #demo in the URL.

import { constellationFor, STARS_PER_CONSTELLATION as N } from './constellations.js';

const CREW_ID = 'demo';
const ME = 'demo-me';

// A crew about half way through the season. A couple of guys are dead on five,
// one has finished, one has barely started — enough spread to see what a real
// night sky looks like rather than a tidy row of identical shapes.
const ROSTER = [
  ['demo-me',  'Crawdad',    12, 5],
  ['demo-2',   'Bulldozer',   9, 5],
  ['demo-3',   'Sherpa',     10, 6],
  ['demo-4',   'Slingshot',   7, 4],
  ['demo-5',   'Timber',     11, 5],
  ['demo-6',   'Anchorman',  10, 10],
  ['demo-7',   'Mudbug',      8, 5],
  ['demo-8',   'Gump',        6, 2],
  ['demo-9',   'Half-Track',  9, 7],
  ['demo-10',  'Waffle House', 5, 1],
];

const GOALS = [
  'Run 100 miles in a month',      'Sub-25 5k',
  'Post 3x a week for a month',    'Murph under 55',
  'Ruck a half marathon',          '50 pull-ups unbroken',
  'Lead a Q at every AO',          'Bring a FNG',
  'Read a book a month',           'No booze for 30 days',
  'Deadlift 2x bodyweight',        'Sunrise summit',
  'Ten straight days of stretching', 'Swim a mile',
];

// Fixed base so the fake timeline is stable across reloads within a session.
const T0 = 1_700_000_000_000;
const stamp = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

const members = new Map();
const goals = new Map();
let seq = 0;

ROSTER.forEach(([uid, f3Name, total, done], mi) => {
  members.set(uid, {
    uid,
    f3Name,
    shapeKey: constellationFor(f3Name).key,
    customShape: null,
    displayName: f3Name,
    photoURL: '',
    joinedAt: stamp(T0 + mi * 86_400_000),
  });
  for (let i = 0; i < total; i++) {
    const id = `${uid}-g${i}`;
    goals.set(id, {
      id,
      uid,
      title: GOALS[(mi * 3 + i) % GOALS.length],
      target: i % 3 === 0 ? 'end of season' : '',
      order: i,
      achieved: i < done,
      // Spread the achievements out so the stars light in a believable order.
      achievedAt: i < done ? stamp(T0 + (mi * 7 + i * 5) * 3_600_000) : null,
    });
  }
});

const user = { uid: ME, displayName: 'You', photoURL: '' };
const memberCbs = [];
const goalCbs = [];

const emitMembers = () => memberCbs.forEach((f) => f([...members.values()]));
const emitGoals = () => goalCbs.forEach((f) => f([...goals.values()]));

// ── the data.js surface ───────────────────────────────────────────────────
export function watchAuth(cb) { cb(user); return () => {}; }
export async function signIn() {}
export async function signOut() { location.hash = ''; location.reload(); }
export function currentUser() { return user; }

export async function createCrew() { return CREW_ID; }
export async function getCrew() {
  return { id: CREW_ID, name: 'Demo AO', createdBy: ME };
}
export async function getMyMembership() { return members.get(ME) || null; }

export async function joinCrew(_crewId, { f3Name, shapeKey, customShape }) {
  const m = members.get(ME);
  Object.assign(m, { f3Name, shapeKey, customShape: customShape || null });
  emitMembers();
}

export function watchMembers(_crewId, cb) {
  memberCbs.push(cb);
  cb([...members.values()]);
  return () => {};
}

export function watchGoals(_crewId, cb) {
  goalCbs.push(cb);
  cb([...goals.values()]);
  return () => {};
}

export async function addGoal(_crewId, { title, target, order }) {
  const id = `demo-new-${++seq}`;
  goals.set(id, { id, uid: ME, title, target, order, achieved: false, achievedAt: null });
  emitGoals();
}

export async function setGoalAchieved(_crewId, goalId, achieved) {
  const g = goals.get(goalId);
  g.achieved = achieved;
  g.achievedAt = achieved ? stamp(Date.now()) : null;
  emitGoals();
}

export async function removeGoal(_crewId, goalId) {
  goals.delete(goalId);
  emitGoals();
}

export async function removeGoals(_crewId, ids) {
  ids.forEach((id) => goals.delete(id));
  emitGoals();
}

export async function removeMember(_crewId, uid, ids = []) {
  ids.forEach((id) => goals.delete(id));
  members.delete(uid);
  emitMembers();
  emitGoals();
}

export async function saveConstellation(_crewId, customShape) {
  members.get(ME).customShape = customShape || null;
  emitMembers();
}

export const IS_DEMO = true;
export const DEMO_CREW_ID = CREW_ID;

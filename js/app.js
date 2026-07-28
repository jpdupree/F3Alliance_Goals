// App wiring: gate → crew → sky. Reads Firestore, feeds the canvas, and keeps
// the "only your own stuff" rule visible in the UI (the server enforces it).

import { isConfigured } from './config.js';
import { createSky } from './sky.js';
import { constellationFor, shapeByKey, lightingOrder, STARS_PER_CONSTELLATION } from './constellations.js';
import { openDrawEditor, isValidShape } from './editor.js';

const $ = (id) => document.getElementById(id);
const els = {
  gate: $('gate'), gateTitle: $('gateTitle'), gateLede: $('gateLede'),
  gateLoading: $('gateLoading'), setupMsg: $('setupMsg'), setupCode: $('setupCode'),
  googleBtn: $('googleBtn'), crewForm: $('crewForm'), crewInput: $('crewInput'),
  rejoinBtn: $('rejoinBtn'), rejoinName: $('rejoinName'),
  nameForm: $('nameForm'), nameInput: $('nameInput'),
  previewCanvas: $('previewCanvas'), previewLabel: $('previewLabel'),
  topbar: $('topbar'), crewName: $('crewName'), crewSub: $('crewSub'),
  shareBtn: $('shareBtn'), signOutBtn: $('signOutBtn'), helpBtn: $('helpBtn'),
  dock: $('dock'), dockHandle: $('dockHandle'), dockTally: $('dockTally'),
  goalForm: $('goalForm'), goalTitle: $('goalTitle'),
  goalList: $('goalList'), goalEmpty: $('goalEmpty'),
  drawOwnBtn: $('drawOwnBtn'), mcEditShape: $('mcEditShape'),
  drawModal: $('drawModal'), drawCanvas: $('drawCanvas'), drawTitle: $('drawTitle'),
  drawCount: $('drawCount'), drawUndo: $('drawUndo'), drawRemove: $('drawRemove'),
  drawClear: $('drawClear'), drawAuto: $('drawAuto'), drawSave: $('drawSave'),
  drawClose: $('drawClose'), drawLabel: $('drawLabel'),
  adminBtn: $('adminBtn'), adminModal: $('adminModal'),
  adminClose: $('adminClose'), adminList: $('adminList'),
  installBtn: $('installBtn'), installModal: $('installModal'),
  installClose: $('installClose'), installLede: $('installLede'), installSteps: $('installSteps'),
  memberCard: $('memberCard'), memberClose: $('memberClose'),
  mcPhoto: $('mcPhoto'), mcName: $('mcName'), mcSub: $('mcSub'), mcGoals: $('mcGoals'),
  helpModal: $('helpModal'), helpClose: $('helpClose'),
  demoBar: $('demoBar'),
  toast: $('toast'),
};

const LS_CREW = 'f3campfire:lastCrew';

const state = {
  user: null,
  crewId: null,
  crew: null,
  members: [],
  goals: [],
  me: null,
  bootstrapped: false,      // first goals snapshot seen?
  achievedSeen: new Set(),  // goal ids already burned, so we don't re-fire embers
  pending: new Map(),       // uid → Set(starIndex) mid-flight, kept dark until arrival
  celebrated: new Set(),
  pendingShape: null,       // drawn on the F3-name step, saved when he joins
};

let sky = null;
let dockObserver = null;
let unsubMembers = null;
let unsubGoals = null;
let db = null;             // ./data.js module, imported lazily after config check

// ── gate helpers ───────────────────────────────────────────────────────────
function showStep(step) {
  document.querySelectorAll('.gate-step').forEach((el) => {
    el.hidden = el.dataset.step !== step;
  });
  els.gateLoading.hidden = true;
  els.gate.hidden = false;
}

function showLoading() {
  document.querySelectorAll('.gate-step').forEach((el) => { el.hidden = true; });
  els.gateLoading.hidden = false;
  els.gate.hidden = false;
}

function hideGate() {
  els.gate.hidden = true;
}

function fail(message, code) {
  els.setupMsg.textContent = message;
  els.setupCode.hidden = !code;
  if (code) els.setupCode.textContent = code;
  showStep('setup');
}

let toastTimer = 0;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => { els.toast.hidden = true; }, 350);
  }, 3800);
}

// ── routing ────────────────────────────────────────────────────────────────
function crewIdFromHash() {
  const m = location.hash.match(/^#c\/([A-Za-z0-9_-]{4,})$/);
  return m ? m[1] : null;
}

/** #demo loads a fake mid-season crew from js/demo.js instead of Firebase. */
function isDemo() {
  return location.hash === '#demo';
}

function crewLink(crewId) {
  if (isDemo()) return `${location.origin}${location.pathname}#demo`;
  return `${location.origin}${location.pathname}#c/${crewId}`;
}

// ── constellation preview on the name step ─────────────────────────────────
function drawPreview(f3Name) {
  const cv = els.previewCanvas;
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 320;
  const h = cv.clientHeight || 200;
  cv.width = w * dpr; cv.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const c = state.pendingShape || constellationFor(f3Name);
  els.previewLabel.textContent = state.pendingShape
    ? ((state.pendingShape.label || '').trim() || 'your own mark')
    : (f3Name.trim() ? c.label : '—');

  const size = Math.min(w, h) * 0.82;
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;
  const pts = c.stars.map(([x, y]) => ({ x: ox + x * size, y: oy + y * size }));

  ctx.strokeStyle = 'rgba(255,196,120,0.42)';
  ctx.lineWidth = 1;
  for (const [a, b] of c.edges) {
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  }
  for (const p of pts) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
    g.addColorStop(0, 'rgba(255,240,205,0.95)');
    g.addColorStop(0.3, 'rgba(255,190,110,0.45)');
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,250,0.95)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * The shape a member is drawn with: his own drawing if he made one, otherwise
 * the one his F3 name picked. Guards against a malformed stored shape so one
 * bad document can't blank out the sky.
 */
function shapeFor(member) {
  const custom = member?.customShape;
  if (isValidShape(custom)) {
    return {
      stars: custom.stars,
      edges: custom.edges,
      label: (custom.label || '').trim() || 'his own mark',
      custom: true,
    };
  }
  const key = member?.shapeKey || constellationFor(member?.f3Name || '').key;
  const s = shapeByKey(key);
  return { stars: s.stars, edges: s.edges, label: s.label, custom: false, key };
}

// ── derive sky state from members + goals ──────────────────────────────────
function goalsByMember() {
  const map = new Map();
  for (const m of state.members) map.set(m.uid, []);
  for (const g of state.goals) {
    if (!map.has(g.uid)) map.set(g.uid, []);
    map.get(g.uid).push(g);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return map;
}

/**
 * A man's achieved goals in the order he actually knocked them down, since
 * that's the order the stars light in. Goals still waiting on the server for
 * their achievedAt sort last, which is where they belong anyway.
 */
function achievedInOrder(goals) {
  return goals
    .filter((g) => g.achieved)
    .sort((a, b) => {
      const ta = a.achievedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const tb = b.achievedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      return ta - tb || (a.order || 0) - (b.order || 0);
    });
}

/**
 * One goal, one star: the Nth goal a man finishes lights the Nth star along
 * the shape's own lines, so the creature builds up connected rather than as
 * scattered points. Past ten his constellation is already full — extra goals
 * still feed the fire, they just have nowhere left to land.
 */
function starForNthAchieved(shape, n) {
  if (n >= STARS_PER_CONSTELLATION) return -1;
  const order = lightingOrder(shape);
  return order[n] ?? -1;
}

/** Star indices a member has earned, minus any ember still in flight. */
function litFor(uid, goals, shape) {
  const lit = new Set();
  const flying = state.pending.get(uid);
  achievedInOrder(goals).forEach((g, i) => {
    const star = starForNthAchieved(shape, i);
    if (star < 0 || flying?.has(star)) return;
    lit.add(star);
  });
  return lit;
}

function refreshSky() {
  if (!sky) return;
  const byMember = goalsByMember();
  let openLogs = 0;
  let achieved = 0;

  const rows = state.members.map((m) => {
    const goals = byMember.get(m.uid) || [];
    const shape = shapeFor(m);
    const shapeKey = shape.key || m.shapeKey || '';
    const starCount = shape.stars.length;
    const done = goals.filter((g) => g.achieved).length;
    openLogs += goals.length - done;
    achieved += done;
    const lit = litFor(m.uid, goals, shape);
    return {
      uid: m.uid,
      f3Name: m.f3Name || m.displayName || 'Pax',
      photoURL: m.photoURL || '',
      shapeKey,
      customShape: shape.custom ? { stars: shape.stars, edges: shape.edges, label: shape.label } : null,
      starCount,
      litStars: lit,
      complete: lit.size >= starCount,
      goalsTotal: goals.length,
      goalsAchieved: done,
      shapeLabel: shape.label,
      isMe: m.uid === state.user?.uid,
    };
  });

  sky.setState(rows, { openLogs, achieved });

  // The fire tracks every achievement; the sky only has ten slots per man.
  const starsLit = rows.reduce((n, r) => n + r.litStars.size, 0);
  els.crewSub.textContent =
    `${state.members.length} pax · ${openLogs} log${openLogs === 1 ? '' : 's'} burning · ${starsLit} star${starsLit === 1 ? '' : 's'} lit`;

  for (const row of rows) {
    if (row.complete && !state.celebrated.has(row.uid)) {
      state.celebrated.add(row.uid);
      if (state.bootstrapped) {
        toast(`${row.f3Name} finished the season — ${row.shapeLabel} is fully lit.`);
      }
    } else if (!row.complete) {
      state.celebrated.delete(row.uid);
    }
  }
}

/** Compare against what we've already seen and fly embers for anything new. */
function fireNewEmbers() {
  const byMember = goalsByMember();
  const nextSeen = new Set();
  const launches = [];

  for (const m of state.members) {
    const goals = byMember.get(m.uid) || [];
    const shape = shapeFor(m);
    achievedInOrder(goals).forEach((g, i) => {
      nextSeen.add(g.id);
      if (!state.bootstrapped || state.achievedSeen.has(g.id)) return;
      const star = starForNthAchieved(shape, i);
      launches.push({
        uid: m.uid, f3Name: m.f3Name, goal: g,
        stars: star < 0 ? [] : [star],   // past ten there's no star left to light
      });
    });
  }

  state.achievedSeen = nextSeen;

  for (const l of launches) {
    if (!state.pending.has(l.uid)) state.pending.set(l.uid, new Set());
    const flying = state.pending.get(l.uid);

    l.stars.forEach((s, k) => {
      // Hold the star dark only once an ember is actually on its way to it.
      flying.add(s);
      const away = sky.launchEmber(l.uid, s, {
        delay: k * 0.28,
        onArrive: () => {
          flying.delete(s);
          if (!flying.size) state.pending.delete(l.uid);
          refreshSky();
        },
      });
      if (!away) flying.delete(s);
    });
    if (!flying.size) state.pending.delete(l.uid);

    if (l.uid === state.user?.uid) sky.focusMember(l.uid);   // watch your own land
    else toast(`${l.f3Name} hit it: ${l.goal.title}`);
  }

  if (launches.length) refreshSky();
}

// ── dock ───────────────────────────────────────────────────────────────────
/** Keep the fire clear of the dock, which grows and shrinks with the list. */
function syncDockInset() {
  if (!sky) return;
  const visible = els.dock.classList.contains('collapsed')
    ? 46
    : els.dock.getBoundingClientRect().height;
  sky.setInsets(visible);
}

function setDockCollapsed(collapsed) {
  els.dock.classList.toggle('collapsed', collapsed);
  syncDockInset();
}

// ── goal list rendering ────────────────────────────────────────────────────
function renderMyGoals() {
  const mine = state.goals
    .filter((g) => g.uid === state.user?.uid)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  els.goalList.innerHTML = '';
  els.goalEmpty.hidden = mine.length > 0;

  const lit = Math.min(mine.filter((g) => g.achieved).length, STARS_PER_CONSTELLATION);
  els.dockTally.textContent = mine.length ? `${lit} / ${STARS_PER_CONSTELLATION} ★` : '';
  els.dockTally.classList.toggle('full', lit >= STARS_PER_CONSTELLATION);

  for (const g of mine) {
    const li = document.createElement('li');
    li.className = 'goal' + (g.achieved ? ' done' : '');

    const btn = document.createElement('button');
    btn.className = 'check';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(!!g.achieved));
    btn.title = g.achieved ? 'Put it back on the pile' : 'Mark it hit';
    btn.textContent = g.achieved ? '★' : '';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await db.setGoalAchieved(state.crewId, g.id, !g.achieved);
      } catch (err) {
        toast(errText(err));
      } finally {
        btn.disabled = false;
      }
    });

    const body = document.createElement('div');
    body.className = 'goal-body';
    const title = document.createElement('div');
    title.className = 'goal-title';
    title.textContent = g.title;
    body.appendChild(title);

    const del = document.createElement('button');
    del.className = 'trash';
    del.type = 'button';
    del.title = 'Pull this log off the fire';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      if (!confirm(`Remove “${g.title}”?`)) return;
      try {
        await db.removeGoal(state.crewId, g.id);
      } catch (err) {
        toast(errText(err));
      }
    });

    li.append(btn, body, del);
    els.goalList.appendChild(li);
  }
}

function showMemberCard(uid) {
  const m = state.members.find((x) => x.uid === uid);
  if (!m) return;
  const goals = state.goals
    .filter((g) => g.uid === uid)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const done = goals.filter((g) => g.achieved).length;
  const shape = shapeFor(m);

  els.mcName.textContent = m.f3Name || m.displayName || 'Pax';
  const lit = Math.min(done, STARS_PER_CONSTELLATION);
  els.mcSub.textContent = goals.length
    ? `${lit} of ${STARS_PER_CONSTELLATION} stars · ${shape.label}`
    : `no logs yet · ${shape.label}`;
  if (m.photoURL) {
    els.mcPhoto.src = m.photoURL;
    els.mcPhoto.hidden = false;
  } else {
    els.mcPhoto.hidden = true;
  }

  els.mcGoals.innerHTML = '';
  if (!goals.length) {
    const li = document.createElement('li');
    li.className = 'mc-empty';
    li.textContent = 'Hasn’t thrown a log on yet.';
    els.mcGoals.appendChild(li);
  }
  for (const g of goals) {
    const li = document.createElement('li');
    li.className = g.achieved ? 'lit' : '';
    const mark = document.createElement('span');
    mark.className = 'mc-mark';
    mark.textContent = g.achieved ? '★' : '·';
    const txt = document.createElement('span');
    txt.textContent = g.title;
    li.append(mark, txt);
    els.mcGoals.appendChild(li);
  }
  els.mcEditShape.hidden = uid !== state.user?.uid;
  els.memberCard.hidden = false;
}

/**
 * Losing read access mid-session means the owner took your seat back (or the
 * crew is gone). Show that plainly instead of a raw permission error.
 */
function handleLostAccess() {
  unsubMembers?.(); unsubGoals?.();
  unsubMembers = unsubGoals = null;
  Object.assign(state, {
    crewId: null, crew: null, members: [], goals: [], me: null,
    bootstrapped: false, achievedSeen: new Set(), pending: new Map(),
    celebrated: new Set(),
  });
  localStorage.removeItem(LS_CREW);
  els.topbar.hidden = true;
  els.dock.hidden = true;
  els.memberCard.hidden = true;
  els.adminModal.hidden = true;
  els.helpModal.hidden = true;
  if (location.hash) { history.replaceState(null, '', location.pathname); }
  els.gateTitle.textContent = 'F3 Campfire';
  els.gateLede.textContent = 'You’re not at that fire anymore.';
  onSignedIn();
}

function errText(err) {
  if (err?.code === 'permission-denied') {
    return 'Firestore said no — you can only change your own goals.';
  }
  return err?.message || 'Something went wrong.';
}

// ── listeners ──────────────────────────────────────────────────────────────
function startCrewListeners() {
  unsubGoals?.();
  unsubGoals = db.watchGoals(state.crewId, (goals, err) => {
    if (err) {
      // Denied *after* we were reading fine means the seat was taken back;
      // denied on the very first read means the rules aren't deployed.
      if (err.code === 'permission-denied' && state.bootstrapped) {
        handleLostAccess();
      } else {
        fail(
          err.code === 'permission-denied'
            ? 'Firestore turned down the read. Deploy firestore.rules from this repo, then reload.'
            : `Couldn’t load goals: ${err.message}`,
        );
      }
      return;
    }
    state.goals = goals;
    renderMyGoals();
    fireNewEmbers();
    refreshSky();
    renderAdmin();
    if (!state.bootstrapped) {
      state.bootstrapped = true;
      state.achievedSeen = new Set(goals.filter((g) => g.achieved).map((g) => g.id));
      // Arriving with goals already set, the sky is the point — tuck the dock
      // away. Arriving with none, the dock is the point: leave it open.
      setDockCollapsed(goals.some((g) => g.uid === state.user?.uid));
    }
  });
}

function enterCrew() {
  hideGate();
  els.topbar.hidden = false;
  els.dock.hidden = false;
  els.crewName.textContent = state.crew?.name || 'The fire';
  if (isDemo()) {
    els.demoBar.hidden = false;
    els.signOutBtn.textContent = 'Exit demo';
    $('signOutBtn2').textContent = 'Exit demo';
  }

  if (!sky) {
    sky = createSky($('sky'));
    sky.on('select', (uid) => {
      if (uid) showMemberCard(uid);
      else els.memberCard.hidden = true;
    });
    // Swiping to a different man re-points an open card at him rather than
    // leaving it showing somebody who's now off screen.
    sky.on('focus', (uid) => {
      if (uid && !els.memberCard.hidden) showMemberCard(uid);
    });
    if (isDemo()) window.__sky = sky;   // demo only, for poking at in the console
    dockObserver = new ResizeObserver(syncDockInset);
    dockObserver.observe(els.dock);
    syncDockInset();
  }
  startCrewListeners();
  refreshSky();
}

async function attachCrew(crewId) {
  showLoading();
  state.crewId = crewId;
  let crew;
  try {
    crew = await db.getCrew(crewId);
  } catch (err) {
    fail(
      err.code === 'permission-denied'
        ? 'Firestore turned down the read. Deploy firestore.rules from this repo, then reload.'
        : `Couldn’t reach the fire: ${err.message}`,
    );
    return;
  }
  if (!crew) {
    fail('No fire at that link. Check the URL, or start a new one from the home page.');
    return;
  }
  state.crew = crew;
  localStorage.setItem(LS_CREW, JSON.stringify({ id: crewId, name: crew.name }));

  // Only members may read the roster or the goals, so settle membership first.
  let mine;
  try {
    mine = await db.getMyMembership(crewId);
  } catch (err) {
    fail(`Couldn’t check your seat at the fire: ${errText(err)}`);
    return;
  }

  if (!mine) {
    const seed = (state.user?.displayName || '').split(' ')[0] || '';
    if (!els.nameInput.value) els.nameInput.value = seed;
    drawPreview(els.nameInput.value);
    els.gateTitle.textContent = crew.name;
    els.gateLede.textContent = 'Pull up a log.';
    showStep('name');
    return;
  }

  state.me = mine;
  unsubMembers?.();
  unsubMembers = db.watchMembers(crewId, (members, err) => {
    if (err) {
      if (err.code === 'permission-denied' && state.bootstrapped) handleLostAccess();
      else fail(`Couldn’t load the crew: ${errText(err)}`);
      return;
    }
    state.members = members;
    state.me = members.find((m) => m.uid === state.user?.uid) || state.me;
    if (els.gate.hidden === false) enterCrew();
    else { renderMyGoals(); refreshSky(); renderAdmin(); }
  });
}

// ── auth flow ──────────────────────────────────────────────────────────────
function onSignedOut() {
  unsubMembers?.(); unsubGoals?.();
  unsubMembers = unsubGoals = null;
  Object.assign(state, {
    crew: null, members: [], goals: [], me: null,
    bootstrapped: false, achievedSeen: new Set(), pending: new Map(), celebrated: new Set(),
  });
  els.topbar.hidden = true;
  els.dock.hidden = true;
  els.memberCard.hidden = true;
  els.gateTitle.textContent = 'F3 Campfire';
  els.gateLede.textContent = 'Set the goal. Feed the fire. Light your constellation.';
  showStep('signin');
}

function onSignedIn() {
  const crewId = crewIdFromHash();
  if (crewId) { attachCrew(crewId); return; }

  const last = safeParse(localStorage.getItem(LS_CREW));
  if (last?.id) {
    els.rejoinBtn.hidden = false;
    els.rejoinName.textContent = last.name || 'your crew';
    els.rejoinBtn.onclick = () => { location.hash = `#c/${last.id}`; };
  } else {
    els.rejoinBtn.hidden = true;
  }
  els.gateTitle.textContent = 'F3 Campfire';
  els.gateLede.textContent = `Good to see you, ${(state.user.displayName || '').split(' ')[0] || 'pax'}.`;
  showStep('crew');
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ── events ─────────────────────────────────────────────────────────────────
els.googleBtn.addEventListener('click', async () => {
  els.googleBtn.disabled = true;
  try {
    await db.signIn();
  } catch (err) {
    fail(`Google sign-in failed: ${err.message}`);
  } finally {
    els.googleBtn.disabled = false;
  }
});

els.signOutBtn.addEventListener('click', () => db.signOut());
$('signOutBtn2').addEventListener('click', () => {
  els.helpModal.hidden = true;
  db.signOut();
});

els.crewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = els.crewInput.value.trim();
  if (!name) return;
  showLoading();
  try {
    const id = await db.createCrew(name);
    location.hash = `#c/${id}`;
  } catch (err) {
    fail(`Couldn’t start the fire: ${errText(err)}`);
  }
});

els.nameInput.addEventListener('input', () => drawPreview(els.nameInput.value));

els.nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f3Name = els.nameInput.value.trim();
  if (!f3Name) return;
  showLoading();
  try {
    await db.joinCrew(state.crewId, {
      f3Name,
      shapeKey: constellationFor(f3Name).key,
      customShape: state.pendingShape,
    });
    state.pendingShape = null;
    await attachCrew(state.crewId);   // now a member — roster and goals open up
  } catch (err) {
    fail(`Couldn’t join: ${errText(err)}`);
  }
});

els.goalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = els.goalTitle.value.trim();
  if (!title) return;
  els.goalTitle.value = '';
  try {
    await db.addGoal(state.crewId, { title, order: Date.now() });
  } catch (err) {
    toast(errText(err));
    els.goalTitle.value = title;
  }
});

// Draw one before joining: seeded with the automatic shape so nobody starts
// from a blank canvas.
els.drawOwnBtn.addEventListener('click', async () => {
  const seed = state.pendingShape || constellationFor(els.nameInput.value || 'pax');
  const result = await openDrawEditor(els, {
    stars: seed.stars,
    edges: seed.edges,
    label: state.pendingShape?.label || '',
    f3Name: els.nameInput.value.trim(),
  });
  if (result === null) return;
  state.pendingShape = result === 'auto' ? null : result;
  drawPreview(els.nameInput.value);
  toast(result === 'auto' ? 'Back to the automatic constellation.' : 'Looking good. Take your place at the fire.');
});

// Redraw it later. Only ever your own — the button is hidden on anyone else's
// card, and the rules reject a write to another man's member doc regardless.
els.mcEditShape.addEventListener('click', async () => {
  const me = state.members.find((m) => m.uid === state.user?.uid);
  if (!me) return;
  const current = shapeFor(me);
  const result = await openDrawEditor(els, {
    stars: current.stars,
    edges: current.edges,
    label: current.custom ? current.label : '',
    f3Name: me.f3Name,
  });
  if (result === null) return;
  try {
    await db.saveConstellation(state.crewId, result === 'auto' ? null : result);
    toast(result === 'auto'
      ? `Back to ${shapeByKey(constellationFor(me.f3Name).key).label}.`
      : 'Constellation saved.');
  } catch (err) {
    toast(errText(err));
  }
});

els.shareBtn.addEventListener('click', async () => {
  const url = crewLink(state.crewId);
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: state.crew?.name || 'F3 Campfire', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Link copied. Send it to the crew.');
  } catch {
    prompt('Copy this link:', url);
  }
});

els.memberClose.addEventListener('click', () => {
  els.memberCard.hidden = true;
  sky?.clearFocus();
});

els.helpBtn.addEventListener('click', () => {
  els.adminBtn.hidden = !isCrewOwner();
  els.helpModal.hidden = false;
});

els.adminBtn.addEventListener('click', () => {
  els.helpModal.hidden = true;
  els.adminModal.hidden = false;
  renderAdmin();
});
els.adminClose.addEventListener('click', () => { els.adminModal.hidden = true; });
els.adminModal.addEventListener('click', (e) => {
  if (e.target === els.adminModal) els.adminModal.hidden = true;
});
els.helpClose.addEventListener('click', () => { els.helpModal.hidden = true; });
els.helpModal.addEventListener('click', (e) => {
  if (e.target === els.helpModal) els.helpModal.hidden = true;
});

els.dockHandle.addEventListener('click', () => {
  setDockCollapsed(!els.dock.classList.contains('collapsed'));
});

window.addEventListener('hashchange', () => {
  if (!state.user) return;
  const id = crewIdFromHash();
  if (!id) { onSignedIn(); return; }
  if (id === state.crewId) return;
  // First crew of the session attaches in place; hopping to a *different* fire
  // reloads so no listener or ember state leaks across.
  if (state.crewId) location.reload();
  else attachCrew(id);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!els.adminModal.hidden) { els.adminModal.hidden = true; return; }
  if (!els.helpModal.hidden) { els.helpModal.hidden = true; return; }
  if (!els.memberCard.hidden) { els.memberCard.hidden = true; sky?.clearFocus(); }
});

// ── manage crew (owner only) ───────────────────────────────────────────────
function isCrewOwner() {
  return !!state.crew && state.crew.createdBy === state.user?.uid;
}

function goalIdsFor(uid) {
  return state.goals.filter((g) => g.uid === uid).map((g) => g.id);
}

function renderAdmin() {
  if (els.adminModal.hidden) return;
  const byMember = goalsByMember();
  els.adminList.innerHTML = '';

  for (const m of state.members) {
    const goals = byMember.get(m.uid) || [];
    const done = goals.filter((g) => g.achieved).length;
    const isMe = m.uid === state.user?.uid;

    const li = document.createElement('li');
    li.className = 'admin-row';

    if (m.photoURL) {
      const img = document.createElement('img');
      img.src = m.photoURL;
      img.alt = '';
      li.appendChild(img);
    }

    const who = document.createElement('div');
    who.className = 'admin-who';
    const name = document.createElement('div');
    name.className = 'admin-name';
    name.textContent = m.f3Name || m.displayName || 'Pax';
    if (isMe) {
      const tag = document.createElement('span');
      tag.className = 'you';
      tag.textContent = 'you';
      name.appendChild(tag);
    }
    const sub = document.createElement('div');
    sub.className = 'admin-sub';
    const joined = m.joinedAt?.toDate?.();
    sub.textContent = [
      goals.length
        ? `${Math.min(done, STARS_PER_CONSTELLATION)} of ${STARS_PER_CONSTELLATION} stars · ${goals.length} log${goals.length === 1 ? '' : 's'}`
        : 'no logs',
      shapeFor(m).label,
      joined ? `joined ${joined.toLocaleDateString()}` : null,
    ].filter(Boolean).join(' · ');
    who.append(name, sub);
    li.appendChild(who);

    const acts = document.createElement('div');
    acts.className = 'admin-acts';

    const clear = document.createElement('button');
    clear.className = 'btn ghost small';
    clear.type = 'button';
    clear.textContent = 'Clear logs';
    clear.disabled = !goals.length;
    clear.addEventListener('click', async () => {
      const label = m.f3Name || 'this pax';
      if (!confirm(`Delete all ${goals.length} of ${label}'s logs? This can't be undone.`)) return;
      acts.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        await db.removeGoals(state.crewId, goalIdsFor(m.uid));
        toast(`Cleared ${label}'s logs.`);
      } catch (err) {
        toast(errText(err));
      } finally {
        renderAdmin();
      }
    });
    acts.appendChild(clear);

    const remove = document.createElement('button');
    remove.className = 'btn danger small';
    remove.type = 'button';
    remove.textContent = isMe ? 'Leave' : 'Remove';
    remove.addEventListener('click', async () => {
      const label = m.f3Name || 'this pax';
      const msg = isMe
        ? `Leave ${state.crew?.name || 'this crew'}? Your logs and constellation go with you.`
        : `Take ${label}'s seat back? His ${goals.length} log${goals.length === 1 ? '' : 's'} and his constellation are deleted. He can rejoin with the crew link.`;
      if (!confirm(msg)) return;
      acts.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        await db.removeMember(state.crewId, m.uid, goalIdsFor(m.uid));
        if (isMe) {
          handleLostAccess();
        } else {
          toast(`${label} is out.`);
        }
      } catch (err) {
        toast(errText(err));
      } finally {
        renderAdmin();
      }
    });
    acts.appendChild(remove);

    li.appendChild(acts);
    els.adminList.appendChild(li);
  }
}

// ── install / PWA ──────────────────────────────────────────────────────────
export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches ||
         matchMedia('(display-mode: minimal-ui)').matches ||
         navigator.standalone === true;
}

function setupInstall() {
  let deferred = null;

  // Chrome/Edge/Android hand us the prompt to fire later.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    els.installBtn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    els.installBtn.hidden = true;
    toast('Installed. The fire is on your home screen.');
  });

  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const firefox = /Firefox/.test(ua);

  // Safari and Firefox never fire beforeinstallprompt, so offer instructions
  // instead of hiding the option entirely.
  if (!isStandalone() && (iOS || firefox)) els.installBtn.hidden = false;

  els.installBtn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === 'accepted') els.installBtn.hidden = true;
      return;
    }
    const steps = iOS
      ? ['Tap the Share button in Safari’s toolbar.',
         'Scroll down and tap <b>Add to Home Screen</b>.',
         'Tap <b>Add</b>. The campfire lands on your home screen.']
      : firefox
        ? ['Open the browser menu (⋮).',
           'Tap <b>Install</b> or <b>Add to Home screen</b>.',
           'Confirm, and the campfire lands on your home screen.']
        : ['Open your browser’s menu.',
           'Choose <b>Install app</b> or <b>Add to Home screen</b>.'];
    els.installLede.textContent = iOS
      ? 'Safari can add F3 Campfire to your home screen — it opens full screen, like any other app.'
      : 'Your browser can add F3 Campfire to your home screen — it opens full screen, like any other app.';
    els.installSteps.innerHTML = '';
    for (const s of steps) {
      const li = document.createElement('li');
      li.innerHTML = s;
      els.installSteps.appendChild(li);
    }
    els.installModal.hidden = false;
  });

  els.installClose.addEventListener('click', () => { els.installModal.hidden = true; });
  els.installModal.addEventListener('click', (e) => {
    if (e.target === els.installModal) els.installModal.hidden = true;
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Relative URL so the scope covers a project subpath on GitHub Pages.
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        // A previous worker was in control, so this is an update, not a
        // first install — tell the user rather than swapping under them.
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('New version ready — reopen to update.');
        }
      });
    });
  }).catch(() => { /* offline support is a bonus; never block the app */ });
}

// ── boot ───────────────────────────────────────────────────────────────────
(async function boot() {
  registerServiceWorker();
  setupInstall();

  if (isDemo()) {
    showLoading();
    db = await import('./demo.js');
    document.body.classList.add('is-demo');
    db.watchAuth((u) => {
      state.user = u;
      attachCrew(db.DEMO_CREW_ID);
    });
    return;
  }

  if (!isConfigured()) {
    fail(
      'This copy isn’t pointed at a Firebase project yet. Paste your web app config into js/config.js, deploy firestore.rules, and reload. Setup steps are in README.md.',
      "export const firebaseConfig = {\n  apiKey: '…',\n  authDomain: '….firebaseapp.com',\n  projectId: '…',\n  appId: '…',\n};",
    );
    return;
  }

  showLoading();
  try {
    db = await import('./data.js');
  } catch (err) {
    fail(`Couldn’t load Firebase: ${err.message}`);
    return;
  }

  db.watchAuth((user) => {
    state.user = user;
    if (user) onSignedIn();
    else onSignedOut();
  });
})();

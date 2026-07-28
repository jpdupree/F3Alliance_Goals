// The night sky: campfire, log pile, embers and everyone's constellations.
//
// One 2D canvas. The constellations sit on a horizontal carousel — one centred,
// its neighbours peeking in at the edges — and the starfield behind them wheels
// a few degrees as you swipe, so moving along the crew feels like turning to
// look at a different part of the sky.

import { shapeByKey, edgeOrder } from './constellations.js';

const PALETTE = [
  { h: 38,  s: 100, l: 68 },  // ember gold
  { h: 20,  s: 95,  l: 64 },  // hot orange
  { h: 196, s: 90,  l: 70 },  // ice blue
  { h: 168, s: 70,  l: 66 },  // teal
  { h: 268, s: 70,  l: 76 },  // violet
  { h: 340, s: 75,  l: 74 },  // rose
  { h: 52,  s: 95,  l: 74 },  // straw
  { h: 148, s: 60,  l: 68 },  // sage
];

const TAU = Math.PI * 2;
const reduceMotion = typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function createSky(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });

  let W = 0, H = 0, dpr = 1;
  let members = [];          // laid-out member records
  let stats = { openLogs: 0, achieved: 0 };
  let bgStars = [];
  let flames = [];
  let ambient = [];
  let travelers = [];        // achievement embers in flight
  let bursts = [];           // ignite flashes
  let selectedUid = null;
  const listeners = { select: [], focus: [] };

  // The sky is a carousel: one constellation centred, its neighbours peeking
  // in at the edges, and the starfield wheeling a little as you swipe.
  let scroll = 0;          // float position, in slots
  let scrollTarget = 0;    // integer slot we're easing toward
  let centred = 0;         // last announced centre, for the focus event
  let last = performance.now();
  let time = 0;
  let raf = 0;

  // ── sizing ────────────────────────────────────────────────────────────
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedBackground();
    layout();
  }

  function seedBackground() {
    const rnd = mulberry32(0x5eed);
    const count = Math.round((W * H) / (reduceMotion ? 4200 : 2600));
    bgStars = [];
    for (let i = 0; i < count; i++) {
      const y = Math.pow(rnd(), 1.35) * H * 0.9;
      bgStars.push({
        x: rnd() * W,
        y,
        r: 0.4 + rnd() * 1.1,
        a: 0.15 + rnd() * 0.55,
        tw: rnd() * TAU,
        sp: 0.4 + rnd() * 1.4,
      });
    }
  }

  // The dock covers the bottom of the screen, right where the fire wants to be,
  // and the top bar covers the first ~60px. The whole scene lives between them
  // and eases into its new shape when the dock opens or closes, so the sky
  // never snaps.
  const BASE_INSET = 58;
  const TOP_INSET = 64;
  let bottomInset = BASE_INSET;
  let insetTarget = BASE_INSET;

  function usableH() {
    return Math.max(H - bottomInset, 240);
  }

  function setInsets(px) {
    insetTarget = clamp(px || BASE_INSET, BASE_INSET, H * 0.55);
  }

  function easeInsets(dt) {
    if (Math.abs(insetTarget - bottomInset) < 0.4) {
      if (bottomInset !== insetTarget) { bottomInset = insetTarget; layout(); }
      return;
    }
    bottomInset = lerp(bottomInset, insetTarget, 1 - Math.exp(-dt * 7));
    layout();
  }

  /** Where the treeline stands. The fire is well in front of it. */
  function groundY() {
    return TOP_INSET + (usableH() - TOP_INSET) * 0.78;
  }

  function fireOrigin() {
    // Below the treeline, so the pile sits on the near ground rather than
    // looking like it's burning among the trees.
    return { x: W / 2, y: TOP_INSET + (usableH() - TOP_INSET) * 0.92 };
  }

  // The fire is the anchor of the scene, so its parts grow with the space it
  // has — keyed to the *usable* height, so opening the dock banks it down
  // instead of letting the flames climb into the caption.
  function fireScale() {
    return clamp(Math.min(W, usableH()) / 700, 0.7, 1.8);
  }

  // ── carousel layout ───────────────────────────────────────────────────
  function bandTop() { return TOP_INSET + 8; }
  function bandHeight() { return Math.max((usableH() - TOP_INSET) * 0.68, 140); }

  /** Vertical middle of the constellation row. */
  function slotCentreY() { return bandTop() + bandHeight() * 0.42; }

  /**
   * The caption tucks just under the constellation frame — a fixed height for
   * the viewport, so it doesn't jump about as you swipe between a tall shape
   * and a wide one, but never leaving a lake of empty sky on a phone.
   */
  function captionY() {
    return slotCentreY() + slotSize() / 2 + clamp(W * 0.02, 18, 34);
  }

  /**
   * Opening the dock squeezes the sky until there is genuinely no room for the
   * constellation, its caption and the fire all at once. Rather than shuffle
   * them into each other, the caption fades away — with the dock up you're
   * working through your logs, not reading the sky.
   */
  function captionAlpha() {
    return clamp(1 - (bottomInset - BASE_INSET) / 170, 0, 1);
  }

  /** One constellation, as large as the screen sensibly allows. */
  function slotSize() {
    return Math.min(W * 0.66, bandHeight() * 0.70);
  }

  /**
   * Gap between neighbours. Tuned so a wide screen shows the edges of the two
   * either side and a phone shows a sliver — the neighbour is a hint that
   * there's more sky, not something you're meant to read.
   */
  function slotGap() {
    return Math.max(slotSize() * 1.25, W * 0.42);
  }

  /** Shortest signed distance from slot i to the scroll position, wrapping. */
  function wrapDelta(d, n) {
    if (n <= 1) return d;
    const half = n / 2;
    let x = (d + half) % n;
    if (x < 0) x += n;
    return x - half;
  }

  // Recomputed every frame — the whole point is that it moves.
  function layout() {
    const n = members.length;
    if (!n || !W) return;

    const size = slotSize();
    const gap = slotGap();
    const cy = slotCentreY();

    members.forEach((m, i) => {
      const d = wrapDelta(i - scroll, n);
      const ad = Math.abs(d);
      // Off-centre ones sit a touch lower and smaller, as if on a dome.
      const drop = Math.min(ad, 2.2) ** 2 * size * 0.075;
      const scale = 1 - Math.min(ad, 1.6) * 0.13;
      const s = size * scale;
      const x = W / 2 + d * gap;

      m.d = d;
      m.alpha = clamp(1 - ad * 0.62, 0.1, 1);
      m.box = { x: x - s / 2, y: cy - s / 2 + drop, w: s, h: s };
      m.points = m.shape.stars.map(([sx, sy]) => ({
        x: m.box.x + sx * s,
        y: m.box.y + sy * s,
      }));
    });
  }

  // ── state in ──────────────────────────────────────────────────────────
  /**
   * @param {Array} nextMembers  [{uid, f3Name, photoURL, shapeKey, starCount,
   *                               litStars:Set<number>, complete, goalsTotal,
   *                               goalsAchieved, isMe}]
   * @param {Object} nextStats   {openLogs, achieved}
   */
  function setState(nextMembers, nextStats) {
    const prev = new Map(members.map((m) => [m.uid, m]));
    const wasAt = members.findIndex((m) => m.uid === anchorUid);
    members = nextMembers.map((m, i) => {
      // A hand-drawn shape wins over the one picked from the F3 name.
      const shape = m.customShape || shapeByKey(m.shapeKey);
      const tone = PALETTE[hashStr(m.uid + (m.shapeKey || '')) % PALETTE.length];
      const old = prev.get(m.uid);
      // Newly finished — and only for a member we'd already drawn, so a whole
      // crew doesn't sweep at once the first time the sky loads.
      const justFinished = m.complete && old && !old.complete;
      return {
        ...m,
        shape,
        tone,
        sweep: justFinished ? 0 : (old?.sweep ?? (m.complete ? 1 : undefined)),
        box: old?.box,
        points: old?.points,
        // per-star reveal progress, so a newly lit star swells in
        glow: old?.glow || new Map(),
        pulse: old?.pulse ?? 0,
        index: i,
      };
    });
    stats = { ...stats, ...nextStats };
    // Somebody joining or leaving shouldn't slide the sky out from under you:
    // if whoever was centred moved in the list, shift by the same amount.
    const n = members.length;
    const nowAt = members.findIndex((m) => m.uid === anchorUid);
    if (n && wasAt >= 0 && nowAt >= 0 && nowAt !== wasAt) {
      const delta = nowAt - wasAt;
      scroll += delta;
      scrollTarget += delta;
    }
    layout();
    if (selectedUid && !members.some((m) => m.uid === selectedUid)) selectedUid = null;
  }

  // ── moving through the sky ────────────────────────────────────────────
  let anchorUid = null;

  function centreIndex() {
    const n = members.length;
    if (!n) return 0;
    return ((Math.round(scroll) % n) + n) % n;
  }

  function step(dir) {
    if (members.length < 2) return;   // nowhere to go
    scrollTarget = Math.round(scrollTarget) + dir;
  }

  /** Bring a man's constellation to the middle by the shortest way round. */
  function focusMember(uid, instant = false) {
    const i = members.findIndex((m) => m.uid === uid);
    if (i < 0) return;
    selectedUid = uid;
    scrollTarget = Math.round(scroll) + wrapDelta(i - Math.round(scroll), members.length);
    if (instant) scroll = scrollTarget;
  }

  function clearFocus() {
    selectedUid = null;
  }

  // ── achievement ember ─────────────────────────────────────────────────
  /**
   * Send an ember from the flames up into a member's star. Returns false if
   * there's nothing to fly at yet (member not laid out) — the caller needs to
   * know, or it will hold that star dark waiting on an arrival that never comes.
   */
  function launchEmber(uid, starIndex, opts = {}) {
    const m = members.find((x) => x.uid === uid);
    if (!m || !m.points || !m.points[starIndex]) return false;
    const target = m.points[starIndex];
    const o = fireOrigin();
    const rnd = mulberry32(hashStr(uid + ':' + starIndex + ':' + Math.floor(time * 10)));

    const from = { x: o.x + (rnd() - 0.5) * 26, y: o.y - 46 - rnd() * 20 };
    const mid = {
      x: lerp(from.x, target.x, 0.5) + (rnd() - 0.5) * Math.min(W * 0.3, 220),
      y: lerp(from.y, target.y, 0.42) - Math.min(H * 0.18, 150),
    };

    travelers.push({
      uid, starIndex, from, mid, to: { x: target.x, y: target.y },
      t: 0,
      dur: reduceMotion ? 0.9 : 1.7 + rnd() * 0.5,
      delay: opts.delay || 0,
      onArrive: opts.onArrive,
      tone: m.tone,
      trail: [],
    });
    return true;
  }

  function igniteBurst(m, point) {
    bursts.push({ x: point.x, y: point.y, t: 0, dur: 0.9, tone: m.tone });
    m.pulse = 1;
  }

  // ── drawing ───────────────────────────────────────────────────────────
  function drawSkyBackdrop() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04060e');
    g.addColorStop(0.42, '#080e1d');
    g.addColorStop(0.76, '#0d1526');
    g.addColorStop(1, '#150f14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // faint milky band
    const band = ctx.createLinearGradient(0, H * 0.1, W, H * 0.5);
    band.addColorStop(0, 'rgba(90,120,190,0)');
    band.addColorStop(0.45, 'rgba(110,130,200,0.055)');
    band.addColorStop(1, 'rgba(90,120,190,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, W, H);
  }

  /** How far the sky has turned, in radians. A gentle few degrees per swipe. */
  function skyAngle() {
    return -scroll * (reduceMotion ? 0 : 0.055);
  }

  function drawBgStars() {
    // Wheel about a pole well below the horizon, so stars near the top swing
    // further than those near the ground — the way a real sky turns.
    const ang = skyAngle();
    ctx.save();
    if (ang) {
      const px = W / 2;
      const py = usableH() * 1.45;
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.translate(-px, -py);
    }
    for (const s of bgStars) {
      const tw = reduceMotion ? 1 : 0.72 + 0.28 * Math.sin(time * s.sp + s.tw);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = '#dce7ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGround() {
    const y = groundY();
    const g = ctx.createLinearGradient(0, y - 40, 0, H);
    g.addColorStop(0, 'rgba(8,7,10,0.0)');
    g.addColorStop(0.5, 'rgba(8,7,10,0.85)');
    g.addColorStop(1, '#050408');
    ctx.fillStyle = g;
    ctx.fillRect(-W, y - 40, W * 3, H - y + 60);

    // Treeline silhouette, seeded so it doesn't crawl between frames. Pines
    // get drawn as stacked tiers with uneven heights and gaps, otherwise the
    // horizon reads as a sawtooth.
    const rnd = mulberry32(0xf3f3);
    ctx.fillStyle = '#04050a';
    const step = Math.max(W * 0.022, 16);
    for (let x = -W * 0.1; x < W * 1.1; x += step * (0.55 + rnd() * 0.9)) {
      const h = (0.055 + Math.pow(rnd(), 1.6) * 0.14) * (usableH() - TOP_INSET);
      const w = h * (0.30 + rnd() * 0.16);
      const base = y + h * 0.06;
      ctx.beginPath();
      ctx.moveTo(x - w, base);
      // three tiers up to the tip
      for (let t = 0; t < 3; t++) {
        const f = t / 3;
        const nf = (t + 1) / 3;
        ctx.lineTo(x - w * (1 - f) * 0.8, base - h * f - h * 0.06);
        ctx.lineTo(x - w * (1 - nf), base - h * nf);
      }
      ctx.lineTo(x, base - h * 1.06);
      for (let t = 2; t >= 0; t--) {
        const f = t / 3;
        const nf = (t + 1) / 3;
        ctx.lineTo(x + w * (1 - nf), base - h * nf);
        ctx.lineTo(x + w * (1 - f) * 0.8, base - h * f - h * 0.06);
      }
      ctx.lineTo(x + w, base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(-W, y, W * 3, H - y + 40);
  }

  // How many logs the pile can actually show. Past this the fire would be a
  // wall of timber, so the overflow is stated in words instead.
  const LOG_CAP = 24;

  /**
   * The pile's shape for the number of logs currently on it. Wider as the crew
   * piles more on, which the flames and the glow then follow — so the fire's
   * *width* tracks what's outstanding while its *brightness* tracks what the
   * crew has knocked down over the season. Two different things, two signals.
   */
  function pileMetrics() {
    const shown = Math.min(stats.openLogs, LOG_CAP);
    const perTier = clamp(Math.round(Math.sqrt(Math.max(shown, 1) * 1.7)), 3, 7);
    const fs = fireScale();
    return {
      shown,
      perTier,
      width: (40 + perTier * 13) * fs,
      fs,
    };
  }

  function fireIntensity() {
    // Asymptotic: the fire always burns, and every achievement adds less than
    // the one before — but the crew's season total keeps pushing it up.
    return 0.45 + 0.55 * (1 - Math.exp(-stats.achieved / 14));
  }

  function drawGlow() {
    const o = fireOrigin();
    const k = fireIntensity();
    const flick = reduceMotion ? 1 : 0.94 + 0.06 * Math.sin(time * 7.3) + 0.03 * Math.sin(time * 13.1);
    const r = (Math.min(W, usableH()) * (0.26 + 0.22 * k) + pileMetrics().width * 1.6) * flick;

    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(o.x, o.y - 30, 0, o.x, o.y - 30, r);
    g.addColorStop(0, `rgba(255,196,110,${0.30 * k})`);
    g.addColorStop(0.25, `rgba(255,140,50,${0.16 * k})`);
    g.addColorStop(0.6, `rgba(210,80,30,${0.06 * k})`);
    g.addColorStop(1, 'rgba(120,40,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y - 30, r, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawLogs() {
    const o = fireOrigin();
    const { shown, perTier, width, fs } = pileMetrics();
    for (let i = 0; i < shown; i++) {
      const r2 = mulberry32(1000 + i * 7919);
      const tier = Math.floor(i / perTier);
      const inTier = i % perTier;
      const inRow = Math.min(perTier, shown - tier * perTier);
      const tierW = width * (1 - tier * 0.12);
      const step = tierW / Math.max(inRow, 1);
      const x = o.x + (inTier - (inRow - 1) / 2) * step + (r2() - 0.5) * 8 * fs;
      const y = o.y - tier * 10 * fs - 2;
      const len = tierW * (0.80 + r2() * 0.24);
      const thick = (11.5 - perTier * 0.6) * fs;
      const ang = (tier % 2 === 0 ? 1 : -1) * (0.16 + r2() * 0.46)
                  + (inTier - (inRow - 1) / 2) * 0.05;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      // body
      ctx.fillStyle = '#241812';
      roundRect(ctx, -len / 2, -thick / 2, len, thick, thick / 2);
      ctx.fill();
      // rim light from the flames
      const lg = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
      lg.addColorStop(0, 'rgba(255,150,60,0.30)');
      lg.addColorStop(0.55, 'rgba(255,90,30,0.06)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      roundRect(ctx, -len / 2, -thick / 2, len, thick, thick / 2);
      ctx.fill();
      // glowing end grain
      ctx.fillStyle = `rgba(255,${120 + Math.round(60 * Math.sin(time * 3 + i))},60,0.55)`;
      ctx.beginPath();
      ctx.ellipse(-len / 2 + 2 * fs, 0, 2.6 * fs, thick / 2.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (stats.openLogs > shown) {
      ctx.fillStyle = 'rgba(255,205,150,0.5)';
      ctx.font = `600 ${Math.round(12 * fs)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`+${stats.openLogs - shown} more on the pile`, o.x, o.y + 42 * fs);
      ctx.textAlign = 'left';
    }
  }

  function spawnFlames(dt) {
    const k = fireIntensity();
    const rate = (reduceMotion ? 30 : 105) * k;
    let n = rate * dt;
    while (n > 0) {
      if (n < 1 && Math.random() > n) break;
      n -= 1;
      const o = fireOrigin();
      const { width, fs } = pileMetrics();
      const spread = width * 0.95 + 16 * k * fs;
      flames.push({
        x: o.x + (Math.random() - 0.5) * spread,
        y: o.y - (6 + Math.random() * 12) * fs,
        vx: (Math.random() - 0.5) * 26 * fs,
        vy: -(80 + Math.random() * 100) * (0.7 + 0.6 * k) * fs,
        life: 0,
        ttl: 0.5 + Math.random() * 0.65,
        r: (11 + Math.random() * 17 * k) * fs,
        sway: Math.random() * TAU,
      });
    }
    if (flames.length > 500) flames.splice(0, flames.length - 500);
  }

  function drawFlames(dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = flames.length - 1; i >= 0; i--) {
      const p = flames[i];
      p.life += dt;
      if (p.life >= p.ttl) { flames.splice(i, 1); continue; }
      const t = p.life / p.ttl;
      p.x += (p.vx + Math.sin(time * 4 + p.sway) * 16) * dt;
      p.y += p.vy * dt;
      p.vy *= 1 - 0.7 * dt;

      const r = p.r * (1 - t * 0.75);
      const a = (1 - t) * 0.5;
      // hot core → orange → smoke
      const hue = lerp(52, 8, Math.pow(t, 0.7));
      const light = lerp(72, 40, t);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(r, 0.1));
      g.addColorStop(0, `hsla(${hue},100%,${light}%,${a})`);
      g.addColorStop(0.5, `hsla(${hue - 6},100%,${light - 12}%,${a * 0.45})`);
      g.addColorStop(1, 'hsla(10,100%,30%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(r, 0.1), 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function spawnAmbient(dt) {
    const k = fireIntensity();
    if (Math.random() < dt * (reduceMotion ? 3 : 11) * k) {
      const o = fireOrigin();
      const { width, fs } = pileMetrics();
      ambient.push({
        x: o.x + (Math.random() - 0.5) * width * 1.1,
        y: o.y - (20 + Math.random() * 30) * fs,
        vy: -(28 + Math.random() * 46) * fs,
        sway: Math.random() * TAU,
        amp: (8 + Math.random() * 22) * fs,
        life: 0,
        ttl: 2.4 + Math.random() * 3.4,
        r: 0.8 + Math.random() * 1.7,
      });
    }
  }

  function drawAmbient(dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = ambient.length - 1; i >= 0; i--) {
      const p = ambient[i];
      p.life += dt;
      if (p.life >= p.ttl) { ambient.splice(i, 1); continue; }
      const t = p.life / p.ttl;
      p.y += p.vy * dt;
      p.vy *= 1 - 0.25 * dt;
      const x = p.x + Math.sin(time * 1.6 + p.sway) * p.amp * t;
      const a = (1 - t) * 0.75 * (t < 0.1 ? t / 0.1 : 1);
      ctx.fillStyle = `hsla(${lerp(46, 16, t)},100%,${lerp(72, 52, t)}%,${a})`;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTravelers(dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = travelers.length - 1; i >= 0; i--) {
      const e = travelers[i];
      if (e.delay > 0) { e.delay -= dt; continue; }
      e.t += dt / e.dur;

      if (e.t >= 1) {
        const m = members.find((x) => x.uid === e.uid);
        if (m && m.points?.[e.starIndex]) {
          igniteBurst(m, m.points[e.starIndex]);
          m.glow.set(e.starIndex, 0.0001);   // swell up from dark, don't snap
        }
        travelers.splice(i, 1);
        e.onArrive?.();
        continue;
      }

      // Re-read the target each frame: the constellation may be sliding past
      // while the ember is still on its way up.
      const tgt = members.find((x2) => x2.uid === e.uid)?.points?.[e.starIndex];
      if (tgt) { e.to.x = tgt.x; e.to.y = tgt.y; }

      const t = easeOut(e.t);
      const x = quad(e.from.x, e.mid.x, e.to.x, t);
      const y = quad(e.from.y, e.mid.y, e.to.y, t);

      e.trail.unshift({ x, y });
      if (e.trail.length > 22) e.trail.pop();

      for (let j = e.trail.length - 1; j >= 0; j--) {
        const p = e.trail[j];
        const f = 1 - j / e.trail.length;
        const r = lerp(0.6, 3.4, f) * (1 + 0.6 * (1 - e.t));
        const hue = lerp(30, e.tone.h, e.t * 0.85);
        ctx.fillStyle = `hsla(${hue},100%,${lerp(58, 78, f)}%,${0.55 * f})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      }

      const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
      g.addColorStop(0, 'rgba(255,255,235,0.95)');
      g.addColorStop(0.3, `hsla(${lerp(30, e.tone.h, e.t)},100%,70%,0.55)`);
      g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBursts(dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.t += dt / b.dur;
      if (b.t >= 1) { bursts.splice(i, 1); continue; }
      const t = easeOut(b.t);
      const r = lerp(2, 26, t);
      // Kept faint — a whole crew can land embers at once, and heavy rings
      // turn that into a field of bubbles.
      ctx.strokeStyle = `hsla(${b.tone.h},100%,82%,${Math.pow(1 - b.t, 2) * 0.42})`;
      ctx.lineWidth = lerp(2, 0.3, t);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, TAU);
      ctx.stroke();

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 0.9);
      g.addColorStop(0, `hsla(${b.tone.h},100%,88%,${Math.pow(1 - b.t, 2) * 0.55})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.9, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawConstellations(dt) {
    for (const m of members) {
      if (!m.points) continue;
      const dim = m.alpha ?? 1;
      const isCentre = Math.abs(m.d ?? 0) < 0.5;
      const tone = m.tone;
      const col = (a, l = tone.l) => `hsla(${tone.h},${tone.s}%,${l}%,${a * dim})`;

      // ease each lit star's glow toward 1
      for (let i = 0; i < m.points.length; i++) {
        const lit = m.litStars.has(i);
        const cur = m.glow.get(i) ?? (lit ? 1 : 0);
        const target = lit ? 1 : 0;
        const next = reduceMotion ? target : lerp(cur, target, 1 - Math.exp(-dt * 4));
        m.glow.set(i, next);
      }

      if (m.pulse > 0) m.pulse = Math.max(0, m.pulse - dt * 0.8);

      // completed creature gets a soft nebula behind it
      if (m.complete) {
        const cx = m.box.x + m.box.w / 2;
        const cy = m.box.y + m.box.h / 2;
        const breathe = reduceMotion ? 1 : 0.9 + 0.1 * Math.sin(time * 1.1 + m.index);
        const r = m.box.w * 0.85 * breathe;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, col(0.16, tone.l + 6));
        g.addColorStop(0.55, col(0.06));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      // Edges, only where both ends are lit. Nothing hints at the rest of the
      // figure — the shape is a surprise until the stars that make it arrive.
      if (m.sweep !== undefined && m.sweep < 1) {
        m.sweep = Math.min(1, m.sweep + dt / 1.5);
      }
      const eo = edgeOrder(m.shape);
      const sweeping = m.sweep !== undefined && m.sweep < 1;

      m.shape.edges.forEach(([a, b], k) => {
        const pa = m.points[a], pb = m.points[b];
        if (!pa || !pb) return;
        const strength = Math.min(m.glow.get(a) ?? 0, m.glow.get(b) ?? 0);
        if (strength <= 0.02) return;

        // On completion a light runs along the figure in the order it was
        // built, so the last goal reads as the thing resolving.
        const wave = sweeping ? Math.exp(-(((m.sweep - (eo[k] ?? 0)) * 5.5) ** 2)) : 0;

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = col(
          0.14 + 0.44 * strength + m.pulse * 0.25 + wave * 0.45,
          tone.l + wave * 16,
        );
        ctx.lineWidth = 0.7 + 1.0 * strength + wave * 1.8;
        ctx.stroke();
      });

      // stars
      for (let i = 0; i < m.points.length; i++) {
        const p = m.points[i];
        const g = m.glow.get(i) ?? 0;
        if (g < 0.02) {
          ctx.fillStyle = `rgba(210,222,248,${0.20 * dim})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5, 0, TAU);
          ctx.fill();
          continue;
        }
        const tw = reduceMotion ? 1 : 0.9 + 0.1 * Math.sin(time * 2.4 + i * 1.7 + m.index);
        const r = (1.5 + 1.1 * g) * tw * (1 + m.pulse * 0.3);

        // Halo stays tight — a wide bloom turns a twelve-star creature into a
        // smear at the sizes these get drawn at.
        ctx.globalCompositeOperation = 'lighter';
        const halo = r * 3.4;
        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo);
        rg.addColorStop(0, col(0.75 * g, Math.min(96, tone.l + 22)));
        rg.addColorStop(0.3, col(0.26 * g));
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, halo, 0, TAU);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,250,${0.95 * g * dim})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.7, 0, TAU);
        ctx.fill();

        // sparkle cross
        const sp = r * 2.6 * g;
        ctx.strokeStyle = col(0.24 * g, tone.l + 14);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x - sp, p.y); ctx.lineTo(p.x + sp, p.y);
        ctx.moveTo(p.x, p.y - sp); ctx.lineTo(p.x, p.y + sp);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }

      // Only the centred one is captioned; the neighbours stay quiet.
      if (!isCentre) continue;
      const ca = captionAlpha();
      if (ca <= 0.02) continue;
      const litCount = m.litStars.size;
      const fs = clamp(W * 0.028, 16, 27);
      const y = captionY();

      ctx.textAlign = 'center';
      ctx.font = `700 ${fs}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = m.complete ? col(0.98 * ca, tone.l + 16) : `rgba(232,239,252,${0.94 * dim * ca})`;
      ctx.fillText(m.f3Name, W / 2, y);

      ctx.font = `500 ${fs * 0.6}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = m.complete ? col(0.8 * ca, tone.l + 8) : `rgba(180,194,222,${0.78 * dim * ca})`;
      ctx.fillText(
        m.complete ? `${m.shape.label} — fully lit`
                   : `${litCount} of ${m.points.length} · ${m.shape.label}`,
        W / 2, y + fs * 0.92,
      );
    }
    ctx.textAlign = 'left';
  }

  /** Which one of how many, and which way to swipe. */
  function drawCarouselChrome() {
    const n = members.length;
    const ca = captionAlpha();
    if (n < 2 || ca <= 0.02) return;
    const i = centreIndex();
    const fs = clamp(W * 0.028, 16, 27);
    const y = captionY() + fs * 1.6;

    if (n <= 14) {
      const gap = 13;
      const x0 = W / 2 - ((n - 1) * gap) / 2;
      for (let k = 0; k < n; k++) {
        const on = k === i;
        ctx.fillStyle = on ? `rgba(255,190,120,${0.95 * ca})` : `rgba(190,205,235,${0.26 * ca})`;
        ctx.beginPath();
        ctx.arc(x0 + k * gap, y, on ? 3.2 : 2.1, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.textAlign = 'center';
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = `rgba(190,205,235,${0.5 * ca})`;
      ctx.fillText(`${i + 1} of ${n}`, W / 2, y + 4);
      ctx.textAlign = 'left';
    }

    // Faint chevrons so it's obvious there's more either side.
    const cy = slotCentreY();
    const inset = Math.min(22, W * 0.045);
    ctx.strokeStyle = `rgba(200,214,240,${0.22 * ca})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      const x = dir < 0 ? inset : W - inset;
      ctx.beginPath();
      ctx.moveTo(x + dir * 5, cy - 9);
      ctx.lineTo(x - dir * 4, cy);
      ctx.lineTo(x + dir * 5, cy + 9);
      ctx.stroke();
    }
  }

  // ── loop ──────────────────────────────────────────────────────────────
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    time += dt;
    easeInsets(dt);

    // Ease toward the target slot unless a finger is on it.
    if (!dragging) {
      scroll = lerp(scroll, scrollTarget, 1 - Math.exp(-dt * 8));
      if (Math.abs(scrollTarget - scroll) < 0.001) scroll = scrollTarget;
    }
    layout();

    const i = centreIndex();
    if (members.length && i !== centred) {
      centred = i;
      anchorUid = members[i]?.uid || null;
      listeners.focus.forEach((fn) => fn(anchorUid));
    }
    if (!anchorUid && members.length) anchorUid = members[i]?.uid || null;

    drawSkyBackdrop();
    drawBgStars();
    drawConstellations(dt);
    drawCarouselChrome();
    drawGlow();
    drawGround();
    drawLogs();
    spawnFlames(dt);
    drawFlames(dt);
    spawnAmbient(dt);
    drawAmbient(dt);
    drawTravelers(dt);
    drawBursts(dt);

    raf = requestAnimationFrame(frame);
  }

  // ── interaction ───────────────────────────────────────────────────────
  function hitTest(px, py) {
    let best = null, bestD = Infinity;
    for (const m of members) {
      if (!m.box || Math.abs(m.d ?? 9) > 1.2) continue;
      const pad = m.box.w * 0.16;
      const inside = px >= m.box.x - pad && px <= m.box.x + m.box.w + pad &&
                     py >= m.box.y - pad && py <= m.box.y + m.box.h + pad * 2.2;
      if (!inside) continue;
      const cx = m.box.x + m.box.w / 2;
      const cy = m.box.y + m.box.h / 2;
      const d = (px - cx) ** 2 + (py - cy) ** 2;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  let dragging = null;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = {
      x: e.clientX, y: e.clientY, t: performance.now(),
      from: scroll, moved: false, vx: 0, lastX: e.clientX, lastT: performance.now(),
    };
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) {
      const r = canvas.getBoundingClientRect();
      canvas.style.cursor = hitTest(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - dragging.x;
    const dy = e.clientY - dragging.y;
    // Let a mostly-vertical drag through — the dock lives down there.
    if (!dragging.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      dragging.moved = true;
    }
    if (!dragging.moved) return;
    if (members.length < 2) return;   // a lone constellation stays put
    canvas.style.cursor = 'grabbing';

    const now = performance.now();
    const dt = Math.max(now - dragging.lastT, 1);
    dragging.vx = (e.clientX - dragging.lastX) / dt;   // px per ms
    dragging.lastX = e.clientX;
    dragging.lastT = now;

    scroll = dragging.from - dx / slotGap();
  });

  function endDrag(e) {
    if (!dragging) return;
    const d = dragging;
    dragging = null;
    canvas.style.cursor = 'grab';

    if (!d.moved) {
      // A tap: the centred one opens its card, a neighbour just comes over.
      const r = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit && Math.abs(hit.d) < 0.5) {
        listeners.select.forEach((fn) => fn(hit.uid));
      } else if (hit) {
        focusMember(hit.uid);
      } else {
        listeners.select.forEach((fn) => fn(null));
      }
      return;
    }

    // Where to land. Rounding alone is too strict: dragging a third of the way
    // across and letting go clearly means "next", and a quick flick means it
    // even when the finger barely moved.
    const moved = scroll - d.from;
    const dir = moved !== 0 ? Math.sign(moved) : -Math.sign(d.vx || 0);
    const flicked = Math.abs(d.vx) > 0.25;

    if (Math.abs(moved) >= 0.5) {
      scrollTarget = Math.round(scroll);            // dragged past halfway, maybe several
    } else if (dir && (flicked || Math.abs(moved) > 0.25)) {
      scrollTarget = Math.round(d.from) + dir;      // committed to the next one
    } else {
      scrollTarget = Math.round(d.from);            // not enough, settle back
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { dragging = null; });

  canvas.addEventListener('wheel', (e) => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx) return;
    e.preventDefault();
    wheelAcc += dx;
    if (Math.abs(wheelAcc) > 45) {
      step(Math.sign(wheelAcc));
      wheelAcc = 0;
    }
  }, { passive: false });
  let wheelAcc = 0;

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    setState,
    setInsets,
    launchEmber,
    focusMember,
    clearFocus,
    step,
    centreUid: () => members[centreIndex()]?.uid || null,
    position: () => ({ scroll, target: scrollTarget, index: centreIndex(), dragging: !!dragging }),
    on(evt, fn) { listeners[evt]?.push(fn); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

function quad(a, b, c, t) {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

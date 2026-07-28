// The night sky: campfire, log pile, embers and everyone's constellations.
//
// Rendered on one 2D canvas in "world" coordinates (CSS pixels of the canvas)
// with a lerped camera on top, so tapping a constellation can push in on it.

import { shapeByKey } from './constellations.js';

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
  const listeners = { select: [] };

  const cam = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1 };
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
    if (!selectedUid) resetCamera(true);
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

  function fireOrigin() {
    return { x: W / 2, y: TOP_INSET + (usableH() - TOP_INSET) * 0.90 };
  }

  // The fire is the anchor of the scene, so its parts grow with the viewport
  // instead of staying a fixed pixel size on a big monitor.
  function fireScale() {
    return clamp(Math.min(W, H) / 700, 0.85, 1.8);
  }

  // ── layout ────────────────────────────────────────────────────────────
  // Constellations get a loose grid in the upper sky, jittered per-uid so it
  // reads as a night sky rather than a spreadsheet.
  function layout() {
    const n = members.length;
    if (!n || !W) return;

    const Hu = usableH();
    const top = TOP_INSET + 10;
    const bottom = top + Math.max((Hu - TOP_INSET) * 0.66, 120);
    const left = W * 0.04;
    const right = W * 0.96;
    const areaW = right - left;
    const areaH = bottom - top;

    const cols = Math.max(1, Math.round(Math.sqrt(n * (areaW / Math.max(areaH, 1)))));
    const rows = Math.ceil(n / cols);
    const cellW = areaW / cols;
    const cellH = areaH / rows;
    const size = Math.min(cellW, cellH) * 0.70;

    members.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * cellW;
      const rowLeft = left + (areaW - rowW) / 2;

      const rnd = mulberry32(hashStr(m.uid));
      const jx = (rnd() - 0.5) * cellW * 0.22;
      const jy = (rnd() - 0.5) * cellH * 0.22;

      const cx = rowLeft + col * cellW + cellW / 2 + jx;
      const cy = top + row * cellH + cellH / 2 + jy;

      m.box = { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
      m.points = m.shape.stars.map(([sx, sy]) => ({
        x: m.box.x + sx * size,
        y: m.box.y + sy * size,
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
    members = nextMembers.map((m, i) => {
      // A hand-drawn shape wins over the one picked from the F3 name.
      const shape = m.customShape || shapeByKey(m.shapeKey);
      const tone = PALETTE[hashStr(m.uid + (m.shapeKey || '')) % PALETTE.length];
      const old = prev.get(m.uid);
      return {
        ...m,
        shape,
        tone,
        box: old?.box,
        points: old?.points,
        // per-star reveal progress, so a newly lit star swells in
        glow: old?.glow || new Map(),
        pulse: old?.pulse ?? 0,
        index: i,
      };
    });
    stats = { ...stats, ...nextStats };
    layout();
    if (selectedUid && !members.some((m) => m.uid === selectedUid)) {
      selectedUid = null;
      resetCamera();
    }
  }

  // ── camera ────────────────────────────────────────────────────────────
  function resetCamera(instant = false) {
    cam.tx = 0; cam.ty = 0; cam.ts = 1;
    if (instant) { cam.x = 0; cam.y = 0; cam.s = 1; }
  }

  function focusMember(uid, instant = false) {
    const m = members.find((x) => x.uid === uid);
    if (!m || !m.box) return;
    selectedUid = uid;
    const pad = 2.1;
    const band = Math.max(usableH() - TOP_INSET, 160);
    const s = clamp(Math.min(W / (m.box.w * pad), (band * 0.62) / (m.box.h * pad)), 1, 3.2);
    const cx = m.box.x + m.box.w / 2;
    const cy = m.box.y + m.box.h / 2;
    cam.ts = s;
    cam.tx = W / 2 - cx * s;
    cam.ty = TOP_INSET + band * 0.34 - cy * s;
    if (instant) { cam.s = cam.ts; cam.x = cam.tx; cam.y = cam.ty; }
  }

  function clearFocus() {
    selectedUid = null;
    resetCamera();
  }

  function worldFromScreen(px, py) {
    return { x: (px - cam.x) / cam.s, y: (py - cam.y) / cam.s };
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

  function drawBgStars() {
    for (const s of bgStars) {
      const tw = reduceMotion ? 1 : 0.72 + 0.28 * Math.sin(time * s.sp + s.tw);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = '#dce7ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    const y = TOP_INSET + (usableH() - TOP_INSET) * 0.955;
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
      const h = (0.045 + Math.pow(rnd(), 1.6) * 0.115) * H;
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

  function fireIntensity() {
    // Asymptotic: the fire always burns, and every achievement adds less than
    // the one before — but the crew's season total keeps pushing it up.
    return 0.45 + 0.55 * (1 - Math.exp(-stats.achieved / 14));
  }

  function drawGlow() {
    const o = fireOrigin();
    const k = fireIntensity();
    const flick = reduceMotion ? 1 : 0.94 + 0.06 * Math.sin(time * 7.3) + 0.03 * Math.sin(time * 13.1);
    const r = Math.min(W, H) * (0.34 + 0.26 * k) * flick;

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
    const count = Math.min(stats.openLogs, 16);
    const fs = fireScale();
    for (let i = 0; i < count; i++) {
      const r2 = mulberry32(1000 + i * 7919);
      const tier = Math.floor(i / 4);
      const inTier = i % 4;
      const spread = (68 - tier * 8) * fs;
      const x = o.x + (inTier - 1.5) * (spread / 2) + (r2() - 0.5) * 10 * fs;
      const y = o.y - tier * 11 * fs - 2;
      const len = (78 - tier * 7 + r2() * 13) * fs;
      const thick = (11 - tier * 0.8) * fs;
      const ang = (tier % 2 === 0 ? 1 : -1) * (0.18 + r2() * 0.5) + (inTier - 1.5) * 0.06;

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

    if (stats.openLogs > count) {
      ctx.fillStyle = 'rgba(255,205,150,0.5)';
      ctx.font = `600 ${Math.round(12 * fs)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`+${stats.openLogs - count} more on the pile`, o.x, o.y + 34 * fs);
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
      const fs = fireScale();
      const spread = (38 + 26 * k) * fs;
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
      const fs = fireScale();
      ambient.push({
        x: o.x + (Math.random() - 0.5) * 84 * fs,
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
      const isSel = selectedUid === m.uid;
      const dim = selectedUid && !isSel ? 0.35 : 1;
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

      // edges
      for (const [a, b] of m.shape.edges) {
        const pa = m.points[a], pb = m.points[b];
        if (!pa || !pb) continue;
        const ga = m.glow.get(a) ?? 0;
        const gb = m.glow.get(b) ?? 0;
        const strength = Math.min(ga, gb);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = strength > 0.02
          ? col(0.14 + 0.44 * strength + m.pulse * 0.25)
          : `rgba(190,205,235,${0.055 * dim})`;
        ctx.lineWidth = strength > 0.02 ? 0.7 + 1.0 * strength : 0.6;
        ctx.stroke();
      }

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

      // label
      const litCount = m.litStars.size;
      const fs = clamp(m.box.w * 0.105, 9, 15);
      ctx.font = `600 ${fs}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = m.complete ? col(0.95, tone.l + 14) : `rgba(214,224,246,${(0.34 + 0.4 * (litCount / Math.max(m.points.length, 1))) * dim})`;
      ctx.fillText(m.f3Name, m.box.x + m.box.w / 2, m.box.y + m.box.h + fs * 1.25);

      // The species line needs room; in a tight grid it lands on the neighbour.
      if (isSel || (m.complete && m.box.w > 130)) {
        ctx.font = `500 ${fs * 0.78}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = `rgba(180,194,222,${0.6 * dim})`;
        const sub = m.complete
          ? `${m.shape.label} — lit`
          : `${litCount}/${m.points.length} · ${m.shape.label}`;
        ctx.fillText(sub, m.box.x + m.box.w / 2, m.box.y + m.box.h + fs * 2.4);
      }
    }
    ctx.textAlign = 'left';
  }

  // ── loop ──────────────────────────────────────────────────────────────
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    time += dt;
    easeInsets(dt);

    const k = 1 - Math.exp(-dt * 5);
    cam.x = lerp(cam.x, cam.tx, k);
    cam.y = lerp(cam.y, cam.ty, k);
    cam.s = lerp(cam.s, cam.ts, k);

    drawSkyBackdrop();

    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.s, cam.s);

    drawBgStars();
    drawConstellations(dt);
    drawGlow();
    drawGround();
    drawLogs();
    spawnFlames(dt);
    drawFlames(dt);
    spawnAmbient(dt);
    drawAmbient(dt);
    drawTravelers(dt);
    drawBursts(dt);

    ctx.restore();

    raf = requestAnimationFrame(frame);
  }

  // ── interaction ───────────────────────────────────────────────────────
  function hitTest(px, py) {
    const w = worldFromScreen(px, py);
    let best = null, bestD = Infinity;
    for (const m of members) {
      if (!m.box) continue;
      const pad = m.box.w * 0.18;
      const inside = w.x >= m.box.x - pad && w.x <= m.box.x + m.box.w + pad &&
                     w.y >= m.box.y - pad && w.y <= m.box.y + m.box.h + pad * 2.2;
      if (!inside) continue;
      const cx = m.box.x + m.box.w / 2;
      const cy = m.box.y + m.box.h / 2;
      const d = (w.x - cx) ** 2 + (w.y - cy) ** 2;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const held = performance.now() - downAt.t;
    downAt = null;
    if (moved > 12 || held > 600) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      focusMember(hit.uid);
      listeners.select.forEach((fn) => fn(hit.uid));
    } else if (selectedUid) {
      clearFocus();
      listeners.select.forEach((fn) => fn(null));
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    canvas.style.cursor = hitTest(e.clientX - rect.left, e.clientY - rect.top) ? 'pointer' : 'default';
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

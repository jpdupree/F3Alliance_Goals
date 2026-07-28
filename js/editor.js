// Connect-the-dots constellation editor.
//
// Tap empty sky to drop a star (it links to whatever was selected), tap a star
// to select it, tap a second star to join or unjoin them, drag to move. The
// result is normalized into the same 0..1 box the built-in shapes use, so the
// renderer can't tell the difference.

export const MAX_STARS = 20;
export const MIN_STARS = 3;
export const MAX_EDGES = 40;
export const MAX_LABEL = 24;

const TAU = Math.PI * 2;

/** Fit a drawing into the 0..1 box, centered, without distorting it. */
export function normalizeShape(stars) {
  if (!stars.length) return [];
  const xs = stars.map((s) => s[0]);
  const ys = stars.map((s) => s[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const span = Math.max(w, h);
  if (span < 1e-6) return stars.map(() => [0.5, 0.5]);
  // Leave a little margin so glow isn't clipped by the cell.
  const scale = 0.94 / span;
  const ox = (1 - w * scale) / 2;
  const oy = (1 - h * scale) / 2;
  return stars.map(([x, y]) => [
    +((x - minX) * scale + ox).toFixed(4),
    +((y - minY) * scale + oy).toFixed(4),
  ]);
}

/** Cheap structural check — the same one the rules enforce server-side. */
export function isValidShape(shape) {
  if (!shape || !Array.isArray(shape.stars) || !Array.isArray(shape.edges)) return false;
  const n = shape.stars.length;
  if (n < MIN_STARS || n > MAX_STARS) return false;
  if (shape.edges.length > MAX_EDGES) return false;
  for (const s of shape.stars) {
    if (!Array.isArray(s) || s.length !== 2) return false;
    if (!Number.isFinite(s[0]) || !Number.isFinite(s[1])) return false;
  }
  for (const e of shape.edges) {
    if (!Array.isArray(e) || e.length !== 2) return false;
    const [a, b] = e;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
    if (a === b || a < 0 || b < 0 || a >= n || b >= n) return false;
  }
  return true;
}

/**
 * Open the editor over the page.
 * @returns {Promise<{stars,edges,label}|null|'auto'>} the drawing, null if
 *          cancelled, or 'auto' if they chose the automatic shape instead.
 */
export function openDrawEditor(els, { stars = [], edges = [], label = '', f3Name = '' } = {}) {
  const canvas = els.drawCanvas;
  const ctx = canvas.getContext('2d');

  // Working copy in 0..1 space.
  let pts = stars.map(([x, y]) => ({ x, y }));
  let links = edges.map(([a, b]) => [a, b]);
  let selected = null;
  const history = [];
  let raf = 0;
  let resolveWith = null;

  els.drawLabel.value = label || '';
  els.drawTitle.textContent = f3Name ? `${f3Name}'s constellation` : 'Draw your constellation';
  els.drawModal.hidden = false;

  function snapshot() {
    history.push({
      pts: pts.map((p) => ({ ...p })),
      links: links.map((l) => [...l]),
    });
    if (history.length > 60) history.shift();
  }

  function size() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height };
  }

  // The drawing box is the largest square that fits, so the shape keeps its
  // proportions between here and the sky.
  function box() {
    const rect = canvas.getBoundingClientRect();
    const s = Math.min(rect.width, rect.height) * 0.9;
    return { x: (rect.width - s) / 2, y: (rect.height - s) / 2, s };
  }

  const toScreen = (p) => { const b = box(); return { x: b.x + p.x * b.s, y: b.y + p.y * b.s }; };
  const toWorld = (x, y) => { const b = box(); return { x: (x - b.x) / b.s, y: (y - b.y) / b.s }; };

  function hit(x, y) {
    for (let i = pts.length - 1; i >= 0; i--) {
      const s = toScreen(pts[i]);
      if (Math.hypot(s.x - x, s.y - y) < 18) return i;
    }
    return -1;
  }

  function toggleEdge(a, b) {
    const at = links.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
    if (at >= 0) links.splice(at, 1);
    else if (links.length < MAX_EDGES) links.push([a, b]);
  }

  function removeStar(i) {
    pts.splice(i, 1);
    links = links
      .filter(([a, b]) => a !== i && b !== i)
      .map(([a, b]) => [a > i ? a - 1 : a, b > i ? b - 1 : b]);
  }

  function draw() {
    const { w, h } = size();
    const b = box();

    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, w, h);

    // drawing area
    ctx.strokeStyle = 'rgba(150,175,220,.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + .5, b.y + .5, b.s, b.s);

    ctx.strokeStyle = 'rgba(255,196,120,.42)';
    ctx.lineWidth = 1.2;
    for (const [a, c] of links) {
      if (!pts[a] || !pts[c]) continue;
      const p = toScreen(pts[a]), q = toScreen(pts[c]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }

    pts.forEach((pt, i) => {
      const p = toScreen(pt);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 13);
      g.addColorStop(0, 'rgba(255,240,205,.9)');
      g.addColorStop(.32, 'rgba(255,190,110,.4)');
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      ctx.fillStyle = '#fffdf5';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, TAU); ctx.fill();

      if (i === selected) {
        ctx.strokeStyle = 'rgba(255,176,86,.95)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, TAU); ctx.stroke();
      }
    });

    if (!pts.length) {
      ctx.fillStyle = 'rgba(158,176,204,.6)';
      ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tap to place your first star', w / 2, h / 2);
      ctx.textAlign = 'left';
    }

    els.drawCount.textContent =
      `${pts.length} star${pts.length === 1 ? '' : 's'} · ${links.length} line${links.length === 1 ? '' : 's'}`;
    els.drawSave.disabled = pts.length < MIN_STARS;
    els.drawRemove.disabled = selected === null;
    els.drawUndo.disabled = !history.length;

    raf = requestAnimationFrame(draw);
  }

  // ── pointer ──────────────────────────────────────────────────────────
  let drag = null;

  function onDown(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const i = hit(x, y);
    drag = { i, x, y, moved: false, took: false };
    if (i >= 0) {
      snapshot();
      drag.took = true;
    }
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!drag || drag.i < 0) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - drag.x, y - drag.y) > 5) drag.moved = true;
    if (!drag.moved) return;
    const w = toWorld(x, y);
    pts[drag.i] = { x: Math.min(1.15, Math.max(-0.15, w.x)), y: Math.min(1.15, Math.max(-0.15, w.y)) };
  }

  function onUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) return;                 // a drag, not a tap

    // A tap on a star that we snapshotted for a drag that never happened —
    // drop that snapshot so undo doesn't need two presses.
    if (d.took) history.pop();

    if (d.i >= 0) {
      if (selected === null) selected = d.i;
      else if (selected === d.i) selected = null;
      else { snapshot(); toggleEdge(selected, d.i); selected = d.i; }
      return;
    }

    if (pts.length >= MAX_STARS) return;
    const r = canvas.getBoundingClientRect();
    const w = toWorld(e.clientX - r.left, e.clientY - r.top);
    snapshot();
    pts.push({ x: w.x, y: w.y });
    const added = pts.length - 1;
    if (selected !== null && links.length < MAX_EDGES) links.push([selected, added]);
    selected = added;
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { drag = null; });

  // ── buttons ──────────────────────────────────────────────────────────
  const onUndo = () => {
    const prev = history.pop();
    if (!prev) return;
    pts = prev.pts; links = prev.links; selected = null;
  };
  const onRemove = () => {
    if (selected === null) return;
    snapshot();
    removeStar(selected);
    selected = null;
  };
  const onClear = () => { snapshot(); pts = []; links = []; selected = null; };
  const onAuto = () => finish('auto');
  const onSave = () => {
    if (pts.length < MIN_STARS) return;
    finish({
      stars: normalizeShape(pts.map((p) => [p.x, p.y])),
      edges: links.slice(0, MAX_EDGES),
      label: els.drawLabel.value.trim().slice(0, MAX_LABEL),
    });
  };
  const onCancel = () => finish(null);
  const onKey = (e) => {
    if (e.key === 'Escape') onCancel();
    if ((e.key === 'Backspace' || e.key === 'Delete') && selected !== null &&
        document.activeElement !== els.drawLabel) {
      e.preventDefault();
      onRemove();
    }
  };
  const onBackdrop = (e) => { if (e.target === els.drawModal) onCancel(); };

  els.drawUndo.addEventListener('click', onUndo);
  els.drawRemove.addEventListener('click', onRemove);
  els.drawClear.addEventListener('click', onClear);
  els.drawAuto.addEventListener('click', onAuto);
  els.drawSave.addEventListener('click', onSave);
  els.drawClose.addEventListener('click', onCancel);
  els.drawModal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey);

  function finish(result) {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    els.drawUndo.removeEventListener('click', onUndo);
    els.drawRemove.removeEventListener('click', onRemove);
    els.drawClear.removeEventListener('click', onClear);
    els.drawAuto.removeEventListener('click', onAuto);
    els.drawSave.removeEventListener('click', onSave);
    els.drawClose.removeEventListener('click', onCancel);
    els.drawModal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey);
    els.drawModal.hidden = true;
    resolveWith(result);
  }

  draw();
  return new Promise((res) => { resolveWith = res; });
}

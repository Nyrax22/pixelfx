// The painted panels of the prologue, brought to life on a canvas: a slow eased camera with a
// hand-held drift, and per panel the things that move in it — embers, motes, torch flicker,
// a heart's glow beating, blood drawn up through chains, a crack of red light breathing.
// Points of interest are in image space (0..1), so the effects stay pinned as the camera moves.

const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

// what lives in each panel
const PRESET = {
  p1: { glow: [[0.76, 0.38, 0.16, "255,170,70", 0.5, 1.1], [0.32, 0.19, 0.08, "255,210,120", 0.35, 0.4]], motes: { n: 70, col: "255,220,140", up: 10 },
    flick: [[0.08, 0.76, 0.03], [0.13, 0.74, 0.03], [0.38, 0.83, 0.025], [0.03, 0.72, 0.025]], river: [[0.75, 0.48], [0.7, 0.58], [0.62, 0.64], [0.55, 0.7], [0.62, 0.76], [0.72, 0.8]] },
  p2: { glow: [[0.2, 0.26, 0.12, "255,40,40", 0.45, 1.6], [0.62, 0.07, 0.1, "255,60,60", 0.35, 0.3]], embers: { n: 90 }, ash: 50, fire: [0.55, 1, 0.38, 0.62], tint: "120,10,10" },
  p3: { heart: [0.62, 0.45, 0.32], stream: [[0.52, 0.6], [0.37, 0.7]], flick: [[0.14, 0.73, 0.04], [0.22, 0.83, 0.035]], motes: { n: 40, col: "255,190,120", up: 6 } },
  king: { glow: [[0.56, 0.24, 0.2, "255,150,90", 0.5, 0.5]], glint: [0.58, 0.12], motes: { n: 50, col: "255,200,160", up: 4 }, rays: [0.56, 0.24] },
  mob: { flick: [[0.25, 0.53, 0.04], [0.33, 0.54, 0.04], [0.41, 0.55, 0.04], [0.47, 0.55, 0.04], [0.56, 0.54, 0.04], [0.63, 0.54, 0.04], [0.71, 0.53, 0.04], [0.79, 0.54, 0.04], [0.94, 0.53, 0.04], [0.12, 0.55, 0.035], [0.86, 0.55, 0.035]],
    glow: [[0.49, 0.56, 0.06, "255,200,120", 0.5, 2]], embers: { n: 60 }, chant: true },
  seal: { heart: [0.45, 0.38, 0.22, true], drain: [0.45, 0.4], glow: [[0.45, 0.76, 0.3, "255,190,80", 0.35, 0.8]], flick: [[0.22, 0.47, 0.03], [0.12, 0.62, 0.03], [0.82, 0.62, 0.03], [0.88, 0.5, 0.03], [0.28, 0.6, 0.03]] },
  p100: { glow: [[0.24, 0.24, 0.1, "255,60,70", 0.4, 0.3], [0.25, 0.53, 0.12, "220,220,255", 0.25, 0.2]], crack: [0.75, 0.65], fog: true, eyes: [0.752, 0.6] },
};

export function createStory(cv) {
  const g = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let cur = null, prev = null, fade = 1, shakeK = 0, flashK = 0, flashC = "255,255,255", t = 0, beat = 0;
  const parts = [];
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  /** Camera for a panel at time u (0..1): centre in image space and zoom over "cover". */
  function cam(p, u) {
    const k = ease(Math.min(1, u));
    const drift = [Math.sin(t * 0.37 + p.seed) * 0.004, Math.cos(t * 0.29 + p.seed) * 0.003];
    return { x: p.from[0] + (p.to[0] - p.from[0]) * k + drift[0], y: p.from[1] + (p.to[1] - p.from[1]) * k + drift[1], z: p.from[2] + (p.to[2] - p.from[2]) * k };
  }
  function place(p, c, sx, sy) {
    const iw = p.img.naturalWidth || 1, ih = p.img.naturalHeight || 1;
    const s = Math.max(W / iw, H / ih) * c.z;
    // keep the image covering the screen however far the camera wanders
    let ox = W / 2 - c.x * iw * s, oy = H / 2 - c.y * ih * s;
    ox = Math.min(0, Math.max(W - iw * s, ox)); oy = Math.min(0, Math.max(H - ih * s, oy));
    return { s, ox: ox + sx, oy: oy + sy, iw, ih, P: (u, v) => [ox + sx + u * iw * s, oy + sy + v * ih * s], R: (r) => r * Math.max(iw, ih) * s };
  }
  function drawPanel(p, alpha, sx, sy) {
    if (!p.img.complete || !p.img.naturalWidth) return null;
    const c = cam(p, p.age / p.dur), m = place(p, c, sx, sy);
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = !p.px;
    g.drawImage(p.img, m.ox, m.oy, m.iw * m.s, m.ih * m.s);
    g.globalAlpha = 1;
    return m;
  }
  function glowAt(x, y, r, col, a) {
    if (a <= 0.003 || r <= 0) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function spawnParts(p) {
    parts.length = 0;
    const F = p.fx;
    const add = (n, mk) => { for (let i = 0; i < n; i++) parts.push(mk(true)); };
    if (F.motes) add(F.motes.n, () => ({ k: "mote", u: Math.random(), v: Math.random(), vu: rand(-0.004, 0.004), vv: -rand(0.2, 1) * F.motes.up * 0.001, r: rand(0.6, 1.8), ph: rand(0, TAU), col: F.motes.col }));
    if (F.embers) add(F.embers.n, () => ({ k: "ember", u: Math.random(), v: rand(0.3, 1.1), vu: rand(-0.01, 0.01), vv: -rand(0.02, 0.07), r: rand(0.8, 2.2), ph: rand(0, TAU) }));
    if (F.ash) add(F.ash, () => ({ k: "ash", u: Math.random(), v: Math.random(), vu: rand(0.004, 0.012), vv: rand(0.008, 0.02), r: rand(0.8, 1.6), ph: rand(0, TAU) }));
  }
  function stepParts(dt) {
    for (const q of parts) {
      q.u += q.vu * dt + (q.k === "ember" ? Math.sin(t * 2 + q.ph) * 0.0006 : 0);
      q.v += q.vv * dt;
      if (q.v < -0.05) { q.v = 1.05; q.u = Math.random(); }
      if (q.v > 1.05) { q.v = -0.05; q.u = Math.random(); }
      if (q.u > 1.05) q.u = -0.05; if (q.u < -0.05) q.u = 1.05;
    }
  }
  function drawFx(p, m, alpha) {
    const F = p.fx, ad = (a) => a * alpha;
    const bpm = 0.95, ph = (beat % bpm) / bpm, pulse = ph < 0.1 ? ph / 0.1 : ph < 0.25 ? 1 - (ph - 0.1) / 0.15 : ph < 0.35 ? (ph - 0.25) / 0.1 * 0.5 : ph < 0.5 ? 0.5 - (ph - 0.35) / 0.15 * 0.5 : 0;
    g.globalCompositeOperation = "lighter";
    for (const [u, v, r, col, a, sp] of F.glow ?? []) { const [x, y] = m.P(u, v); glowAt(x, y, m.R(r) * (1 + 0.08 * Math.sin(t * sp * TAU)), col, ad(a * (0.75 + 0.25 * Math.sin(t * sp * TAU)))); }
    for (const [u, v, r] of F.flick ?? []) { const [x, y] = m.P(u, v), f = 0.55 + 0.45 * Math.sin(t * 17 + u * 40) * Math.sin(t * 7.3 + v * 20); glowAt(x, y, m.R(r) * (0.9 + f * 0.3), "255,150,60", ad(0.35 + f * 0.3)); }
    if (F.heart) {
      const [u, v, r, dying] = F.heart, [x, y] = m.P(u, v), k = dying ? Math.max(0.15, 1 - p.age / p.dur) : 1;
      glowAt(x, y, m.R(r) * (1 + pulse * 0.15), "255,40,40", ad((0.18 + pulse * 0.45) * k));
    }
    if (F.river) {
      // light running down the river of blood toward the fields
      for (let i = 0; i < 7; i++) {
        const s = ((t * 0.12 + i / 7) % 1) * (F.river.length - 1), j = Math.floor(s), f = s - j;
        const a = F.river[j], b = F.river[j + 1] ?? a, [x, y] = m.P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
        glowAt(x, y, m.R(0.025), "255,200,90", ad(0.6));
      }
    }
    if (F.fire) { const [u0, u1, v0, v1] = F.fire; for (let i = 0; i < 8; i++) { const u = u0 + ((i * 0.137 + 0.05) % 1) * (u1 - u0), v = v0 + ((i * 0.311) % 1) * (v1 - v0), [x, y] = m.P(u, v), f = 0.5 + 0.5 * Math.sin(t * 11 + i * 3); glowAt(x, y, m.R(0.05), "255,110,40", ad(0.25 + 0.25 * f)); } }
    if (F.stream) {
      // sparks of the heart's blood flowing into the child
      const [[a0, b0], [a1, b1]] = F.stream;
      for (let i = 0; i < 26; i++) {
        const s = (t * 0.25 + i / 26) % 1, w = Math.sin(s * Math.PI * 3 + i) * 0.02;
        const [x, y] = m.P(a0 + (a1 - a0) * s, b0 + (b1 - b0) * s + w);
        g.fillStyle = `rgba(255,${190 + (i % 3) * 20},120,${ad(0.9 * Math.sin(s * Math.PI))})`;
        const r = Math.max(1, m.R(0.003)); g.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    if (F.rays) {
      const [x, y] = m.P(...F.rays);
      g.save(); g.translate(x, y); g.rotate(t * 0.05);
      for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); const gr = g.createLinearGradient(0, 0, m.R(0.6), 0); gr.addColorStop(0, `rgba(255,170,110,${ad(0.12)})`); gr.addColorStop(1, "rgba(255,170,110,0)"); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(m.R(0.6), -m.R(0.025)); g.lineTo(m.R(0.6), m.R(0.025)); g.fill(); }
      g.restore();
    }
    if (F.glint) {
      // the sword catches the sun every few seconds
      const c = (t % 3.2) / 3.2, k = c < 0.12 ? Math.sin((c / 0.12) * Math.PI) : 0;
      if (k > 0) { const [x, y] = m.P(...F.glint), r = m.R(0.06) * k; g.fillStyle = `rgba(255,255,240,${ad(k)})`; g.fillRect(x - r, y - 1, r * 2, 2); g.fillRect(x - 1, y - r, 2, r * 2); glowAt(x, y, r * 0.8, "255,255,220", ad(k * 0.8)); }
    }
    if (F.drain) {
      // the chains draw the blood up and away, toward the city
      const [u, v] = F.drain;
      for (let i = 0; i < 30; i++) {
        const s = (t * 0.18 + i / 30) % 1, uu = u + Math.sin(i * 2.3) * 0.06 * (1 - s), vv = v - s * 0.45;
        const [x, y] = m.P(uu, vv), r = Math.max(1.5, m.R(0.004));
        g.fillStyle = `rgba(255,40,50,${ad(0.8 * Math.sin(s * Math.PI))})`; g.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    if (F.crack) { const [x, y] = m.P(...F.crack); glowAt(x, y, m.R(0.1) * (1 + pulse * 0.25), "255,30,40", ad(0.25 + pulse * 0.55)); }
    for (const q of parts) {
      const [x, y] = m.P(q.u, q.v), tw = 0.5 + 0.5 * Math.sin(t * 3 + q.ph), r = q.r * dpr;
      if (q.k === "mote") { g.fillStyle = `rgba(${q.col},${ad(0.25 + tw * 0.5)})`; g.fillRect(x, y, r, r); }
      else if (q.k === "ember") { g.fillStyle = `rgba(255,${120 + (tw * 90) | 0},40,${ad(0.5 + tw * 0.5)})`; g.fillRect(x, y, r, r); glowAt(x, y, r * 4, "255,90,30", ad(0.15)); }
    }
    g.globalCompositeOperation = "source-over";
    for (const q of parts) if (q.k === "ash") { const [x, y] = m.P(q.u, q.v); g.fillStyle = `rgba(30,24,28,${ad(0.6)})`; g.fillRect(x, y, q.r * dpr, q.r * dpr); }
    if (F.tint) { g.fillStyle = `rgba(${F.tint},${ad(0.06 + 0.05 * Math.sin(t * 9) * Math.sin(t * 5.1))})`; g.fillRect(0, 0, W, H); }
    if (F.fog) {
      for (let i = 0; i < 5; i++) { const u = ((t * 0.01 * (1 + i * 0.3) + i * 0.27) % 1.4) - 0.2, [x, y] = m.P(u, 0.82 + (i % 2) * 0.06); g.fillStyle = "rgba(20,10,24,0.35)"; g.beginPath(); g.ellipse(x, y, m.R(0.18), m.R(0.03), 0, 0, TAU); g.fill(); }
    }
    if (F.eyes && p.age > 2.2) {
      // two red eyes open in the crack, blink once, stay open
      const o = Math.min(1, (p.age - 2.2) / 0.8), bl = (p.age % 3.5) < 0.12 ? 0.15 : 1, [x, y] = m.P(...F.eyes), r = m.R(0.006);
      g.globalCompositeOperation = "lighter";
      for (const dx of [-1, 1]) { g.fillStyle = `rgba(255,40,40,${ad(o)})`; g.fillRect(x + dx * r * 2.2 - r, y - r * 0.5 * bl, r * 2, r * bl); glowAt(x + dx * r * 2.2, y, r * 5, "255,0,0", ad(o * 0.6)); }
      g.globalCompositeOperation = "source-over";
    }
  }
  return {
    resize,
    /** Show a panel. key picks its living effects; from/to are [x, y, zoom] in image space. */
    show(img, key, { px = false, from = [0.5, 0.5, 1.05], to = [0.5, 0.5, 1.2], dur = 12 } = {}) {
      if (!W) resize();
      prev = cur; fade = 0;
      cur = { img, px, from, to, dur, age: 0, fx: PRESET[key] ?? {}, seed: Math.random() * 10 };
      spawnParts(cur);
    },
    clear() { prev = cur; cur = null; fade = 0; },
    shake(k = 1) { shakeK = Math.max(shakeK, k); },
    flash(col = "255,255,255", k = 0.8) { flashC = col; flashK = k; },
    tick(dt) {
      if (!W) resize();
      t += dt; beat += dt;
      fade = Math.min(1, fade + dt / 1.6);
      if (cur) cur.age += dt;
      if (prev) prev.age += dt;
      stepParts(dt);
      shakeK = Math.max(0, shakeK - dt * 1.5);
      flashK = Math.max(0, flashK - dt * 1.8);
      const chant = cur?.fx.chant ? Math.abs(Math.sin(t * 3.4)) * 2.5 * dpr : 0;
      const sx = (Math.random() - 0.5) * shakeK * 16 * dpr, sy = (Math.random() - 0.5) * shakeK * 16 * dpr - chant;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const Wd = W, Hd = H;
      if (prev && fade < 1) { const m = drawPanel(prev, 1 - fade, sx, sy); if (m) drawFx(prev, m, 1 - fade); }
      if (cur) { const m = drawPanel(cur, prev ? fade : fade, sx, sy); if (m) drawFx(cur, m, fade); }
      if (fade >= 1) prev = null;
      // a soft vignette and a breathing darkness at the edges
      const vg = g.createRadialGradient(Wd / 2, Hd / 2, Math.min(Wd, Hd) * 0.3, Wd / 2, Hd / 2, Math.max(Wd, Hd) * 0.72);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${0.7 + 0.08 * Math.sin(t * 1.3)})`);
      g.fillStyle = vg; g.fillRect(0, 0, Wd, Hd);
      if (flashK > 0) { g.fillStyle = `rgba(${flashC},${Math.min(0.8, flashK)})`; g.fillRect(0, 0, Wd, Hd); }
    },
  };
}

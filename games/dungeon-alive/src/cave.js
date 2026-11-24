// Painting the cave: the rock, the hollows carved into it, the gate on the hill and the heart's hall.
// Everything here is drawn once at native resolution (1 world unit = 1 pixel) whenever the cave
// changes, and the renderer scales it up with hard pixels.

import { W, H, GROUND, ZONES, WP, MAP } from "./map.js";
const GX = MAP.nodes.gate[0];

const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// smooth value noise and a few octaves of it
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s, o = 3) => { let t = 0, amp = 0.5, f = 1; for (let i = 0; i < o; i++) { t += vnoise(x * f, y * f, s + i) * amp; amp *= 0.5; f *= 2; } return t; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// rock ramps from the surface down into the deep: dark loam, then old stone, then something purple and wrong
const ROCK_TOP = ["#140c0c", "#24171a", "#352228", "#4a3036", "#62424a"].map(rgb);
const ROCK_DEEP = ["#09060d", "#130c1a", "#1e1428", "#2c1e3a", "#3e2c4e"].map(rgb);
const GOLD_ROCK = ["#2a1a0e", "#4a2e18", "#6a4424", "#8e6034", "#b07e48"].map(rgb);
const WALL = ["#0b0810", "#120d18", "#1a1322", "#241b2e", "#30253c"].map(rgb);
const GOLD_WALL = ["#3a2412", "#4e3218", "#644222", "#7c5430", "#9a6c40"].map(rgb);

/** The ceiling height above a zone's floor at x: domes for chambers, flat-ish roofs for tunnels. */
function floorAt(z, x) {
  const p = z.path;
  if (x <= Math.min(p[0][0], p[p.length - 1][0])) return p[0][0] < p[p.length - 1][0] ? p[0][1] : p[p.length - 1][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[i + 1];
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    if (x >= lo && x <= hi && hi > lo) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return p[0][0] > p[p.length - 1][0] ? p[0][1] : p[p.length - 1][1];
}

/** Rasterise the hollow of a zone onto a mask context. */
function hollow(m, z) {
  m.lineCap = "round"; m.lineJoin = "round";
  if (z.kind === "chamber" || z.kind === "heart" || z.kind === "secret") {
    const pad = z.kind === "heart" ? 18 : 10, x0 = z.x0 - pad, x1 = z.x1 + pad, hw = (x1 - x0) / 2, cx = (x0 + x1) / 2;
    m.beginPath();
    m.moveTo(x0, floorAt(z, x0) + 2);
    for (let x = x0; x <= x1; x += 2) {
      const t = (x - cx) / hw, dome = Math.pow(Math.max(0, 1 - t * t), 0.45);
      m.lineTo(x, floorAt(z, x) - 8 - (z.h - 8) * dome);
    }
    m.lineTo(x1, floorAt(z, x1) + 2);
    for (let x = x1; x >= x0; x -= 4) m.lineTo(x, floorAt(z, x) + 2);
    m.closePath(); m.fill();
  }
  // every zone is also a tube along its floor, so tunnels and shafts read at any angle
  const h = z.kind === "entrance" ? 30 : Math.min(z.h, 36);
  m.lineWidth = h;
  m.beginPath();
  z.path.forEach(([x, y], i) => (i ? m.lineTo(x, y - h / 2 + 3) : m.moveTo(x, y - h / 2 + 3)));
  m.stroke();
}

/**
 * Paint the whole cave for a run. `mode` is "normal" or "golden" (the prologue's golden age).
 * Returns { canvas, torches: [[x,y]], gate: [x,y] }.
 */
export function paintCave(run, mode = "normal") {
  const gold = mode === "golden";
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  // masks: open hollows, collapsed hollows
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.strokeStyle = "#fff"; return [c, x]; };
  const [openC, openM] = mk(), [shutC, shutM] = mk();
  for (const z of Object.values(ZONES)) {
    if (z.kind === "entrance") continue;
    const open = run.rooms[z.id]?.open;
    // a closed secret room stays hidden in the rock until it opens
    if (!open && z.kind === "secret") continue;
    hollow(open ? openM : shutM, z);
  }
  const om = openM.getImageData(0, 0, W, H).data, sm = shutM.getImageData(0, 0, W, H).data;
  // warp the masks a little so edges are ragged rock, not ruler lines
  const at = (d, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4]);
  const inside = new Uint8Array(W * H); // 0 rock, 1 open, 2 collapsed
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = Math.round((fbm(x * 0.08, y * 0.08, 11, 2) - 0.5) * 7), dy = Math.round((fbm(x * 0.08, y * 0.08, 23, 2) - 0.5) * 7);
    if (at(om, x + dx, y + dy) > 127 || at(om, x, y) > 200) inside[y * W + x] = 1;
    else if (at(sm, x + dx, y + dy) > 127) inside[y * W + x] = 2;
  }
  // floors are where the path is: keep the walkable line clear of warped rock
  for (const z of Object.values(ZONES)) {
    if (!run.rooms[z.id]?.open || z.kind === "entrance") continue;
    for (const id of z.wps) { const w = WP[id]; for (let yy = -16; yy <= -1; yy++) for (let xx = -2; xx <= 2; xx++) { const X = Math.round(w.x) + xx, Y = Math.round(w.y) + yy; if (X >= 0 && Y >= 0 && X < W && Y < H && Y > GROUND) inside[Y * W + X] = 1; } }
  }
  const img = g.createImageData(W, H), px = img.data;
  const R0 = gold ? GOLD_ROCK : ROCK_TOP, R1 = gold ? GOLD_ROCK : ROCK_DEEP, WL = gold ? GOLD_WALL : WALL;
  const surf = (x) => GROUND - 2 + Math.round((fbm(x * 0.05, 3, 5, 2) - 0.5) * 4) - hill(x);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o = i * 4, top = surf(x);
    if (y < top) { px[o + 3] = 0; continue; }
    const depth = Math.min(1, Math.max(0, (y - GROUND) / (H - GROUND)));
    const s = inside[i];
    let col;
    if (s === 1) {
      // the back wall of a hollow: darker toward the ceiling, old masonry in chambers, rough rock in tunnels
      const z = zoneAtPixel(x, y);
      let lv = 1.6 + fbm(x * 0.15, y * 0.15, 41, 2) * 1.6;
      if (z && (z.kind === "chamber" || z.kind === "heart" || z.kind === "secret")) {
        const fy = Math.round(floorAt(z, x)), d = fy - y, rel = d / z.h;
        lv += rel < 0.25 ? 0.6 : 0;
        // big carved blocks
        const row = Math.floor(d / 9), bx = ((x + (row % 2) * 9) % 18 + 18) % 18, dr = ((d % 9) + 9) % 9;
        if (dr === 0 || bx === 0) lv -= 1.1;
        else if (dr === 1 || bx === 1) lv += 0.4;
        lv -= Math.max(0, rel - 0.55) * 3;
      } else lv -= 0.4;
      col = WL[Math.max(0, Math.min(4, Math.round(lv)))];
    } else {
      // rock: mottled, banded into strata, peppered with stones
      const n = fbm(x * 0.045, y * 0.06, 7, 3);
      const band = Math.sin(y * 0.11 + fbm(x * 0.02, y * 0.02, 9, 2) * 6) * 0.5 + 0.5;
      let lv = 1 + n * 2.4 + band * 0.7;
      const pebble = hash(x >> 1, y >> 1, 3);
      if (pebble > 0.985) lv += 1.2; else if (pebble < 0.02) lv -= 1;
      // edges of hollows: a lit lip on floors, a dark rim on ceilings
      const above = y > 0 ? inside[i - W] : 0, below = y < H - 1 ? inside[i + W] : 0, a2 = y > 1 ? inside[i - 2 * W] : 0;
      if (s === 0 && above === 1) lv = 4.2;
      else if (s === 0 && a2 === 1) lv = 3.2;
      else if (s === 0 && below === 1) lv = 0;
      if (s === 2) lv = 1.4 + (hash(x >> 2, y >> 2, 8) > 0.5 ? 1 : 0) + n; // rubble: blocky and loose
      const ramp = R0.map((c, k) => mixc(c, R1[k], depth));
      col = ramp[Math.max(0, Math.min(4, Math.round(lv)))];
      if (s === 0 && y - top < 3) col = gold ? rgb("#6a8a34") : rgb("#1c2a1a");
      else if (s === 0 && y - top < 5) col = gold ? rgb("#4a5a24") : rgb("#141c12");
    }
    px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);

  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  // roots from the surface, bones and skulls in the deep rock
  for (let i = 0; i < 26; i++) {
    let x = hash(i, 11) * W, y = surf(x | 0) + 2;
    for (let k = 0; k < 18 + hash(i, 12) * 26; k++) { if (inside[(y | 0) * W + (x | 0)]) break; P(x, y, 1, 1, gold ? "#7a5030" : "#2a1812"); x += hash(i, k) - 0.5; y += 1; }
  }
  for (let i = 0; i < 22; i++) {
    const x = (hash(i, 21) * W) | 0, y = (GROUND + 60 + hash(i, 22) * (H - GROUND - 70)) | 0;
    if (inside[y * W + x] || inside[(y + 3) * W + x]) continue;
    if (i % 3 === 0) { P(x, y, 4, 3, "#6a6058"); P(x + 1, y + 1, 1, 1, "#0a0608"); P(x + 3, y + 1, 1, 1, "#0a0608"); P(x + 1, y + 3, 3, 1, "#5a5048"); }
    else { P(x, y, 6, 1, "#5a5048"); P(x - 1, y - 1, 2, 3, "#6a6058"); P(x + 5, y - 1, 2, 3, "#6a6058"); }
  }

  // inside the hollows: stalactites, stairs on steep floors, pillars and chains in the halls
  const torches = [];
  for (const z of Object.values(ZONES)) {
    const rm = run.rooms[z.id];
    if (!rm?.open || z.kind === "entrance") continue;
    // stalactites hang from the ceiling edge
    for (let x = Math.round(z.x0 - 6); x <= z.x1 + 6; x += 3) {
      if (hash(x, 5, z.x0) > 0.42) continue;
      let y = Math.round(floorAt(z, x)) - 6;
      while (y > 0 && inside[y * W + x] === 1) y--;
      if (y <= GROUND) continue;
      const len = 2 + ((hash(x, 7) * 7) | 0);
      for (let k = 1; k <= len; k++) { const w = k < len * 0.5 ? 2 : 1; if (inside[(y + k) * W + x] === 1) P(x, y + k, w, 1, k === len ? "#1a1220" : "#2a2030"); }
    }
    // stairs: notches on any stretch steeper than a ramp
    for (let i = 0; i < z.path.length - 1; i++) {
      const [x0, y0] = z.path[i], [x1, y1] = z.path[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
      if (Math.abs(y1 - y0) < Math.abs(x1 - x0) * 0.35) continue;
      for (let d = 3; d < len; d += 4) {
        const t = d / len, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        P(x - 4, y, 9, 1, gold ? "#c8a070" : "#5a4a5c"); P(x - 4, y + 1, 9, 1, gold ? "#8a6a48" : "#2a2030");
      }
    }
    if (z.kind === "chamber" || z.kind === "heart") {
      // pillars at either end of a hall and torches between them
      const fy = (x) => Math.round(floorAt(z, x));
      for (const x of [z.x0 + 4, z.x1 - 4]) {
        const top = fy(x) - z.h * 0.72;
        P(x - 3, top, 7, fy(x) - top, gold ? "#8a6a48" : "#2c2234"); P(x - 3, top, 1, fy(x) - top, gold ? "#b08a60" : "#3e3048");
        P(x + 3, top, 1, fy(x) - top, "#120c16"); P(x - 4, top - 2, 9, 3, gold ? "#a0805a" : "#3a2e44"); P(x - 4, fy(x) - 3, 9, 3, gold ? "#a0805a" : "#3a2e44");
      }
      if (z.kind === "chamber") for (const x of [z.x0 + 18, z.x1 - 18]) { const y = fy(x) - 30; torches.push([x, y]); P(x - 1, y + 2, 3, 6, "#3a2a1a"); P(x - 2, y + 7, 5, 1, "#5a4028"); }
      if (z.h >= 70 && z.kind === "chamber") {
        // a chain hanging in the great hall
        const cx = Math.round(z.cx), y0 = fy(cx) - z.h + 6;
        for (let k = 0; k < 26; k += 2) P(cx, y0 + k, 1, 1, k % 4 ? "#5a5868" : "#7a7888");
        P(cx - 2, y0 + 26, 5, 2, "#6a6878");
      }
    }
    if (z.kind === "tunnel" && z.wps.length > 14) {
      const w = WP[z.wps[(z.wps.length / 2) | 0]];
      torches.push([w.x + 6, w.y - 24]); P(w.x + 5, w.y - 22, 2, 5, "#3a2a1a");
    }
  }

  // collapsed chambers: boulders and the dark gaps between them
  for (const z of Object.values(ZONES)) {
    if (run.rooms[z.id]?.open || z.kind !== "chamber") continue;
    for (let i = 0; i < 14; i++) {
      const x = z.x0 + hash(i, 1, z.x0) * (z.x1 - z.x0), y = floorAt(z, x) - 4 - hash(i, 2, z.x0) * (z.h * 0.6), r = 4 + hash(i, 3, z.x0) * 6;
      g.fillStyle = gold ? "#7a5a3a" : "#2e2430"; g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = gold ? "#9a7a50" : "#40344a"; g.fillRect(Math.round(x - r * 0.5), Math.round(y - r * 0.6), Math.round(r * 0.7), 1);
      g.fillStyle = "#08060a"; g.fillRect(Math.round(x + r * 0.4), Math.round(y + r * 0.3), 2, 1);
    }
  }

  // the heart's hall: arteries running out of the heart into the rock
  const K = Object.values(ZONES).find((z) => z.kind === "heart");
  if (K) {
    const hx = K.cx, hy = K.y - 60;
    for (let i = 0; i < 16; i++) {
      let a = (i / 16) * Math.PI * 2 + hash(i, 4) * 0.3, x = hx, y = hy, w = 3;
      for (let k = 0; k < 90 + hash(i, 5) * 80; k++) {
        a += (hash(i, k, 9) - 0.5) * 0.35;
        x += Math.cos(a) * 1.2; y += Math.sin(a) * 1.2;
        if (x < 0 || y < GROUND + 6 || x >= W || y >= H) break;
        const wall = inside[(y | 0) * W + (x | 0)] === 1;
        g.fillStyle = gold ? (wall ? "#c86a3a" : "#a04a2a") : wall ? "#4a0e18" : "#3a0a14";
        g.fillRect(x | 0, y | 0, Math.max(1, Math.round(w)), Math.max(1, Math.round(w)));
        if (!wall && k % 9 === 0) { g.fillStyle = gold ? "#ffb070" : "#8a1a2a"; g.fillRect(x | 0, y | 0, 1, 1); }
        w = Math.max(1, w - 0.02);
      }
    }
    // a stone plinth under the heart
    const fy = Math.round(K.y);
    P(hx - 26, fy - 8, 52, 8, gold ? "#a0805a" : "#2e2232"); P(hx - 30, fy - 10, 60, 3, gold ? "#c8a070" : "#463650");
    P(hx - 22, fy - 7, 44, 1, gold ? "#7a5a3a" : "#1e1622");
  }

  const gate = drawSurface(g, gold);
  // room types dress their chambers
  for (const z of Object.values(ZONES)) {
    const rm = run.rooms[z.id];
    if (!rm?.open || z.kind !== "chamber" && z.kind !== "secret") continue;
    decoZone(g, rm.type, z.x0 - 4, z.x1 + 4, Math.round(z.y), z.h, z.x0);
  }
  return { canvas: cv, torches, gate };
}
function zoneAtPixel(x, y) {
  let best = null, bd = Infinity;
  for (const z of Object.values(ZONES)) {
    if (x < z.x0 - 22 || x > z.x1 + 22) continue;
    const fy = floorAt(z, x);
    if (y > fy + 4 || y < fy - z.h - 6) continue;
    const d = Math.abs(fy - y);
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}
// the hill the gate is cut into
const hill = (x) => Math.max(0, 22 - Math.abs(x - GX) * 0.32);

/** The world above: a hill with a gothic gate flanked by hooded saints. Returns the gate's light point. */
function drawSurface(g, gold) {
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const gx = GX, gy = GROUND;
  const stone = gold ? ["#5a4630", "#8a7050", "#b8986c", "#e0c8a0"] : ["#16121c", "#2a2432", "#3e3648", "#5a5064"];
  // the gate: a tall pointed arch
  P(gx - 20, gy - 58, 40, 58, stone[1]);
  for (let y = gy - 58; y < gy; y += 6) for (let x = gx - 20 + ((y / 6) % 2) * 5; x < gx + 20; x += 10) P(x, y, 1, 6, stone[0]);
  for (let y = gy - 58; y < gy; y += 6) P(gx - 20, y, 40, 1, stone[0]);
  for (let k = 0; k < 14; k++) { P(gx - 20 + k, gy - 58 - k * 0.9, 1, 3, stone[2]); P(gx + 19 - k, gy - 58 - k * 0.9, 1, 3, stone[2]); }
  P(gx - 2, gy - 74, 4, 6, stone[2]); P(gx - 4, gy - 72, 8, 2, stone[2]);
  // the opening
  g.fillStyle = "#050307";
  g.beginPath(); g.moveTo(gx - 11, gy); g.lineTo(gx - 11, gy - 30); g.quadraticCurveTo(gx - 11, gy - 44, gx, gy - 50); g.quadraticCurveTo(gx + 11, gy - 44, gx + 11, gy - 30); g.lineTo(gx + 11, gy); g.fill();
  P(gx - 12, gy - 30, 1, 30, stone[3]); P(gx + 11, gy - 30, 1, 30, stone[0]);
  // banners
  P(gx - 18, gy - 52, 5, 20, gold ? "#a82a1a" : "#5a0e16"); P(gx + 13, gy - 52, 5, 20, gold ? "#a82a1a" : "#5a0e16");
  P(gx - 17, gy - 46, 3, 3, gold ? "#ffd070" : "#b08a3a"); P(gx + 14, gy - 46, 3, 3, gold ? "#ffd070" : "#b08a3a");
  // two hooded saints, hands folded, keeping watch either side
  for (const sx of [gx - 32, gx + 32]) {
    const base = gy;
    P(sx - 7, base - 6, 14, 6, stone[1]); P(sx - 8, base - 7, 16, 2, stone[2]);
    g.fillStyle = stone[1];
    g.beginPath(); g.moveTo(sx - 6, base - 7); g.lineTo(sx - 4, base - 30); g.quadraticCurveTo(sx, base - 38, sx + 4, base - 30); g.lineTo(sx + 6, base - 7); g.fill();
    P(sx - 3, base - 33, 6, 6, stone[2]); P(sx - 2, base - 30, 4, 3, stone[0]);
    P(sx - 1, base - 24, 3, 5, stone[3]); P(sx - 4, base - 28, 1, 20, stone[2]);
    P(sx + 4, base - 28, 1, 20, stone[0]);
  }
  return [gx, gy - 24];
}

/** Room types: what a chamber looks like once it is given a purpose. */
export function decoZone(g, type, x0, x1, F, h, seed = 0) {
  const P = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, hh); };
  const iw = x1 - x0, M = (x0 + x1) / 2, top = F - h;
  switch (type) {
    case "water":
      P(x0 + 4, F - 14, iw - 8, 14, "#12305a"); P(x0 + 4, F - 14, iw - 8, 1, "#6aaee8");
      for (let i = 0; i < 9; i++) P(x0 + 8 + hash(seed, i) * (iw - 20), F - 11 + hash(i, seed) * 9, 6, 1, "#2a6ab0");
      break;
    case "treasure":
      P(x1 - 34, F - 12, 20, 12, "#6a4418"); P(x1 - 34, F - 12, 20, 4, "#9a6a24"); P(x1 - 26, F - 8, 4, 3, "#ffe07a");
      for (let i = 0; i < 26; i++) { const px = x0 + 10 + hash(seed, i) * 34, ph = 1 + ((hash(i, seed) * 7) | 0); P(px, F - ph, 2, ph, i % 3 ? "#c8902a" : "#ffe07a"); }
      P(x0 + 50, F - 9, 6, 9, "#8a8090"); P(x0 + 51, F - 13, 4, 4, "#a8a0b0");
      break;
    case "nest":
      for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI; P(M + Math.cos(t) * 26, F - 3 - Math.sin(t) * 7, 3, 2, a % 2 ? "#4a3a24" : "#6a5232"); }
      P(M - 24, F - 4, 48, 4, "#4a3a24");
      P(M - 7, F - 11, 5, 7, "#d8ccb0"); P(M + 2, F - 10, 5, 6, "#c8bca0"); P(M - 2, F - 9, 1, 1, "#4a3a24");
      break;
    case "web":
      for (const [sx, dx] of [[x0 + 4, 1], [x1 - 5, -1]]) for (let k = 0; k < 22; k++) {
        P(sx + dx * k, top + 14 + k, 1, 1, "#a8a8bc"); if (k % 7 === 6) for (let j = 0; j < k; j++) P(sx + dx * j, top + 14 + k, 1, 1, "#6a6a80");
        P(sx, top + 14 + k, 1, 1, "#7a7a90"); P(sx + dx * k, top + 14, 1, 1, "#7a7a90");
      }
      break;
    case "lava":
      P(x0 + 4, F - 8, iw - 8, 8, "#a02a0c"); P(x0 + 4, F - 8, iw - 8, 2, "#ff7a22");
      for (let i = 0; i < 6; i++) { let px = x0 + 8 + hash(seed, i) * (iw - 14), py = top + 12; for (let k = 0; k < 14; k++) { P(px, py, 1, 2, "#6a1a0a"); px += hash(k, i) * 3 - 1.5; py += 2; } }
      break;
    case "icecave":
      for (let i = 0; i < 12; i++) { const px = x0 + 6 + ((hash(seed, i) * (iw - 8)) | 0), ln = 4 + ((hash(i, seed) * 14) | 0); for (let k = 0; k < ln; k++) P(px, top + 10 + k, k < ln * 0.5 ? 3 : k < ln * 0.8 ? 2 : 1, 1, k < 2 ? "#d0eeff" : "#7ab8e8"); }
      P(x0 + 4, F - 2, iw - 8, 2, "#a8d8f8");
      break;
    case "altar":
      P(M - 12, F - 16, 24, 16, "#3a2e5a"); P(M - 14, F - 18, 28, 3, "#5a4a8a"); P(M - 3, F - 34, 6, 10, "#a87ae8"); P(M - 1, F - 36, 2, 2, "#ffffff");
      for (let i = 0; i < 4; i++) P(M - 16 + i * 10, F - 21, 2, 3, "#e8d8b0");
      break;
    case "dark":
      for (let i = 0; i < 30; i++) P(x0 + 6 + hash(seed, i) * (iw - 10), top + 12 + hash(i, seed) * (h - 16), 3, 1, "#1a0e2a");
      break;
    case "mushroom":
      for (let i = 0; i < 8; i++) { const px = x0 + 8 + hash(seed, i) * (iw - 14), hh = 4 + ((hash(i, seed) * 9) | 0); P(px + 1, F - hh, 2, hh, "#c8bca8"); P(px - 2, F - hh - 3, 7, 3, i % 2 ? "#a02a4a" : "#6a3aa8"); P(px, F - hh - 3, 1, 1, "#ffffff"); }
      break;
    case "library": case "secret":
      for (let i = 0; i < Math.floor((iw - 8) / 18); i++) { P(x0 + 6 + i * 18, top + 18, 16, h - 20, "#2e1e14"); for (let sy = top + 20; sy < F - 6; sy += 11) for (let k = 0; k < 7; k++) P(x0 + 7 + i * 18 + k * 2, sy, 2, 9, ["#7a1e1e", "#1e3e7a", "#2a5a2a", "#8a7030"][(k + sy) % 4]); }
      if (type === "secret") { P(M - 2, F - 10, 3, 10, "#e8dcc0"); P(M - 1, F - 12, 1, 2, "#ffd070"); }
      break;
    case "sealed":
      P(M - 16, top + 14, 32, h - 14, "#4a3a24"); P(M - 14, top + 16, 28, h - 16, "#2a2014"); P(M - 2, F - h * 0.5, 4, 6, "#c8a040"); P(M - 1, top + 16, 2, h - 16, "#1a140c");
      for (let k = 0; k < 3; k++) P(M - 14, top + 22 + k * 14, 28, 2, "#5a4a2a");
      break;
  }
}

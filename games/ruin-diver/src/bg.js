// Drawing the cave: tile textures with lit and shaded edges, the back wall behind open space, the sky over the
// surface, and the light that falls off with depth.

import { W, H, T, MW, MH } from "./data.js";
import { AIR, DIRT, STONE, BEDROCK, GOLD, GEM, BRICK, WOOD, SOLID } from "./cave.js";

const rgb = (r, g, b) => (255 << 24) | ((Math.max(0, Math.min(255, b)) & 255) << 16) | ((Math.max(0, Math.min(255, g)) & 255) << 8) | (Math.max(0, Math.min(255, r)) & 255);
const hx = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
function h2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sh = (c, k) => rgb(c[0] * k, c[1] * k, c[2] * k);
const VAR = 4; // texture variants per material

function texSet(fn) {
  return Array.from({ length: VAR }, (_, v) => {
    const t = new Uint32Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) t[y * T + x] = fn(x, y, v);
    return t;
  });
}
function dirtTex(base, specks) {
  const b = hx(base), s = specks.map(hx);
  return (x, y, v) => {
    const n = h2(x, y, v + 10);
    let c = sh(b, 0.86 + h2(x >> 1, y >> 1, v) * 0.22);
    if (n < 0.06) c = sh(s[0], 1);
    else if (n > 0.95) c = sh(s[1], 1);
    return c;
  };
}
function stoneTex(base) {
  const b = hx(base);
  return (x, y, v) => {
    // a couple of chunky facets per tile with cracks between
    const cx = (x + (v & 1) * 5) % T, cy = (y + (v >> 1) * 7) % T;
    const crack = (cx === 9 && cy < 11) || (cy === 10 && cx > 3) || (cx === 3 && cy > 10);
    let k = 0.82 + h2(x >> 2, y >> 2, v + 30) * 0.3;
    if (crack) k = 0.55;
    else if ((cx === 10 && cy < 10) || (cy === 11 && cx > 3)) k *= 1.18;
    return sh(b, k + (h2(x, y, v + 31) - 0.5) * 0.08);
  };
}
function oreTex(baseFn, ore) {
  const o = ore.map(hx);
  return (x, y, v) => {
    const blobs = [[4, 5], [11, 9], [6, 12], [12, 3]];
    for (let i = 0; i < 3; i++) {
      const [bx, by] = blobs[(i + v) % 4], dx = x - bx, dy = y - by, d = dx * dx + dy * dy;
      if (d <= 2) return sh(o[d === 0 ? 2 : dx < 0 || dy < 0 ? 1 : 0], 1);
    }
    return baseFn(x, y, v);
  };
}
const brickTex = (x, y, v) => {
  const row = y >> 2, off = row & 1 ? 4 : 0, mortar = (y & 3) === 3 || ((x + off) & 7) === 7;
  const b = hx("#7a4a3a");
  return mortar ? sh(b, 0.5) : sh(b, 0.82 + h2((x + off) >> 3, row, v + 50) * 0.3 + ((y & 3) === 0 ? 0.12 : 0));
};
const woodTex = (x, y, v) => {
  const b = hx("#7a5230"), plank = y >> 2;
  if ((y & 3) === 3) return sh(b, 0.5);
  if ((x + plank * 5 + v * 3) % 16 === 0) return sh(b, 0.6);
  return sh(b, 0.85 + h2(x >> 2, plank, v + 60) * 0.25 + (h2(x, y, v + 61) - 0.5) * 0.1);
};

const dirtV = dirtTex("#6a4630", ["#4a2e1e", "#8a6a4a"]);
const dirtM = dirtTex("#54443c", ["#3a2e28", "#76665c"]);
const stoneV = stoneTex("#6a6a78");
const stoneM = stoneTex("#585c6c");
// [village, mine] textures per material
const TEX = {
  [DIRT]: [texSet(dirtV), texSet(dirtM)],
  [STONE]: [texSet(stoneV), texSet(stoneM)],
  [BEDROCK]: [texSet(stoneTex("#26222e")), texSet(stoneTex("#26222e"))],
  [GOLD]: [texSet(oreTex(dirtV, ["#a06a0a", "#f0b424", "#fff0a0"])), texSet(oreTex(dirtM, ["#a06a0a", "#f0b424", "#fff0a0"]))],
  [GEM]: [texSet(oreTex(stoneM, ["#1a6a8a", "#4ad0ff", "#e0ffff"])), texSet(oreTex(stoneM, ["#1a6a8a", "#4ad0ff", "#e0ffff"]))],
  [BRICK]: [texSet(brickTex), texSet(brickTex)],
  [WOOD]: [texSet(woodTex), texSet(woodTex)],
};
// the back wall: the same rock, dark and soft, behind open space
const BACK = [
  texSet((x, y, v) => sh(hx("#2a1c16"), 0.8 + h2(x >> 2, y >> 2, v + 70) * 0.35)),
  texSet((x, y, v) => sh(hx("#1e1c22"), 0.8 + h2(x >> 2, y >> 2, v + 71) * 0.35)),
];
const GRASS = hx("#4a8a3a"), GRASS_HI = hx("#8ac04a");
const SKY = ["#141030", "#2e2450", "#6a4066", "#d07a5a"].map(hx);

/** Zone for texture choice: a soft dithered seam at 100m. */
const zoneIdx = (wx, wy) => {
  const d = wy - 100 * T;
  if (d < -12) return 0;
  if (d > 12) return 1;
  return h2(wx, wy, 99) < (d + 12) / 24 ? 1 : 0;
};

/**
 * Paint the cave for a camera whose top-left is at world (camX, camY), whole pixels. dig: Map of tile index
 * to dig progress 0..1, drawn as cracks.
 */
export function drawCave(frame, cave, camX, camY, dig) {
  const C = frame.color, { tile } = cave;
  // sky above the surface
  for (let sy = 0; sy < H; sy++) {
    const wy = camY + sy;
    if (wy >= 0) break;
    const t = Math.max(0, Math.min(1, (wy + 260) / 260)) * (SKY.length - 1), i = Math.min(SKY.length - 2, Math.floor(t)), f = t - i;
    const a = SKY[i], b = SKY[i + 1], row = sy * W;
    for (let x = 0; x < W; x++) {
      const d = (h2(x + camX, wy, 3) - 0.5) * 6;
      C[row + x] = h2(x + camX, wy, 4) < 0.002 && wy < -120 ? rgb(230, 220, 240) : rgb(a[0] + (b[0] - a[0]) * f + d, a[1] + (b[1] - a[1]) * f + d, a[2] + (b[2] - a[2]) * f + d);
    }
  }
  const tx0 = Math.floor(camX / T), ty0 = Math.max(0, Math.floor(camY / T));
  const tx1 = Math.min(MW - 1, Math.floor((camX + W - 1) / T)), ty1 = Math.min(MH - 1, Math.floor((camY + H - 1) / T));
  const solidAt = (x, y) => (x < 0 || x >= MW || y >= MH ? true : y < 0 ? false : SOLID[tile[y * MW + x]]);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const m = tile[ty * MW + tx], v = (h2(tx, ty, 7) * VAR) | 0, z = zoneIdx(tx * T, ty * T);
    const ox = tx * T - camX, oy = ty * T - camY;
    if (m === AIR) {
      blit(C, BACK[z][v], ox, oy, 0, 0, 0, 0, 0, 0);
      continue;
    }
    const top = !solidAt(tx, ty - 1), bot = !solidAt(tx, ty + 1), lf = !solidAt(tx - 1, ty), rt = !solidAt(tx + 1, ty);
    blit(C, TEX[m][z][v], ox, oy, top, bot, lf, rt, ty <= 1 && top && (m === DIRT || m === GOLD), dig?.get(ty * MW + tx) ?? 0);
  }
}

function blit(C, tex, ox, oy, top, bot, lf, rt, grass, crack) {
  const x0 = Math.max(0, -ox), x1 = Math.min(T, W - ox), y0 = Math.max(0, -oy), y1 = Math.min(T, H - oy);
  for (let y = y0; y < y1; y++) {
    const row = (oy + y) * W + ox;
    for (let x = x0; x < x1; x++) {
      let c = tex[y * T + x];
      if (grass && y < 3) c = y === 0 || (y === 2 && (x * 7) % 5 === 0) ? sh(GRASS_HI, 1) : y < 2 || (x * 3) % 4 ? sh(GRASS, 1) : c;
      else if (top && y === 0) c = lighten(c, 1.35);
      else if (top && y === 1) c = lighten(c, 1.15);
      if (bot && y >= T - 2) c = lighten(c, y === T - 1 ? 0.45 : 0.7);
      if (lf && x === 0) c = lighten(c, 0.6);
      if (rt && x === T - 1) c = lighten(c, 0.6);
      if (crack > 0 && CRACK[Math.min(3, (crack * 4) | 0)][y * T + x]) c = lighten(c, 0.35);
      C[row + x] = c;
    }
  }
}
const lighten = (c, k) => rgb((c & 255) * k, ((c >>> 8) & 255) * k, ((c >>> 16) & 255) * k);
// four stages of cracks, each adding to the last
const CRACK = (() => {
  const lines = [
    [[8, 8, 4, 3], [8, 8, 12, 5]],
    [[8, 8, 3, 12], [12, 5, 14, 2]],
    [[8, 8, 13, 13], [4, 3, 1, 6], [3, 12, 6, 15]],
    [[8, 8, 8, 1], [13, 13, 15, 10], [1, 6, 2, 9], [8, 8, 9, 15]],
  ];
  const out = [];
  let acc = new Uint8Array(T * T);
  for (const set of lines) {
    acc = acc.slice();
    for (const [a, b, c, d] of set) {
      const n = Math.max(Math.abs(c - a), Math.abs(d - b));
      for (let i = 0; i <= n; i++) acc[Math.round(b + ((d - b) * i) / n) * T + Math.round(a + ((c - a) * i) / n)] = 1;
    }
    out.push(acc);
  }
  return out;
})();

// ---------------------------------------------------------------- light

/** How much daylight reaches world y (pixels). */
export function ambientAt(wy) {
  if (wy < 0) return 1;
  const m = wy / T;
  if (m < 3) return 0.85 - m * 0.12;
  if (m < 100) return Math.max(0.16, 0.5 - ((m - 3) / 97) * 0.34);
  return Math.max(0.07, 0.16 - ((m - 100) / 200) * 0.09);
}
export function fillAmbient(lm, camY) {
  for (let sy = 0; sy < H; sy++) lm.fill(ambientAt(camY + sy), sy * W, sy * W + W);
}
/** Add a pool of light around (cx, cy), screen space: k at the center, smooth to 0 at radius r. */
export function addLight(lm, cx, cy, r, k) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy, row = y * W;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const f = 1 - d2 / r2;
      lm[row + x] += k * f * f;
    }
  }
}
/** Color times light, plus the frame's additive glow, into RGBA bytes. Light steps a little: pixel-art banding. */
export function compositeLit(frame, lm, out) {
  const C = frame.color, L = frame.light, n = W * H;
  for (let i = 0; i < n; i++) {
    const c = C[i], l = L[i];
    let k = lm[i];
    k = k > 1.25 ? 1.25 : Math.round(k * 10) / 10;
    let r = (c & 255) * k, g = ((c >>> 8) & 255) * k, b = ((c >>> 16) & 255) * k;
    if (l) { r += l & 255; g += (l >>> 8) & 255; b += (l >>> 16) & 255; }
    const j = i << 2;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
  }
}

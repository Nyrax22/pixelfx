// The shaft: tiling wall textures for each zone, the sky over the surface, and the light that falls off with depth.

import { W, H, SHAFT_L, SHAFT_R, PX_PER_M } from "./data.js";

const TH = 128;                         // texture height; every texture tiles vertically
const SW = SHAFT_R - SHAFT_L, WW = SHAFT_L;
const rgb = (r, g, b) => (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
const hx = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
function h2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// periodic value noise, so textures tile
function vnoise(x, y, per, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const g = (a, b) => h2(((a % per) + per) % per, ((b % per) + per) % per, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
}
const shadeC = (c, k) => rgb(Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k));

function tex(w, fn) {
  const t = new Uint32Array(w * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < w; x++) t[y * w + x] = fn(x, y);
  return t;
}
const mirror = (t, w) => {
  const m = new Uint32Array(t.length);
  for (let y = 0; y < TH; y++) for (let x = 0; x < w; x++) m[y * w + x] = t[y * w + (w - 1 - x)];
  return m;
};

// ---- the fallen village: brick at the back, big mossy stones either side
const vBack = tex(SW, (x, y) => {
  const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, bx = Math.floor((x + off) / 16);
  const mortar = y % 8 === 7 || (x + off) % 16 === 15;
  const base = hx("#3e3040"), k = 0.85 + h2(bx, row, 3) * 0.3 + (h2(x, y, 4) - 0.5) * 0.12;
  if (mortar) return shadeC(base, 0.55);
  if (y % 8 === 0) return shadeC(base, k * 1.12);
  return shadeC(base, k);
});
const vWallL = tex(WW, (x, y) => {
  const row = Math.floor(y / 16), off = row % 2 ? 12 : 0, bx = Math.floor((x + off) / 24);
  const lx = (x + off) % 24, ly = y % 16;
  const base = hx("#5e4e58");
  let k = 0.82 + h2(bx, row, 7) * 0.3 + (vnoise(x / 3, y / 3, 1000, 2) - 0.5) * 0.18;
  if (lx === 23 || ly === 15) k = 0.42;
  else if (lx === 0 || ly === 0) k *= 1.22;
  else if (lx === 22 || ly === 14) k *= 0.75;
  let c = shadeC(base, k);
  if (ly <= 2 && lx < 23 && h2(x, y, 9) < 0.35 + (2 - ly) * 0.15) c = shadeC(hx("#4a7a3a"), 0.75 + h2(x, y, 10) * 0.4);
  // darker toward the shaft: the wall turns away from the light
  if (x > WW - 7) c = shadeC([c & 255, (c >>> 8) & 255, (c >>> 16) & 255], 0.55 + (WW - 1 - x) * 0.06);
  return c;
});
const vWallR = mirror(vWallL, WW);

// ---- the mine: raw rock at the back with ore flecks, timbered walls
const mBack = tex(SW, (x, y) => {
  const n = vnoise(x / 9, y / 9, Math.round(SW / 9), 11) * 0.6 + vnoise(x / 3, y / 3, SW / 3, 12) * 0.4;
  const base = hx("#2e2620");
  let c = shadeC(base, 0.7 + n * 0.6);
  if (h2(x, y, 13) < 0.006) c = rgb(200, 120, 60);
  else if (h2(x, y, 14) < 0.004) c = rgb(120, 200, 220);
  return c;
});
const mWallL = tex(WW, (x, y) => {
  const n = vnoise(x / 7, y / 7, 1000, 21) * 0.65 + vnoise(x / 2.5, y / 2.5, 1000, 22) * 0.35;
  let c = shadeC(hx("#4a3c32"), 0.62 + n * 0.62);
  // a timber post along the shaft edge and a beam every 64 px
  if (x >= WW - 12 && x < WW - 2) {
    const g = vnoise(x * 0.8, y / 10, 1000, 23);
    c = shadeC(hx("#6a4424"), x === WW - 12 || x === WW - 3 ? 0.5 : 0.8 + g * 0.35);
  } else if (y % 64 < 6) {
    c = shadeC(hx("#6a4424"), y % 64 === 0 || y % 64 === 5 ? 0.5 : 0.85 + vnoise(x / 10, y, 1000, 24) * 0.3);
  }
  if (x >= WW - 2) c = shadeC(hx("#1c1410"), 1);
  if (h2(x, y, 25) < 0.004) c = rgb(220, 140, 70);
  return c;
});
const mWallR = mirror(mWallL, WW);

const ZT = [
  { back: vBack, l: vWallL, r: vWallR },
  { back: mBack, l: mWallL, r: mWallR },
];
const BOUNDARY = 100 * PX_PER_M;
const SKY = ["#1b1530", "#3a2a4a", "#7a4a5a", "#d07a5a"].map(hx);
const EARTH = hx("#3a2a22"), GRASS = hx("#4a7a3a"), GRASS_HI = hx("#7ab04a");
export const SURFACE = -14;

function skyRow(wy) {
  const t = Math.max(0, Math.min(1, (wy + 220) / 206)) * (SKY.length - 1), i = Math.min(SKY.length - 2, Math.floor(t)), f = t - i;
  const a = SKY[i], b = SKY[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Paint the background for a camera whose top edge is at world y camY (whole pixels). */
export function drawBackground(frame, camY) {
  const C = frame.color;
  for (let sy = 0; sy < H; sy++) {
    const wy = camY + sy, row = sy * W;
    if (wy < SURFACE) {
      const s = skyRow(wy);
      for (let x = 0; x < W; x++) {
        // a few stars high up, and a gentle dither between sky bands
        const d = (h2(x, wy, 31) - 0.5) * 6;
        C[row + x] = h2(x, wy, 32) < 0.0015 && wy < -120 ? rgb(230, 220, 240) : rgb(s[0] + d, s[1] + d, s[2] + d);
      }
      continue;
    }
    const ty = ((Math.floor(wy) % TH) + TH) % TH;
    const by = ((Math.floor(wy * 0.7) % TH) + TH) % TH; // the back wall scrolls slower: depth
    const near = wy - BOUNDARY;
    let z = wy < BOUNDARY ? 0 : 1;
    const blend = Math.abs(near) < 18;
    const T = ZT[z];
    if (!blend) {
      C.set(T.l.subarray(ty * WW, ty * WW + WW), row);
      C.set(T.back.subarray(by * SW, by * SW + SW), row + SHAFT_L);
      C.set(T.r.subarray(ty * WW, ty * WW + WW), row + SHAFT_R);
    } else {
      const f = (near + 18) / 36;
      for (let x = 0; x < W; x++) {
        const Z = ZT[h2(x, wy, 41) < f ? 1 : 0];
        C[row + x] = x < SHAFT_L ? Z.l[ty * WW + x] : x < SHAFT_R ? Z.back[by * SW + x - SHAFT_L] : Z.r[ty * WW + x - SHAFT_R];
      }
    }
    if (wy < 0) {
      // the ground at the surface: grass on top, earth below, the shaft open in the middle
      for (let x = 0; x < W; x++) {
        if (x >= SHAFT_L && x < SHAFT_R) {
          C[row + x] = shadeC(hx("#1c1418"), 1);
          continue;
        }
        const d = wy - SURFACE;
        const tuft = h2(x, 0, 51) < 0.3 ? 1 : 0;
        C[row + x] = d < 2 + tuft ? shadeC(d === 0 ? GRASS_HI : GRASS, 0.9 + h2(x, wy, 52) * 0.2) : shadeC(EARTH, 0.8 + h2(x, wy, 53) * 0.3);
      }
    }
  }
}

// ---------------------------------------------------------------- light

/** How much daylight reaches world y. */
export function ambientAt(wy) {
  if (wy < SURFACE) return 1;
  const m = wy / PX_PER_M;
  if (m < 0) return 0.9;
  if (m < 100) return 0.62 - (m / 100) * 0.42;
  return Math.max(0.09, 0.2 - ((m - 100) / 200) * 0.11);
}

export function fillAmbient(lm, camY) {
  for (let sy = 0; sy < H; sy++) {
    const a = ambientAt(camY + sy);
    lm.fill(a, sy * W, sy * W + W);
  }
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

/** Color times light, plus the frame's additive glow, into RGBA bytes. Light is quantized a little: pixel-art banding. */
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

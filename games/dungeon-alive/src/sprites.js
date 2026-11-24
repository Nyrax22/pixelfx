// Pixel sprites drawn in code: chibi adventurers, card icons, room floors, the heart.
// Each sprite is painted into a small buffer, given a one-pixel ink outline, then cached as a canvas.

const cache = new Map();
export const INK = "#140c1c";

/** A tiny pixel buffer with a few drawing helpers. */
export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.p[y * this.w + x] : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  hline(x, y, w, c) { this.rect(x, y, w, 1, c); }
  vline(x, y, h, c) { this.rect(x, y, 1, h, c); }
  oval(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
  /** Ink every empty pixel that touches a filled one. */
  outline(c = INK, diag = false) {
    const src = this.p.slice();
    const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : null);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x]) continue;
        const n = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || (diag && (at(x - 1, y - 1) || at(x + 1, y + 1) || at(x + 1, y - 1) || at(x - 1, y + 1)));
        if (n && n !== c) this.p[y * this.w + x] = c;
      }
    return this;
  }
  canvas(scale = 1) {
    const cv = document.createElement("canvas");
    cv.width = this.w * scale; cv.height = this.h * scale;
    const g = cv.getContext("2d");
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.p[y * this.w + x];
        if (c) { g.fillStyle = c; g.fillRect(x * scale, y * scale, scale, scale); }
      }
    return cv;
  }
}
const memo = (k, f) => {
  if (!cache.has(k)) cache.set(k, f());
  return cache.get(k);
};

// ---------------------------------------------------------------- adventurers
const SKIN = "#f2c49a", SKIN2 = "#cf8f6a", EYE = "#1a1020", WHITE = "#fffaf0";
export const CLASS_PAL = {
  warrior: { a: "#c8323a", A: "#7a1a26", l: "#f0705a", hat: "#b8c0d0", Hat: "#6a7088" },
  rogue: { a: "#3a9a4a", A: "#1f5a2e", l: "#7ad06a", hat: "#2f7a3c", Hat: "#1a4a26" },
  mage: { a: "#3a5ad0", A: "#22307a", l: "#7aa0ff", hat: "#3a5ad0", Hat: "#22307a" },
  cleric: { a: "#ece8de", A: "#a8a296", l: "#ffffff", hat: "#ece8de", Hat: "#a8a296" },
  boss: { a: "#c0c8d8", A: "#6a7088", l: "#eef2ff", hat: "#c0c8d8", Hat: "#6a7088" },
  knight: { a: "#c0c8d8", A: "#6a7088", l: "#eef2ff", hat: "#c0c8d8", Hat: "#6a7088" },
  villager: { a: "#b08850", A: "#6e5030", l: "#d8b070", hat: "#6e4a2a", Hat: "#4a301a" },
  sealmage: { a: "#283c8c", A: "#141e4a", l: "#e8ecff", hat: "#283c8c", Hat: "#141e4a" },
  traitor: { a: "#5a1a6a", A: "#2e0a38", l: "#d8b040", hat: "#d8b040", Hat: "#8a6a20" },
};

/**
 * A full-height figure, 24x44 with feet at (12, 43): helmets and hoods instead of faces,
 * capes, crests, real weapons. mood: walk | scared (weapon dropped, running) | cheer (weapon raised).
 * The figure fills the bottom 36 rows; the rows above are headroom for plumes, banners and staffs.
 */
export const HERO_H = 36;
const ST = ["#e4e8f0", "#a8b0c2", "#6a7290", "#3c4258", "#22263a"];
const DARK_ST = ["#9aa0b4", "#5c6278", "#3a3e52", "#24273a", "#14161f"];
const WHITE_ST = ["#fbf8ee", "#d8d0b8", "#a49a80", "#6e6652", "#3e3a2e"];
const HERO_PAL = {
  warrior: { st: ST, tab: ["#b0202e", "#781424"], trim: "#e8c050", cape: ["#7a1420", "#4a0a14"] },
  knight: { st: ST, tab: ["#2a4aa0", "#1a2e6a"], trim: "#e8c050", cape: ["#1e3478", "#101c48"] },
  bannerman: { st: ST, tab: ["#2a4aa0", "#1a2e6a"], trim: "#e8c050", cape: ["#1e3478", "#101c48"], banner: true },
  boss: { st: DARK_ST, tab: ["#3a1050", "#22082e"], trim: "#c8a040", cape: ["#3a0c4a", "#1c0626"], horns: true, eyes: "#ff3030" },
  cleric: { st: WHITE_ST, tab: ["#f6f2e8", "#d0c8b4"], trim: "#e8c040", cape: ["#e8e0cc", "#b0a888"], cross: true },
};
const EYE_GLOW = { rogue: "#d8ff5a", mage: "#7ad8ff", sealmage: "#bff4ff" };

function armored(px, P, f, mood, cls) {
  const s = P.st, a = f ? 1 : 0, Y = 11; // Y: top of the figure in the canvas
  const up = mood === "cheer", lost = mood === "scared";
  // cape, behind everything
  px.rect(8, Y + 10, 9, 17, P.cape[0]); px.rect(7, Y + 15, 2, 12, P.cape[1]); px.rect(16, Y + 14, 2, 12, P.cape[1]);
  for (let i = 0; i < 5; i++) px.set(7 + i * 2, Y + 27 + (i % 2), P.cape[1]);
  // legs: greaves and sabatons
  px.rect(9 + a, Y + 21, 3, 10, s[2]); px.rect(9 + a, Y + 21, 1, 10, s[1]); px.rect(8 + a, Y + 31, 5, 2, s[3]);
  px.rect(12 - a, Y + 21, 3, 10, s[1]); px.rect(12 - a, Y + 21, 1, 10, s[0]); px.rect(12 - a, Y + 31, 5, 2, s[2]);
  px.rect(9 + a, Y + 25, 3, 1, s[3]); px.rect(12 - a, Y + 25, 3, 1, s[2]);
  // breastplate and tabard
  px.rect(8, Y + 10, 9, 11, s[1]); px.rect(8, Y + 10, 2, 11, s[2]);
  px.rect(9, Y + 12, 7, 12, P.tab[0]); px.rect(9, Y + 12, 1, 12, P.tab[1]); px.hline(9, Y + 12, 7, P.trim);
  for (let i = 0; i < 4; i++) px.set(9 + i * 2, Y + 23 + (i % 2), P.tab[1]);
  if (P.cross) { px.rect(12, Y + 14, 1, 7, P.trim); px.rect(10, Y + 16, 5, 1, P.trim); }
  else { px.rect(11, Y + 15, 3, 3, P.trim); px.set(12, Y + 16, P.tab[1]); }
  px.hline(8, Y + 20, 9, "#3a2418"); px.set(12, Y + 20, P.trim);
  // pauldrons and gorget
  px.rect(6, Y + 9, 4, 3, s[0]); px.hline(6, Y + 11, 4, s[2]);
  px.rect(15, Y + 9, 4, 3, s[1]); px.hline(15, Y + 11, 4, s[3]);
  px.rect(10, Y + 8, 5, 2, s[2]);
  // the helm: no face, a slit, a glint
  px.rect(9, Y + 1, 7, 8, s[1]); px.rect(9, Y + 1, 2, 8, s[0]); px.rect(15, Y + 1, 1, 8, s[2]);
  px.set(9, Y + 1, null); px.set(15, Y + 1, null); px.hline(10, Y, 5, s[1]);
  px.hline(10, Y + 4, 5, "#06040a"); px.set(13, Y + 4, P.eyes ?? "#ff6a50");
  if (P.eyes) px.set(11, Y + 4, P.eyes);
  px.set(12, Y + 6, s[3]); px.set(14, Y + 6, s[3]); px.vline(12, Y + 1, 3, s[2]);
  if (P.horns) { px.line(9, Y + 2, 6, Y - 3, s[0]); px.line(8, Y + 2, 5, Y - 2, s[2]); px.line(15, Y + 2, 18, Y - 3, s[0]); px.line(16, Y + 2, 19, Y - 2, s[2]); }
  else if (P.cross) { px.rect(10, Y - 3, 5, 4, WHITE_ST[1]); px.rect(11, Y - 5, 3, 2, WHITE_ST[1]); px.vline(12, Y - 5, 5, P.trim); }
  else { px.rect(11, Y - 3, 3, 3, P.tab[0]); px.rect(12, Y - 5, 3, 2, P.tab[0]); px.set(14, Y - 6, P.tab[1]); }
  if (lost) return;
  // shield on the far arm
  px.rect(4, Y + 11, 6, 8, P.tab[0]); px.rect(5, Y + 19, 4, 2, P.tab[0]); px.rect(6, Y + 21, 2, 1, P.tab[0]);
  px.vline(4, Y + 11, 8, P.trim); px.hline(4, Y + 11, 6, P.trim); px.rect(6, Y + 13, 2, 4, P.trim);
  // weapon in the near hand
  if (cls === "cleric") {
    if (up) { px.vline(17, Y - 6, 18, "#6a4a2a"); px.rect(15, Y - 9, 6, 4, s[1]); px.hline(15, Y - 9, 6, P.trim); }
    else { px.vline(18, Y + 10, 16, "#6a4a2a"); px.rect(16, Y + 7, 6, 4, s[1]); px.hline(16, Y + 7, 6, P.trim); px.rect(17, Y + 15, 2, 2, s[2]); }
  } else if (up) {
    px.vline(18, Y - 8, 18, s[0]); px.vline(19, Y - 7, 16, s[2]); px.rect(16, Y + 9, 6, 1, P.trim); px.rect(17, Y + 10, 3, 2, s[2]);
  } else {
    px.rect(17, Y + 14, 3, 3, s[2]);
    px.line(18, Y + 17, 22, Y + 29, s[0]); px.line(19, Y + 17, 23, Y + 28, s[2]); px.rect(16, Y + 16, 5, 1, P.trim);
  }
  if (P.banner) {
    // a banner bearer: the kingdom's colours above the march
    px.vline(19, 0, Y + 18, "#6a4a2a");
    px.rect(20, 1, 4, 10, P.tab[0]); px.vline(20, 1, 10, P.trim); px.set(22, 5, P.trim); px.set(22, 6, P.trim);
    px.set(21, 11, P.tab[1]); px.set(23, 11, P.tab[1]);
  }
}

function robed(px, cls, f, mood) {
  const Y = 11, a = f ? 1 : 0;
  const isSeal = cls === "sealmage";
  const R = isSeal ? ["#e8eef8", "#a8b8d8", "#6a7ca8"] : ["#2e44a0", "#1c2a6a", "#101a44"];
  const trim = isSeal ? "#7ad8ff" : "#e8c050";
  // robe widening to the floor, hem swaying with the step
  for (let y = 0; y < 23; y++) { const w = 9 + Math.floor(y / 3); px.hline(12 - Math.floor(w / 2) + (y > 18 ? a : 0), Y + 10 + y, w, y % 7 === 6 ? R[2] : R[1]); }
  px.vline(12, Y + 12, 20, R[0]);
  for (let y = 14; y < 31; y += 4) px.set(12, Y + y, trim);
  px.hline(8 + a, Y + 32, 9, trim);
  // pointed hood with a dark face and two eyes
  px.rect(9, Y + 1, 7, 9, R[1]); px.rect(10, Y - 1, 5, 2, R[1]); px.rect(12, Y - 3, 3, 2, R[1]); px.set(15, Y - 4, R[1]);
  px.rect(10, Y + 3, 5, 5, "#05040a"); px.set(11, Y + 5, EYE_GLOW[cls]); px.set(13, Y + 5, EYE_GLOW[cls]);
  px.rect(8, Y + 9, 9, 2, R[0]);
  if (mood === "scared") return;
  // staff with a glowing stone
  const sx = mood === "cheer" ? 18 : 19;
  px.vline(sx, Y - (mood === "cheer" ? 8 : 2), 36, isSeal ? "#d0d8ff" : "#5a3a1a");
  px.rect(sx - 1, Y - (mood === "cheer" ? 11 : 5), 3, 3, isSeal ? "#bff4ff" : "#ff5a8a"); px.set(sx, Y - (mood === "cheer" ? 10 : 4), "#ffffff");
  px.rect(17, Y + 15, 2, 2, R[2]);
}

function hooded(px, f, mood) {
  // the rogue: a dark cloak, a mask, two eyes in the shadow, two knives
  const Y = 11, a = f ? 1 : 0, C = ["#2f4436", "#1e2a22", "#121a14"];
  px.rect(9 + a, Y + 20, 3, 11, "#2a2218"); px.rect(13 - a, Y + 20, 3, 11, "#3a3022"); px.rect(8 + a, Y + 31, 4, 2, "#1a140c"); px.rect(13 - a, Y + 31, 4, 2, "#241c12");
  px.rect(8, Y + 9, 10, 13, C[1]); px.rect(7, Y + 12, 2, 12, C[2]); px.rect(17, Y + 11, 2, 11, C[2]);
  for (let i = 0; i < 6; i++) px.set(7 + i * 2, Y + 24 + (i % 2), C[2]);
  px.rect(10, Y + 12, 5, 8, "#3a3022"); px.hline(10, Y + 17, 5, "#1a140c");
  px.rect(9, Y + 1, 8, 9, C[0]); px.rect(10, Y, 6, 1, C[0]); px.rect(8, Y + 4, 1, 6, C[1]);
  px.rect(11, Y + 3, 5, 5, "#04060a"); px.set(12, Y + 4, EYE_GLOW.rogue); px.set(14, Y + 4, EYE_GLOW.rogue);
  px.rect(11, Y + 6, 5, 2, "#3a4a3a");
  if (mood === "scared") return;
  px.rect(17, Y + 14, 2, 2, "#3a3022"); px.line(19, Y + 13, 21, Y + 9, "#e4e8f0"); px.set(19, Y + 15, "#6a4a2a");
  px.rect(6, Y + 15, 2, 2, "#3a3022"); px.line(5, Y + 17, 4, Y + 21, "#c8ccd8");
}

function commoner(px, cls, f) {
  // villagers, and the chancellor in his robes of state
  const Y = 11, a = f ? 1 : 0, tr = cls === "traitor";
  const C = tr ? ["#4a1460", "#2e0a3c", "#d8b040"] : ["#8a6a40", "#5e4628", "#c8a870"];
  if (tr) { for (let y = 0; y < 22; y++) px.hline(8 - (y > 12 ? 1 : 0), Y + 11 + y, 9 + (y > 12 ? 2 : 0), y % 6 === 5 ? C[1] : C[0]); px.vline(12, Y + 11, 22, C[2]); px.hline(8, Y + 13, 9, C[2]); px.rect(7, Y + 10, 11, 3, "#e8e0d0"); }
  else { px.rect(9 + a, Y + 21, 3, 10, "#4a3a2a"); px.rect(12 - a, Y + 21, 3, 10, "#5a4834"); px.rect(9 + a, Y + 31, 3, 2, "#2a1e14"); px.rect(12 - a, Y + 31, 3, 2, "#2a1e14"); px.rect(8, Y + 10, 9, 12, C[0]); px.hline(8, Y + 18, 9, C[1]); }
  px.rect(10, Y + 2, 5, 7, "#e8c0a0"); px.rect(10, Y + 2, 5, 2, tr ? "#3a2a2a" : "#4a3020"); px.set(11, Y + 5, "#1a1018"); px.set(13, Y + 5, "#1a1018");
  if (tr) { px.hline(11, Y + 7, 3, "#6a2020"); px.set(14, Y + 6, "#6a2020"); px.rect(11, Y + 8, 3, 2, "#3a2a2a"); px.rect(9, Y, 7, 2, C[2]); px.set(9, Y - 1, C[2]); px.set(12, Y - 2, C[2]); px.set(15, Y - 1, C[2]); px.set(12, Y - 1, "#e03040"); }
}

export function chibi(cls, frame = 0, mood = "walk") {
  return memo(`hero:${cls}:${frame}:${mood}`, () => {
    const px = new Pix(24, 44);
    const P = HERO_PAL[cls];
    if (P) armored(px, P, frame, mood, cls);
    else if (cls === "mage" || cls === "sealmage") robed(px, cls, frame, mood);
    else if (cls === "rogue") hooded(px, frame, mood);
    else commoner(px, cls, frame);
    const cv = px.outline("#06040a").canvas();
    cv.vh = HERO_H;
    return cv;
  });
}

/** A cartoon ghost for adventurers who didn't make it: angry little face. */
export function angryGhost() {
  return memo("angryGhost", () => {
    const px = new Pix(16, 18);
    px.oval(8, 7, 6, 6, "#e8ecff"); px.rect(2, 7, 12, 8, "#e8ecff");
    for (let i = 0; i < 4; i++) px.rect(2 + i * 3, 15, 2, 2, "#c8d0f0");
    px.line(4, 5, 6, 6, EYE); px.line(12, 5, 10, 6, EYE);
    px.rect(5, 7, 1, 2, EYE); px.rect(10, 7, 1, 2, EYE);
    px.hline(6, 11, 4, EYE); px.set(5, 12, EYE); px.set(10, 12, EYE);
    return px.outline("#3a4a80").canvas();
  });
}

// ---------------------------------------------------------------- card icons (24x24)
const ICONS = {
  spike(px) {
    px.rect(2, 18, 20, 4, "#4a4458"); px.hline(2, 18, 20, "#6a6480");
    for (let i = 0; i < 5; i++) { const x = 3 + i * 4; for (let j = 0; j < 7; j++) px.hline(x + (j >> 1) - 0, 17 - j, Math.max(1, 3 - (j >> 1)), j < 2 ? "#9aa0b4" : "#d8dde8"); px.set(x + 1, 10, "#ffb04a"); }
  },
  zap(px) {
    px.rect(2, 17, 20, 5, "#3a3448"); px.hline(2, 17, 20, "#5a5470");
    px.rect(9, 9, 6, 9, "#5a5470"); px.rect(10, 8, 4, 1, "#8a84a0");
    px.line(12, 1, 8, 7, "#ffe24a"); px.line(8, 7, 14, 7, "#ffe24a"); px.line(14, 7, 10, 13, "#fff6b0");
    px.set(5, 15, "#ffe24a"); px.set(19, 14, "#ffe24a");
  },
  flame(px) {
    px.rect(4, 18, 16, 4, "#3a3040"); for (let i = 0; i < 4; i++) px.vline(6 + i * 4, 18, 4, "#1a1420");
    px.oval(12, 12, 6, 7, "#d4451a"); px.oval(12, 13, 4, 5, "#ff8a2a"); px.oval(12, 15, 2, 3, "#ffe26b");
    px.set(9, 4, "#ff8a2a"); px.set(15, 5, "#ffc65a"); px.set(12, 2, "#ff8a2a");
  },
  frost(px) {
    px.oval(12, 18, 10, 4, "#14304e"); px.oval(12, 18, 8, 3, "#215a86");
    px.vline(12, 3, 15, "#c2ecff"); px.line(5, 7, 19, 15, "#c2ecff"); px.line(19, 7, 5, 15, "#c2ecff");
    px.set(12, 11, "#ffffff"); px.set(12, 3, "#ffffff");
  },
  gas(px) {
    px.rect(6, 18, 12, 4, "#3a3448"); px.rect(9, 16, 6, 2, "#5a5470");
    px.oval(8, 10, 5, 4, "#4b8a2a"); px.oval(15, 8, 6, 5, "#6abf3a"); px.oval(11, 4, 4, 3, "#a6f06a");
  },
  boulder(px) {
    px.vline(12, 0, 6, "#8a6a40"); px.oval(12, 12, 8, 7, "#6e5a4a"); px.oval(10, 10, 5, 4, "#8e7a66"); px.set(8, 8, "#b0a090");
    px.oval(12, 21, 8, 2, "#2a2030");
  },
  arrow(px) {
    px.rect(6, 16, 12, 6, "#4a4458"); px.hline(6, 16, 12, "#6a6480");
    px.rect(10, 9, 4, 7, "#2a8a90"); px.hline(3, 9, 18, "#4fe0e8"); px.set(3, 8, "#4fe0e8"); px.set(20, 8, "#4fe0e8");
    px.line(12, 3, 12, 9, "#d8dde8"); px.set(11, 4, "#d8dde8"); px.set(13, 4, "#d8dde8");
  },
  crystal(px) {
    px.rect(8, 19, 8, 3, "#4a4458");
    for (let j = 0; j < 8; j++) px.hline(12 - j, 2 + j, j * 2 + 1, j < 3 ? "#a8fff8" : "#4fe0e8");
    for (let j = 0; j < 6; j++) px.hline(5 + j, 10 + j, 14 - j * 2, "#1fa8b0");
    px.set(10, 5, "#ffffff");
  },
  tesla(px) {
    px.rect(9, 6, 6, 16, "#4a4458"); for (let i = 0; i < 3; i++) px.rect(7, 8 + i * 4, 10, 2, "#2a8a90");
    px.oval(12, 4, 4, 3, "#4fe0e8"); px.set(12, 3, "#ffffff"); px.line(16, 3, 21, 1, "#a8fff8"); px.line(8, 3, 3, 0, "#a8fff8");
  },
  wall(px) {
    px.rect(2, 8, 20, 14, "#5a5470"); for (let y = 8; y < 22; y += 4) px.hline(2, y, 20, "#3a3448");
    for (let i = 0; i < 5; i++) { px.vline(4 + i * 4, 3, 5, "#4fe0e8"); px.set(4 + i * 4, 2, "#a8fff8"); }
  },
  totem(px) {
    px.rect(6, 18, 12, 4, "#4a4458"); px.rect(7, 5, 10, 13, "#6a6480"); px.rect(6, 4, 12, 3, "#8a84a0");
    px.rect(8, 9, 2, 2, "#4fe0e8"); px.rect(14, 9, 2, 2, "#4fe0e8"); px.rect(9, 14, 6, 2, "#2a2438");
  },
  strike(px) {
    px.line(15, 0, 8, 11, "#ffe24a"); px.line(8, 11, 15, 11, "#ffe24a"); px.line(15, 11, 8, 23, "#fff6b0");
    px.line(16, 0, 9, 11, "#ffe24a"); px.line(16, 11, 9, 23, "#ffe24a");
  },
  scream(px) {
    px.oval(12, 11, 7, 7, "#9c86d0"); px.rect(8, 9, 3, 3, "#18122a"); px.rect(13, 9, 3, 3, "#18122a"); px.oval(12, 15, 2, 2.5, "#18122a");
    px.line(1, 6, 3, 9, "#e0d4ff"); px.line(1, 16, 3, 13, "#e0d4ff"); px.line(23, 6, 21, 9, "#e0d4ff"); px.line(23, 16, 21, 13, "#e0d4ff");
  },
  nova(px) {
    px.oval(12, 12, 10, 10, "#215a86"); ICONS.frost(px); px.oval(12, 11, 2, 2, "#ffffff");
  },
  meteor(px) {
    px.line(2, 2, 12, 12, "#ff8a2a"); px.line(4, 2, 13, 11, "#ffc65a"); px.line(2, 5, 11, 13, "#d4451a");
    px.oval(15, 15, 6, 6, "#6e3a20"); px.oval(14, 14, 3, 3, "#a0502a");
  },
  mend(px) {
    heartPix(px, 12, 13, 9, "#c81e3a", "#ff6a7a");
    px.rect(11, 8, 3, 9, "#fff6f0"); px.rect(8, 11, 9, 3, "#fff6f0");
  },
  rage(px) {
    px.oval(12, 12, 9, 9, "#a01c2c"); px.oval(12, 12, 7, 7, "#e03a44");
    px.line(7, 8, 10, 10, "#ffe0e0"); px.line(17, 8, 14, 10, "#ffe0e0"); px.rect(8, 15, 8, 2, "#ffe0e0");
  },
};
ICONS.pro_judge = (px) => { ICONS.strike(px); for (let i = 0; i < px.p.length; i++) if (px.p[i]) px.p[i] = i % 3 ? "#fff0a0" : "#ffd040"; };
ICONS.pro_meteor = (px) => ICONS.meteor(px);
ICONS.thorn = (px) => { for (const [x, h] of [[6, 12], [11, 20], [16, 15]]) for (let k = 0; k < h; k++) { const w = Math.max(1, Math.round((h - k) / 4)); px.rect(x - (w >> 1), 22 - k, w, 1, k > h - 3 ? "#ff3a4a" : k % 3 ? "#2a1220" : "#4a2232"); } px.rect(2, 22, 20, 2, "#1a0e14"); };
ICONS.pro_pillar = (px) => { px.rect(8, 2, 8, 20, "#ff8a2a"); px.rect(10, 0, 4, 22, "#ffe26b"); px.rect(11, 0, 2, 22, "#fff6d0"); };

export function cardIcon(id) {
  return memo("icon:" + id, () => {
    const px = new Pix(24, 24);
    (ICONS[id] ?? ICONS.spike)(px);
    return px.outline().canvas();
  });
}
export const hasIcon = (id) => !!ICONS[id];

// ---------------------------------------------------------------- the heart
function heartPix(px, cx, cy, s, c1, c2, c3) {
  for (let y = 0; y < px.h; y++)
    for (let x = 0; x < px.w; x++) {
      const u = (x + 0.5 - cx) / s, v = -(y + 0.5 - cy) / s + 0.25;
      const q = u * u + v * v - 0.6;
      if (q * q * q - u * u * v * v * v <= 0) {
        const hi = u < -0.2 && v > 0.25;
        px.set(x, y, hi ? c2 : v < -0.55 && c3 ? c3 : c1);
      }
    }
}
/** The heart: an organ, not an emoji. Ventricles, atria, the great vessels, veins; cracks when hurt, stone when sealed. */
export function heartSprite(s, hurt = 0, dead = 0) {
  const k = Math.round(s * 2) / 2;
  return memo(`organ:${k}:${hurt}:${dead}`, () => {
    const n = Math.ceil(k * 3.4) + 8, px = new Pix(n, n), cx = n / 2, cy = n / 2 + k * 0.35;
    const C = dead
      ? { body: "#6a6670", dark: "#48444e", hi: "#8e8a94", spec: "#b0acb6", art: "#7a7680", vein: "#3a3640", cav: "#56525c" }
      : { body: hurt ? "#86142a" : "#a8182e", dark: "#6a0c1e", hi: "#d63a4a", spec: "#ff9aa6", art: "#c84a5a", vein: "#4a0814", cav: "#4a3a8a" };
    // the great vessels first, so the muscle sits in front of them
    for (let i = 0; i < 4; i++) {
      px.line(cx - 0.15 * k + i * 0.18 * k, cy - 0.7 * k, cx - 0.55 * k + i * 0.18 * k, cy - 1.45 * k, C.cav);
      px.line(cx + 0.05 * k + i * 0.16 * k, cy - 0.7 * k, cx + 0.05 * k + i * 0.16 * k, cy - 1.35 * k, C.art);
    }
    px.oval(cx + 0.45 * k, cy - 1.32 * k, 0.55 * k, 0.22 * k, C.art);
    px.oval(cx + 0.85 * k, cy - 1.05 * k, 0.2 * k, 0.35 * k, C.art);
    px.oval(cx - 0.62 * k, cy - 1.45 * k, 0.18 * k, 0.12 * k, C.vein);
    // atria, then the two ventricles and the apex
    px.oval(cx - 0.45 * k, cy - 0.65 * k, 0.48 * k, 0.4 * k, C.dark);
    px.oval(cx + 0.45 * k, cy - 0.62 * k, 0.42 * k, 0.36 * k, C.dark);
    px.oval(cx - 0.12 * k, cy + 0.1 * k, 0.95 * k, 1.05 * k, C.body);
    px.oval(cx + 0.38 * k, cy + 0.05 * k, 0.72 * k, 0.92 * k, C.body);
    px.oval(cx - 0.2 * k, cy + 0.82 * k, 0.48 * k, 0.48 * k, C.body);
    px.oval(cx + 0.55 * k, cy + 0.25 * k, 0.42 * k, 0.65 * k, C.dark);
    px.oval(cx - 0.45 * k, cy - 0.1 * k, 0.26 * k, 0.5 * k, C.hi);
    px.set(cx - 0.55 * k, cy - 0.35 * k, C.spec); px.set(cx - 0.5 * k, cy - 0.25 * k, C.spec);
    // the coronary veins running down the front
    px.line(cx + 0.05 * k, cy - 0.55 * k, cx - 0.1 * k, cy + 0.4 * k, C.vein);
    px.line(cx - 0.1 * k, cy + 0.4 * k, cx - 0.35 * k, cy + 0.95 * k, C.vein);
    px.line(cx - 0.05 * k, cy - 0.1 * k, cx + 0.45 * k, cy + 0.35 * k, C.vein);
    px.line(cx - 0.1 * k, cy + 0.2 * k, cx - 0.6 * k, cy + 0.45 * k, C.vein);
    if (hurt || dead) {
      px.line(cx + 0.2 * k, cy - 0.5 * k, cx + 0.05 * k, cy + 0.1 * k, "#140408");
      px.line(cx + 0.05 * k, cy + 0.1 * k, cx + 0.3 * k, cy + 0.6 * k, "#140408");
      px.line(cx - 0.5 * k, cy + 0.3 * k, cx - 0.2 * k, cy + 0.55 * k, "#140408");
    }
    return px.outline(dead ? "#1a181e" : "#1a0408").canvas();
  });
}

// ---------------------------------------------------------------- small stuff
export function diaryPage() {
  return memo("diaryPage", () => {
    const px = new Pix(9, 10);
    px.rect(0, 0, 9, 10, "#efe2c0"); px.hline(2, 3, 5, "#8a7a5a"); px.hline(2, 5, 4, "#8a7a5a"); px.hline(2, 7, 5, "#8a7a5a");
    px.set(8, 0, null); px.set(8, 9, null);
    return px.outline("#5a4a30").canvas();
  });
}
export function egg(mut = false) {
  return memo("egg:" + mut, () => {
    const px = new Pix(12, 14);
    px.oval(6, 7.5, 4.6, 6, mut ? "#ffe8f8" : "#f4ead0"); px.set(4, 4, "#ffffff"); px.set(7, 9, mut ? "#ff7ab0" : "#c8b890"); px.set(5, 11, mut ? "#7ae0ff" : "#c8b890");
    return px.outline().canvas();
  });
}

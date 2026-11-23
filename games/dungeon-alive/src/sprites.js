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

/** A 20x24 chibi, feet at (10, 23). mood: walk | scared | cheer. frame: 0 or 1. */
export function chibi(cls, frame = 0, mood = "walk") {
  return memo(`chibi:${cls}:${frame}:${mood}`, () => {
    const P = CLASS_PAL[cls] ?? CLASS_PAL.villager, px = new Pix(20, 24);
    const up = mood === "scared" || mood === "cheer";
    // legs
    const lo = frame ? 1 : 0;
    px.rect(7, 20 - lo, 2, 3 + lo, P.A); px.rect(11, 20 + lo - 1, 2, 3 - lo + 1, P.A);
    px.rect(7, 22, 2, 1, "#3a2418"); px.rect(11, 22, 2, 1, "#3a2418");
    // body
    px.rect(6, 14, 8, 6, P.a);
    px.rect(6, 18, 8, 1, P.A);
    px.rect(7, 15, 1, 3, P.l);
    if (cls === "warrior" || cls === "boss" || cls === "knight") { px.rect(6, 14, 8, 2, P.hat); px.rect(9, 16, 2, 2, P.l); }
    if (cls === "cleric") { px.rect(9, 15, 2, 4, "#e8c040"); px.rect(8, 16, 4, 1, "#e8c040"); }
    if (cls === "traitor") px.rect(9, 14, 2, 6, P.l);
    // arms
    if (up) { px.rect(4, 10, 2, 5, P.a); px.rect(14, 10, 2, 5, P.a); px.rect(4, 9, 2, 2, SKIN); px.rect(14, 9, 2, 2, SKIN); }
    else { px.rect(4, 15, 2, 4, P.A); px.rect(14, 15, 2, 4, P.A); px.rect(4, 18, 2, 1, SKIN); px.rect(14, 18, 2, 1, SKIN); }
    // head
    px.oval(10, 8.5, 6.2, 5.6, SKIN);
    px.rect(5, 11, 10, 2, SKIN);
    px.hline(6, 13, 8, SKIN2);
    // face
    if (mood === "scared") {
      px.rect(6, 8, 3, 3, WHITE); px.rect(11, 8, 3, 3, WHITE); px.set(7, 9, EYE); px.set(12, 9, EYE);
      px.rect(9, 11, 2, 2, "#5a1020");
      px.rect(16, 5, 1, 2, "#7ac8ff"); px.set(16, 7, "#cfeeff");
    } else if (mood === "cheer") {
      px.hline(6, 9, 2, EYE); px.hline(12, 9, 2, EYE); px.set(5, 8, EYE); px.set(14, 8, EYE);
      px.rect(8, 11, 4, 1, "#5a1020"); px.rect(9, 12, 2, 1, "#e05060");
    } else {
      px.rect(7, 9, 1, 2, EYE); px.rect(12, 9, 1, 2, EYE);
      px.set(7, 9, "#5a4a70");
      px.hline(9, 12, 2, SKIN2);
      px.set(6, 11, "#f09a8a"); px.set(13, 11, "#f09a8a");
    }
    // hats
    if (cls === "warrior" || cls === "knight" || cls === "boss") {
      px.oval(10, 6, 6.6, 4.6, P.hat); px.rect(4, 6, 13, 2, P.hat); px.hline(4, 7, 13, P.Hat);
      px.rect(9, 7, 2, 3, P.Hat); px.set(7, 4, P.l); px.set(8, 3, P.l);
      if (cls !== "knight") { px.rect(9, 0, 2, 3, cls === "boss" ? "#e03040" : "#e8483a"); px.set(11, 0, "#ff8a6a"); }
    } else if (cls === "rogue") {
      px.oval(10, 6.5, 7, 5.6, P.hat); px.rect(3, 7, 3, 6, P.hat); px.rect(14, 7, 3, 6, P.hat);
      px.rect(6, 8, 8, 5, SKIN); px.rect(7, 9, 1, 2, EYE); px.rect(12, 9, 1, 2, EYE);
      if (mood === "scared") { px.rect(6, 8, 3, 3, WHITE); px.rect(11, 8, 3, 3, WHITE); px.set(7, 9, EYE); px.set(12, 9, EYE); px.rect(9, 11, 2, 2, "#5a1020"); }
      if (mood === "cheer") { px.rect(6, 8, 8, 5, SKIN); px.hline(6, 9, 2, EYE); px.hline(12, 9, 2, EYE); px.rect(8, 11, 4, 1, "#5a1020"); }
      px.rect(6, 12, 8, 1, P.Hat);
      px.hline(5, 4, 10, P.l);
    } else if (cls === "mage" || cls === "sealmage") {
      px.rect(2, 5, 16, 2, P.hat); px.hline(2, 6, 16, P.Hat);
      for (let i = 0; i < 6; i++) px.rect(6 + i, 4 - i, 8 - i * 2 + 1, 1, P.hat);
      px.rect(5, 4, 10, 1, P.hat); px.set(13, 0, P.hat); px.set(14, 0, P.l);
      px.hline(5, 4, 10, cls === "mage" ? "#e8c040" : P.l);
    } else if (cls === "cleric") {
      px.oval(10, 5.5, 6.4, 4, P.hat); px.rect(4, 5, 12, 2, P.hat); px.hline(4, 6, 12, P.Hat);
      px.rect(9, 1, 2, 4, "#e8c040"); px.rect(8, 2, 4, 1, "#e8c040");
    } else if (cls === "traitor") {
      px.rect(5, 3, 10, 2, P.hat); px.set(5, 2, P.hat); px.set(8, 1, P.hat); px.set(11, 1, P.hat); px.set(14, 2, P.hat);
      px.set(8, 2, "#e03040");
    } else {
      px.oval(10, 4.5, 6, 2.6, P.hat);
    }
    // weapons
    if (!up) {
      if (cls === "warrior" || cls === "knight" || cls === "boss") { px.vline(16, 9, 9, "#dfe6f0"); px.vline(17, 10, 7, "#9aa4b8"); px.rect(15, 17, 4, 1, "#8a6a30"); px.set(16, 18, "#5a3a18"); }
      if (cls === "rogue") { px.vline(16, 14, 4, "#dfe6f0"); px.rect(15, 18, 3, 1, "#5a3a18"); }
      if (cls === "mage") { px.vline(16, 6, 16, "#8a5a2a"); px.rect(15, 4, 3, 3, "#ff5a8a"); px.set(16, 4, "#ffd0e0"); }
      if (cls === "sealmage") { px.vline(16, 6, 16, "#d0d8ff"); px.rect(15, 3, 3, 3, "#7ae0ff"); }
      if (cls === "cleric") { px.vline(16, 12, 7, "#8a6a30"); px.rect(15, 10, 3, 3, "#e8c040"); }
      if (cls === "boss") { px.rect(1, 13, 4, 7, "#8a92a8"); px.rect(2, 14, 2, 5, "#e03040"); }
    }
    if (cls === "boss" || cls === "knight") px.rect(5, 19, 10, 1, cls === "boss" ? "#5a1a6a" : P.A);
    return px.outline().canvas();
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
/** The beating heart at a given swell (radius in pixels). */
export function heartSprite(s, hurt = 0) {
  const k = Math.round(s * 2) / 2;
  return memo(`heart:${k}:${hurt}`, () => {
    const n = Math.ceil(k * 3) + 4, px = new Pix(n, n);
    const c1 = hurt ? "#a01830" : "#d42040", c2 = "#ff7a8a", c3 = "#7a0c22";
    heartPix(px, n / 2, n / 2 + 1, k, c1, c2, c3);
    // veins
    if (k > 6) { px.line(n / 2 - 2, n / 2 + 3, n / 2 + 1, n / 2 - 1, "#8a1028"); px.line(n / 2 + 1, n / 2 - 1, n / 2 + 4, n / 2, "#8a1028"); }
    if (hurt) { px.line(n / 2 - 1, n / 2 - 3, n / 2 + 1, n / 2 + 2, "#2a0610"); px.line(n / 2 + 1, n / 2 + 2, n / 2 - 1, n / 2 + 4, "#2a0610"); }
    return px.outline("#2a0610").canvas();
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

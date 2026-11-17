// Painted sprites (PNG, made with PixelLab): decoded once into pixel buffers the renderer copies straight into the frame.
// Everything here is optional: until an image has loaded (or in headless tests) the game draws its old code sprites.

export const IMG = {}; // name -> { w, h, px: Uint32Array (ABGR, same byte order as the frame), url }

/** Decode a PNG data URL; trims transparent edges unless keep is set. */
export function loadImg(name, src, keep = false) {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = im.width; c.height = im.height;
      const g = c.getContext("2d");
      g.drawImage(im, 0, 0);
      let img = { w: im.width, h: im.height, px: new Uint32Array(g.getImageData(0, 0, im.width, im.height).data.buffer.slice(0)), url: src };
      if (!keep) img = trim(img);
      IMG[name] = img;
      resolve(img);
    };
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

/** A piece of an image (for sheets). */
export function crop(img, x, y, w, h) {
  const px = new Uint32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px[j * w + i] = img.px[(y + j) * img.w + x + i];
  return { w, h, px };
}
/** Cut away fully transparent rows and columns. */
export function trim(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[y * img.w + x] >>> 24 > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return img;
  const out = crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  out.url = img.url;
  return out;
}

/** Copy an image into the frame at (x, y), top-left. opts: { flip, tint (ABGR), a (0-1) } */
export function blit(frame, img, x, y, opts = {}) {
  x = Math.round(x); y = Math.round(y);
  const W = frame.w, H = frame.h, dst = frame.color, src = img.px, a = opts.a ?? 1, tint = opts.tint;
  for (let j = 0; j < img.h; j++) {
    const fy = y + j;
    if (fy < 0 || fy >= H) continue;
    for (let i = 0; i < img.w; i++) {
      const fx = x + i;
      if (fx < 0 || fx >= W) continue;
      let c = src[j * img.w + (opts.flip ? img.w - 1 - i : i)];
      const al = (c >>> 24) * a;
      if (al < 100) continue;
      if (tint !== undefined) c = tint;
      dst[fy * W + fx] = (c | 0xff000000) >>> 0;
    }
  }
}
/** Draw centred on x with its bottom on y: how things stand on floors. */
export const blitFeet = (frame, img, x, y, opts) => blit(frame, img, x - (img.w >> 1), y - img.h, opts);
export const blitMid = (frame, img, x, y, opts) => blit(frame, img, x - (img.w >> 1), y - (img.h >> 1), opts);

const urlCache = new Map();
/** A data URL of an image for the DOM, in color, dim (seen) or silhouette (unknown). */
export function imgURL(img, mode = "color") {
  if (mode === "color" && img.url && img.w === img.srcW) return img.url;
  const k = img; let m = urlCache.get(k);
  if (!m) urlCache.set(k, (m = {}));
  if (m[mode]) return m[mode];
  const c = document.createElement("canvas");
  c.width = img.w; c.height = img.h;
  const g = c.getContext("2d"), d = g.createImageData(img.w, img.h), out = new Uint32Array(d.data.buffer);
  for (let i = 0; i < img.px.length; i++) {
    const p = img.px[i];
    if (p >>> 24 < 100) continue;
    if (mode === "color") out[i] = p;
    else {
      const r = p & 255, gg = (p >> 8) & 255, b = (p >> 16) & 255, lum = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
      const v = mode === "dim" ? 40 + lum * 50 : 28 + lum * 22;
      const vv = Math.round(v);
      out[i] = (0xff << 24) | ((vv + 14) << 16) | (vv << 8) | vv;
    }
  }
  g.putImageData(d, 0, 0);
  return (m[mode] = c.toDataURL());
}

/** Load the packed atlas and cut every named sprite out of it. */
export async function loadAtlas(src, rects) {
  const sheet = await loadImg("__atlas", src, true);
  if (!sheet) return false;
  for (const [name, [x, y, w, h]] of Object.entries(rects)) IMG[name] = crop(sheet, x, y, w, h);
  // the Wang tiles of each tileset, keyed by which corners are solid (NW NE SW SE as 4 bits)
  for (const set of ["t_dirt", "t_stone"]) {
    const s = IMG[set];
    if (!s) continue;
    const tiles = new Array(16);
    for (const [key, [cx, cy]] of Object.entries(WANG)) tiles[parseInt(key, 2)] = crop(s, cx, cy, 16, 16);
    IMG[set + "_w"] = tiles;
  }
  return true;
}
// where each corner combination sits in a PixelLab sidescroller tileset (NW NE SW SE, 1 = solid)
const WANG = {
  "0010": [0, 0],
  "0101": [16, 0],
  "1011": [32, 0],
  "0011": [48, 0],
  "1001": [0, 16],
  "0111": [16, 16],
  "1111": [32, 16],
  "1110": [48, 16],
  "0100": [0, 32],
  "1100": [16, 32],
  "1101": [32, 32],
  "1010": [48, 32],
  "0000": [0, 48],
  "0001": [16, 48],
  "0110": [32, 48],
  "1000": [48, 48],
};

// Bodies in the air. The cave is solid rock with hollows carved in it; anything thrown, knocked or
// dropped flies under gravity until it hits rock: walls and floors hurt in proportion to how hard
// they are hit. The hollow test mirrors how cave.js carves the hollows (minus the ragged noise).

import { ZONES, GROUND, W, H } from "./map.js";

export const G = 620; // world units per second squared

/** The floor height of a zone at x (its floor polyline, flat beyond the ends). */
export function floorAt(z, x) {
  const p = z.path;
  if (x <= Math.min(p[0][0], p[p.length - 1][0])) return p[0][0] < p[p.length - 1][0] ? p[0][1] : p[p.length - 1][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[i + 1];
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    if (x >= lo && x <= hi && hi > lo) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return p[0][0] > p[p.length - 1][0] ? p[0][1] : p[p.length - 1][1];
}

// per zone: the dome span and the tube's segments, computed once
const SHAPES = Object.values(ZONES).filter((z) => z.kind !== "entrance").map((z) => {
  const dome = z.kind === "chamber" || z.kind === "heart" || z.kind === "secret";
  const pad = z.kind === "heart" ? 18 : 10;
  const th = Math.min(z.h, 36);
  const segs = [];
  for (let i = 0; i < z.path.length - 1; i++) {
    const [ax, ay] = z.path[i], [bx, by] = z.path[i + 1];
    segs.push([ax, ay - th / 2 + 3, bx, by - th / 2 + 3]);
  }
  const ys = z.path.map((p) => p[1]);
  return { z, dome, x0: z.x0 - pad, x1: z.x1 + pad, th, segs, top: Math.min(...ys) - z.h - 4, bot: Math.max(...ys) + 4 };
});

function segD2(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return qx * qx + qy * qy;
}

/** Is (x, y) open air inside the cave or above ground? */
export function hollowAt(rooms, x, y) {
  if (x < -70 || x > W + 70 || y > H + 40) return false;
  if (y < GROUND - 1) return true;
  for (const s of SHAPES) {
    if (y < s.top - 20 || y > s.bot + 4) continue;
    if (!rooms[s.z.id]?.open) continue;
    if (s.dome && x >= s.x0 && x <= s.x1) {
      const f = floorAt(s.z, x), hw = (s.x1 - s.x0) / 2, t = (x - (s.x0 + s.x1) / 2) / hw;
      const roof = f - 8 - (s.z.h - 8) * Math.pow(Math.max(0, 1 - t * t), 0.45);
      if (y <= f + 2 && y >= roof) return true;
    }
    const r2 = (s.th / 2) ** 2;
    for (const sg of s.segs) if (segD2(x, y, sg) <= r2) return true;
  }
  return false;
}

/** How far above (x, y) the rock begins: the ceiling, scanning up at most `max`. */
export function ceilingAbove(rooms, x, y, max = 220) {
  let k = 0;
  while (k < max && hollowAt(rooms, x, y - k - 1)) k++;
  return y - k;
}

/**
 * Advance one body by dt. body = {x, y, vx, vy, r?} with y at its feet (or bottom).
 * Calls hit(kind, speed) for "wall", "floor" and "roof" impacts. Returns true while airborne.
 * Grounded bodies slide with friction; `roll` keeps rolling (a boulder) and climbs gentle steps.
 */
export function flyStep(rooms, b, dt, hit, { roll = false, height = 14 } = {}) {
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  const open = (x, y) => hollowAt(rooms, x, y);
  for (let i = 0; i < n; i++) {
    b.vy += G * h;
    // sideways: blocked at the waist?
    const nx = b.x + b.vx * h;
    if (!open(nx, b.y - height * 0.5) || !open(nx, b.y - 1.5)) {
      // a low step: climb it instead (floors are slopes and stairs)
      let up = 0;
      if (b.ground) while (up < 7 && !(open(nx, b.y - 1.5 - up) && open(nx, b.y - height * 0.5 - up))) up++;
      if (b.ground && up < 7) { b.x = nx; b.y -= up; }
      else { hit("wall", Math.abs(b.vx)); b.vx = -b.vx * (roll ? 0 : 0.3); if (roll) return false; }
    } else b.x = nx;
    const ny = b.y + b.vy * h;
    if (b.vy > 0 && !open(b.x, ny)) {
      const v = b.vy;
      if (v > 60) hit("floor", v);
      if (!roll && v > 190) { b.vy = -v * 0.22; b.vx *= 0.6; }
      else { b.vy = 0; b.ground = true; }
      // never rest inside rock
      let k = 0;
      while (k < 12 && !open(b.x, b.y - 1)) { b.y -= 1; k++; }
    } else if (b.vy < 0 && !open(b.x, ny - height)) {
      hit("roof", -b.vy);
      b.vy = 0;
    } else {
      // walking off a ledge lifts the ground flag
      if (b.ground && open(b.x, b.y + 2)) b.ground = false;
      if (!b.ground) b.y = ny; else b.vy = 0;
    }
    if (b.ground && !roll) {
      b.vx *= Math.max(0, 1 - 7 * h);
      if (Math.abs(b.vx) < 22) { b.vx = 0; return false; }
    }
    if (b.y > H + 30) return false;
  }
  return true;
}

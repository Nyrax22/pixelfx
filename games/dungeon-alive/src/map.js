// The dungeon's shape: one hand-drawn cave seen from the side, turned into a walkable graph.
// Every zone (a chamber, a tunnel, the gate, the heart's hall) is a floor polyline; walking happens on
// waypoints a few pixels apart along those floors. Cards, monsters and people stand on waypoints.

import MAP from "../data/map.json";

export { MAP };
export const W = MAP.W, H = MAP.H, GROUND = MAP.ground;
const STEP = 6;

/** waypoints: {id, x, y, zone, nb: [ids]} */
export const WP = [];
/** zones: id -> {id, kind, name, h, closed, join, wps: [ids], x0, x1, y, cx, center} */
export const ZONES = {};
const nodeWp = new Map();

function wpAt(x, y, zone) {
  const w = { id: WP.length, x, y, zone, nb: [] };
  WP.push(w);
  return w;
}
function link(a, b) {
  if (a === b) return;
  if (!a.nb.includes(b.id)) a.nb.push(b.id);
  if (!b.nb.includes(a.id)) b.nb.push(a.id);
}
// named nodes become shared waypoints, owned by the first chamber-like zone that lists them
const owner = {};
for (const [zid, z] of Object.entries(MAP.zones)) {
  const pri = z.kind === "tunnel" ? 1 : 2;
  for (const n of z.path) if (!owner[n] || owner[n].pri < pri) owner[n] = { zid, pri };
}
for (const [n, [x, y]] of Object.entries(MAP.nodes)) nodeWp.set(n, wpAt(x, y, owner[n]?.zid ?? null));

for (const [zid, z] of Object.entries(MAP.zones)) {
  const Z = { id: zid, kind: z.kind, name: z.name ?? null, h: z.h, closed: !!z.closed, join: z.join ?? null, wps: [], path: z.path.map((n) => MAP.nodes[n]) };
  ZONES[zid] = Z;
  for (let i = 0; i < z.path.length - 1; i++) {
    const A = nodeWp.get(z.path[i]), B = nodeWp.get(z.path[i + 1]);
    const len = Math.hypot(B.x - A.x, B.y - A.y), n = Math.max(1, Math.round(len / STEP));
    let prev = A;
    if (A.zone === zid && !Z.wps.includes(A.id)) Z.wps.push(A.id);
    for (let k = 1; k < n; k++) {
      const t = k / n, w = wpAt(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t, zid);
      Z.wps.push(w.id);
      link(prev, w);
      prev = w;
    }
    link(prev, B);
    if (B.zone === zid && !Z.wps.includes(B.id)) Z.wps.push(B.id);
  }
  const xs = Z.path.map((p) => p[0]), ys = Z.path.map((p) => p[1]);
  Z.x0 = Math.min(...xs); Z.x1 = Math.max(...xs); Z.y = Math.max(...ys); Z.yTop = Math.min(...ys) - Z.h;
  Z.cx = (Z.x0 + Z.x1) / 2;
  // the waypoint nearest the middle of the floor: where treasure lies and where room effects are shown
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  Z.center = Z.wps.reduce((best, id) => (best == null || dist2(WP[id], Z.cx, cy) < dist2(WP[best], Z.cx, cy) ? id : best), null);
}
function dist2(w, x, y) { return (w.x - x) ** 2 + (w.y - y) ** 2; }

export const HEART_WP = nodeWp.get(MAP.heartNode).id;
export const ENT_WP = nodeWp.get(MAP.entNode).id;
export const GATE_WP = nodeWp.get("gate").id;
export const zoneOf = (w) => WP[w]?.zone ?? null;
export const wpXY = (w) => [WP[w].x, WP[w].y];
export const distW = (a, b) => Math.hypot(WP[a].x - WP[b].x, WP[a].y - WP[b].y);
export const distXY = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
/** chamber-like zones joined to this one through a tunnel (and the tunnels themselves) */
export function zoneLinks(zid) {
  const out = [];
  for (const z of Object.values(ZONES)) if (z.join && z.join.includes(zid)) out.push({ tunnel: z.id, other: z.join[0] === zid ? z.join[1] : z.join[0] });
  return out;
}
/** The waypoint nearest a point, optionally only among a set and within a radius. */
export function nearestWp(x, y, maxR = Infinity, filter = null) {
  let best = null, bd = maxR * maxR;
  for (const w of WP) {
    if (filter && !filter(w)) continue;
    const d = dist2(w, x, y);
    if (d < bd) { bd = d; best = w.id; }
  }
  return best;
}
/** Which zone a point is inside (between its floor and ceiling), for clicks. */
export function zoneAtXY(x, y, filter = null) {
  let best = null, bd = Infinity;
  for (const z of Object.values(ZONES)) {
    if (filter && !filter(z)) continue;
    if (x < z.x0 - 14 || x > z.x1 + 14 || y < z.yTop - 6 || y > z.y + 10) continue;
    const d = Math.abs(x - z.cx) / (z.x1 - z.x0 + 30);
    if (d < bd) { bd = d; best = z.id; }
  }
  return best;
}

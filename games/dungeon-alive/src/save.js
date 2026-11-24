// Saves live on the device. Three slots take turns so one bad write never loses everything;
// loading picks the newest slot whose checksum holds. Export/import moves a save between devices.

import { newMeta } from "./sim.js";

const KEY = "dungeon-alive:slot:";
const sum = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
const store = () => {
  try { return window.localStorage; } catch { return null; }
};

export function save(meta, run) {
  const ls = store();
  if (!ls) return false;
  const body = JSON.stringify({ meta, run, at: Date.now() });
  const rec = JSON.stringify({ body, sum: sum(body) });
  let slot = 0, oldest = Infinity;
  for (let i = 0; i < 3; i++) {
    const r = read(i);
    if (!r) { slot = i; oldest = -1; break; }
    if (r.at < oldest) { oldest = r.at; slot = i; }
  }
  try { ls.setItem(KEY + slot, rec); return true; } catch { return false; }
}
function read(i) {
  const ls = store();
  try {
    const rec = JSON.parse(ls.getItem(KEY + i));
    if (!rec || sum(rec.body) !== rec.sum) return null;
    return JSON.parse(rec.body);
  } catch { return null; }
}
export function load() {
  let best = null;
  for (let i = 0; i < 3; i++) { const r = read(i); if (r && (!best || r.at > best.at)) best = r; }
  if (!best) return { meta: newMeta(), run: null };
  return { meta: { ...newMeta(), ...best.meta }, run: best.run?.v === 2 ? best.run : null };
}
export function exportSave(meta, run) {
  const body = JSON.stringify({ meta, run, at: Date.now() });
  return btoa(unescape(encodeURIComponent(JSON.stringify({ body, sum: sum(body) }))));
}
export function importSave(text) {
  try {
    const rec = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
    if (sum(rec.body) !== rec.sum) return null;
    const d = JSON.parse(rec.body);
    return { meta: { ...newMeta(), ...d.meta }, run: d.run?.v === 2 ? d.run : null };
  } catch { return null; }
}
export function wipe() {
  const ls = store();
  for (let i = 0; i < 3; i++) try { ls?.removeItem(KEY + i); } catch {}
}

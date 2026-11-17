// Rules that turn a save into numbers: stats, the collection, and what a finished dive is worth.

import { ITEMS, ITEM, RARITY, SETS, STARS, STAR3_COIN_BONUS, UPGRADES, UPGRADE, ZONES, MISSIONS, MISSION_BEST, upgradeCost, MATS, FACILITIES, GEAR, RESEARCH, STORE_KIT, MUSEUM_COINS } from "./data.js";

const SAVE_KEY = "ruindiver.v1";
export const SAVE_VERSION = 2;
export let storageOk = true;
export let saveWasCorrupt = false;

export function defaultSave() {
  return {
    v: SAVE_VERSION, coins: 0, best: 0, runs: 0, muted: false, lang: null,
    up: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    book: {},   // id -> { seen: meters first seen, count, variant }
    sets: {},   // id -> true once completed
    bossKills: {}, // id -> times beaten
    start: "top",  // where the next expedition starts
    missions: { next: 3, active: [{ i: 0, p: 0 }, { i: 1, p: 0 }, { i: 2, p: 0 }] },
    hintsShown: [],
    // v2: the long game
    mats: Object.fromEntries(MATS.map((m) => [m, 0])),
    base: Object.fromEntries(FACILITIES.map((f) => [f.id, f.start])),
    gear: {}, equip: [], research: {},
    beasts: {},   // id -> { seen: meters, kills, drops: { mat: true } }
    rec: { escapes: 0, deaths: 0, time: 0, coins: 0, kills: 0, events: 0, used: {} },
    claimed: {},  // challenge id -> true
    eventLog: [], // the last few dives' events, so they don't repeat too often
  };
}
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);
const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
/** Bring any older or partly broken save up to the current shape, keeping what can be kept. */
export function migrate(s) {
  const d = defaultSave();
  if (!isObj(s)) return d;
  const out = { ...d, ...s, v: SAVE_VERSION };
  for (const k of ["coins", "best", "runs"]) out[k] = Math.max(0, num(s[k]));
  for (const k of ["up", "book", "sets", "bossKills", "gear", "research", "beasts", "claimed"]) out[k] = isObj(s[k]) ? { ...d[k], ...s[k] } : d[k];
  out.mats = { ...d.mats };
  if (isObj(s.mats)) for (const m of MATS) out.mats[m] = Math.max(0, num(s.mats[m]));
  out.base = { ...d.base };
  if (isObj(s.base)) for (const f of FACILITIES) out.base[f.id] = Math.max(f.start, Math.min(f.max, num(s.base[f.id], f.start)));
  out.rec = { ...d.rec, ...(isObj(s.rec) ? s.rec : {}) };
  out.rec.used = isObj(out.rec.used) ? out.rec.used : {};
  if (!isObj(s.rec) && out.runs) out.rec.deaths = 0; // v1 saves didn't keep records: start counting now
  out.equip = Array.isArray(s.equip) ? s.equip.filter((id) => out.gear[id]) : [];
  out.eventLog = Array.isArray(s.eventLog) ? s.eventLog.slice(-16) : [];
  out.hintsShown = Array.isArray(s.hintsShown) ? s.hintsShown : [];
  out.missions = isObj(s.missions) ? s.missions : d.missions;
  for (const u of UPGRADES) out.up[u.id] = Math.max(0, Math.min(u.levels.length - 1, num(out.up[u.id])));
  return out;
}
export function loadSave() {
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    storageOk = false;
    return defaultSave();
  }
  if (!raw) return defaultSave();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    // unreadable: keep a copy aside rather than lose it, and start over
    saveWasCorrupt = true;
    try { localStorage.setItem(SAVE_KEY + ".broken", raw); } catch {}
    return defaultSave();
  }
}
export function writeSave(s) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    storageOk = false;
  }
}
export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

export const starsOf = (count) => STARS.filter((n) => count >= n).length;

/** The bonuses from completed sets, summed. */
export function setBonus(save) {
  const b = { ropes: 0, lantern: 0, hearts: 0, coins: 0 };
  for (const s of SETS) if (save.sets[s.id]) for (const [k, v] of Object.entries(s.bonus)) b[k] += v;
  return b;
}

/** The perks from gear you have equipped, research done and the base, merged into one set of numbers. */
export function perks(save) {
  const k = { dig: 1, waterK: 1, jumpK: 1, fall: 0, lightK: 1, lamp: 1, hearts: 0, detect: 0, poolK: 1, oil: 0, torchK: 1, campStone: 0, hunterK: 1, kit: {} };
  const add = (fx) => {
    for (const [n, v] of Object.entries(fx)) {
      if (n === "kit") { for (const [r, c] of Object.entries(v)) k.kit[r] = (k.kit[r] ?? 0) + c; }
      else if (n.endsWith("K") || n === "dig" || n === "lamp") k[n] *= v;
      else k[n] += v;
    }
  };
  for (const id of save.equip ?? []) { const g = GEAR.find((x) => x.id === id); if (g && save.gear?.[id]) add(g.fx); }
  for (const r of RESEARCH) if (save.research?.[r.id]) add(r.fx);
  add({ kit: STORE_KIT[save.base?.store ?? 0] ?? {} });
  return k;
}

/** Everything a dive needs to know about the player's gear. */
export function stats(save) {
  const lv = (id) => UPGRADE[id].levels[Math.min(save.up[id], UPGRADE[id].levels.length - 1)];
  const b = setBonus(save), pk = perks(save);
  const star3 = ITEMS.filter((it) => starsOf(save.book[it.id]?.count ?? 0) >= 3).length;
  return {
    lantern: lv("lantern") + b.lantern,
    bag: lv("bag"),
    hearts: lv("hearts") + b.hearts + pk.hearts,
    pick: lv("pick") * pk.dig,
    stomach: lv("stomach"),
    ropes: b.ropes,
    coinK: 1 + b.coins + star3 * STAR3_COIN_BONUS + (save.base?.museum ?? 0) * MUSEUM_COINS,
    pk,
  };
}

export function bookPercent(save) {
  const owned = ITEMS.filter((it) => (save.book[it.id]?.count ?? 0) > 0).length;
  return owned / ITEMS.length;
}
export function zonePercent(save, zone) {
  const list = ITEMS.filter((it) => it.zone === zone);
  return list.filter((it) => (save.book[it.id]?.count ?? 0) > 0).length / list.length;
}

export function upgradeState(save, u) {
  const level = save.up[u.id], max = level >= u.levels.length - 1;
  const locked = u.unlockDepth && save.best < u.unlockDepth;
  const cost = max ? 0 : upgradeCost(u, level);
  return { level, max, locked, cost, affordable: !max && !locked && save.coins >= cost, now: u.levels[level], next: max ? null : u.levels[level + 1] };
}
export function buyUpgrade(save, id) {
  const u = UPGRADE[id], st = upgradeState(save, u);
  if (!st.affordable) return false;
  save.coins -= st.cost;
  save.up[id]++;
  return true;
}
/** The cheapest upgrade the player can't afford yet, for "N more coins". */
export function nextGoal(save) {
  let best = null;
  for (const u of UPGRADES) {
    const st = upgradeState(save, u);
    if (st.max || st.locked || st.affordable) continue;
    if (!best || st.cost < best.cost) best = { id: u.id, cost: st.cost, need: st.cost - save.coins };
  }
  return best;
}

export const zoneAt = (m) => ZONES.find((z) => m >= z.from && m < z.to) ?? ZONES[ZONES.length - 1];

/**
 * Apply a finished dive to the save. run: { bag: [{id, variant}], dropped: [...], seen: {id: meters},
 * coins, depth }. Returns what happened, for the results screen.
 */
export function applyRun(save, run, bonus = false) {
  const k = stats(save).coinK;
  const out = { items: [], itemCoins: 0, newCoins: 0, looseCoins: Math.round(run.coins * k), newSets: [], record: false, depth: run.depth, total: 0 };
  // everything seen goes in the book as discovered
  for (const [id, m] of Object.entries(run.seen)) {
    const e = (save.book[id] ??= { seen: m, count: 0, variant: false });
    if (e.seen == null) e.seen = m;
  }
  for (const d of run.dropped) save.book[d.id] ??= { seen: run.depth, count: 0, variant: false };
  for (const it of run.bag) {
    const def = ITEM[it.id], r = RARITY[def.rarity], zk = ZONES.find((z) => z.id === def.zone).valueK;
    const e = (save.book[it.id] ??= { seen: run.depth, count: 0, variant: false });
    const before = e.count, isNew = before === 0, newVariant = it.variant && !e.variant;
    e.count++;
    if (it.variant) e.variant = true;
    const value = Math.round(r.value * zk * (it.variant ? 3 : 1));
    out.itemCoins += value;
    if (isNew) out.newCoins += r.newBonus;
    if (newVariant) out.newCoins += r.newBonus * 2;
    out.items.push({ id: it.id, variant: it.variant, isNew, newVariant, starUp: starsOf(e.count) > starsOf(before) && !isNew, stars: starsOf(e.count), value });
  }
  out.itemCoins = Math.round(out.itemCoins * k);
  for (const s of SETS) if (!save.sets[s.id] && s.items.every((id) => (save.book[id]?.count ?? 0) > 0)) {
    save.sets[s.id] = true;
    out.newSets.push(s.id);
  }
  out.total = out.itemCoins + out.newCoins + out.looseCoins;
  save.coins += out.total;
  if (!bonus) {
    if (run.depth > save.best) {
      out.record = save.runs > 0;
      save.best = run.depth;
    }
    save.runs++;
  }
  // the rarest things first on the results screen
  out.items.sort((a, b) => RARITY[ITEM[b.id].rarity].order - RARITY[ITEM[a.id].rarity].order || b.isNew - a.isNew);
  return out;
}

// ------------------------------------------------------------ missions

/** What an expedition counts toward a mission kind. tally: the run's counters; escaped: whether it got out. */
export function missionValue(kind, tally, escaped) {
  if (kind === "escapeWith") return escaped ? tally.escapeWith ?? 0 : 0;
  if (kind === "winch") return escaped && tally.winch ? 1 : 0;
  return tally[kind] ?? 0;
}
/** Progress a mission would have with this expedition's tally added. */
export function missionProgress(m, tally, escaped) {
  const def = MISSIONS[m.i], v = missionValue(def.kind, tally, escaped);
  return MISSION_BEST.has(def.kind) || def.kind === "escapeWith" ? Math.max(m.p, v) : m.p + v;
}
/** Fold an expedition into the missions: returns the ones completed (with rewards), refilling from the list. */
export function applyMissions(save, tally, escaped) {
  const done = [];
  const ms = save.missions;
  ms.active = ms.active.map((m) => {
    const p = missionProgress(m, tally, escaped), def = MISSIONS[m.i];
    if (p < def.n) return { ...m, p };
    done.push(def);
    save.coins += def.reward;
    return ms.next < MISSIONS.length ? { i: ms.next++, p: 0 } : null;
  }).filter(Boolean);
  return done;
}

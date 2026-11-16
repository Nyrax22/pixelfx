// Rules that turn a save into numbers: stats, the collection, and what a finished dive is worth.

import { ITEMS, ITEM, RARITY, SETS, STARS, STAR3_COIN_BONUS, UPGRADES, UPGRADE, ZONES, upgradeCost } from "./data.js";

const SAVE_KEY = "ruindiver.v1";
export let storageOk = true;

export function defaultSave() {
  return {
    v: 1, coins: 0, best: 0, runs: 0, muted: false, lang: null,
    up: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    book: {},   // id -> { seen: meters first seen, count, variant }
    sets: {},   // id -> true once completed
    bossKills: {}, // id -> times beaten
    start: "top",  // where the next expedition starts
  };
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw), d = defaultSave();
    return { ...d, ...s, up: { ...d.up, ...s.up }, bossKills: { ...(s.bossKills ?? {}) } };
  } catch {
    storageOk = false;
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

/** Everything a dive needs to know about the player's gear. */
export function stats(save) {
  const lv = (id) => UPGRADE[id].levels[Math.min(save.up[id], UPGRADE[id].levels.length - 1)];
  const b = setBonus(save);
  const star3 = ITEMS.filter((it) => starsOf(save.book[it.id]?.count ?? 0) >= 3).length;
  return {
    lantern: lv("lantern") + b.lantern,
    bag: lv("bag"),
    hearts: lv("hearts") + b.hearts,
    pick: lv("pick"),
    ropes: lv("ropes") + b.ropes,
    coinK: 1 + b.coins + star3 * STAR3_COIN_BONUS,
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

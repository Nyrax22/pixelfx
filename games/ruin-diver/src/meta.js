// The long game around the dives: rare materials, the base, gear, research, the bestiary, records and challenges.

import { MATS, FACILITIES, GEAR, RESEARCH, BEASTS, BEAST_REWARD, CHALLENGES, ITEMS, EVENTS, EVENTS_PER_ZONE } from "./data.js";

/** Can the save pay this cost ({ coins, copper, ... })? */
export const canAfford = (save, cost) => Object.entries(cost).every(([k, v]) => (k === "coins" ? save.coins : save.mats[k] ?? 0) >= v);
export function pay(save, cost) {
  if (!canAfford(save, cost)) return false;
  for (const [k, v] of Object.entries(cost)) if (k === "coins") save.coins -= v; else save.mats[k] -= v;
  return true;
}

// ------------------------------------------------------------ facilities
export const FAC = Object.fromEntries(FACILITIES.map((f) => [f.id, f]));
export function facState(save, id) {
  const f = FAC[id], lv = save.base[id], max = lv >= f.max;
  const cost = max ? null : f.up[lv + 1];
  return { lv, max, cost, can: !max && canAfford(save, cost) };
}
export function upgradeFacility(save, id) {
  const st = facState(save, id);
  if (!st.can || !pay(save, st.cost)) return false;
  save.base[id]++;
  return true;
}
export const gearSlots = (save) => (save.base.bench >= 3 ? 2 : 1);

// ------------------------------------------------------------ gear
export function gearState(save, g) {
  const owned = !!save.gear[g.id], tierOk = save.base.bench >= g.tier;
  return { owned, tierOk, equipped: save.equip.includes(g.id), can: !owned && tierOk && canAfford(save, g.cost) };
}
export function craftGear(save, id) {
  const g = GEAR.find((x) => x.id === id), st = gearState(save, g);
  if (!st.can || !pay(save, g.cost)) return false;
  save.gear[id] = true;
  if (save.equip.length < gearSlots(save)) save.equip.push(id);
  return true;
}
/** Equip or unequip; with every slot full, the oldest piece comes off. */
export function toggleEquip(save, id) {
  if (!save.gear[id]) return;
  if (save.equip.includes(id)) { save.equip = save.equip.filter((x) => x !== id); return; }
  save.equip.push(id);
  while (save.equip.length > gearSlots(save)) save.equip.shift();
}

// ------------------------------------------------------------ research
export const relicsOwned = (save) => ITEMS.filter((it) => (save.book[it.id]?.count ?? 0) > 0).length;
export const beastsSeen = (save) => BEASTS.filter((b) => save.beasts[b.id]).length;
export const beastsKilled = (save) => BEASTS.filter((b) => (save.beasts[b.id]?.kills ?? 0) > 0).length;
export function researchState(save, r) {
  const done = !!save.research[r.id], tierOk = save.base.lab >= r.tier;
  const relicOk = !r.needRelics || relicsOwned(save) >= r.needRelics;
  const beastOk = !r.needBeasts || beastsSeen(save) >= r.needBeasts;
  return { done, tierOk, relicOk, beastOk, can: !done && tierOk && relicOk && beastOk && canAfford(save, r.cost) };
}
export function doResearch(save, id) {
  const r = RESEARCH.find((x) => x.id === id), st = researchState(save, r);
  if (!st.can || !pay(save, r.cost)) return false;
  save.research[id] = true;
  return true;
}

// ------------------------------------------------------------ the end of a dive: materials, monsters, records
/**
 * Fold a dive's long-game results into the save. d: { mats, beasts: { id: { seen, kills, drops } }, events: [ids],
 * used: { eat: n, ... }, time, coins, escaped, died, torches }. Returns what's new, for the results screen.
 */
export function applyMeta(save, d) {
  const out = { mats: {}, newBeasts: [], rewards: 0 };
  for (const m of MATS) if (d.mats[m]) { save.mats[m] += d.mats[m]; out.mats[m] = d.mats[m]; }
  const seenBefore = beastsSeen(save), killedBefore = beastsKilled(save);
  for (const [id, b] of Object.entries(d.beasts)) {
    const e = save.beasts[id];
    if (!e) out.newBeasts.push(id);
    const n = (save.beasts[id] ??= { seen: b.seen, kills: 0, drops: {} });
    n.kills += b.kills;
    if (n.seen == null) n.seen = b.seen;
    Object.assign(n.drops, b.drops);
  }
  // one-time rewards for completing the bestiary
  if (seenBefore < BEASTS.length && beastsSeen(save) === BEASTS.length) { save.coins += BEAST_REWARD.seen; out.rewards += BEAST_REWARD.seen; out.allSeen = true; }
  if (killedBefore < BEASTS.length && beastsKilled(save) === BEASTS.length) { save.coins += BEAST_REWARD.killed; out.rewards += BEAST_REWARD.killed; out.allKilled = true; }
  const r = save.rec;
  r.time += d.time;
  r.coins += d.coins;
  r.kills += Object.values(d.beasts).reduce((a, b) => a + b.kills, 0);
  r.events += d.events.length;
  if (d.escaped) r.escapes++;
  if (d.died) r.deaths++;
  for (const [k, v] of Object.entries(d.used)) r.used[k] = (r.used[k] ?? 0) + v;
  if (!d.torches && d.depth >= 100) r.noTorch = 1;
  save.eventLog = [...save.eventLog, ...d.events].slice(-16);
  return out;
}

// ------------------------------------------------------------ challenges
export function challengeValue(save, c) {
  switch (c.kind) {
    case "best": return save.best;
    case "escapes": return save.rec.escapes;
    case "boss": return save.bossKills[c.id2] ?? 0;
    case "kills": return save.rec.kills;
    case "events": return save.rec.events;
    case "sets": return Object.keys(save.sets).length;
    case "beasts": return beastsSeen(save);
    case "gear": return Object.keys(save.gear).length;
    case "base": return FACILITIES.reduce((a, f) => a + save.base[f.id], 0);
    case "noTorch": return save.rec.noTorch ?? 0;
  }
  return 0;
}
export function challengeState(save, c) {
  const v = challengeValue(save, c);
  return { v: Math.min(v, c.n), done: v >= c.n, claimed: !!save.claimed[c.id] };
}
export function claimChallenge(save, id) {
  const c = CHALLENGES.find((x) => x.id === id), st = challengeState(save, c);
  if (!st.done || st.claimed) return false;
  save.claimed[id] = true;
  save.coins += c.reward;
  return true;
}
export const claimable = (save) => CHALLENGES.filter((c) => { const s = challengeState(save, c); return s.done && !s.claimed; }).length;

// ------------------------------------------------------------ events: which ones a dive gets
/** Pick this dive's events for a zone: weighted, and less likely the more often they came up lately. */
export function pickEvents(R, zone, log) {
  const pool = Object.entries(EVENTS).filter(([, e]) => e.zones.includes(zone));
  const out = [];
  for (let n = 0; n < EVENTS_PER_ZONE[zone]; n++) {
    const w = pool.map(([id, e]) => (out.includes(id) ? 0 : e.w / (1 + log.filter((x) => x === id).length * 0.6)));
    let t = R.next() * w.reduce((a, b) => a + b, 0), k = 0;
    while (k < pool.length - 1 && (t -= w[k]) > 0) k++;
    if (w[k] > 0) out.push(pool[k][0]);
  }
  return out;
}

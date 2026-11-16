// Ruin Diver: the loop, the input and every screen around the dive.

import { createFrame, clearFrame, createFx, painterFor } from "../../../src/core/index.js";
import * as confettiFx from "../../../src/fx/ui/confetti.js";
import { W, H, STR, ITEMS, ITEM, RARITY, SETS, UPGRADES, ZONES, SEAL_DEPTH, LANTERN_AD_SECONDS, PX_PER_M } from "./data.js";
import { loadSave, writeSave, wipeSave, storageOk, stats, applyRun, bookPercent, upgradeState, buyUpgrade, nextGoal, starsOf, zoneAt } from "./logic.js";
import { Run } from "./world.js";
import { compositeLit } from "./bg.js";
import { itemIcon } from "./sprites.js";
import { audio } from "./audio.js";
import { poki } from "./poki.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), cv = $("cv"), ctx = cv.getContext("2d");
const img = ctx.createImageData(W, H), frame = createFrame(W, H), lm = new Float32Array(W * H);

let save = loadSave();
let lang = save.lang ?? ((navigator.language || "en").toLowerCase().startsWith("ko") ? "ko" : "en");
let mode = "boot";            // boot, ready, run, prompt, paused, escaping, results, book
let run = new Run(save, stats(save), false);
let result = null;            // the last dive's outcome
let freshInBook = new Set();  // owned since the book was last opened
let setQueue = [];
let screenFx = [];
let dragged = 0;
audio.setMuted(!!save.muted);

// ------------------------------------------------------------ text
const S = (key, vars = {}) => {
  let s = STR[lang][key] ?? STR.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
};
const itemName = (id) => STR[lang].items[id][0];
const itemDesc = (id) => STR[lang].items[id][1];
function applyStrings() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-s]")) el.textContent = S(el.dataset.s);
  $("soundBtn").textContent = audio.muted ? "🔇" : "🔊";
  $("langBtn").textContent = lang === "ko" ? "English" : "한국어";
}

// ------------------------------------------------------------ layout: a 16:9 stage, 1em = 10 game pixels
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(vw, (vh * 16) / 9), h = (w * 9) / 16;
  stage.style.width = w + "px";
  stage.style.height = h + "px";
  stage.style.fontSize = w / 48 + "px";
  const portrait = vh > vw && matchMedia("(pointer: coarse)").matches;
  $("rotate").style.display = portrait ? "flex" : "none";
  if (portrait && mode === "run") pause();
}
window.addEventListener("resize", layout);

// ------------------------------------------------------------ input
const input = { dx: 0, dir: 0 };
const keys = new Set();
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (mode !== "run" || e.target.closest("button")) return;
  drag = { id: e.pointerId, x: e.clientX };
  stage.setPointerCapture?.(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const k = W / stage.getBoundingClientRect().width, dx = (e.clientX - drag.x) * k;
  drag.x = e.clientX;
  input.dx += dx;
  dragged += Math.abs(dx);
});
const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  audio.unlock();
  const k = e.key.toLowerCase();
  keys.add(k);
  if (mode === "ready" && !e.repeat) return startDive();
  if (k === "escape" || k === " ") {
    if (e.repeat) return;
    if (mode === "run") return pause();
    if (mode === "paused") return resume();
    if (mode === "book" && k === "escape") return closeBook();
    if (mode === "results" && k === " ") return dive();
  }
  if (mode === "run" && (k === "arrowup" || k === "w")) run.ascend("manual");
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "run") pause(); });

// ------------------------------------------------------------ toasts and banners
let toastTimer = 0;
function toast(text, color = "#fff") {
  const t = $("toast");
  t.textContent = text;
  t.style.color = color;
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1700);
}
function banner(title, sub) {
  const b = $("banner");
  b.querySelector("b").textContent = title;
  b.querySelector("span").textContent = sub;
  b.classList.remove("show");
  void b.offsetWidth;
  b.classList.add("show");
}
const show = (id, on = true) => $(id).classList.toggle("hidden", !on);

// ------------------------------------------------------------ HUD
let hudBag = -1;
function buildHud() {
  const st = run.st;
  const slots = $("bagSlots");
  slots.innerHTML = "";
  for (let i = 0; i < st.bag; i++) slots.appendChild(Object.assign(document.createElement("div"), { className: "slot" }));
  hudBag = -1;
  // the depth gauge: the rope's length top to bottom, with the record, the zone line and the seal
  const max = st.rope, marks = $("gaugeMarks");
  marks.innerHTML = "";
  const mark = (m, cls, label) => {
    const el = document.createElement("div");
    el.className = "gmark " + cls;
    el.style.top = (m / max) * 100 + "%";
    el.innerHTML = `<i></i>${label}`;
    marks.appendChild(el);
  };
  mark(0, "", "0m");
  for (const z of ZONES) if (z.from > 0 && z.from < max) mark(z.from, "zone", `${z.from}m`);
  if (save.best > 0 && save.best < max - 4) mark(save.best, "best", `★ ${save.best}m`);
  if (max >= SEAL_DEPTH) mark(SEAL_DEPTH, "seal", `🔒 ${SEAL_DEPTH}m`);
  else mark(max, "", `${max}m`);
  show("helmetRow", st.helmet > 0);
  updateHud(true);
}
let lastHud = {};
function updateHud(force = false) {
  const st = run.st, d = run.depth;
  if (force || lastHud.d !== d) {
    $("hDepth").innerHTML = `${d}<small>m</small>`;
    $("hZone").textContent = STR[lang].zones[zoneAt(d).id];
    const k = Math.min(1, run.p.y / PX_PER_M / st.rope);
    $("gaugeFill").style.height = k * 100 + "%";
    $("gaugeMe").style.top = k * 100 + "%";
    lastHud.d = d;
  }
  const coins = save.coins + run.coins;
  if (force || lastHud.coins !== coins) {
    $("hCoins").textContent = coins;
    lastHud.coins = coins;
  }
  const lr = Math.max(0, run.lantern / st.lantern);
  $("lanternFill").style.width = lr * 100 + "%";
  $("lanternTx").textContent = Math.ceil(run.lantern) + S("sec");
  $("lanternBox").classList.toggle("low", lr < 0.25 && run.state === "descend");
  if (force || hudBag !== run.bagVer) {
    const slots = $("bagSlots").children;
    for (let i = 0; i < slots.length; i++) {
      const b = run.bag[i], el = slots[i];
      el.className = "slot" + (b ? ` filled r-${ITEM[b.id].rarity}` : "");
      el.innerHTML = b ? `<img src="${itemIcon(ITEM[b.id], "color", b.variant)}" alt="">` : "";
    }
    $("bagTx").textContent = `${run.bag.length}/${st.bag}`;
    hudBag = run.bagVer;
  }
  $("helmetTx").textContent = "●".repeat(run.helmet) + "○".repeat(Math.max(0, st.helmet - run.helmet));
  show("ascendBtn", run.state === "descend");
}
$("ascendBtn").addEventListener("click", () => run.ascend("manual"));
$("pauseBtn").addEventListener("click", () => pause());

// ------------------------------------------------------------ the dive
function startDive() {
  audio.unlock();
  const first = save.runs === 0;
  run = new Run(save, stats(save), first);
  result = null;
  hideScreens();
  show("hud");
  buildHud();
  mode = "run";
  run.start();
  poki.gameplayStart();
  dragged = 0;
  show("hint", first);
}
async function dive() {
  if (mode !== "results") return;
  audio.play("click");
  mode = "boot";
  await poki.commercialBreak();
  startDive();
}
function hideScreens() {
  for (const id of ["ready", "results", "book", "lanternPrompt", "pause", "setPop"]) show(id, false);
}

function handleEvents() {
  while (run.events.length) {
    const e = run.events.shift();
    switch (e.type) {
      case "toast":
        toast(S(e.key), e.key === "helmetSave" ? "#ffe06a" : "#fff");
        break;
      case "ascend":
        show("hint", false);
        if (e.reason === "manual") toast(S("goingUp"), "#9ad0ff");
        break;
      case "zone":
        banner(STR[lang].zones[e.zone], `${e.depth}m`);
        break;
      case "seal":
        setTimeout(() => toast(bookPercent(save) >= 0.3 ? S("sealOpen") : S("sealNeed", { p: 30 }), "#6ad0ff"), 900);
        break;
      case "coin":
        $("hCoinsBox").classList.remove("bump");
        void $("hCoinsBox").offsetWidth;
        $("hCoinsBox").classList.add("bump");
        break;
      case "drop":
        toast(S("lost"), "#ff8a8a");
        break;
      case "lanternOut":
        if (e.depth >= 40 && !e.relit) {
          mode = "prompt";
          poki.gameplayStop();
          $("lpAdTx").textContent = S("relight", { s: LANTERN_AD_SECONDS });
          show("lanternPrompt");
        } else {
          toast(S("lanternOut"), "#ffb04a");
          run.ascend("lantern");
        }
        break;
      case "escaped":
        finishDive();
        break;
    }
  }
}
$("lpUp").addEventListener("click", () => {
  show("lanternPrompt", false);
  mode = "run";
  poki.gameplayStart();
  run.ascend("lantern");
});
$("lpAd").addEventListener("click", async () => {
  show("lanternPrompt", false);
  const ok = await poki.rewardedBreak();
  mode = "run";
  poki.gameplayStart();
  if (ok) run.relight(LANTERN_AD_SECONDS);
  else run.ascend("lantern");
});

function finishDive() {
  mode = "escaping";
  poki.gameplayStop();
  show("hint", false);
  const before = new Set(ITEMS.filter((it) => (save.book[it.id]?.count ?? 0) > 0).map((it) => it.id));
  result = applyRun(save, { bag: run.bag, dropped: run.dropped, seen: run.seen, coins: run.coins, depth: run.depthMax });
  result.dropped = run.dropped.slice();
  for (const it of result.items) if (!before.has(it.id)) freshInBook.add(it.id);
  setQueue.push(...result.newSets);
  writeSave(save);
  setTimeout(() => {
    show("hud", false);
    showResults();
  }, 700);
}

// ------------------------------------------------------------ results (and the hub, when there's no dive to show)
function showResults() {
  mode = "results";
  show("results");
  const r = result;
  const title = $("resTitle"), grid = $("lootGrid");
  grid.innerHTML = "";
  if (r) {
    title.innerHTML = `${S("escaped")} <small>${S("reachedDepth")} ${r.depth}m</small>${r.record ? `<span id="resRecord">★ ${S("newRecord")}</span>` : ""}`;
    show("resEmpty", !r.items.length);
    $("resEmpty").textContent = S("nothing");
    const shown = stack(r.items);
    shown.forEach((it, i) => grid.appendChild(card(it, i)));
    renderCoins(r);
    const dr = $("droppedRow");
    show("droppedRow", r.dropped.length > 0);
    dr.querySelector(".ic").innerHTML = r.dropped.map((d) => `<img src="${itemIcon(ITEM[d.id], "color", d.variant)}" alt="">`).join("");
    $("dropAd").disabled = false;
    $("doubleBtn").disabled = r.total <= 0;
    show("doubleBtn", true);
    $("diveBtn").textContent = S("diveAgain");
    // reveal one card after another, then the sets
    const reveal = 180;
    shown.forEach((it, i) => setTimeout(() => {
      grid.children[i]?.classList.add("in");
      audio.play(it.isNew ? "newItem" : "reveal", RARITY[ITEM[it.id].rarity].order);
    }, 250 + i * reveal));
    setTimeout(nextSetPop, 450 + shown.length * reveal);
  } else {
    title.innerHTML = `${S("hubTitle")} <small>${S("hubSub", { d: save.best, p: Math.round(bookPercent(save) * 100) })}</small>`;
    show("resEmpty", true);
    $("resEmpty").textContent = "";
    hubGrid(grid);
    $("resCoins").innerHTML = "";
    show("droppedRow", false);
    show("doubleBtn", false);
    $("diveBtn").textContent = S("dive");
  }
  renderUpgrades();
  renderBookBtn();
}
/** Duplicates on one card with a count. */
function stack(items) {
  const out = [], by = new Map();
  for (const it of items) {
    const k = it.id + (it.variant ? "*" : ""), s = by.get(k);
    if (!s) { const c = { ...it, n: 1 }; by.set(k, c); out.push(c); continue; }
    s.n++;
    s.isNew ||= it.isNew;
    s.newVariant ||= it.newVariant;
    s.starUp ||= it.starUp;
    s.stars = Math.max(s.stars, it.stars);
  }
  return out;
}
function card(it, i) {
  const def = ITEM[it.id], el = document.createElement("div");
  el.className = `card r-${def.rarity}`;
  const stars = "★".repeat(it.stars) + "☆".repeat(3 - it.stars);
  el.innerHTML = `${it.newVariant ? `<span class="badge var">${S("variant")}</span>` : it.isNew ? `<span class="badge">NEW</span>` : it.starUp ? `<span class="badge">★UP</span>` : ""}
    <img src="${itemIcon(def, "color", it.variant)}" alt=""><div class="nm">${itemName(it.id)}</div><div class="st">${stars}</div>${it.n > 1 ? `<span class="cnt">×${it.n}</span>` : ""}`;
  return el;
}
function hubGrid(grid) {
  // a peek at the collection: what you have, and what's still a silhouette
  for (const it of ITEMS.slice(0, 12)) {
    const e = save.book[it.id], owned = (e?.count ?? 0) > 0;
    const el = document.createElement("div");
    el.className = `card in r-${it.rarity}`;
    el.innerHTML = `<img src="${itemIcon(it, owned ? "color" : e ? "dim" : "silhouette", owned && e.variant)}" alt=""><div class="nm">${owned || e ? itemName(it.id) : "???"}</div><div class="st">${owned ? "★".repeat(starsOf(e.count)) : ""}</div>`;
    grid.appendChild(el);
  }
}
function renderCoins(r) {
  const parts = [];
  if (r.itemCoins) parts.push(`${S("loot")} <b>+${r.itemCoins}</b>`);
  if (r.newCoins) parts.push(`${S("newBonus")} <b>+${r.newCoins}</b>`);
  if (r.looseCoins) parts.push(`${S("looseCoins")} <b>+${r.looseCoins}</b>`);
  $("resCoins").innerHTML = `<span id="resTotal">🪙 +${r.total * (r.doubled ? 2 : 1)}</span>${parts.map((p) => `<span>${p}</span>`).join("")}${r.doubled ? `<span><b>×2</b></span>` : ""}`;
}
function renderUpgrades() {
  const list = $("upList");
  list.innerHTML = "";
  const unit = (u, v) => (u.unit === "s" ? v + S("sec") : u.unit === "m" ? v + "m" : u.unit === "px" ? "+" + v : String(v));
  for (const u of UPGRADES) {
    const st = upgradeState(save, u), el = document.createElement("div");
    el.className = "up" + (st.affordable ? " can" : "") + (st.locked ? " locked" : "");
    const name = STR[lang].upgradeNames[u.id];
    const line = st.locked ? S("locked", { d: u.unlockDepth }) : st.max ? `${unit(u, st.now)}` : `${unit(u, st.now)} → <em>${unit(u, st.next)}</em>`;
    el.innerHTML = `<div class="ic">${u.icon}</div><div class="tx"><b>${name}</b> <span>${st.max ? S("max") : S("lvl", { n: st.level + 1 })}</span><br><span>${STR[lang].upgradeDesc[u.id]}</span> ${line}</div>
      <button ${st.affordable ? "" : "disabled"}>${st.max ? S("max") : st.locked ? "🔒" : "🪙" + st.cost}</button>`;
    el.querySelector("button").addEventListener("click", () => {
      if (!buyUpgrade(save, u.id)) return audio.play("deny");
      audio.play("upgrade");
      writeSave(save);
      renderUpgrades();
      list.children[UPGRADES.indexOf(u)].classList.add("bought");
    });
    list.appendChild(el);
  }
  $("resWallet").textContent = save.coins;
  const g = nextGoal(save), any = UPGRADES.some((u) => upgradeState(save, u).affordable);
  $("goal").textContent = any ? S("canBuy") : g ? `${UPGRADE_ICON[g.id]} ${S("needMore", { n: g.need, name: STR[lang].upgradeNames[g.id] })}` : "";
}
const UPGRADE_ICON = Object.fromEntries(UPGRADES.map((u) => [u.id, u.icon]));
function renderBookBtn() {
  $("bookBtnPct").textContent = Math.round(bookPercent(save) * 100) + "%";
  show("bookDot", freshInBook.size > 0);
}

$("diveBtn").addEventListener("click", dive);
$("doubleBtn").addEventListener("click", async () => {
  if (!result || result.doubled) return;
  $("doubleBtn").disabled = true;
  const ok = await poki.rewardedBreak();
  if (!ok) return ($("doubleBtn").disabled = false);
  result.doubled = true;
  save.coins += result.total;
  writeSave(save);
  audio.play("upgrade");
  toast(S("doubled"), "#ffcf4a");
  renderCoins(result);
  renderUpgrades();
});
$("dropSkip").addEventListener("click", () => show("droppedRow", false));
$("dropAd").addEventListener("click", async () => {
  if (!result?.dropped.length) return;
  $("dropAd").disabled = true;
  const ok = await poki.rewardedBreak();
  if (!ok) return ($("dropAd").disabled = false);
  const before = new Set(ITEMS.filter((it) => (save.book[it.id]?.count ?? 0) > 0).map((it) => it.id));
  const extra = applyRun(save, { bag: result.dropped, dropped: [], seen: {}, coins: 0, depth: 0 }, true);
  writeSave(save);
  for (const it of extra.items) if (!before.has(it.id)) freshInBook.add(it.id);
  const grid = $("lootGrid");
  for (const it of extra.items) {
    const el = card(it, 0);
    grid.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
  }
  result.items.push(...extra.items);
  result.itemCoins += extra.itemCoins;
  result.newCoins += extra.newCoins;
  result.total += extra.total;
  result.dropped = [];
  show("droppedRow", false);
  show("resEmpty", false);
  renderCoins(result);
  renderUpgrades();
  renderBookBtn();
  setQueue.push(...extra.newSets);
  toast(S("recovered"), "#8aff8a");
  audio.play("newItem");
  nextSetPop();
});

// ------------------------------------------------------------ set complete
function nextSetPop() {
  if (mode !== "results" || !setQueue.length || !$("setPop").classList.contains("hidden")) return;
  const id = setQueue.shift(), set = SETS.find((s) => s.id === id);
  $("setPopName").textContent = STR[lang].setNames[id];
  $("setPopIcs").innerHTML = set.items.map((i) => `<img src="${itemIcon(ITEM[i])}" alt="">`).join("");
  $("setPopBonus").textContent = bonusText(set.bonus);
  show("setPop");
  audio.play("set");
  for (let i = 0; i < 2; i++) screenFx.push({ fx: createFx(confettiFx, { seed: 11 + i * 7 }), x: 150 + i * 180, y: 200 });
}
function bonusText(b) {
  return Object.entries(b).map(([k, v]) => S("setBonus") + " · " + STR[lang].bonusText[k].replace("{v}", v).replace("{p}", Math.round(v * 100))).join(", ");
}
$("setPopOk").addEventListener("click", () => {
  show("setPop", false);
  renderUpgrades();
  setTimeout(nextSetPop, 200);
});

// ------------------------------------------------------------ the collection
let bookZone = "village", bookSel = null;
function openBook() {
  mode = "book";
  show("book");
  audio.play("click");
  bookSel = null;
  renderBook();
}
function closeBook() {
  freshInBook.clear();
  show("book", false);
  mode = "results";
  renderBookBtn();
}
$("bookBtn").addEventListener("click", openBook);
$("bookClose").addEventListener("click", closeBook);
function renderBook() {
  const pct = bookPercent(save);
  $("bookPctFill").style.width = pct * 100 + "%";
  $("bookPctTx").textContent = Math.round(pct * 100) + "%";
  const tabs = $("tabs");
  tabs.innerHTML = "";
  for (const z of ZONES) {
    const b = document.createElement("button");
    b.className = "tab" + (z.id === bookZone ? " on" : "");
    const list = ITEMS.filter((it) => it.zone === z.id);
    const owned = list.filter((it) => (save.book[it.id]?.count ?? 0) > 0).length;
    b.textContent = z.coming ? `🔒 ${STR[lang].zones[z.id]}` : `${STR[lang].zones[z.id]} ${owned}/${list.length}`;
    b.disabled = !!z.coming;
    if (z.coming) b.title = S("sealNeed", { p: 30 });
    b.addEventListener("click", () => { bookZone = z.id; bookSel = null; audio.play("click"); renderBook(); });
    tabs.appendChild(b);
  }
  const grid = $("bookGrid");
  grid.innerHTML = "";
  for (const it of ITEMS.filter((i) => i.zone === bookZone)) {
    const e = save.book[it.id], owned = (e?.count ?? 0) > 0, seen = !!e && !owned;
    const el = document.createElement("div");
    el.className = `bc r-${it.rarity} ${owned ? "owned" : seen ? "seen" : "unknown"}${bookSel === it.id ? " sel" : ""}`;
    el.innerHTML = `${owned && e.variant ? '<span class="vb">🌈</span>' : ""}${freshInBook.has(it.id) ? '<span class="badge" style="position:absolute;top:-0.5em;right:-0.4em;font-size:0.6em;background:#ff3a5a;padding:0.05em 0.35em;border-radius:99em;font-weight:900">NEW</span>' : ""}
      <img src="${itemIcon(it, owned ? "color" : seen ? "dim" : "silhouette", owned && e.variant)}" alt="">
      <div class="nm">${owned || seen ? itemName(it.id) : "???"}</div><div class="st">${owned ? "★".repeat(starsOf(e.count)) + "☆".repeat(3 - starsOf(e.count)) : ""}</div>`;
    el.addEventListener("click", () => { bookSel = it.id; audio.play("click"); renderBook(); });
    grid.appendChild(el);
  }
  renderDetail();
}
function renderDetail() {
  const d = $("detail");
  if (!bookSel) {
    const zoneSets = SETS.filter((s) => ITEM[s.items[0]].zone === bookZone);
    d.innerHTML = `<h3>${S("sets")}</h3>` + zoneSets.map((s) => {
      const have = s.items.filter((i) => (save.book[i]?.count ?? 0) > 0).length, done = !!save.sets[s.id];
      return `<div class="set${done ? " done" : ""}"><b><span>${STR[lang].setNames[s.id]}</span><span>${have}/${s.items.length}</span></b>
        <div class="ics">${s.items.map((i) => { const e = save.book[i], o = (e?.count ?? 0) > 0; return `<img src="${itemIcon(ITEM[i], o ? "color" : e ? "dim" : "silhouette")}" alt="">`; }).join("")}</div>
        <div class="bn">${bonusText(s.bonus)}</div></div>`;
    }).join("");
    return;
  }
  const it = ITEM[bookSel], e = save.book[bookSel], owned = (e?.count ?? 0) > 0, seen = !!e && !owned;
  const rc = RARITY[it.rarity].color;
  d.innerHTML = `<img src="${itemIcon(it, owned ? "color" : seen ? "dim" : "silhouette", owned && e.variant, 6)}" alt="">
    <div class="nm">${owned || seen ? itemName(bookSel) : "???"}</div>
    <div class="rr" style="color:${rc}">${STR[lang].rarity[it.rarity]}</div>
    <p>${owned ? itemDesc(bookSel) : seen ? S("seenAt", { d: e.seen ?? "?" }) : S("seeDeeper")}</p>
    ${owned ? `<div class="meta"><span>${S("owned", { n: e.count })}</span><span>${"★".repeat(starsOf(e.count))}${"☆".repeat(3 - starsOf(e.count))}</span></div>
    <div class="meta"><span>${e.variant ? "🌈 " + S("variant") : ""}</span><span>${e.seen != null ? e.seen + "m" : ""}</span></div>` : ""}`;
}

// ------------------------------------------------------------ pause and settings
function pause() {
  if (mode !== "run") return;
  mode = "paused";
  drag = null;
  poki.gameplayStop();
  show("pause");
}
function resume() {
  if (mode !== "paused") return;
  show("pause", false);
  mode = "run";
  poki.gameplayStart();
}
$("resumeBtn").addEventListener("click", resume);
$("soundBtn").addEventListener("click", () => {
  audio.setMuted(!audio.muted);
  save.muted = audio.muted;
  writeSave(save);
  applyStrings();
});
$("langBtn").addEventListener("click", () => {
  lang = lang === "ko" ? "en" : "ko";
  save.lang = lang;
  writeSave(save);
  applyStrings();
});
// two taps to erase: the first asks, the second does it (browser confirm dialogs are blocked in some embeds)
let resetArmed = 0;
$("resetBtn").addEventListener("click", () => {
  if (Date.now() - resetArmed > 3000) {
    resetArmed = Date.now();
    $("resetBtn").textContent = S("resetConfirm");
    setTimeout(() => ($("resetBtn").textContent = S("reset")), 3000);
    return;
  }
  wipeSave();
  location.reload();
});

// ------------------------------------------------------------ ads off Poki: a short stand-in
function adPlaceholder(ms) {
  return new Promise((resolve) => {
    show("adBox");
    const bar = $("adBox").querySelector("i");
    bar.style.transition = "none";
    bar.style.width = "0";
    requestAnimationFrame(() => {
      bar.style.transition = `width ${ms}ms linear`;
      bar.style.width = "100%";
    });
    setTimeout(() => { show("adBox", false); resolve(true); }, ms);
  });
}

// ------------------------------------------------------------ the loop
let last = performance.now();
const idle = { dx: 0, dir: 0 };
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "run" && !poki.inAd) {
    input.dir = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    run.update(dt, input);
    input.dx = 0;
    handleEvents();
    if (mode === "run") updateHud();
    if (run.first && dragged > 40) show("hint", false);
  } else if (mode !== "paused" && mode !== "prompt") {
    run.update(dt, idle);
    if (mode === "escaping") handleEvents();
  }
  for (const f of screenFx) f.fx.update(dt);
  screenFx = screenFx.filter((f) => !f.fx.done());
  render();
  requestAnimationFrame(tick);
}
function render() {
  clearFrame(frame);
  run.draw(frame, lm);
  for (const f of screenFx) {
    f.fx.options.x = f.x;
    f.fx.options.y = f.y;
    f.fx.draw(frame);
  }
  compositeLit(frame, lm, img.data);
  let sx = 0, sy = 0;
  if (run.shake > 0) {
    sx = Math.round((Math.random() - 0.5) * 4);
    sy = Math.round((Math.random() - 0.5) * 4);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.putImageData(img, sx, sy);
}

// ------------------------------------------------------------ boot
async function boot() {
  layout();
  applyStrings();
  await poki.init((m) => audio.setAdMuted(m), adPlaceholder);
  poki.loadingFinished();
  show("noSave", !storageOk);
  if (save.runs === 0) {
    mode = "ready";
    show("ready");
    $("ready").addEventListener("pointerdown", () => mode === "ready" && startDive(), { once: true });
  } else {
    showResults();
  }
  requestAnimationFrame(tick);
}
boot();

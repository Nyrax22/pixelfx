// Ruin Diver: the loop, the input and every screen around the dive.

import { createFrame, clearFrame, createFx, painterFor } from "../../../src/core/index.js";
import * as confettiFx from "../../../src/fx/ui/confetti.js";
import { W, H, STR, ITEMS, ITEM, RARITY, SETS, UPGRADES, ZONES, SEAL_DEPTH, LANTERN_AD_SECONDS, DEATH_COIN_KEEP, STARTS, MISSIONS, SURVIVE, MATS, FACILITIES, GEAR, RESEARCH, BEASTS, CHALLENGES, EVENTS } from "./data.js";
import { loadSave, writeSave, wipeSave, storageOk, saveWasCorrupt, stats, applyRun, applyMissions, bookPercent, upgradeState, buyUpgrade, nextGoal, starsOf, zoneAt } from "./logic.js";
import { Run } from "./world.js";
import { compositeLit, setBackdrop } from "./bg.js";
import villageArt from "../art/bg_village.png";
import mineArt from "../art/bg_mine.png";
import atlasPng from "../art/px/atlas.png";
import atlasRects from "../art/px/atlas.json";
import { IMG, imgURL, loadAtlas } from "./pix.js";
import { itemIcon, icon, spriteURL, BAT, BAT_PAL, SLIME, SLIME_PAL, RED_SLIME_PAL, GOLD_SLIME_PAL, SKULL, SKULL_PAL, SLIME_KING, SLIME_KING_PAL, GOLEM, GOLEM_PAL } from "./sprites.js";
import { applyMeta, facState, upgradeFacility, gearState, craftGear, toggleEquip, gearSlots, researchState, doResearch, challengeState, claimChallenge, claimable, relicsOwned, beastsSeen } from "./meta.js";
import { audio } from "./audio.js";
import { poki } from "./poki.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), cv = $("cv"), ctx = cv.getContext("2d");
const img = ctx.createImageData(W, H), frame = createFrame(W, H), lm = new Float32Array(W * H);

let save = loadSave();
let lang = save.lang ?? ((navigator.language || "en").toLowerCase().startsWith("ko") ? "ko" : "en");
let mode = "boot";            // boot, ready, run, prompt, paused, escaping, results, book
let run = new Run(save, stats(save), save.runs === 0);
run.state = "preview"; // the cave behind the title and the hub, standing still
let result = null;            // the last dive's outcome
let freshInBook = new Set();  // owned since the book was last opened
let setQueue = [];
let screenFx = [];
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
  for (const el of document.querySelectorAll("[data-s-act]")) el.textContent = STR[lang].act[el.dataset.sAct];
  $("soundBtn").textContent = audio.muted ? "SOUND OFF" : "SOUND ON";
  for (const el of document.querySelectorAll("i[data-icon]")) el.outerHTML = icon(el.dataset.icon);
  $("langBtn").textContent = lang === "ko" ? "English" : "한국어";
}

// ------------------------------------------------------------ layout: a 16:9 stage, 1em = 10 game pixels
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  // whole-number pixel scale when it doesn't waste much of the screen: every game pixel the same size
  let k = Math.min(vw / W, vh / H);
  if (Math.floor(k) >= 1 && Math.floor(k) / k >= 0.85) k = Math.floor(k);
  const w = W * k, h = H * k;
  stage.style.width = w + "px";
  stage.style.height = h + "px";
  stage.style.fontSize = w / 48 + "px";
  const portrait = vh > vw && matchMedia("(pointer: coarse)").matches;
  $("rotate").style.display = portrait ? "flex" : "none";
  if (portrait && mode === "run") pause();
}
window.addEventListener("resize", layout);

// ------------------------------------------------------------ input
// keyboard: arrows or WASD, Space/Z jump, X/C rope. touch: drag on the left half to move (down digs, up climbs),
// the buttons on the right jump and throw a rope.
const keys = new Set();
const touch = { dir: 0, up: false, down: false, jump: false };
let jumpEdge = false, ropeEdge = false;
const isTouch = matchMedia("(pointer: coarse)").matches;
let stick = null;
stage.addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (mode !== "run" || e.target.closest("button")) return;
  const r = stage.getBoundingClientRect();
  if (e.clientX - r.left > r.width * 0.55) { jumpEdge = true; touch.jump = true; stick = stick ?? null; return; }
  stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
  stage.setPointerCapture?.(e.pointerId);
  const k = $("stick");
  k.style.left = e.clientX - r.left + "px";
  k.style.top = e.clientY - r.top + "px";
  show("stick");
  moveStick(0, 0);
});
stage.addEventListener("pointermove", (e) => {
  if (!stick || e.pointerId !== stick.id) return;
  const em = parseFloat(stage.style.fontSize);
  moveStick((e.clientX - stick.x) / em, (e.clientY - stick.y) / em);
});
function moveStick(dx, dy) {
  // dx, dy in em; the knob moves at most 2.2em from the center
  const d = Math.hypot(dx, dy), m = Math.min(1, 2.2 / (d || 1));
  $("stickKnob").style.transform = `translate(${dx * m}em, ${dy * m}em)`;
  touch.dir = dx > 0.8 ? 1 : dx < -0.8 ? -1 : 0;
  touch.up = dy < -1.4;
  touch.down = dy > 1.4;
}
const endStick = (e) => {
  if (stick && e.pointerId === stick.id) { stick = null; touch.dir = 0; touch.up = touch.down = false; show("stick", false); }
  else touch.jump = false;
};
stage.addEventListener("pointerup", endStick);
stage.addEventListener("pointercancel", endStick);
stage.addEventListener("contextmenu", (e) => e.preventDefault());
const hold = (id, on, off) => {
  const el = $(id);
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); audio.unlock(); on(); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, off);
};
hold("jumpBtn", () => { jumpEdge = true; touch.jump = true; }, () => (touch.jump = false));
hold("ropeBtn", () => (ropeEdge = true), () => {});
// the survival bar: eat, drink, torch, campfire (keys 1-4), tappable too
const actEdge = { eat: false, drink: false, torch: false, campfire: false, look: false, attack: false };
hold("attackBtn", () => (actEdge.attack = true), () => {});
hold("lookBtn", () => (actEdge.look = true), () => {});
for (const b of document.querySelectorAll("#craftBar button")) hold(b.id, () => { if (b.dataset.act === "rope") ropeEdge = true; else actEdge[b.dataset.act] = true; }, () => {});

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  audio.unlock();
  const k = e.key.toLowerCase();
  if (mode === "ready" && !e.repeat) return startDive();
  if (k === "escape" && !e.repeat) {
    if (mode === "base") return closeBase();
    if (mode === "prompt" && choiceEv) return closeChoice();
    if (mode === "run") return pause();
    if (mode === "paused") return resume();
    if (mode === "book") return closeBook();
  }
  if (mode === "results" && k === "enter" && !e.repeat) return dive();
  if (!e.repeat && (k === " " || k === "z" || k === "k")) jumpEdge = true;
  if (!e.repeat && (k === "c" || k === "r" || k === "5")) ropeEdge = true;
  if (!e.repeat && (k === "x" || k === "j") && mode === "run") actEdge.attack = true;
  if (!e.repeat && mode === "run") {
    if (k === "1" || k === "e") actEdge.eat = true;
    if (k === "2" || k === "q") actEdge.drink = true;
    if (k === "3" || k === "t") actEdge.torch = true;
    if (k === "4" || k === "f") actEdge.campfire = true;
  }
  keys.add(k);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "run") pause(); });

function readInput() {
  const kd = (...ks) => ks.some((k) => keys.has(k));
  const up = kd("arrowup", "w") || touch.up, down = kd("arrowdown", "s") || touch.down;
  const dir = (kd("arrowright", "d") ? 1 : 0) - (kd("arrowleft", "a") ? 1 : 0) || touch.dir;
  // on the keyboard, up also jumps when there's no ladder to climb
  const upJump = kd("arrowup", "w") && !run.climbable(run.p.x + 5, run.p.y + 7) && !run.climbable(run.p.x + 5, run.p.y + 2) && !run.atWinch && !run.nearEv;
  const inp = { dir, up, down, jump: kd(" ", "z", "k") || touch.jump || upJump, jumpPressed: jumpEdge || (upJump && !readInput.upWas), ropePressed: ropeEdge, ...actEdge };
  readInput.upWas = upJump;
  jumpEdge = ropeEdge = false;
  for (const k in actEdge) actEdge[k] = false;
  return inp;
}

// ------------------------------------------------------------ toasts and banners
let toastTimer = 0;
function toast(text, color = "#fff", ms = 1900) {
  const t = $("toast");
  t.textContent = text;
  t.style.color = color;
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
  clearTimeout(toastTimer);
  t.style.animationDuration = ms / 1000 + 0.2 + "s";
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
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
let hudBag = -1, gaugeMax = 60, lastHud = {};
function buildHud() {
  lastHud = {};
  // the depth gauge: from the top to the exit at the bottom, with the zone line, the bosses and your record
  gaugeMax = SEAL_DEPTH;
  const marks = $("gaugeMarks");
  marks.innerHTML = "";
  const mark = (m, cls, label) => {
    const el = document.createElement("div");
    el.className = "gmark " + cls;
    el.style.top = (m / gaugeMax) * 100 + "%";
    el.innerHTML = `<i></i>${label}`;
    marks.appendChild(el);
  };
  mark(0, "", "0m");
  for (const z of ZONES) if (z.from > 0 && z.from < gaugeMax) mark(z.from, "zone", `${z.from}m`);
  if (save.best > 4 && save.best < gaugeMax - 4) mark(save.best, "best", `★${save.best}m`);
  mark(SEAL_DEPTH, "exit", `${icon("exit")}${SEAL_DEPTH}m`);
  show("touchPad", isTouch);
  const cc = run.craftCost("campfire");
  $("act-campfire").querySelector(".c").innerHTML = `${cc.wood}${icon("wood")}${cc.stone}${icon("stone")}`;
  $("goalLine").textContent = S("goal", { d: SEAL_DEPTH });
  updateHud(true);
}
const meter = (id, v) => {
  const el = $(id);
  el.querySelector("i").style.width = v + "%";
  el.classList.toggle("low", v < 25);
  el.classList.toggle("empty", v <= 0);
};
function updateHud(force = false) {
  const st = run.st, d = run.depth;
  if (force || lastHud.d !== d) {
    $("hDepth").innerHTML = `${d}<small>m</small>`;
    const k = Math.min(1, d / gaugeMax);
    $("gaugeFill").style.height = k * 100 + "%";
    $("gaugeMe").style.top = k * 100 + "%";
    $("hExit").textContent = S("toExit", { d: Math.max(0, SURVIVE.exitDepth - d) });
    $("hZone").textContent = STR[lang].zones[zoneAt(d).id];
    lastHud.d = d;
  }
  const coins = save.coins + run.coins;
  if (force || lastHud.coins !== coins) { $("hCoins").textContent = coins; lastHud.coins = coins; }
  if (force || lastHud.hp !== run.hp) {
    $("hearts").innerHTML = Array.from({ length: st.hearts }, (_, i) => icon(i < run.hp ? "heart" : "heartOff")).join("");
    if (lastHud.hp != null && run.hp < lastHud.hp) { $("hearts").classList.remove("hit"); void $("hearts").offsetWidth; $("hearts").classList.add("hit"); }
    lastHud.hp = run.hp;
  }
  meter("mFood", run.food);
  meter("mWater", run.water);
  meter("mLight", run.light);
  meter("mPick", (run.dur / run.durMax) * 100);
  // the collapse: on the gauge, and a warning when it's close
  const colM = Math.max(0, run.colY / 16);
  $("gaugeCol").style.height = Math.min(100, (colM / gaugeMax) * 100) + "%";
  const cw = $("colWarn"), gap = Math.max(0, Math.floor(run.colGap));
  show("colWarn", !!run.colStarted && gap < 30);
  if (run.colStarted && gap < 30) { cw.textContent = S("collapseGap", { d: gap }); cw.classList.toggle("near", gap < 9); }
  // the survival bar: counts, and whether each action can be done now
  const inv = run.inv, key = JSON.stringify(inv);
  if (force || lastHud.inv !== key) {
    lastHud.inv = key;
    $("cnt-eat").textContent = inv.mushroom;
    $("cnt-drink").textContent = inv.water;
    $("cnt-wood").textContent = inv.wood;
    $("cnt-stone").textContent = inv.stone;
    const cc = run.craftCost("campfire");
    const can = { eat: inv.mushroom > 0, drink: inv.water > 0, torch: inv.wood >= SURVIVE.torch.wood, campfire: inv.wood >= cc.wood && inv.stone >= cc.stone, rope: inv.wood >= SURVIVE.rope.wood };
    for (const [a, ok] of Object.entries(can)) $("act-" + a).classList.toggle("off", !ok);
  }
  // nudge the action you need
  $("act-eat").classList.toggle("want", run.food < 35 && inv.mushroom > 0);
  $("act-drink").classList.toggle("want", run.water < 35 && inv.water > 0);
  $("act-torch").classList.toggle("want", run.light < 25 && inv.wood >= SURVIVE.torch.wood);
  if (isTouch) show("lookBtn", !!run.nearEv);
}
$("pauseBtn").addEventListener("click", () => pause());

// ------------------------------------------------------------ the expedition
function startDive() {
  audio.unlock();
  const first = save.runs === 0;
  run = new Run(save, stats(save), first, first ? null : chosenStart());
  result = null;
  hideScreens();
  show("hud");
  buildHud();
  mode = "run";
  poki.gameplayStart();
  $("hint").querySelector("div:last-child").textContent = isTouch ? S("ctrlTouch") : S("ctrlKeys");
  $("hint").querySelector(".hand").textContent = "";
  show("hint", save.runs < 2);
  clearTimeout(startDive.hintT);
  startDive.hintT = setTimeout(() => show("hint", false), 9000);
}
async function dive() {
  if (mode !== "results") return;
  audio.play("click");
  mode = "boot";
  await poki.commercialBreak();
  startDive();
}
function hideScreens() {
  for (const id of ["ready", "results", "book", "base", "choice", "lanternPrompt", "pause", "setPop", "bossBar"]) show(id, false);
}

let promptAction = null;
function promptBox(title, stdLabel, adLabel, onStd, onAd) {
  mode = "prompt";
  poki.gameplayStop();
  stick = null; touch.dir = 0; touch.up = touch.down = touch.jump = false; keys.clear();
  show("stick", false);
  $("lpTitle").innerHTML = title;
  $("lpUp").textContent = stdLabel;
  $("lpAdTx").textContent = adLabel;
  promptAction = { onStd, onAd };
  show("lanternPrompt");
}
$("lpUp").addEventListener("click", () => {
  show("lanternPrompt", false);
  promptAction?.onStd();
});
$("lpAd").addEventListener("click", async () => {
  show("lanternPrompt", false);
  const ok = await poki.rewardedBreak();
  promptAction?.onAd(ok);
});
const backToRun = () => { mode = "run"; poki.gameplayStart(); };

// ------------------------------------------------------------ event choices in the cave
let choiceEv = null;
const COST_ICON = { hp: "heart", coins: "coin", mushroom: "mushroom", water: "water", wood: "wood", stone: "stone" };
const costHtml = (cost, have) => Object.entries(cost).map(([k, v]) => `<span class="${have && !have(k, v) ? "no" : ""}">${v}${icon(COST_ICON[k] ?? k)}</span>`).join("");
function openChoice(ev) {
  choiceEv = ev;
  mode = "prompt";
  poki.gameplayStop();
  stick = null; touch.dir = 0; touch.up = touch.down = touch.jump = false; keys.clear();
  show("stick", false);
  renderChoice();
  show("choice");
}
function renderChoice(msg) {
  const ev = choiceEv, def = EVENTS[ev.type], [name, desc] = STR[lang].ev[ev.type];
  $("chTitle").textContent = name;
  $("chDesc").textContent = msg ?? desc;
  $("chHave").innerHTML = ["hp", "coins", "mushroom", "water", "wood", "stone"].map((k) => `<span>${icon(COST_ICON[k])}${k === "hp" ? run.hp : k === "coins" ? run.coins : run.inv[k]}</span>`).join("");
  const box = $("chOpts");
  box.innerHTML = "";
  if (!ev.done) for (const o of def.opts) {
    const b = document.createElement("button");
    b.innerHTML = `<span>${STR[lang].evOpt[o.id]}</span><span class="cost">${costHtml(o.cost)}</span>`;
    b.disabled = !run.canPay(o.cost);
    b.addEventListener("click", () => {
      const m = run.resolveEvent(ev, o.id);
      if (!m) return audio.play("deny");
      handleEvents();
      if (def.stay) { renderChoice(STR[lang].evDone[m]); updateHud(true); }
      else { closeChoice(); toast(STR[lang].evDone[m], "#ffe06a", 2400); }
    });
    box.appendChild(b);
  }
  const leave = document.createElement("button");
  leave.className = "leave";
  leave.textContent = S("leave");
  leave.addEventListener("click", closeChoice);
  box.appendChild(leave);
}
function closeChoice() {
  show("choice", false);
  choiceEv = null;
  if (run.state === "play") backToRun();
}

function handleEvents() {
  while (run.events.length) {
    const e = run.events.shift();
    switch (e.type) {
      case "toast": {
        let text = S(e.key);
        if (e.key === "needs") text = S("needs", { what: STR[lang].inv[e.what] ?? e.what });
        if (e.key === "placed") text = STR[lang].placed[e.what];
        toast(text, e.key === "needs" ? "#ff9a8a" : e.key === "reachedExit" ? "#9affb0" : "#fff");
        break;
      }
      case "hint":
        toast(S(isTouch && e.key === "hintSwing" ? "hintSwingTouch" : e.key), "#ffe06a", 3200);
        save.hintsShown = [...run.hintsShown];
        break;
      case "zone":
        banner(STR[lang].zones[e.zone], `${e.depth}m`);
        break;
      case "seal":
        setTimeout(() => toast(bookPercent(save) >= 0.3 ? S("sealOpen") : S("sealNeed", { p: 30 }), "#6ad0ff"), 400);
        break;
      case "coin":
        $("hCoinsBox").classList.remove("bump");
        void $("hCoinsBox").offsetWidth;
        $("hCoinsBox").classList.add("bump");
        break;
      case "dead":
        setTimeout(() => {
          if (run.revived) return finishDive(true);
          promptBox(icon("skull") + " " + S("died"), S("giveUp"), S("revive"),
            () => finishDive(true),
            (ok) => { if (ok) { run.revive(); backToRun(); } else finishDive(true); });
        }, 900);
        break;
      case "bossWake":
        banner(STR[lang].bosses[e.id], S("bossHint"));
        bossBar(e.id, e.hp, e.hp);
        break;
      case "bossHp":
        bossBar(e.id, e.hp);
        break;
      case "bossDown":
        show("bossBar", false);
        banner(STR[lang].bosses[e.id], S("bossDown"));
        break;
      case "escaped":
        finishDive(false);
        break;
      case "evFound":
        toast(S("evFound", { name: STR[lang].ev[e.type][0] }), "#ffe06a", 2200);
        break;
      case "beastSeen":
        if (!save.beasts[e.id]) toast("NEW · " + STR[lang].beastNames[e.id], "#ff9aff", 1800);
        break;
      case "event":
        openChoice(e.ev);
        break;
    }
  }
}

let bossMax = 0;
function bossBar(id, hp, max) {
  if (max) bossMax = max;
  $("bossName").textContent = STR[lang].bosses[id];
  $("bossPips").innerHTML = Array.from({ length: bossMax }, (_, i) => `<i class="${i < hp ? "on" : ""}"></i>`).join("");
  show("bossBar", true);
}

function finishDive(died) {
  show("bossBar", false);
  for (const id of run.bossesBeaten ?? []) save.bossKills[id] = (save.bossKills[id] ?? 0) + 1;
  mode = "escaping";
  poki.gameplayStop();
  show("hint", false);
  show("stick", false);
  const before = new Set(ITEMS.filter((it) => (save.book[it.id]?.count ?? 0) > 0).map((it) => it.id));
  // you keep what you found either way: the run's score is how deep and how long you lasted
  result = applyRun(save, { bag: run.bag, dropped: [], seen: run.seen, coins: run.coins, depth: run.depthMax });
  result.missions = [];
  result.died = died;
  result.won = run.won;
  result.lost = [];
  result.time = run.alive ?? 0;
  result.meta = applyMeta(save, { mats: run.mats, beasts: run.beasts, events: run.eventsMet, used: run.used, time: result.time, coins: Math.round(run.coins * stats(save).coinK), escaped: !died, died, torches: run.torchesPlaced, depth: run.depthMax });
  result.total += result.meta.rewards;
  save.hintsShown = [...run.hintsShown];
  for (const it of result.items) if (!before.has(it.id)) freshInBook.add(it.id);
  setQueue.push(...result.newSets);
  writeSave(save);
  setTimeout(() => {
    show("hud", false);
    showResults();
  }, died ? 300 : 800);
}

// ------------------------------------------------------------ results (and the hub, when there's no dive to show)
function showResults() {
  mode = "results";
  show("results");
  const r = result;
  const title = $("resTitle"), grid = $("lootGrid");
  grid.innerHTML = "";
  if (r) {
    const mm = Math.floor(r.time / 60), ss = String(Math.floor(r.time % 60)).padStart(2, "0");
    title.innerHTML = `<span class="${r.died ? "dead" : ""}">${r.won ? S("won") : r.died ? S("died") : S("escaped")}</span> <small>${S("reachedDepth")} ${r.depth}m · ${S("survived")} ${mm}:${ss}</small>${r.record ? `<span id="resRecord">★ ${S("newRecord")}</span>` : ""}`;
    show("resEmpty", !r.items.length && !r.died);
    $("resEmpty").textContent = S("nothing");
    const shown = stack(r.items);
    shown.forEach((it, i) => grid.appendChild(card(it, i)));
    renderCoins(r);
    // what was in the bag when you fell: it stays down there
    const dr = $("droppedRow");
    show("droppedRow", false);
    dr.querySelector(".lbl").textContent = r.lost.length ? S("lostBag") : S("keptCoins");
    dr.querySelector(".ic").innerHTML = r.lost.map((d) => `<img src="${itemIcon(ITEM[d.id], "color", d.variant)}" alt="">`).join("");
    dr.querySelector(".sp").textContent = r.lost.length ? S("keptCoins") : "";
    const mt = r.meta ?? { mats: {}, newBeasts: [] }, mr = $("matsRow");
    const bits = Object.entries(mt.mats).map(([m, n]) => `<span>${icon(m)}+${n}</span>`);
    for (const id of mt.newBeasts) bits.push(`<span style="color:#ff9aff">NEW ${STR[lang].beastNames[id]}</span>`);
    if (mt.allSeen) bits.push(`<span style="color:var(--gold)">${S("beastSeenAll")} +${icon("coin")}150</span>`);
    if (mt.allKilled) bits.push(`<span style="color:var(--gold)">${S("beastKillAll")} +${icon("coin")}300</span>`);
    mr.innerHTML = bits.length ? `<span class="lbl">${S("matsHome")}</span>` + bits.join("") : "";
    show("matsRow", bits.length > 0);
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
    show("matsRow", false);
    show("doubleBtn", false);
    $("diveBtn").textContent = S("dive");
  }
  renderUpgrades();
  renderBookBtn();
  renderBaseBtn();
  renderStarts();
  show("missionBox", false);
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
const missionText = (def) => STR[lang].mission[def.kind].replace("{n}", def.n);
function renderMissions(done = []) {
  const box = $("missionBox");
  const rows = done.map((def) => `<div class="mr done">✓ ${missionText(def)}<b>${icon("coin")}${def.reward}</b></div>`);
  for (const m of save.missions.active) {
    const def = MISSIONS[m.i], k = Math.min(1, m.p / def.n);
    rows.push(`<div class="mr"><span>${missionText(def)}</span><i><u style="width:${k * 100}%"></u></i><em>${Math.min(m.p, def.n)}/${def.n}</em><b>${icon("coin")}${def.reward}</b></div>`);
  }
  if (!rows.length) rows.push(`<div class="mr done">${S("allMissions")}</div>`);
  box.innerHTML = `<h4>${S("missions")}</h4>` + rows.slice(0, 4).join("");
}
function renderCoins(r) {
  const parts = [];
  if (r.itemCoins) parts.push(`${S("loot")} <b>+${r.itemCoins}</b>`);
  if (r.newCoins) parts.push(`${S("newBonus")} <b>+${r.newCoins}</b>`);
  if (r.looseCoins) parts.push(`${S("looseCoins")} <b>+${r.looseCoins}</b>`);
  if (r.missionCoins) parts.push(`${S("missionReward")} <b>+${r.missionCoins}</b>`);
  $("resCoins").innerHTML = `<span id="resTotal">${icon("coin")} +${r.total * (r.doubled ? 2 : 1)}</span>${parts.map((p) => `<span>${p}</span>`).join("")}${r.doubled ? `<span><b>×2</b></span>` : ""}`;
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
    el.innerHTML = `<div class="ic">${icon(u.id)}</div><div class="tx"><b>${name}</b> <span>${st.max ? S("max") : S("lvl", { n: st.level + 1 })}</span><br><span>${STR[lang].upgradeDesc[u.id]}</span> ${line}</div>
      <button ${st.affordable ? "" : "disabled"}>${st.max ? S("max") : st.locked ? icon("lock") : icon("coin") + st.cost}</button>`;
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
const UPGRADE_ICON = Object.fromEntries(UPGRADES.map((u) => [u.id, icon(u.id)]));
const startOpen = (st) => !st.boss || (save.bossKills[st.boss] ?? 0) > 0;
const chosenStart = () => STARTS.find((st) => st.id === save.start && startOpen(st)) ?? STARTS[0];
function renderStarts() {
  const open = STARTS.filter(startOpen), box = $("starts");
  show("starts", open.length > 1);
  box.innerHTML = `<span>${S("start")}</span>` + open.map((st) => `<button data-id="${st.id}" class="${chosenStart().id === st.id ? "on" : ""}">${STR[lang].starts[st.id]}</button>`).join("");
  for (const b of box.querySelectorAll("button")) b.addEventListener("click", () => {
    save.start = b.dataset.id;
    writeSave(save);
    audio.play("click");
    renderStarts();
  });
}
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
    b.textContent = z.coming ? `${STR[lang].zones[z.id]} ?` : `${STR[lang].zones[z.id]} ${owned}/${list.length}`;
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
    el.innerHTML = `${owned && e.variant ? '<span class="vb">★</span>' : ""}${freshInBook.has(it.id) ? '<span class="badge" style="position:absolute;top:-0.5em;right:-0.4em;font-size:0.6em;background:#ff3a5a;padding:0.05em 0.35em;border-radius:99em;font-weight:900">NEW</span>' : ""}
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
    <div class="meta"><span>${e.variant ? "★ " + S("variant") : ""}</span><span>${e.seen != null ? e.seen + "m" : ""}</span></div>` : ""}`;
}

// ------------------------------------------------------------ the base
let baseTab = "fac", beastSel = null;
const BEAST_SPR = {
  bat: [BAT[0], BAT_PAL], slime: [SLIME[0], SLIME_PAL], gold_slime: [SLIME[0], GOLD_SLIME_PAL], red_slime: [SLIME[0], RED_SLIME_PAL],
  skull: [SKULL[0], SKULL_PAL], slime_king: [SLIME_KING[0], SLIME_KING_PAL], golem: [GOLEM[0], GOLEM_PAL],
};
const has = (k, v) => (k === "coins" ? save.coins : save.mats[k] ?? 0) >= v;
/** Is there something to do in each part of the base right now? */
function baseWants() {
  return {
    fac: FACILITIES.some((f) => facState(save, f.id).can),
    bench: GEAR.some((g) => gearState(save, g).can),
    lab: RESEARCH.some((r) => researchState(save, r).can),
    beasts: false,
    rec: claimable(save) > 0,
  };
}
function renderBaseBtn() {
  show("baseDot", Object.values(baseWants()).some(Boolean));
}
function openBase() {
  mode = "base";
  show("base");
  audio.play("click");
  renderBase();
}
function closeBase() {
  show("base", false);
  mode = "results";
  renderUpgrades();
  renderBaseBtn();
}
$("baseBtn").addEventListener("click", openBase);
$("baseClose").addEventListener("click", closeBase);
function renderBase() {
  $("baseMats").innerHTML = `<span>${icon("coin")}<b>${save.coins}</b></span>` + MATS.map((m) => `<span title="${STR[lang].mats[m]}">${icon(m)}<b>${save.mats[m]}</b></span>`).join("");
  const w = baseWants();
  $("baseTabs").innerHTML = Object.entries(STR[lang].baseTabs).map(([id, name]) => `<button class="tab${id === baseTab ? " on" : ""}" data-t="${id}">${name}${w[id] ? '<span class="dot"></span>' : ""}</button>`).join("");
  for (const b of $("baseTabs").querySelectorAll("button")) b.addEventListener("click", () => { baseTab = b.dataset.t; audio.play("click"); renderBase(); });
  const body = $("baseBody");
  body.className = baseTab === "rec" ? "one" : baseTab === "beasts" ? "beasts" : "";
  body.innerHTML = "";
  ({ fac: baseFac, bench: baseBench, lab: baseLab, beasts: baseBeasts, rec: baseRec })[baseTab](body);
}
function boxEl(html, cls = "") {
  const el = document.createElement("div");
  el.className = "bx " + cls;
  el.innerHTML = html;
  return el;
}
const act = (el, fn) => el.querySelector(":scope > button")?.addEventListener("click", () => {
  if (!fn()) return audio.play("deny");
  audio.play("upgrade");
  writeSave(save);
  renderBase();
});
function baseFac(body) {
  for (const f of FACILITIES) {
    const st = facState(save, f.id), L = STR[lang];
    const next = st.max ? null : L.facNext[f.id]?.[st.lv + 1];
    const now = L.facNext[f.id]?.[st.lv];
    const extra = f.id === "bench" ? S("slots", { a: save.equip.length, b: gearSlots(save) }) : now || "";
    const el = boxEl(`${icon(f.id)}<div><b>${L.fac[f.id]}</b><span class="lv">${st.lv ? S("facLv", { n: st.lv }) : "—"}</span><div class="d">${L.facDesc[f.id]}${extra ? " · " + extra : ""}${next ? ` → <span style="color:#8aff8a">${next}</span>` : ""}</div>
      ${st.max ? "" : `<div class="c">${costHtml(st.cost, has)}</div>`}</div>
      <button class="${st.can ? "can" : ""}" ${st.max ? "disabled" : ""}>${st.max ? S("max") : st.lv ? S("upgrade") : S("build")}</button>`, st.max ? "done" : "");
    act(el, () => upgradeFacility(save, f.id));
    if (f.id === "museum" && st.lv > 0) {
      const b = document.createElement("button");
      b.innerHTML = `${icon("book")}${S("book")}`;
      b.style.cssText = "min-width:0;padding:0.2em 0.5em;margin-top:0.25em;font-size:0.95em";
      b.addEventListener("click", () => { show("base", false); openBook(); });
      el.querySelector("div").appendChild(b);
    }
    body.appendChild(el);
  }
}
function baseBench(body) {
  for (const g of GEAR) {
    const st = gearState(save, g), [name, desc] = STR[lang].gear[g.id];
    const need = !st.tierOk ? `<div class="c"><span class="no">${S("needTier", { f: STR[lang].fac.bench, n: g.tier })}</span></div>` : "";
    const label = st.owned ? (st.equipped ? S("equipped") : S("equip")) : S("craft");
    const el = boxEl(`${icon("gear_" + g.id)}<div><b>${name}</b><div class="d">${desc}</div>${st.owned ? "" : need || `<div class="c">${costHtml(g.cost, has)}</div>`}</div>
      <button class="${st.equipped ? "on" : st.can || st.owned ? "can" : ""}" ${!st.owned && !st.tierOk ? "disabled" : ""}>${label}</button>`, (!st.tierOk && !st.owned ? "lock" : "") + (st.equipped ? " done" : ""));
    act(el, () => { if (st.owned) { toggleEquip(save, g.id); return true; } return craftGear(save, g.id); });
    body.appendChild(el);
  }
  const n = document.createElement("div");
  n.id = "baseNote";
  n.textContent = S("slots", { a: save.equip.length, b: gearSlots(save) });
  body.appendChild(n);
}
function baseLab(body) {
  for (const r of RESEARCH) {
    const st = researchState(save, r), [name, desc] = STR[lang].res[r.id];
    const needs = [];
    if (!st.tierOk) needs.push(S("needTier", { f: STR[lang].fac.lab, n: r.tier }));
    if (!st.relicOk) needs.push(S("needRelics", { n: r.needRelics }) + ` (${relicsOwned(save)})`);
    if (!st.beastOk) needs.push(S("needBeasts", { n: r.needBeasts }) + ` (${beastsSeen(save)})`);
    const el = boxEl(`${icon("res_" + r.id)}<div><b>${name}</b><div class="d">${desc}</div>${st.done ? "" : needs.length ? `<div class="c"><span class="no">${needs.join(" · ")}</span></div>` : `<div class="c">${costHtml(r.cost, has)}</div>`}</div>
      <button class="${st.can ? "can" : ""}" ${st.done ? "disabled" : ""}>${st.done ? S("researched") : S("research")}</button>`, st.done ? "done" : needs.length ? "lock" : "");
    act(el, () => doResearch(save, r.id));
    body.appendChild(el);
  }
}
function baseBeasts(body) {
  const grid = document.createElement("div");
  grid.className = "bgrid";
  for (const b of BEASTS) {
    const e = save.beasts[b.id], [rows, pal] = BEAST_SPR[b.id];
    const c = document.createElement("div");
    c.className = "bcell" + (beastSel === b.id ? " sel" : "");
    const hd = IMG[b.id];
    c.innerHTML = `<img src="${hd ? imgURL(hd, e ? "color" : "silhouette") : spriteURL(b.id, rows, pal, e ? "color" : "silhouette", 4)}" alt=""><div>${e ? STR[lang].beastNames[b.id] : "???"}</div><div class="k">${e ? S("beastKills", { n: e.kills }) : ""}</div>`;
    c.addEventListener("click", () => { beastSel = b.id; audio.play("click"); renderBase(); });
    grid.appendChild(c);
  }
  body.appendChild(grid);
  const side = document.createElement("div");
  side.id = "beastSide";
  const id = beastSel ?? BEASTS.find((b) => save.beasts[b.id])?.id;
  if (!id) side.innerHTML = `<p>${S("unknownBeast")}</p>`;
  else {
    const b = BEASTS.find((x) => x.id === id), e = save.beasts[id], [rows, pal] = BEAST_SPR[id];
    const hd = IMG[id], pic = (mode) => (hd ? imgURL(hd, mode) : spriteURL(id, rows, pal, mode, 4));
    if (!e) side.innerHTML = `<img src="${pic("silhouette")}" alt=""><h4>???</h4><p>${S("unknownBeast")}</p>`;
    else {
      // drops: only the ones you've actually seen fall
      const drops = Object.keys(b.drops).map((m) => (e.drops?.[m] ? `${icon(m)}${STR[lang].mats[m]}` : "???")).join(" · ");
      side.innerHTML = `<img src="${pic("color")}" alt=""><h4>${STR[lang].beastNames[id]}</h4>
        <div class="row"><span>${STR[lang].zones[b.zone]}</span><span>${b.boss ? "BOSS" : ""}</span></div>
        <p>${STR[lang].beastDesc[id]}</p>
        <div class="row"><span>${S("beastKills", { n: e.kills })}</span><span>${S("beastFirst", { d: e.seen ?? "?" })}</span></div>
        <div>${S("beastDrops")}: ${drops}</div>`;
    }
  }
  body.appendChild(side);
}
function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s2 = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}` : `${m}:${String(s2).padStart(2, "0")}`;
}
function baseRec(body) {
  const r = save.rec, L = STR[lang].rec;
  const fav = Object.entries(r.used).sort((a, b) => b[1] - a[1])[0];
  const bosses = Object.values(save.bossKills).reduce((a, b) => a + b, 0);
  const rows = [
    [L.runs, save.runs], [L.best, save.best + "m"], [L.escapes, r.escapes], [L.deaths, r.deaths],
    [L.time, fmtTime(r.time)], [L.coins, r.coins], [L.relics, Math.round(bookPercent(save) * 100) + "%"], [L.beasts, `${beastsSeen(save)}/${BEASTS.length}`],
    [L.kills, r.kills], [L.bosses, bosses], [L.events, r.events], [L.fav, fav ? `${STR[lang].act[fav[0]] ?? fav[0]} ×${fav[1]}` : "—"],
  ];
  const rec = document.createElement("div");
  rec.className = "recs";
  rec.innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  body.appendChild(rec);
  const h = document.createElement("div");
  h.id = "baseNote";
  h.innerHTML = `<b style="color:var(--gold)">${icon("star")}${S("challenges")}</b>`;
  body.appendChild(h);
  for (const c of CHALLENGES) {
    const st = challengeState(save, c), el = document.createElement("div");
    el.className = "chl" + (st.claimed ? " got" : "");
    el.innerHTML = `<span>${STR[lang].ch[c.id]}</span><i><u style="width:${(st.v / c.n) * 100}%"></u></i><em>${icon("coin")}${c.reward}</em><button class="${st.done && !st.claimed ? "can" : ""}" ${st.done && !st.claimed ? "" : "disabled"}>${st.claimed ? S("claimed") : st.done ? S("claim") : `${st.v}/${c.n}`}</button>`;
    el.querySelector("button").addEventListener("click", () => {
      if (!claimChallenge(save, c.id)) return audio.play("deny");
      audio.play("set");
      writeSave(save);
      renderBase();
    });
    body.appendChild(el);
  }
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
const idle = { dir: 0, up: false, down: false, jump: false, jumpPressed: false, ropePressed: false };
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "run" && !poki.inAd) {
    run.update(dt, readInput());
    handleEvents();
    if (mode === "run") updateHud();
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
  await loadAtlas(atlasPng, atlasRects); // painted sprites (PixelLab); the game falls back to code sprites without them
  layout();
  applyStrings();
  await poki.init((m) => audio.setAdMuted(m), adPlaceholder);
  poki.loadingFinished();
  show("noSave", !storageOk);
  if (saveWasCorrupt) setTimeout(() => toast(S("saveCorrupt"), "#ffb0a0", 4000), 600);
  if (save.runs === 0) {
    mode = "ready";
    show("ready");
    $("ready").addEventListener("pointerdown", () => mode === "ready" && startDive(), { once: true });
  } else {
    showResults();
  }
  requestAnimationFrame(tick);
}
// painted backdrops (made with Scenario's Retro Diffusion): decode once, hand the pixels to the renderer
function loadBackdrop(z, src) {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    const g = c.getContext("2d");
    g.drawImage(im, 0, 0);
    setBackdrop(z, im.width, im.height, g.getImageData(0, 0, im.width, im.height).data);
  };
  im.src = src;
}
loadBackdrop(0, villageArt);
loadBackdrop(1, mineArt);
document.documentElement.style.setProperty("--title-art", `url(${villageArt})`);

// ?debug exposes the game for automated playtests
if (/[?&]debug/.test(location.search)) window.__rd = { get run() { return run; }, get mode() { return mode; }, save: () => save };
boot();

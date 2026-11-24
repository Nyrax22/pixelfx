// 던전이 살아있다: the loop, the screens, and the glue between the rules, the renderer and the player.

import * as S from "./sim.js";
import { Renderer, critterIcon, roomIcon, cloneCanvas, miniStage, FX } from "./render.js";
import { createFx } from "../../../src/core/index.js";
import { cardIcon, chibi } from "./sprites.js";
import * as A from "./audio.js";
import { save, load, exportSave, importSave, wipe } from "./save.js";
import { playPrologue } from "./prologue.js";
import * as M from "./map.js";
import { kinetic, setKineticSound, KINETIC_CSS } from "./kinetic.js";
{ const st = document.createElement("style"); st.textContent = KINETIC_CSS; document.head.appendChild(st); }
setKineticSound((n) => A.sfx(n));

const $ = (id) => document.getElementById(id);
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const CLS = (c) => S.BAL.classes[c]?.name ?? c;
const KIND = { trap: "함정", facility: "방어 시설", monster: "몬스터", spell: "마법", support: "회복·강화" };
const EL = { physical: "물리", lightning: "번개", fire: "불", ice: "얼음", poison: "독", arcane: "비전", fear: "공포", holy: "신성" };

const R = new Renderer($("cv"));
let { meta, run } = load();
let mode = "boot", speed = 1, slowT = 0, selected = -1, placingRoom = null, lastPhase = null, modalOpen = false, menuPause = false;
const modalQueue = [];
let prologue = null, backdrop = null;
window.__game = { get run() { return run; }, get meta() { return meta; }, S, R, chibi };

// ---------------------------------------------------------------- layout
function fit() {
  const portrait = innerHeight > innerWidth * 1.05;
  if (portrait !== R.portrait) R.setLayout(portrait);
  const st = $("stage").getBoundingClientRect();
  R.resizeView(Math.max(1, st.width), Math.max(1, st.height), Math.min(2, window.devicePixelRatio || 1));
}
addEventListener("resize", fit);
const toScreen = (x, y) => R.worldToScreen(x, y);
R.onText = (x, y, text, cls) => {
  const [sx, sy] = toScreen(x, y);
  const e = h("div", "ft " + cls, esc(text));
  e.style.left = sx + "px"; e.style.top = sy + "px";
  $("floaters").appendChild(e);
  setTimeout(() => e.remove(), 1300);
};

// ---------------------------------------------------------------- little UI pieces
/** A button that asks twice instead of a browser dialog (embedded viewers refuse confirm()). */
function confirmBtn(btn, ask, action) {
  const label = btn.textContent;
  let armed = false, timer = 0;
  btn.onclick = () => {
    if (armed) { clearTimeout(timer); action(); return; }
    armed = true;
    btn.textContent = ask;
    timer = setTimeout(() => { armed = false; btn.textContent = label; }, 3500);
  };
  return btn;
}
function shakeEl(el) { if (!el) return; el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); }
function toast(text, onClick) {
  const e = h("div", "tt", text);
  if (onClick) e.onclick = onClick;
  $("toast").appendChild(e);
  setTimeout(() => e.remove(), 3600);
}
function banner(text, sub = "") {
  const b = $("banner");
  b.innerHTML = `<span class="bt"></span>` + (sub ? `<small>${esc(sub)}</small>` : "");
  kinetic(b.querySelector(".bt"), text, { speed: 45, quiet: true });
  b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
}
let hintText = "";
function hint(t) { if (t !== hintText) { hintText = t; $("hint").textContent = t; } }
function subtitle(t) { $("subtitle").style.opacity = t ? 1 : 0; if (t) kinetic($("subtitle"), t, { speed: 45 }); }

function openModal(build, { force = false } = {}) {
  if (modalOpen && !force) { modalQueue.push(build); return; }
  const m = $("modal");
  m.innerHTML = "";
  m.hidden = false;
  modalOpen = true;
  build(m);
}
function closeModal() {
  $("modal").hidden = true;
  $("modal").innerHTML = "";
  modalOpen = false;
  if (modalQueue.length) openModal(modalQueue.shift());
}

function paletteFor(def, card) {
  if (card?.mon?.palette) return card.mon.palette;
  for (const t of def.traits ?? []) { const p = S.MON.traits[t]?.palette; if (p) return S.MON.palettes[p]; }
  return null;
}
function cardEl(card, big = false) {
  const def = S.cardDef(card);
  const e = h("div", `card k-${def.kind}${big ? " big" : ""}`);
  e.appendChild(h("div", "stripe"));
  const cost = run ? S.cardCost(run, card) : def.cost;
  const c = h("div", "cost"); c.appendChild(h("b", "", String(cost))); e.appendChild(c);
  const icon = def.kind === "monster" ? cloneCanvas(critterIcon(def.species, paletteFor(def, card))) : cloneCanvas(cardIcon(card.id));
  e.appendChild(icon);
  e.appendChild(h("div", "nm", esc(def.name)));
  e.appendChild(h("div", "kd", KIND[def.kind] + (def.el && def.el !== "physical" ? " · " + EL[def.el] : "")));
  if (big) e.appendChild(h("div", "ds", esc(def.desc ?? "")));
  if (card.id === "bred") e.appendChild(h("div", "bred", "♥"));
  e.title = `${def.name} (${cost}) — ${def.desc ?? ""}`;
  return e;
}
function roomCardEl(type) {
  const d = S.ROOMS[type];
  const e = h("div", "card big room k-facility");
  e.appendChild(h("div", "stripe"));
  e.appendChild(cloneCanvas(roomIcon(type)));
  e.appendChild(h("div", "nm", esc(d.name)));
  e.appendChild(h("div", "ds", esc(d.desc)));
  return e;
}

// ---------------------------------------------------------------- hud and hand
let manaSig = "", handSig = "";
function syncHud() {
  if (!run) return;
  const hp = Math.max(0, run.heart.hp);
  $("hpBar").style.width = (100 * hp) / run.heart.max + "%";
  $("hpText").textContent = `${Math.ceil(hp)}/${run.heart.max}`;
  document.querySelector(".hp .ico").style.animationDuration = 0.4 + (hp / run.heart.max) * 0.8 + "s";
  if (run.phase === "wave" && run.rage >= run.rageNeed && !seen.has("roarHint")) { seen.add("roarHint"); hint("♥ 포효 게이지가 찼어요! 버튼(또는 R)을 눌러 던전 전체를 뒤흔드세요"); }
  const full = Math.floor(run.mana), part = run.phase === "wave" ? run.regenT / S.BAL.mana.regenEvery : 0;
  const sig = run.manaMax + ":" + full + ":" + Math.floor(part * 4);
  if (sig !== manaSig) {
    manaSig = sig;
    const m = $("mana");
    m.innerHTML = "";
    for (let i = 0; i < run.manaMax; i++) m.appendChild(h("i", "gem" + (i < full ? " on" : i === full && part > 0.5 ? " part" : "")));
    m.title = `마나 ${full}/${run.manaMax}`;
  }
  const PH = { night_pick: "밤", wave: "밤", dawn: "새벽", day: "낮", end: "" };
  $("dayText").textContent = `${run.day}일차 ${PH[run.phase] ?? ""} · ${run.maxDays}일 버티기`;
  const left = run.advs.filter((a) => !a.dead && !a.out).length + run.spawnQ.length;
  $("waveText").textContent = run.phase === "wave" ? `웨이브 ${run.wave + 1}/${run.waves.length} · 침입자 ${left}` : run.phase === "day" ? `둥지 교배 ${run.breedsLeft}회 남음` : "";
  $("powerText").textContent = `잃어버린 힘 ${meta.powers.length}/20 · 영혼 ${meta.souls}`;
  const hs = run.hand.map((c) => c.uid).join() + "|" + full + "|" + selected + "|" + run.phase;
  if (hs !== handSig) { handSig = hs; renderHand(); }
  const rb = $("roarBtn");
  rb.hidden = run.phase !== "wave";
  const rageFull = run.rage >= run.rageNeed;
  rb.classList.toggle("ready", rageFull);
  rb.style.setProperty("--fill", Math.min(1, run.rage / run.rageNeed));
  const go = $("goBtn");
  go.hidden = !(run.phase === "day" && run.roomPicked && !placingRoom);
  $("deckN").textContent = (run.deck?.length ?? 0) + (run.discard?.length ?? 0);
  $("drawBar").style.width = run.phase === "wave" && run.hand.length < S.BAL.deck.hand ? (100 * (run.drawT ?? 0)) / S.BAL.deck.drawEvery + "%" : "0%";
}
/** The intruder under the pointer, for the heart's claw. */
function advAt(x, y) {
  let best = null, bd = 20;
  for (const a of run.advs) {
    if (a.dead || a.out || a.npc) continue;
    const [ax, ay] = R.advXY(a), d = Math.hypot(ax - x, ay - 18 - y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
function renderHand() {
  const el = $("hand");
  el.innerHTML = "";
  run.hand.forEach((card, i) => {
    const e = cardEl(card);
    if (S.cardCost(run, card) > run.mana) e.classList.add("poor");
    if (i === selected) e.classList.add("sel");
    e.onclick = () => selectCard(i);
    el.appendChild(e);
  });
}
function selectCard(i) {
  if (!run || mode !== "run") return;
  A.initAudio();
  if (placingRoom) return;
  if (selected === i) { selected = -1; clearAim(); handSig = ""; return; }
  const card = run.hand[i];
  if (!card) return;
  const def = S.cardDef(card);
  if (S.cardCost(run, card) > run.mana) { A.sfx("deny"); shakeEl($("mana")); shakeEl($("hand").children[i]); return; }
  if ((def.kind === "spell" || def.kind === "support") && run.phase !== "wave" && run.phase !== "night_pick") { A.sfx("deny"); toast("마법과 회복 카드는 밤에 써요"); return; }
  const tg = S.cardTargets(run, card);
  if (tg === null) {
    const r = S.playCard(run, meta, i, null);
    if (!r.ok) { toast(r.why); A.sfx("deny"); }
    handSig = "";
    return;
  }
  A.sfx("hover");
  selected = i;
  clearAim();
  R.targets = tg; R.hoverCard = def;
  handSig = "";
  if (!tg.length) toast("놓을 수 있는 곳이 없어요");
}

// ---------------------------------------------------------------- canvas input
function worldFromEvent(ev) {
  const cr = $("cv").getBoundingClientRect();
  return R.screenToWorld(ev.clientX - cr.left, ev.clientY - cr.top);
}
/** The floor spot under the pointer: people point at the middle of a tunnel, so look a little below. */
function spotAt(x, y) {
  const valid = R.targets ? new Set(R.targets) : null;
  let w = valid ? M.nearestWp(x, y + 12, 30, (p) => valid.has(p.id)) : null;
  if (w == null) w = M.nearestWp(x, y + 12, 30, (p) => S.isOpenW(run, p.id));
  return w;
}
function clearAim() { R.targets = null; R.zoneTargets = []; R.hoverW = null; R.hoverZone = null; R.hoverCard = null; }
// press on an intruder and drag: the heart's hand lifts them; let go to throw. A short tap claws.
let press = null;
function heldAdv() { return run?.advs.find((a) => a.fly?.held) ?? null; }
$("cv").addEventListener("pointerdown", (ev) => {
  if (mode !== "run" || !run || run.phase !== "wave" || selected >= 0 || placingRoom) return;
  const [x, y] = worldFromEvent(ev), a = advAt(x, y);
  if (!a) return;
  press = { id: a.id, sx: ev.clientX, sy: ev.clientY, grabbed: false, samples: [[x, y, performance.now()]] };
  try { $("cv").setPointerCapture(ev.pointerId); } catch {}
});
$("cv").addEventListener("pointermove", (ev) => {
  if (press && mode === "run" && run) {
    const [x, y] = worldFromEvent(ev), now = performance.now();
    if (!press.grabbed && Math.hypot(ev.clientX - press.sx, ev.clientY - press.sy) > 7) {
      const r = S.grab(run, meta, press.id);
      if (r.ok) { press.grabbed = true; A.sfx("grab"); hint(""); seenGrab = true; }
      else if (r.why === "cd") { R.onText(x, y - 30, "손이 아직 지쳐 있다", "warn"); press = null; return; }
      else { press = null; return; }
    }
    if (press.grabbed) {
      S.holdAt(run, x, y + 12);
      press.samples.push([x, y, now]);
      while (press.samples.length > 2 && now - press.samples[0][2] > 90) press.samples.shift();
    }
    return;
  }
  if (mode !== "run" || !run) return;
  const [x, y] = worldFromEvent(ev);
  R.hoverBad = false;
  R.hoverW = null; R.hoverZone = null; R.clawHover = null;
  $("cv").classList.remove("claw");
  if (selected < 0 && !placingRoom && run.phase === "wave") {
    const a = advAt(x, y);
    if (a) { R.clawHover = a.id; $("cv").classList.add("claw"); }
    return;
  }
  if (selected >= 0 && run.hand[selected]) {
    const card = run.hand[selected], def = S.cardDef(card), w = spotAt(x, y);
    R.hoverCard = def;
    if (w == null) return;
    R.hoverW = w;
    R.hoverBad = !S.canPlay(run, card, w).ok;
    const rm = S.roomOf(run, w);
    if (rm && !R.hoverBad) hint(synergyHint(def, rm) || "빛나는 바닥 어디든 눌러 놓으세요 · 카드를 다시 누르면 취소");
  } else if (placingRoom) {
    R.hoverZone = M.zoneAtXY(x, y, (z) => z.kind === "chamber");
    R.hoverBad = R.hoverZone ? !S.canPlaceRoom(run, placingRoom, R.hoverZone) : false;
  }
});
$("cv").addEventListener("pointerleave", () => { R.hoverW = null; R.hoverZone = null; });
$("cv").addEventListener("pointerup", (ev) => {
  A.initAudio();
  const [x, y] = worldFromEvent(ev);
  if (mode === "prologue") return prologue?.tap(x, y);
  if (mode !== "run" || !run) return;
  if (placingRoom) {
    const z = M.zoneAtXY(x, y, (q) => R.zoneTargets.includes(q.id)) ?? M.zoneAtXY(x, y, (q) => q.kind === "chamber");
    if (z && S.placeRoom(run, meta, placingRoom, z)) {
      A.sfx("room");
      placingRoom = null;
      clearAim();
      dayReady();
    } else { A.sfx("deny"); toast("빛나는 석실에만 놓을 수 있어요 · 무너진 석실은 열린 동굴과 이어져 있어야 파낼 수 있어요"); }
    return;
  }
  if (selected >= 0) {
    const w = spotAt(x, y);
    const res = w == null ? { ok: false, why: "동굴 바닥을 눌러 주세요" } : S.playCard(run, meta, selected, w);
    if (res.ok) { selected = -1; clearAim(); handSig = ""; hint(""); }
    else { A.sfx("deny"); toast(res.why ?? "여기엔 쓸 수 없어요"); }
    return;
  }
  // a throw ends here: the hand lets go with the pointer's speed
  if (press) {
    const p = press; press = null;
    if (p.grabbed) {
      const s0 = p.samples[0], s1 = p.samples[p.samples.length - 1], dtm = Math.max(16, s1[2] - s0[2]) / 1000;
      const vx = ((s1[0] - s0[0]) / dtm) * 1.15, vy = ((s1[1] - s0[1]) / dtm) * 1.15;
      if (S.fling(run, meta, vx, vy) && Math.hypot(vx, vy) > 200) A.sfx("whoosh");
      return;
    }
  }
  // nothing selected during a fight: the heart strikes whoever was tapped
  if (run.phase === "wave") {
    const a = advAt(x, y);
    if (a) {
      if (S.claw(run, meta, a.id)) A.sfx("claw");
      return;
    }
  }
  // otherwise: tell them what's here
  const w = M.nearestWp(x, y + 12, 40);
  if (w == null) return;
  const zid = S.zoneOf(w), z = S.ZONES[zid], rm = run.rooms[zid];
  if (!rm) return;
  if (!rm.open) { toast(`<b>${esc(z.name ?? "무너진 굴")}</b> · 무너져 막혀 있다. 낮에 방 카드를 놓으면 파낼 수 있다`); return; }
  const D = S.ROOMS[rm.type];
  let txt = `<b>${esc(z.name && rm.type === "hall" ? z.name : D.name)}</b> · ${esc(D.desc)}`;
  for (const cd of run.cards.filter((c) => M.distW(c.w, w) < 30)) { const d = S.CARDS[cd.id]; txt += `<br>${esc(d.name)}: ${esc(d.desc)}${cd.disabledT > 0 ? " <span style='color:#ff8a6a'>(해제됨)</span>" : ""}`; }
  for (const m of S.monstersNear(run, w, 30)) txt += `<br>${esc(m.name ?? S.MON.species[m.species].name)} ${Math.ceil(m.hp)}/${m.max}${m.traits.length ? " · " + m.traits.map((t) => "#" + t).join(" ") : ""}`;
  toast(txt);
});
function synergyHint(def, rm) {
  const D = S.ROOMS[rm.type];
  if (D.mods?.[def.el] > 1) return `${D.name}: ${EL[def.el]} 피해 ×${D.mods[def.el]}${D.chain === def.el ? ", 방 전체로 퍼짐!" : ""}`;
  if (D.mods?.[def.el] < 1) return `${D.name}: ${EL[def.el]} 피해가 약해져요`;
  if (def.kind === "monster" && rm.type === "nest") return "둥지: 몬스터가 천천히 회복해요";
  return "";
}
addEventListener("keydown", (ev) => {
  if (mode !== "run" || !run || modalOpen) return;
  if (ev.key === "Escape" && !placingRoom) { selected = -1; clearAim(); handSig = ""; }
  const n = parseInt(ev.key, 10);
  if (n >= 1 && n <= 9) selectCard(n - 1);
  if (ev.key === " ") { ev.preventDefault(); toggleSpeed(); }
  if (ev.key === "r" || ev.key === "R" || ev.key === "ㄱ") doRoar();
  if (ev.key === "c" || ev.key === "C" || ev.key === "ㅊ") toggleCam();
});

// ---------------------------------------------------------------- hud buttons
function toggleSpeed() { speed = speed === 1 ? 2 : 1; $("speedBtn").textContent = speed + "×"; }
$("speedBtn").onclick = toggleSpeed;
function toggleCam() { R.follow = R.follow === false; $("camBtn").textContent = R.follow === false ? "🔍" : "🎥"; toast(R.follow === false ? "전체 보기" : "전투를 따라가는 카메라"); }
$("camBtn").onclick = toggleCam;
$("muteBtn").onclick = () => { A.initAudio(); A.setMuted(!A.isMuted()); $("muteBtn").textContent = A.isMuted() ? "♪̸" : "♪"; };
$("menuBtn").onclick = () => { if (mode === "run") showMenu(); else if (mode === "meta") showMeta(); };
function doRoar() {
  if (!run || !S.roar(run, meta)) { if (run?.phase === "wave") { A.sfx("deny"); toast("처치할수록 포효 게이지가 차요"); } return; }
  A.sfx("roar");
  if (!seen.has("roar")) seen.add("roar");
}
$("roarBtn").onclick = () => { A.initAudio(); doRoar(); };
$("goBtn").onclick = () => {
  if (!run || run.phase !== "day") return;
  A.initAudio();
  selected = -1; clearAim();
  S.startNight(run, meta);
};
addEventListener("pointerdown", () => A.initAudio(), { once: false });

// ---------------------------------------------------------------- events from the rules
const TRAP_SFX = { zap: "zap", tesla: "zap", flame: "fire", frost: "ice", spike: "spike", boulder: "boom", arrow: "arrow", crystal: "orb" };
const SPELL_SFX = { strike: "thunder", pro_judge: "thunder", meteor: "boom", pro_meteor: "boom", pro_pillar: "fire", nova: "ice", scream: "scream", thorn: "claw" };
const seen = new Set();
const laterRecords = [];
let seenGrab = false;
function handle(e) {
  switch (e.t) {
    case "dmg": if (!e.dot) A.sfx("hit"); break;
    case "trap": if (TRAP_SFX[e.id]) A.sfx(TRAP_SFX[e.id]); break;
    case "spell": A.sfx(SPELL_SFX[e.id] ?? "play"); break;
    case "death": A.sfx("death"); setTimeout(() => A.sfx("coin"), 150); break;
    case "heartHit": A.sfx("heartHit"); break;
    case "spawn":
      A.sfx("babble", e.cls === "mage" ? 200 : 0);
      if (e.boss) banner("봉인 기사 단장", "백 년 전 그날의 기사가 돌아왔다");
      else if (e.nemesis) toast(`<b style="color:#ff8a6a">숙적 ${esc(e.name)}</b>이(가) 더 강해져서 돌아왔다!`);
      break;
    case "flee": A.sfx("babble", 400); { const a = run.advs.find((x) => x.id === e.id); if (a) { const [x, y] = R.advXY(a); R.onText(x, y - 50, "도망친다!", "fear"); } } if (!seen.has("flee")) { seen.add("flee"); toast("겁먹은 침입자가 성문으로 달아난다. 나가기 전에 잡으면 길드에 소문이 퍼지지 않는다"); } break;
    case "spare": break;
    case "combo": break;
    case "roar": break;
    case "record":
      // never stop a fight for reading: records wait for dawn
      if (run.phase === "wave") { laterRecords.push(e.id); break; }
      A.sfx("page"); openModal((m) => showRecord(m, e.id, true)); break;
    case "slam": A.sfx(e.v > 400 ? "thudBig" : "thud"); break;
    case "bowl": A.sfx("thud"); break;
    case "rumble": A.sfx("crumble"); break;
    case "rockHit": A.sfx("thud"); break;
    case "rockBreak": if (e.kind === "roll") A.sfx("crumble"); break;
    case "tooHeavy": A.sfx("deny"); break;
    case "diary":
      A.sfx("page");
      toast(`📜 ${esc(e.diary.name)}의 일기를 주웠다 <small>(누르면 읽기)</small>`, () => openModal((m) => showDiary(m, e.diary, true)));
      break;
    case "secret": A.sfx("secret"); banner("비밀 방이 열렸다", "벽 너머에서 푸른 빛이 새어 나온다"); break;
    case "place": A.sfx("place"); break;
    case "summon": A.sfx("summon"); break;
    case "wave": if (!seen.has("clawHint")) { seen.add("clawHint"); setTimeout(() => { if (!seenGrab) hint("침입자를 꾹 눌러 끌어 보세요: 심장의 손이 붙잡아요. 벽이나 바닥에 세게 던질수록 크게 다쳐요 · 짧게 누르면 할퀴기"); }, 2200); } A.sfx("horn"); banner(e.band, `대장 ${e.captain ?? "?"} · ${e.party.length}명 · 목표: 심장의 조각${e.of > 1 ? ` · ${e.n}/${e.of}진` : ""}`); break;
    case "waveClear": break;
    case "escape":
      if (!e.looter) toast(`${esc(e.name)}이(가) 살아서 나갔다.${e.learned ? ` 길드에 <b>${EL[e.learned] ?? e.learned}</b> 대처법이 퍼질 것이다.` : ""}`);
      else toast(`${esc(e.name)}이(가) 보물을 들고 달아났다!`);
      break;
    case "loot": A.sfx("coin"); break;
    case "disarm":
      R.onText(S.wpXY(e.w)[0], S.wpXY(e.w)[1] - 44, "해제 중…", "warn");
      if (!seen.has("disarm")) { seen.add("disarm"); toast("도적이 함정을 해제하려 한다! 해제하는 동안은 무방비 상태다"); }
      break;
    case "shriek": A.sfx("shriek"); break;
    case "hatch": A.sfx(e.mon.mutant ? "mutant" : "hatch"); break;
    case "room": break;
    case "draw": A.sfx("hover"); break;
    case "streak": {
      const T = { 2: "더블!", 3: "트리플!", 4: "쿼드라!", 5: "학살!", 6: "학살!", 7: "학살!" };
      const txt = T[e.n] ?? "공포 그 자체";
      streakText(txt + (e.bonus ? ` +${e.bonus}◆` : ""), e.n);
      A.sfx("combo", Math.min(10, e.n));
      break;
    }
  }
}
function streakText(text, n) {
  const el = h("div", "streak", "");
  el.style.fontSize = Math.min(64, 26 + n * 5) + "px";
  $("stage").appendChild(el);
  kinetic(el, n >= 5 ? `*${text}*` : text, { speed: 30, quiet: true });
  setTimeout(() => el.classList.add("go"), 700);
  setTimeout(() => el.remove(), 1500);
}
function comboText(n) {
  const e = h("div", "ft combo" + (n >= 6 ? " mega" : ""), n >= 8 ? `학살 ×${n}!!` : n >= 6 ? `대연쇄 ×${n}!` : `연쇄 ×${n}!`);
  e.style.left = "50%";
  e.style.top = "26%";
  $("floaters").querySelectorAll(".combo").forEach((x) => x.remove());
  $("floaters").appendChild(e);
  setTimeout(() => e.remove(), 1000);
  if (n >= 6) { R.stop(0.05); R.shake = Math.max(R.shake, 0.3); }
}

// ---------------------------------------------------------------- mercy
function showMercy(e) {
  const a = run.advs.find((x) => x.id === e.id);
  if (!a || a.looter) return;
  const box = h("div", "mq");
  box.style.position = "relative";
  box.innerHTML = `<span>겁먹은 ${CLS(a.cls)} <b>${esc(a.name)}</b>이(가) 도망친다!</span>`;
  const spare = h("button", "spare", "🕊 살려 보내기"), kill = h("button", "kill", `💀 끝장내기 +${S.BAL.mana.execute}◆`);
  spare.onclick = () => { S.decideMercy(run, meta, a.id, true); box.remove(); };
  kill.onclick = () => { S.decideMercy(run, meta, a.id, false); box.remove(); };
  box.append(spare, kill);
  const tm = h("div", "tm"); box.appendChild(tm);
  box.dataset.id = a.id;
  $("mercy").appendChild(box);
  if (run.mercyShown < S.BAL.mercy.slowmoTimes) { run.mercyShown++; slowT = 2.2; }
}
function syncMercy() {
  for (const box of [...$("mercy").children]) {
    const id = +box.dataset.id;
    const a = run?.advs.find((x) => x.id === id);
    if (!a || !run.mercy.includes(id)) { box.remove(); continue; }
    box.querySelector(".tm").style.width = (100 * a.mercyT) / S.BAL.mercy.timeout + "%";
  }
}

// ---------------------------------------------------------------- phases
function onPhase(ph) {
  selected = -1; clearAim(); handSig = "";
  switch (ph) {
    case "night_pick":
      R.nightTarget = 1;
      A.setMusic("night");
      showPick();
      break;
    case "wave":
      R.nightTarget = 1;
      if (run.first && run.day === 1 && run.wave === 0) hint("손의 카드를 눌러 고른 뒤, 빛나는 방에 놓으세요");
      else if (run.first && run.day === 2 && run.wave === 0) hint("물이 찬 방에 번개 함정을 놓으면 방 전체가 감전돼요");
      else hint("");
      break;
    case "dawn": R.nightTarget = 0; showDawn(); break;
    case "day": R.nightTarget = 0; A.setMusic("day"); save(meta, S.snapshot(run)); dayFlow(); break;
    case "end": showEnd(); break;
  }
}

function showPick() {
  const p = run.pick;
  if (!p) return;
  const party = run.waves[run.wave] ?? [];
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", p.reason === "night" ? `${run.day}일째 밤이 온다` : "막아냈다! 다음 파티가 온다"));
    pn.appendChild(h("div", "sub", "방어 카드 한 장을 고르세요"));
    const pr = h("div", "party", `다음 침입자: ${party.map((c) => `<b>${CLS(c)}</b>`).join(" · ")}`);
    pn.appendChild(pr);
    const ch = pn.appendChild(h("div", "choices"));
    p.options.forEach((id, i) => {
      const e = cardEl({ id }, true);
      e.onclick = () => { closeModal(); S.choosePick(run, meta, i); };
      ch.appendChild(e);
    });
    if (run.first && run.day === 1 && run.wave === 0) pn.appendChild(h("div", "legend", "고른 카드는 덱에 들어와요. 마법은 쓰고 나면 다시 돌아오고, 함정과 몬스터는 한 번 설치하면 끝이에요"));
  });
}

function showDawn() {
  const d = run.dawn;
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", `${d.day}일째 밤을 버텼다`));
    pn.appendChild(h("div", "sub", "던전의 심장이 조금 더 단단해졌다"));
    const st = pn.appendChild(h("div", "stat"));
    st.innerHTML = `<span>보물 방 마나</span><b>+${d.treasure}</b><span>주운 일기</span><b>${d.diaries}장</b><span>도망쳐 나간 모험가</span><b>${d.spared}명</b><span>쓰러뜨린 침입자</span><b>${run.kills}명</b>`;
    pn.appendChild(h("div", "rumor", esc(d.rumor)));
    const row = pn.appendChild(h("div", "row"));
    const b = row.appendChild(h("button", "btn", "낮이 밝았다 ☀"));
    b.onclick = () => { closeModal(); S.startDay(run, meta); };
  });
}

function dayFlow() {
  if (run.roomPicked) return dayReady();
  if (S.canBreed(run)) showBreed();
  else showRoomDraft();
}
function dayReady() {
  hint(run.first && run.day === 2 ? "손에 남은 카드를 미리 놓아도 돼요 · 준비가 끝나면 '밤 시작'" : "준비가 끝나면 '밤 시작' · 손의 함정과 몬스터는 낮에도 놓을 수 있어요");
  $("goBtn").textContent = `${run.day}일째 밤 시작 🌙`;
  handSig = "";
}

function showBreed() {
  const chosen = [];
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "둥지: 몬스터 교배"));
    pn.appendChild(h("div", "sub", "밤을 버틴 몬스터 두 마리를 고르세요. 새끼는 부모의 특성을 하나씩 물려받아요"));
    const list = pn.appendChild(h("div", "monsel"));
    const go = h("button", "btn", "교배하기 🥚");
    go.disabled = true;
    for (const mo of run.monsters.filter((x) => x.hp > 0)) {
      const e = h("div", "mon");
      e.appendChild(cloneCanvas(critterIcon(mo.species, mo.palette)));
      e.appendChild(h("div", "", esc(mo.name ?? S.MON.species[mo.species].name)));
      e.appendChild(h("div", "tr", mo.traits.map((t) => "#" + t).join(" ")));
      e.onclick = () => {
        const i = chosen.indexOf(mo.id);
        if (i >= 0) { chosen.splice(i, 1); e.classList.remove("sel"); }
        else if (chosen.length < 2) { chosen.push(mo.id); e.classList.add("sel"); }
        go.disabled = chosen.length !== 2;
        A.sfx("hover");
      };
      list.appendChild(e);
    }
    const row = pn.appendChild(h("div", "row"));
    const skip = row.appendChild(h("button", "btn ghost", "오늘은 쉬자"));
    row.appendChild(go);
    skip.onclick = () => { run.breedsLeft = 0; closeModal(); showRoomDraft(); };
    go.onclick = () => {
      const mon = S.breed(run, meta, chosen[0], chosen[1]);
      if (mon) hatchScene(pn, mon);
    };
  });
}
function hatchScene(pn, mon) {
  pn.innerHTML = "";
  pn.appendChild(h("h2", "", "알이 흔들린다…"));
  const cv = h("canvas");
  cv.width = 160; cv.height = 120;
  cv.style.cssText = "width:320px;max-width:100%;image-rendering:pixelated;display:block;margin:8px auto";
  pn.appendChild(cv);
  const sp = S.MON.species[mon.species];
  const stage = miniStage(cv, (createFx, FX) => [createFx(FX.eggHatch, { x: 80, y: 100, seed: 3 })]);
  let t = 0, born = false;
  const info = pn.appendChild(h("div", ""));
  const tick = (dt) => {
    t += dt;
    if (!born && t > 1.9) {
      born = true;
      stage.add(createCritter(sp.fx, mon));
      if (mon.mutant) A.sfx("mutant"); else A.sfx("hatch");
      showHatched(pn, info, mon);
    }
    stage.tick(dt);
  };
  hatchTick = tick;
}
let hatchTick = null;
function createCritter(fxName, mon) {
  const o = { x: 80, y: 98, seed: 2 };
  if (mon.palette) o.palette = mon.palette;
  if (mon.species === "slime") o.hop = 10;
  return createFx(FX[fxName], o);
}
function showHatched(pn, info, mon) {
  pn.querySelector("h2").textContent = mon.mutant ? "돌연변이다!" : "새끼가 태어났다";
  if (mon.mutant) pn.querySelector("h2").style.cssText = "background:linear-gradient(90deg,#ff7ab0,#ffe07a,#7ae0ff,#b08aff);-webkit-background-clip:text;background-clip:text;color:transparent";
  info.innerHTML = `<div style="font-size:20px">${esc(mon.name)}</div><div class="tr" style="color:#ff9ad8">${mon.traits.map((t) => "#" + t).join(" ")}</div><div class="legend">부모: ${esc(mon.parents.join(" × "))} · ${mon.gen}세대 · 손에 소환 카드로 들어왔어요</div>`;
  const row = info.appendChild(h("div", "row"));
  let input = null;
  if (!meta.named) {
    input = h("input", "name");
    input.placeholder = "이름을 지어 주세요";
    input.maxLength = 16;
    input.value = mon.name;
    info.insertBefore(input, row);
    setTimeout(() => { input.focus(); input.select(); }, 50);
  }
  const ok = row.appendChild(h("button", "btn", "좋아!"));
  ok.onclick = () => {
    if (input) S.renameMonster(run, meta, mon.id, input.value || mon.name);
    hatchTick = null;
    closeModal();
    handSig = "";
    if (S.canBreed(run)) showBreed(); else showRoomDraft();
  };
}

function showRoomDraft() {
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", `${run.day}일째 낮: 던전 설계`));
    pn.appendChild(h("div", "sub", "방 카드 한 장을 골라 석실에 새기거나, 무너진 굴을 파내세요"));
    const ch = pn.appendChild(h("div", "choices"));
    run.roomOffer.forEach((type) => {
      const e = roomCardEl(type);
      e.onclick = () => {
        closeModal();
        placingRoom = type;
        clearAim();
        R.zoneTargets = S.roomTargets(run, type);
        hint(`${S.ROOMS[type].name}: 빈 석실을 바꾸거나, 무너진 석실을 파내서 새 길을 여세요`);
        A.sfx("pick");
      };
      ch.appendChild(e);
    });
    pn.appendChild(h("div", "rumor", esc(S.rumorOf(run))));
  });
}

function showEnd() {
  const res = run.result;
  R.breach = res.breach;
  if (!res.win) {
    // the party celebrates: they got the treasure
    const K = S.ZONES.K.wps, hx = S.wpXY(S.HEART_WP)[0];
    run.advs = [0, 1, 2, 3].map((i) => ({ id: 9000 + i, cls: ["warrior", "rogue", "mage", "cleric"][i], cell: K[[1, 4, K.length - 5, K.length - 2][i]], next: null, prog: 0, lane: 0, face: S.WP[K[[1, 4, K.length - 5, K.length - 2][i]]].x < hx ? 1 : -1, hp: 1, max: 1, courage: 1, courageMax: 1, gear: [], state: "walk", frozenT: 0, burnT: 0, poisonT: 0, hitT: 0, cheer: true, spare: null }));
    A.sfx("stamp");
  } else {
    for (let i = 0; i < 5; i++) setTimeout(() => R.spawn("firework", R.cam.x + (Math.random() - 0.5) * 220, R.cam.y - 20 + (Math.random() - 0.5) * 80, {}, "over"), i * 350);
    A.sfx("fanfare");
  }
  setTimeout(() => openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("div", "stamp" + (res.win ? " win" : ""), res.win ? "새벽이 왔다" : "심장 함락"));
    pn.appendChild(h("div", "sub", res.win ? `${run.maxDays}일을 버텨 냈다. 심장이 다시 힘차게 뛴다` : "침입자들이 심장의 조각을 들고 승리의 함성을 질렀다"));
    const st = pn.appendChild(h("div", "stat"));
    const br = res.breach != null ? S.ROOMS[run.rooms[res.breach]?.type]?.name : null;
    st.innerHTML = `<span>버틴 날</span><b>${res.days}일</b><span>쓰러뜨린 침입자</span><b>${res.kills}명</b><span>겁줘서 쫓아낸 모험가</span><b>${res.spared}명</b><span>얻은 영혼</span><b style="color:#c8b0ff">+${res.souls}</b>` + (br ? `<span>가장 많이 뚫린 곳</span><b>${esc(br)}</b>` : "");
    const nx = S.POWERS.filter((p) => !meta.powers.includes(p.id)).slice(0, 2);
    if (nx.length) {
      pn.appendChild(h("div", "sub", "다음 판엔 이게 열려요"));
      const l = pn.appendChild(h("div", "list"));
      for (const p of nx) l.appendChild(h("div", "li" + (meta.souls >= p.cost ? " next" : ""), `<span>${esc(p.name)} <small>${esc(p.desc)}</small></span><small>영혼 ${p.cost}</small>`));
    }
    const row = pn.appendChild(h("div", "row"));
    row.appendChild(h("button", "btn", "봉인의 방으로")).onclick = () => { closeModal(); R.breach = null; showMeta(); };
  }), res.win ? 1800 : 2200);
  save(meta, null);
}

// ---------------------------------------------------------------- records and diaries
function showRecord(m, id, fresh = false) {
  const rec = S.STORY.records[id];
  if (!rec) return closeModal();
  menuPause = true;
  const wrap = m.appendChild(h("div", ""));
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:14px;max-width:100%";
  if (fresh) wrap.appendChild(h("div", "", `<span style="color:var(--gold);font-size:18px">핵심 기록을 찾았다</span>`));
  const p = wrap.appendChild(h("div", `paper ${rec.paper}${rec.torn ? " torn" : ""}`));
  p.appendChild(h("h3", "", esc(rec.title)));
  p.appendChild(document.createTextNode(rec.text));
  const b = wrap.appendChild(h("button", "btn", "덮는다"));
  b.onclick = () => { menuPause = false; closeModal(); };
}
function showDiary(m, d, fresh = false) {
  menuPause = true;
  const wrap = m.appendChild(h("div", ""));
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:14px";
  const p = wrap.appendChild(h("div", `paper ${d.cls}`));
  const st = p.appendChild(h("div", "stain")); st.style.cssText += `right:${20 + (d.name.length * 13) % 60}px;top:${30 + (d.name.length * 7) % 40}px`;
  p.appendChild(h("h3", "", `${esc(d.name)} · ${CLS(d.cls)} · ${esc(d.town)}`));
  p.appendChild(document.createTextNode(d.lines.join("\n")));
  const b = wrap.appendChild(h("button", "btn", "덮는다"));
  b.onclick = () => { menuPause = false; closeModal(); };
}
function showJournal(back) {
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.style.minWidth = "min(520px, 100%)";
    pn.appendChild(h("h2", "", "기록 보관함"));
    const tabs = pn.appendChild(h("div", "tabs"));
    const body = pn.appendChild(h("div", "list"));
    const t1 = tabs.appendChild(h("button", "on", "핵심 기록")), t2 = tabs.appendChild(h("button", "", `일기 ${meta.diaries.length}`));
    const recs = () => {
      body.innerHTML = "";
      for (const [id, r] of Object.entries(S.STORY.records)) {
        const got = meta.records.includes(id);
        const li = body.appendChild(h("div", "li" + (got ? " got" : " lock"), got ? `<span>${esc(r.title)}</span><small>${r.act}막</small>` : `<span>??? </span><small>아직 찾지 못한 기록</small>`));
        if (got) li.onclick = () => openModal((mm) => showRecord(mm, id), { force: true });
      }
    };
    const dias = () => {
      body.innerHTML = "";
      if (!meta.diaries.length) body.appendChild(h("div", "sub", "쓰러진 모험가가 일기를 떨어뜨릴 때가 있어요"));
      for (const d of [...meta.diaries].reverse()) {
        const li = body.appendChild(h("div", "li got", `<span>${esc(d.name)} <small>${CLS(d.cls)} · ${esc(d.town)}</small></span><small>${d.end === "death" ? "마지막 페이지" : ""}</small>`));
        li.onclick = () => openModal((mm) => showDiary(mm, d), { force: true });
      }
    };
    t1.onclick = () => { t1.classList.add("on"); t2.classList.remove("on"); recs(); };
    t2.onclick = () => { t2.classList.add("on"); t1.classList.remove("on"); dias(); };
    recs();
    const row = pn.appendChild(h("div", "row"));
    row.appendChild(h("button", "btn", "닫기")).onclick = () => { closeModal(); back?.(); };
  }, { force: true });
}

// ---------------------------------------------------------------- menu and meta
function showMenu() {
  menuPause = true;
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "잠깐 멈춤"));
    const col = pn.appendChild(h("div", "row"));
    col.style.flexDirection = "column";
    col.appendChild(h("button", "btn", "계속하기")).onclick = () => { menuPause = false; closeModal(); };
    col.appendChild(h("button", "btn ghost", "기록 보관함")).onclick = () => { closeModal(); showJournal(() => showMenu()); };
    col.appendChild(h("button", "btn ghost", "도움말")).onclick = () => { closeModal(); showHelp(() => showMenu()); };
    confirmBtn(col.appendChild(h("button", "btn red", "이번 판 포기")), "정말 포기? 한 번 더 누르세요 (영혼 없음)", () => {
      menuPause = false; closeModal(); run = null; meta.runs++; save(meta, null); showMeta();
    });
  }, { force: true });
}
function showHelp(back) {
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "던전의 규칙"));
    pn.appendChild(h("div", "", `<div style="text-align:left;line-height:1.6;font-size:15px">
      ♥ 침입자가 심장에 닿으면 한 대 치고 보물을 들고 달아나요. 심장이 부서지면 끝.<br>
      🌙 밤이 시작될 때와 웨이브를 막을 때마다 방어 카드 3장 중 1장을 골라요.<br>
      ◆ 카드는 마나를 써서 동굴 바닥 어디에든 놓아요. 칸은 없어요. 원이 효과 범위예요. 마나는 밤 동안 천천히 차고, 침입자를 쓰러뜨리면 더 들어와요.<br>
      ☀ 낮에는 몬스터를 교배하고, 방 카드로 던전을 넓혀요. 방과 카드가 맞물리면 더 강해져요.<br>
      🏃 겁먹은 모험가는 성문으로 달아나요. 살아 나간 자는 길드에 대처법을 알리니, 나가기 전에 붙잡으세요.<br>
      ✦ 이기든 지든 영혼을 얻고, 봉인당한 힘 20개를 하나씩 되찾아요.<br>
      <span class="legend">단축키: 1~9 카드 고르기 · Esc 취소 · Space 속도</span></div>`));
    pn.appendChild(h("div", "row")).appendChild(h("button", "btn", "알겠어")).onclick = () => { closeModal(); back?.(); };
  }, { force: true });
}
function showMeta() {
  mode = "meta";
  document.body.classList.add("meta");
  A.setMusic("meta");
  R.nightTarget = 0.7;
  $("hint").textContent = ""; hintText = "";
  $("goBtn").hidden = true;
  $("hand").innerHTML = "";
  backdrop = backdrop ?? S.newRun(meta, 7);
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.style.minWidth = "min(560px, 100%)";
    pn.appendChild(h("h2", "", "봉인의 방"));
    pn.appendChild(h("div", "sub", `영혼 <b style="color:#c8b0ff">${meta.souls}</b> · ${meta.runs}번째 판을 마쳤다 · 도망친 모험가 ${meta.sparedTotal}명`));
    const pw = pn.appendChild(h("div", "pw"));
    for (const p of S.POWERS) pw.appendChild(h("span", meta.powers.includes(p.id) ? "on" : "")).title = meta.powers.includes(p.id) ? p.name : "???";
    const nx = S.nextPower(meta);
    if (nx) {
      const box = pn.appendChild(h("div", "li next", `<span>다음 힘: <b>${esc(nx.name)}</b><br><small>${esc(nx.desc)}</small></span>`));
      const b = box.appendChild(h("button", "btn cyan", `되찾기 · 영혼 ${nx.cost}`));
      b.disabled = meta.souls < nx.cost;
      b.onclick = () => {
        if (S.buyPower(meta, nx.id)) { A.sfx("power"); save(meta, null); closeModal(); toast(`힘을 되찾았다: <b>${esc(nx.name)}</b>`); showMeta(); }
      };
    } else pn.appendChild(h("div", "sub", "모든 힘을 되찾았다. 심연이 꿈틀거린다…"));
    const l = pn.appendChild(h("div", "list"));
    l.style.maxHeight = "180px"; l.style.overflow = "auto";
    for (const p of S.POWERS) {
      const got = meta.powers.includes(p.id);
      l.appendChild(h("div", "li" + (got ? " got" : " lock"), got ? `<span>${esc(p.name)} <small>${esc(p.desc)}</small></span><small>되찾음</small>` : `<span>??? </span><small>영혼 ${p.cost}</small>`));
    }
    const row = pn.appendChild(h("div", "row"));
    row.appendChild(h("button", "btn", meta.runs ? "새 판 시작" : "시작")).onclick = () => { closeModal(); startRun(); };
    row.appendChild(h("button", "btn ghost", "기록 보관함")).onclick = () => { closeModal(); showJournal(() => showMeta()); };
    row.appendChild(h("button", "btn ghost", `몬스터 계보 ${meta.lineage.length}`)).onclick = () => { closeModal(); showLineage(); };
    row.appendChild(h("button", "btn ghost", "저장")).onclick = () => { closeModal(); showSaves(); };
    row.appendChild(h("button", "btn ghost", "프롤로그")).onclick = () => { closeModal(); backdrop = null; startPrologue(() => showMeta()); };
  }, { force: true });
}
function showLineage() {
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "몬스터 계보"));
    pn.appendChild(h("div", "sub", "★ 표시한 몬스터는 다음 판에 소환 카드로 따라와요"));
    const list = pn.appendChild(h("div", "monsel"));
    if (!meta.lineage.length) list.appendChild(h("div", "sub", "낮에 둥지에서 몬스터를 교배하면 여기에 남아요"));
    for (const mo of [...meta.lineage].reverse()) {
      const e = h("div", "mon" + (meta.favorite === mo.id ? " sel" : ""));
      e.appendChild(cloneCanvas(critterIcon(mo.species, mo.palette)));
      e.appendChild(h("div", "", (meta.favorite === mo.id ? "★ " : "") + esc(mo.name)));
      e.appendChild(h("div", "tr", mo.traits.map((t) => "#" + t).join(" ")));
      e.appendChild(h("div", "legend", `${mo.gen}세대 · ${esc(mo.parents.join("×"))}`));
      e.onclick = () => { meta.favorite = mo.id; save(meta, null); closeModal(); showLineage(); };
      list.appendChild(e);
    }
    pn.appendChild(h("div", "row")).appendChild(h("button", "btn", "닫기")).onclick = () => { closeModal(); showMeta(); };
  }, { force: true });
}
function showSaves() {
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "저장"));
    pn.appendChild(h("div", "sub", "진행은 이 기기에 자동 저장돼요. 기기를 옮길 땐 아래 글자를 복사해 가져가세요"));
    const ta = pn.appendChild(h("textarea", "save"));
    ta.value = exportSave(meta, null);
    const row = pn.appendChild(h("div", "row"));
    row.appendChild(h("button", "btn ghost", "복사")).onclick = () => { ta.select(); navigator.clipboard?.writeText(ta.value).catch(() => {}); toast("복사했어요"); };
    row.appendChild(h("button", "btn ghost", "가져오기")).onclick = () => {
      const d = importSave(ta.value);
      if (!d) return toast("저장 글자가 올바르지 않아요");
      meta = d.meta; run = null; save(meta, null); closeModal(); toast("가져왔어요"); showMeta();
    };
    confirmBtn(row.appendChild(h("button", "btn red", "처음부터")), "모두 지울까요? 한 번 더", () => { wipe(); location.reload(); });
    row.appendChild(h("button", "btn", "닫기")).onclick = () => { closeModal(); showMeta(); };
  }, { force: true });
}

// ---------------------------------------------------------------- runs
function startRun() {
  document.body.classList.remove("meta");
  run = S.newRun(meta);
  R.mons.clear();
  R.roomsDirty = true;
  R.breach = null;
  lastPhase = null;
  mode = "run";
  fit();
}
function resumeRun(saved) {
  document.body.classList.remove("meta");
  run = saved;
  run.events = [];
  run.advs = run.advs ?? [];
  R.roomsDirty = true;
  lastPhase = null;
  mode = "run";
}

// ---------------------------------------------------------------- the loop
let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (hatchTick) hatchTick(dt);
  if (mode === "run" && run) {
    const paused = menuPause || (modalOpen && run.phase === "wave");
    const feel = paused ? 1 : R.timeScale(dt);
    let k = paused ? 0 : speed * (slowT > 0 ? 0.3 : 1) * feel * (heldAdv() ? 0.45 : 1);
    if (slowT > 0 && !paused) slowT -= dt;
    let simDt = dt * k;
    while (simDt > 1e-6) { const s = Math.min(simDt, 1 / 30); S.step(run, meta, s); simDt -= s; }
    for (const e of run.events) { R.onEvent(e, run); handle(e); }
    run.events.length = 0;
    if (run.phase !== lastPhase) { lastPhase = run.phase; onPhase(run.phase); }
    if (laterRecords.length && run.phase !== "wave" && !modalOpen) { const id = laterRecords.shift(); A.sfx("page"); openModal((m) => showRecord(m, id, true)); }
    const heartBpm = 60 + (1 - run.heart.hp / run.heart.max) * 90;
    if (run.phase === "wave") A.setMusic("night", heartBpm);
    R.update(dt * (paused ? 0 : (speed * feel) || 0));
    R.draw(run);
    R.present(run, dt);
    syncHud();
    syncMercy();
  } else if (mode === "prologue" && prologue) {
    prologue.tick(dt);
  } else if (mode === "meta") {
    const b = backdrop ?? run;
    if (b) { R.update(dt); R.draw(b); R.present(b, dt); }
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- the prologue
function startPrologue(after) {
  closeModal();
  mode = "prologue";
  document.body.classList.remove("meta");
  document.body.classList.add("cine");
  prologue = playPrologue({ R, S, A, meta, subtitle, banner, toast, openModal, closeModal, h, esc, cardEl, chibi, cloneCanvas, fit,
    done() {
      document.body.classList.remove("cine");
      meta.seenPrologue = true;
      meta.prologueV = 2;
      save(meta, null);
      prologue = null;
      after();
      // waking up: the world is grey and the colour comes back
      R.gray = 1;
      const t0 = performance.now();
      const fade = () => { R.gray = Math.max(0, 1 - (performance.now() - t0) / 3500); if (R.gray > 0) requestAnimationFrame(fade); };
      requestAnimationFrame(fade);
      if (mode === "run") {
        subtitle("봉인이 약해졌다. 빼앗긴 것을 되찾을 시간이다.");
        setTimeout(() => subtitle(""), 4200);
      }
    },
  });
}

// ---------------------------------------------------------------- boot
function boot() {
  // fonts load without blocking the first frame
  document.querySelectorAll('link[media="print"]').forEach((l) => (l.media = "all"));
  if (/skipprologue/.test(location.search)) { meta.seenPrologue = true; meta.prologueV = 2; }
  fit();
  requestAnimationFrame(frame);
  if (!meta.seenPrologue || (meta.prologueV ?? 1) < 2) {
    startPrologue(() => (run && run.phase !== "end" ? resumeRun(run) : startRun()));
  } else if (run && run.phase !== "end") {
    resumeRun(run);
    toast("지난 판을 이어서 해요");
  } else {
    showMeta();
  }
}
boot();

// 던전이 살아있다: the shell around the defense. HUD, the build ring on each spot, the horn that
// calls the next wave, the heart's abilities, card picks, the end, and the prologue in front of it all.

import * as S from "./sim.js"; // the old rules: only the prologue's battle still runs on them
import * as T from "./td.js";
import { Renderer, cloneCanvas, critterIcon } from "./render.js";
import { cardIcon, chibi } from "./sprites.js";
import * as A from "./audio.js";
import { save, load } from "./save.js";
import { playPrologue } from "./prologue.js";
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
const TD = T.TD;
const ICON = (id) => (id === "nest" ? "nest" : id);

const R = new Renderer($("cv"));
R.spots = T.SPOTS;
let { meta, run } = load();
meta.best ??= 0;
let mode = "boot", speed = 1, modalOpen = false, menuPause = false, lastPhase = null;
let prologue = null, backdrop = null, selSpot = null, aiming = null;
window.__game = { get run() { return run; }, get meta() { return meta; }, T, R, chibi };

// ---------------------------------------------------------------- layout
function fit() {
  const portrait = innerHeight > innerWidth * 1.05;
  if (portrait !== R.portrait) R.setLayout(portrait);
  R.follow = portrait ? true : false;
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
function hint(t) { if (t !== hintText) { hintText = t; $("hint").textContent = t; $("hint").style.opacity = t ? 1 : 0; } }
function subtitle(t) { $("subtitle").style.opacity = t ? 1 : 0; if (t) kinetic($("subtitle"), t, { speed: 45 }); }
function shakeEl(el) { if (!el) return; el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); }
function openModal(build) {
  const m = $("modal");
  m.innerHTML = ""; m.hidden = false; modalOpen = true;
  build(m);
}
function closeModal() { $("modal").hidden = true; $("modal").innerHTML = ""; modalOpen = false; }
/** Card element for the prologue's old-rules picks. */
function cardEl(card, big = false) {
  const def = S.cardDef(card);
  const e = h("div", `card k-${def.kind}${big ? " big" : ""}`);
  e.appendChild(h("div", "stripe"));
  e.appendChild(def.kind === "monster" ? cloneCanvas(critterIcon(def.species, null)) : cloneCanvas(cardIcon(card.id)));
  e.appendChild(h("div", "nm", esc(def.name)));
  if (big) e.appendChild(h("div", "ds", esc(def.desc ?? "")));
  return e;
}
function streakText(text, n) {
  const el = h("div", "streak", "");
  el.style.fontSize = Math.min(64, 26 + n * 5) + "px";
  $("stage").appendChild(el);
  kinetic(el, n >= 5 ? `*${text}*` : text, { speed: 30, quiet: true });
  setTimeout(() => el.classList.add("go"), 700);
  setTimeout(() => el.remove(), 1500);
}

// ---------------------------------------------------------------- hud
let hudSig = "";
function syncHud() {
  $("livesN").textContent = Math.max(0, run.heart.hp);
  $("bloodN").textContent = run.blood;
  $("waveText").innerHTML = `<b>${run.night}</b>번째 밤 · 웨이브 <b>${Math.min(run.wave, run.waveTotal)}</b>/${run.waveTotal}`;
  const sig = run.relics.join(",");
  if (sig !== hudSig) {
    hudSig = sig;
    const bar = $("relicBar");
    bar.innerHTML = "";
    for (const id of run.relics) { const r = TD.relics.find((q) => q.id === id); const e = h("span", "relic"); e.appendChild(cloneCanvas(cardIcon(r.icon))); e.title = `${r.name}: ${r.desc}`; e.onclick = () => toast(`<b>${esc(r.name)}</b> · ${esc(r.desc)}`); bar.appendChild(e); }
  }
  // abilities: a sweep shows the cooldown
  for (const k of ["grab", "rockfall", "roll"]) {
    const b = $("ab-" + k), full = k === "grab" ? TD.abilities.grab.cd : TD.abilities[k].cd, cd = run.cd[k];
    b.style.setProperty("--cd", cd > 0 ? (cd / full) * 360 + "deg" : "0deg");
    b.classList.toggle("ready", cd <= 0);
    b.classList.toggle("on", aiming === k);
    b.querySelector("i").textContent = cd > 0 ? Math.ceil(cd) : "";
  }
  // the horn by the gate: call the next wave
  const wb = $("waveBtn");
  const canCall = run.phase === "build" || (run.phase === "wave" && !run.spawnQ.length && run.nextT > 0 && run.wave < run.waveTotal);
  wb.hidden = !canCall || mode !== "run";
  if (canCall) {
    const [gx, gy] = T.wpXY(T.GATE_WP);
    const [sx, sy] = toScreen(gx + 46, gy - 22);
    wb.style.left = sx + "px"; wb.style.top = sy + "px";
    const full = TD.waveGap, left = run.phase === "build" ? 0 : run.nextT;
    wb.style.setProperty("--cd", run.phase === "build" ? "360deg" : (1 - left / full) * 360 + "deg");
    const bonus = run.phase === "wave" ? Math.round(left * TD.earlyBonus) : 0;
    wb.querySelector("small").textContent = run.phase === "build" ? "시작" : bonus > 0 ? `+${bonus}` : "";
    wb.title = previewText();
  }
  // the open build ring follows its spot when the camera moves
  if (selSpot != null) placeRing();
}
function previewText() {
  const p = run.preview;
  if (!p) return "";
  return `다음: ${p.band} · ` + p.groups.map(([c, n]) => `${TD.enemies[c].name} ${n}`).join(", ");
}

// ---------------------------------------------------------------- building: the ring on a spot
function spotAt(x, y) {
  let best = null, bd = 22;
  for (const s of T.SPOTS) {
    const [sx, sy] = T.wpXY(s.w);
    const tw = T.towerAt(run, s.i), wy = tw && (tw.id === "arrow" || tw.id === "tesla") ? sy - 44 : sy - 10;
    const d = Math.min(Math.hypot(sx - x, sy - 10 - y), Math.hypot(sx - x, wy - y));
    if (d < bd) { bd = d; best = s.i; }
  }
  return best;
}
function closeRing() { selSpot = null; R.sel = null; $("ring").hidden = true; $("ring").innerHTML = ""; }
function openRing(spot) {
  A.sfx("hover");
  selSpot = spot;
  const ring = $("ring");
  ring.innerHTML = "";
  ring.hidden = false;
  const tw = T.towerAt(run, spot);
  const [x, y] = T.wpXY(T.SPOTS[spot].w);
  const opts = [];
  if (!tw) {
    for (const id of Object.keys(TD.towers)) opts.push({ icon: ICON(id), cost: T.costOf(run, id, 1), label: TD.towers[id].name, desc: TD.towers[id].desc, go: () => T.build(run, spot, id), range: TD.towers[id].lv[0].r, wall: TD.towers[id].where === "wall" });
    R.sel = { spot };
  } else {
    const D = TD.towers[tw.id];
    if (tw.lvl < 3) opts.push({ icon: "up", cost: T.costOf(run, tw.id, tw.lvl + 1), label: `강화 ${tw.lvl + 1}단계`, desc: upgradeText(tw), go: () => T.upgrade(run, spot), range: D.lv[tw.lvl].r, wall: D.where === "wall" });
    else opts.push({ icon: "max", label: "최대 강화", desc: `${D.name} · 처치 ${tw.kills}`, go: null });
    opts.push({ icon: "sell", cost: -Math.floor(tw.spent * TD.sellBack), label: "부수기", desc: "피를 일부 돌려받는다", go: () => T.sell(run, spot) });
    const L = D.lv[tw.lvl - 1];
    R.sel = { spot, x, y: D.where === "wall" ? y - 10 : y, r: L.r };
  }
  opts.forEach((o, i) => {
    const b = h("button", "rb" + (o.cost != null && o.cost > run.blood ? " poor" : ""));
    const ang = -Math.PI / 2 + (i - (opts.length - 1) / 2) * (opts.length > 3 ? 0.78 : 1.0);
    b.style.setProperty("--dx", Math.cos(ang) * 62 + "px"); b.style.setProperty("--dy", Math.sin(ang) * 62 + "px");
    if (o.icon === "up") b.innerHTML = "<em>▲</em>";
    else if (o.icon === "sell") b.innerHTML = "<em>✕</em>";
    else if (o.icon === "max") b.innerHTML = "<em>★</em>";
    else b.appendChild(cloneCanvas(cardIcon(o.icon)));
    if (o.cost != null) b.appendChild(h("b", "", o.cost < 0 ? "+" + -o.cost : String(o.cost)));
    b.onpointerenter = () => { $("ringTip").innerHTML = `<b>${esc(o.label)}</b><br>${esc(o.desc)}`; if (o.range) R.sel = { ...R.sel, x, y: o.wall ? y - 10 : y, r: o.range }; };
    b.onclick = (ev) => {
      ev.stopPropagation();
      if (!o.go) return;
      if (o.cost > run.blood) { A.sfx("deny"); shakeEl(b); shakeEl($("bloodBox")); return; }
      // a touch screen has no hover: the first tap explains, the second builds
      if (ev.pointerType !== "mouse" && b.dataset.armed !== "1" && o.icon !== "sell") { ring.querySelectorAll(".rb").forEach((q) => (q.dataset.armed = "")); b.dataset.armed = "1"; b.onpointerenter(); return; }
      if (o.go()) { A.sfx(o.icon === "sell" ? "coin" : "place"); seen.add("built"); closeRing(); }
    };
    ring.appendChild(b);
  });
  ring.appendChild(h("div", "tip", "")).id = "ringTip";
  placeRing();
}
function upgradeText(tw) {
  const D = TD.towers[tw.id], a = D.lv[tw.lvl - 1], b = D.lv[tw.lvl];
  const parts = [];
  if (b.dmg) parts.push(`피해 ${a.dmg}→${b.dmg}`);
  if (b.r && b.r !== a.r) parts.push(`범위 ${a.r}→${b.r}`);
  if (b.chain) parts.push(`연쇄 ${a.chain}→${b.chain}`);
  if (b.count) parts.push(`슬라임 ${a.count}→${b.count}`);
  if (b.bleed) parts.push("출혈 추가");
  if (b.pierce) parts.push("관통 추가");
  return parts.join(" · ");
}
function placeRing() {
  const s = T.SPOTS[selSpot];
  if (!s) return;
  const [x, y] = T.wpXY(s.w);
  const [sx, sy] = toScreen(x, y - 14);
  const ring = $("ring");
  ring.style.left = sx + "px"; ring.style.top = sy + "px";
}

// ---------------------------------------------------------------- canvas input
function worldFromEvent(ev) {
  const cr = $("cv").getBoundingClientRect();
  return R.screenToWorld(ev.clientX - cr.left, ev.clientY - cr.top);
}
function advAt(x, y) {
  let best = null, bd = 22;
  for (const a of run.advs) {
    if (a.dead || a.out) continue;
    const [ax, ay] = R.advXY(a), d = Math.hypot(ax - x, ay - 18 * (a.scale ?? 1) - y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
let press = null, seenGrab = false;
const heldAdv = () => run?.advs.find((a) => a.fly?.held) ?? null;
$("cv").addEventListener("pointerdown", (ev) => {
  A.initAudio();
  if (mode !== "run" || !run || aiming) return;
  const [x, y] = worldFromEvent(ev), a = advAt(x, y);
  if (!a) return;
  press = { id: a.id, sx: ev.clientX, sy: ev.clientY, grabbed: false, samples: [[x, y, performance.now()]] };
  try { $("cv").setPointerCapture(ev.pointerId); } catch {}
});
$("cv").addEventListener("pointermove", (ev) => {
  if (mode !== "run" || !run) return;
  const [x, y] = worldFromEvent(ev), now = performance.now();
  if (press) {
    if (!press.grabbed && Math.hypot(ev.clientX - press.sx, ev.clientY - press.sy) > 6) {
      const r = T.grab(run, press.id);
      if (r.ok) { press.grabbed = true; A.sfx("grab"); closeRing(); if (!seenGrab) { seenGrab = true; hint(""); } }
      else { if (r.why === "cd") { R.onText(x, y - 30, "손이 아직 지쳐 있다", "warn"); A.sfx("deny"); } press = null; return; }
    }
    if (press.grabbed) {
      T.holdAt(run, x, y + 12);
      press.samples.push([x, y, now]);
      while (press.samples.length > 2 && now - press.samples[0][2] > 90) press.samples.shift();
    }
    return;
  }
  R.aim = aiming ? { kind: aiming, x, y: y + 6 } : null;
  const a = !aiming && advAt(x, y);
  R.clawHover = a ? a.id : null;
  $("cv").classList.toggle("claw", !!a);
});
$("cv").addEventListener("pointerup", (ev) => {
  const [x, y] = worldFromEvent(ev);
  if (mode === "prologue") return prologue?.tap(x, y);
  if (mode !== "run" || !run) return;
  if (press) {
    const p = press; press = null;
    if (p.grabbed) {
      const s0 = p.samples[0], s1 = p.samples[p.samples.length - 1], dtm = Math.max(16, s1[2] - s0[2]) / 1000;
      const vx = ((s1[0] - s0[0]) / dtm) * 1.15, vy = ((s1[1] - s0[1]) / dtm) * 1.15;
      if (T.fling(run, vx, vy) && Math.hypot(vx, vy) > 200) A.sfx("whoosh");
      return;
    }
  }
  if (aiming) {
    if (T.cast(run, aiming, x, y)) { A.sfx(aiming === "roll" ? "roll" : "crumble"); aiming = null; R.aim = null; hint(""); }
    else A.sfx("deny");
    return;
  }
  const s = spotAt(x, y);
  if (s != null) { if (selSpot === s) closeRing(); else openRing(s); return; }
  closeRing();
});
$("ring").addEventListener("pointerdown", (ev) => ev.stopPropagation());
function useAbility(k) {
  if (!run || mode !== "run") return;
  A.initAudio();
  closeRing();
  if (k === "grab") { hint("침입자를 꾹 눌러 끌었다가 놓으면 던져요. 벽과 바닥에 세게 박을수록 크게 다쳐요"); return; }
  if (run.cd[k] > 0) { A.sfx("deny"); shakeEl($("ab-" + k)); return; }
  aiming = aiming === k ? null : k;
  R.aim = null;
  if (aiming) hint(k === "roll" ? "길 위 아무 곳이나 누르세요: 바위가 성문 쪽으로 굴러가며 모두 튕겨 내요" : "길 위 아무 곳이나 누르세요: 천장이 무너져 돌이 쏟아져요");
  else hint("");
}
for (const k of ["grab", "rockfall", "roll"]) $("ab-" + k).onclick = () => useAbility(k);
$("waveBtn").onclick = () => { if (run && T.callWave(run)) { closeRing(); } };
addEventListener("keydown", (ev) => {
  if (mode !== "run" || !run || modalOpen) return;
  if (ev.key === "Escape") { closeRing(); aiming = null; R.aim = null; hint(""); }
  if (ev.key === "1") useAbility("rockfall");
  if (ev.key === "2") useAbility("roll");
  if (ev.key === "w" || ev.key === "W" || ev.key === "ㅈ") $("waveBtn").click();
  if (ev.key === " ") { ev.preventDefault(); toggleSpeed(); }
});
function toggleSpeed() { speed = speed === 1 ? 2 : 1; $("speedBtn").textContent = speed + "×"; }
$("speedBtn").onclick = toggleSpeed;
$("muteBtn").onclick = () => { A.initAudio(); A.setMuted(!A.isMuted()); $("muteBtn").textContent = A.isMuted() ? "♪̸" : "♪"; };
$("menuBtn").onclick = () => { if (mode === "run") showMenu(); };
addEventListener("pointerdown", () => A.initAudio());

// ---------------------------------------------------------------- events: sound and words
const TRAP_SFX = { tesla: "zap", flame: "fire", spike: "spike", arrow: "arrow" };
const seen = new Set();
function handle(e) {
  switch (e.t) {
    case "dmg": if (!e.dot && Math.random() < 0.5) A.sfx("hit"); break;
    case "trap": if (TRAP_SFX[e.id]) A.sfx(TRAP_SFX[e.id]); break;
    case "death": {
      A.sfx("death");
      R.onText(e.x, e.y - 40, `+${e.bounty}`, "blood");
      break;
    }
    case "heartHit": A.sfx("heartHit"); if (!seen.has("leak")) { seen.add("leak"); hint("침입자가 심장에 닿으면 심장이 깎여요. 0이 되면 끝이에요"); } break;
    case "spawn": if (e.boss) banner("봉인 기사 단장", "백 년 전 그날의 기사가 돌아왔다"); break;
    case "wave": {
      A.sfx("horn");
      banner(e.band, `${e.n}/${e.of}번째 웨이브 · ${e.party.length}명`);
      if (e.n === 1 && !seen.has("grabHint")) { seen.add("grabHint"); setTimeout(() => { if (!seenGrab) hint("침입자를 꾹 눌러 끌었다가 놓아 보세요: 심장의 손이 던져요"); }, 3500); }
      break;
    }
    case "early": A.sfx("coin"); toast(`웨이브를 일찍 불러 피 <b>+${e.amount}</b>`); break;
    case "interest": toast(`고인 피 <b>+${e.amount}</b>`); break;
    case "place": A.sfx("place"); break;
    case "upgrade": A.sfx("power"); break;
    case "summon": A.sfx("summon"); break;
    case "slam": A.sfx(e.v > 400 ? "thudBig" : "thud"); break;
    case "bowl": A.sfx("thud"); break;
    case "rumble": A.sfx("crumble"); break;
    case "rockHit": A.sfx("thud"); break;
    case "rockBreak": if (e.kind === "roll") A.sfx("crumble"); break;
    case "tooHeavy": A.sfx("deny"); break;
    case "pyre": A.sfx("fire"); break;
    case "heal": break;
    case "streak": {
      const W = { 2: "더블!", 3: "트리플!", 4: "쿼드라!" };
      streakText((W[e.n] ?? (e.n >= 8 ? "공포 그 자체" : "학살!")) + (e.bonus ? ` +${e.bonus}` : ""), e.n);
      A.sfx("combo", Math.min(10, e.n));
      break;
    }
    case "relic": A.sfx("chime"); setTimeout(showRelic, 600); break;
    case "night": banner(`${e.n}번째 밤`, "토벌대가 더 많이, 더 단단하게 온다"); A.sfx("wave"); break;
    case "waveClear": save(meta, run); break;
    case "end": setTimeout(showEnd, 1400); break;
  }
}

// ---------------------------------------------------------------- picks, menu, end
function relicCard(r) {
  const e = h("div", "card big relicCard");
  e.appendChild(h("div", "stripe"));
  e.appendChild(cloneCanvas(cardIcon(r.icon)));
  e.appendChild(h("div", "nm", esc(r.name)));
  e.appendChild(h("div", "ds", esc(r.desc)));
  return e;
}
function showRelic() {
  if (run.phase !== "relic") return;
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "심장이 깨어난다"));
    pn.appendChild(h("div", "sub", "되찾은 힘 하나를 고르세요 · 이번 판 내내 유지돼요"));
    const row = pn.appendChild(h("div", "choices"));
    run.offer.forEach((id, i) => {
      const r = TD.relics.find((q) => q.id === id);
      const c = row.appendChild(relicCard(r));
      c.onclick = () => { A.sfx("pick"); T.chooseRelic(run, i); closeModal(); save(meta, run); };
    });
  });
}
function showMenu() {
  menuPause = true;
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "잠시 멈춤"));
    const row = pn.appendChild(h("div", "col"));
    row.appendChild(h("button", "btn", "계속하기")).onclick = () => { menuPause = false; closeModal(); };
    row.appendChild(h("button", "btn ghost", "도움말")).onclick = () => showHelp(() => showMenu());
    row.appendChild(h("button", "btn ghost", "오프닝 다시 보기")).onclick = () => { menuPause = false; startPrologue(() => startRun()); };
    const re = row.appendChild(h("button", "btn red", "처음부터 다시"));
    re.onclick = () => { if (re.dataset.a) { menuPause = false; closeModal(); startRun(); } else { re.dataset.a = 1; re.textContent = "정말요? 한 번 더 누르면 다시 시작"; } };
  });
}
function showHelp(back) {
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("h2", "", "던전의 규칙"));
    pn.appendChild(h("div", "", `<div style="text-align:left;line-height:1.7;font-size:15px">
      ♥ 침입자가 심장에 닿으면 심장이 깎여요. 0이 되면 다시 봉인당해요.<br>
      ● 길가의 빛나는 자리를 눌러 함정을 짓고, 다시 눌러 강화하거나 부숴요.<br>
      ◆ 침입자를 쓰러뜨리면 피가 들어오고, 그 피로 계속 짓고 강화해요.<br>
      ☠ 성문 위 해골을 누르면 다음 웨이브를 일찍 불러요. 남은 시간만큼 피를 더 줘요.<br>
      ✋ 침입자를 꾹 눌러 끌었다 놓으면 심장의 손이 던져요. 벽과 바닥에 세게 박을수록 크게 다쳐요.<br>
      ▼ 낙석과 굴림돌은 버튼을 누르고 길을 눌러 써요.<br>
      ✦ 3웨이브마다 되찾은 힘 하나를 골라요.<br>
      <span class="legend">단축키: 1 낙석 · 2 굴림돌 · W 웨이브 부르기 · Space 속도 · Esc 취소</span></div>`));
    pn.appendChild(h("div", "row")).appendChild(h("button", "btn", "알겠어")).onclick = () => { closeModal(); back?.(); };
  });
}
function showEnd() {
  const r = run.result;
  if (!r) return;
  meta.best = Math.max(meta.best ?? 0, r.wave);
  meta.runs = (meta.runs ?? 0) + 1;
  if (r.win) meta.wins = (meta.wins ?? 0) + 1;
  save(meta, null);
  A.sfx(r.win ? "fanfare" : "stamp");
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel"));
    pn.appendChild(h("div", "stamp" + (r.win ? " win" : ""), r.win ? "복수 완료" : "봉인"));
    pn.appendChild(h("div", "sub", r.win ? "왕국의 토벌대는 다시는 이 산을 넘지 못한다" : "사슬이 다시 심장을 휘감았다… 하지만 봉인은 영원하지 않다"));
    const st = pn.appendChild(h("div", "stats"));
    st.innerHTML = `<span>버틴 웨이브</span><b>${r.wave}/${run.waveTotal}</b><span>쓰러뜨린 침입자</span><b>${r.kills}명</b><span>되찾은 힘</span><b>${r.relics}개</b><span>최고 기록</span><b>${meta.best}웨이브</b>`;
    pn.appendChild(h("div", "row")).appendChild(h("button", "btn", "다시 깨어나기")).onclick = () => { closeModal(); startRun(); };
  });
}
function showTitle() {
  mode = "meta";
  document.body.classList.add("meta");
  backdrop = T.newRun(7);
  R.roomsDirty = true;
  R.nightTarget = 0.6;
  openModal((m) => {
    const pn = m.appendChild(h("div", "panel titlePanel"));
    pn.appendChild(h("h1", "logoText", "던전이 살아있다"));
    pn.appendChild(h("div", "sub", "봉인된 심장의 복수"));
    if (meta.best) pn.appendChild(h("div", "sub", `최고 기록 ${meta.best}웨이브 · ${meta.wins ?? 0}번 복수`));
    const row = pn.appendChild(h("div", "col"));
    row.appendChild(h("button", "btn big", "깨어나기")).onclick = () => { closeModal(); startRun(); };
    row.appendChild(h("button", "btn ghost", "오프닝 보기")).onclick = () => startPrologue(() => startRun());
    row.appendChild(h("button", "btn ghost", "도움말")).onclick = () => showHelp(() => showTitle());
  });
}

// ---------------------------------------------------------------- runs
function startRun() {
  document.body.classList.remove("meta");
  run = T.newRun();
  begin();
  hint("길가에 빛나는 자리를 눌러 함정을 지으세요. 준비되면 성문 위 해골을 눌러 첫 웨이브를 불러요");
}
function begin() {
  closeModal(); closeRing();
  aiming = null; R.aim = null;
  R.mons.clear(); R.corpses = []; R.roomsDirty = true;
  R.nightTarget = 0.45;
  lastPhase = null;
  mode = "run";
  A.setMusic("night", 70);
  fit();
}
function resumeRun(saved) {
  run = saved;
  run.events = [];
  begin();
  if (run.phase === "relic") setTimeout(showRelic, 300);
}

// ---------------------------------------------------------------- the loop
let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (mode === "run" && run) {
    const paused = menuPause || modalOpen;
    const feel = paused ? 1 : R.timeScale(dt);
    const k = paused ? 0 : speed * feel * (heldAdv() ? 0.45 : 1);
    let simDt = dt * k;
    while (simDt > 1e-6) { const s = Math.min(simDt, 1 / 30); T.step(run, s); simDt -= s; }
    for (const e of run.events) { R.onEvent(e, run); handle(e); }
    run.events.length = 0;
    if (run.phase !== lastPhase) { lastPhase = run.phase; if (run.phase === "wave" && hintText.startsWith("길가")) hint(""); }
    A.setMusic("night", 60 + (1 - run.heart.hp / run.heart.max) * 90);
    R.follow = R.portrait && selSpot == null && !aiming;
    R.update(dt * (paused ? 0 : speed * feel || 0));
    R.draw(run);
    R.present(run, dt);
    syncHud();
  } else if (mode === "prologue" && prologue) {
    prologue.tick(dt);
  } else if (mode === "meta" && backdrop) {
    R.update(dt); R.draw(backdrop); R.present(backdrop, dt);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- the prologue
function startPrologue(after) {
  closeModal(); closeRing();
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
      R.camOverride = null; R.heartDead = false; R.chains = []; R.sealCircle = null; R.chainDrain = false; R.mode = "normal";
      after();
      R.gray = 1;
      const t0 = performance.now();
      const fade = () => { R.gray = Math.max(0, 1 - (performance.now() - t0) / 3500); if (R.gray > 0) requestAnimationFrame(fade); };
      requestAnimationFrame(fade);
      subtitle("봉인이 약해졌다. 빼앗긴 것을 되찾을 시간이다.");
      setTimeout(() => subtitle(""), 4200);
    },
  });
}

// ---------------------------------------------------------------- boot
function boot() {
  document.querySelectorAll('link[media="print"]').forEach((l) => (l.media = "all"));
  if (/skipprologue/.test(location.search)) { meta.seenPrologue = true; meta.prologueV = 2; }
  fit();
  requestAnimationFrame(frame);
  if (!meta.seenPrologue || (meta.prologueV ?? 1) < 2) startPrologue(() => startRun());
  else if (run && run.td && run.phase !== "end") { resumeRun(run); toast("지난 판을 이어서 해요"); }
  else if (/autostart/.test(location.search)) startRun();
  else showTitle();
}
boot();

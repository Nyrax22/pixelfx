// The prologue: three hundred years of giving its blood to a kingdom, and the day the kingdom
// decided to take it all. The prince the heart once saved comes back a king, not afraid of it but
// wanting it: the seal is not a cage, it is a pump. The people it fed do not stop him.
// One last stand at full strength, the chains, a hundred years of the kingdom glittering on its
// blood, and the one thing it learned: what you give freely, they will take. This time, it takes.

import p1 from "../assets/p1.jpg";
import p2 from "../assets/p2.jpg";
import p3 from "../assets/p3.jpg";
import pKing from "../assets/p_king.png";
import pMob from "../assets/p_mob.png";
import pSeal from "../assets/p_seal.png";
import p100 from "../assets/p_100.png";
import { createStory } from "./story.js";
import { kinetic, unkinetic } from "./kinetic.js";

const IMG = {};
for (const [k, src] of Object.entries({ p1, p2, p3, king: pKing, mob: pMob, seal: pSeal, p100 })) { const i = new Image(); i.src = src; IMG[k] = i; }
const TYPES = ["water", "treasure", "nest", "library", "altar", "mushroom", "icecave", "web"];

export function playPrologue(api) {
  const { R, S, A, openModal, closeModal, h, cardEl } = api;
  const meta = S.newMeta();
  meta.runs = 1;
  const run = S.newRun(meta, 42);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // the dungeon at full strength: every chamber dug out and dressed, its creatures in every hall
  let ti = 0;
  for (const z of Object.values(S.ZONES)) {
    const rm = run.rooms[z.id];
    rm.open = true;
    if (z.kind === "chamber") rm.type = TYPES[ti++ % TYPES.length];
  }
  run.ver++;
  run.cards = [];
  run.monsters = [];
  const chambers = Object.values(S.ZONES).filter((z) => z.kind === "chamber" || z.kind === "secret");
  ["slime", "bat", "wisp", "slime", "ghost", "frog", "wisp", "eyeball", "slime", "bat", "frog", "skull"].forEach((sp, i) => {
    const card = Object.values(S.CARDS).find((cd) => cd.kind === "monster" && cd.species === sp);
    const z = chambers[i % chambers.length];
    S.addMonster(run, { ...card, hp: card.hp * 3 }, z.wps[2 + ((i * 5) % Math.max(1, z.wps.length - 4))]);
  });
  run.hand = [];
  run.heart = { hp: 999, max: 999 };
  run.mana = 99;
  run.phase = "wave";
  run.pick = null;
  run.waves = new Array(99).fill(["warrior"]);
  run.spawnQ = [];
  let uid = 5000;
  const allWps = S.WP.filter((w) => w.y > 130).map((w) => w.id);
  const npc = (skin, w) => ({
    id: uid++, cls: "warrior", skin, npc: true, cell: w, next: null, prog: 0, lane: 0, hp: 1, max: 1, courage: 1, courageMax: 1,
    gear: [], state: "walk", frozenT: 0, burnT: 0, poisonT: 0, slowT: 0, hitT: 0, spare: true, dead: false, out: false, face: 1,
  });
  // the king's army comes as one column, banners at the head
  const knight = (i) => ({
    id: uid++, cls: "warrior", skin: i % 6 === 0 ? "bannerman" : "knight", name: "기사", town: "왕도", lvl: 1, hp: 60, max: 60, atk: 3, rate: 1, speed: 0.62,
    courage: 1e9, courageMax: 1e9, gear: [], cell: S.ENT_WP, next: null, prog: 0, zone: "entrance", trig: [], seen: [], state: "walk", cd: 0.5, healT: 1, disarmT: 0,
    lootT: 0, looted: true, slowT: 0, slowK: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, frozenT: 0, dmgBy: {}, srcBy: {},
    spare: null, mercyT: 0, lane: ((i % 3) - 1) * 0.8, face: 1, hitT: 0, dead: false, out: false, diary: { lines: [] },
  });

  const [hx, fy] = S.wpXY(S.HEART_WP), hy = fy - 64;
  // the day of the seal is fought at dusk under a red moon
  R.mode = "normal";
  R.roomsDirty = true;
  R.mons.clear();
  R.night = 0.75;
  R.nightTarget = 0.75;
  R.gray = 0;
  R.heartDead = false;
  R.chainDrain = false;
  R.targets = null; R.zoneTargets = [];
  R.camOverride = { x: hx, y: hy, z: 6, speed: 1 };
  R.camSnap = true;

  const $ = (id) => document.getElementById(id);
  const curtain = $("curtain"), epicEl = $("epic"), subEl = $("subtitle"), titleEl = $("title"), storyEl = $("story");
  const story = createStory($("storyCv"));
  story.resize();
  const onResize = () => story.resize();
  addEventListener("resize", onResize);
  curtain.textContent = "";
  curtain.style.transition = "none";
  curtain.classList.add("on");
  void curtain.offsetWidth;
  curtain.style.transition = "";

  // a tiny script runner: wait() counts real time, tap() waits for the player
  let t = 0, waits = [], tapWait = null, grayTarget = 0, ended = false, march = 0, storyOn = false;
  const wait = (s) => new Promise((res) => waits.push({ at: t + s, res }));
  const jolt = () => { story.shake(0.35); R.shake = Math.max(R.shake, 0.3); };
  /** Big words in the middle of the screen: they soak in, hold, and burn away. */
  const epic = async (text, hold) => {
    epicEl.classList.remove("red");
    epicEl.classList.add("on");
    const ms = kinetic(epicEl, text, { speed: 85, onKey: jolt });
    await wait(ms / 1000 + hold);
    await wait(unkinetic(epicEl) / 1000);
    epicEl.classList.remove("on");
    await wait(0.3);
  };
  /** Narration under a panel. Speech (the king) is set in quotes and coloured. */
  const line = async (text, hold, speech = false) => {
    subEl.style.opacity = 1;
    subEl.classList.toggle("speech", speech);
    const ms = kinetic(subEl, text, { speed: 60, onKey: jolt });
    await wait(ms / 1000 + hold);
    await wait(unkinetic(subEl) / 1000);
    subEl.style.opacity = 0;
    await wait(0.25);
  };
  const panel = (key, opts) => { storyOn = true; storyEl.classList.add("on"); story.show(IMG[key], key, opts); };
  const panelsOff = () => { storyEl.classList.remove("on"); setTimeout(() => { if (!storyEl.classList.contains("on")) storyOn = false; }, 1700); };
  const skip = h("button", "btn ghost", "건너뛰기 ▸▸");
  skip.id = "skip";
  if (api.meta.seenPrologue) document.body.appendChild(skip);
  skip.onclick = () => finish();

  function pickCard(ids, fizzle) {
    return new Promise((res) => {
      openModal((m) => {
        m.style.background = "#05030c88";
        const pn = m.appendChild(h("div", "panel"));
        pn.appendChild(h("h2", "", fizzle ? "힘이… 빠져나간다" : "마지막 전성기의 힘"));
        pn.appendChild(h("div", "sub", fizzle ? "카드를 골라 보세요" : "카드를 고르고, 기사단의 행렬을 누르세요"));
        const ch = pn.appendChild(h("div", "choices"));
        ids.forEach((id) => {
          const e = cardEl({ id }, true);
          if (fizzle) e.style.filter = "grayscale(1) brightness(.75)";
          else e.style.boxShadow = "0 0 0 2px #ff4a5a, 0 0 26px #ff2a4a88";
          e.onclick = () => { m.style.background = ""; closeModal(); A.sfx("pick"); res(id); };
          ch.appendChild(e);
        });
      }, { force: true });
    });
  }
  const knights = () => run.advs.filter((a) => !a.npc && !a.dead && !a.out);
  const near = (a, b, r) => Math.hypot(S.WP[a].x - S.WP[b].x, S.WP[a].y - S.WP[b].y) < r;
  const tap = () => new Promise((res) => {
    R.targets = S.WP.filter((w) => w.y > 130 && run.rooms[S.zoneOf(w.id)]?.open).map((w) => w.id);
    tapWait = { res };
  });
  const blast = (id, w) => { run.hand = [{ id, uid: uid++ }]; S.playCard(run, meta, 0, w); };
  /** Spots along the column of knights, from where the player tapped back toward the gate. */
  const column = (w, n) => {
    const ks = knights().map((a) => S.advCell(a)).sort((a, b) => S.field(run, S.HEART_WP, false)[a] - S.field(run, S.HEART_WP, false)[b]);
    const out = [w];
    for (const k of ks) if (out.length < n && !out.some((o) => near(o, k, 36))) out.push(k);
    return out;
  };

  async function volley(id, w) {
    const spots = column(w, id === "pro_pillar" ? 10 : 6);
    for (let i = 0; i < spots.length; i++) {
      blast(id, spots[i]);
      if (id === "pro_judge" && i) { const [ax, ay] = S.wpXY(spots[i - 1]), [bx, by] = S.wpXY(spots[i]); R.bolt(ax, ay - 20, bx, by - 20, "#ffffff", 0.4); }
      if (id === "pro_meteor") A.sfx("boomBig");
      await wait(id === "pro_pillar" ? 0.12 : 0.2);
    }
    await wait(1.2);
  }

  async function script() {
    // press to begin: sound may only start after a touch, and the heartbeat is the first thing heard
    epicEl.innerHTML = '<span style="color:#ff3a5a;font-size:1.6em;display:inline-block;animation:beat 1.1s infinite">♥</span><br><span style="font-size:.6em;color:#a89cc8">눌러서 심장을 깨우세요</span>';
    epicEl.classList.add("on");
    await new Promise((res) => {
      const go = () => { removeEventListener("pointerdown", go); removeEventListener("keydown", go); res(); };
      addEventListener("pointerdown", go); addEventListener("keydown", go);
    });
    A.initAudio();
    epicEl.classList.remove("on");
    A.setMusic("heartbeat");
    await wait(1.2);
    await epic("삼백 년 동안,", 0.8);
    await epic("나는 이 땅에 *피*를 나눠 주었다.", 1.4);

    // what it gave
    A.setMusic("prologue");
    A.sfx("chime");
    panel("p1", { from: [0.45, 0.5, 1.05], to: [0.74, 0.42, 1.35], dur: 13 });
    await wait(1.2);
    await line("메마른 들판이 살아났고, 사람들은 내 문 앞에 무릎을 꿇었다.", 1.6);
    A.sfx("horn");
    A.setMusic("war");
    panel("p2", { from: [0.6, 0.45, 1.25], to: [0.25, 0.5, 1.08], dur: 11 });
    story.shake(0.5);
    await wait(1);
    await line("적이 쳐들어오면, 나의 아이들이 그들을 지켰다.", 1.4);
    A.setMusic("heartbeat");
    panel("p3", { from: [0.62, 0.42, 1.3], to: [0.4, 0.66, 1.45], dur: 12 });
    await wait(1.2);
    await line("죽어 가던 어린 왕자에게도, 나는 내 *피*를 나눴다.", 1.6);

    // what it got back
    panelsOff();
    await wait(1.4);
    await epic("그 아이가 왕이 되어 돌아왔다.", 1);
    A.sfx("horn");
    A.setMusic("war");
    panel("king", { px: true, from: [0.5, 0.75, 1.0], to: [0.55, 0.35, 1.35], dur: 11 });
    await wait(1.2);
    await line("“그 *피*는 이제 왕국의 것이다.”", 1.2, true);
    story.flash("255,240,220", 0.35);
    await line("“심장을 묶어라. 한 방울도 남김없이 퍼 올려라.”", 1.4, true);
    A.sfx("rumble");
    A.sfx("babble", -300);
    panel("mob", { px: true, from: [0.5, 0.7, 1.25], to: [0.48, 0.45, 1.05], dur: 10 });
    await wait(1);
    await line("사람들은 막지 않았다.", 0.8);
    A.sfx("babble", -200);
    await line("그들도 더 많은 *피*를 원했으니까.", 1.6);
    panelsOff();

    // one last stand
    curtain.classList.remove("on");
    R.camOverride = { x: hx, y: hy, z: 5.5, speed: 1 };
    R.camSnap = true;
    await wait(1.2);
    R.camOverride = { ...fitAll(), speed: 0.5 };
    await wait(1.6);
    A.sfx("horn");
    const [gx, gy] = R.gateXY;
    R.camOverride = { x: gx + 60, y: gy + 50, z: 3, speed: 1.4 };
    await epic("왕국 기사단", 0.6);
    for (let i = 0; i < 26; i++) run.spawnQ.push(knight(i));
    run.spawnT = 0.1;
    march = 1;
    await wait(4);
    R.camOverride = { ...fitAll(), speed: 1.1 };
    await wait(1.4);
    const id = await pickCard(["pro_judge", "pro_meteor", "pro_pillar"]);
    api.toast?.("기사단의 행렬을 누르세요");
    const w = await tap();
    R.targets = null;
    await volley(id, w);

    // the seal: mages on the hill, a circle of runes over the dungeon, cards that no longer answer,
    // and chains that do not kill but drink
    march = 0;
    A.setMusic("prologue");
    A.sfx("chant");
    R.camOverride = { ...fitAll(), speed: 0.8 };
    const ent = S.ZONES.entrance.wps;
    for (const i of [2, 4, 6, 8, 10]) { const m = npc("sealmage", ent[Math.min(ent.length - 1, i)]); run.advs.push(m); }
    await epic("왕실 봉인 마법사단", 0.6);
    sealing = true;
    R.sealCircle = { x: hx, y: hy, r: 300, age: 0 };
    A.sfx("seal");
    await wait(2);
    await pickCard(["pro_judge", "pro_meteor", "pro_pillar"], true);
    const w2 = await tap();
    R.targets = null;
    { const [x, y] = S.wpXY(w2); R.onText(x, y - 40, "…발동하지 않는다", "fear"); R.spawn("poof", x, y, { palette: ["#2a2a2a", "#4a4a4a", "#6a6a6a", "#8a8a8a", "#aaaaaa", "#cccccc"] }, "over"); }
    A.sfx("fizzle");
    await wait(1.4);
    R.camOverride = { x: hx, y: hy - 30, z: fitAll().z * 1.5, speed: 0.7 };
    const anchors = [0.04, 0.18, 0.36, 0.64, 0.82, 0.96];
    for (let i = 0; i < anchors.length; i++) {
      R.chains.push({ x0: R.W * anchors[i], y0: -10, x1: hx + (i - 2.5) * 8, y1: hy + 4, t: 0 });
      await wait(0.42);
      A.sfx("clank");
      R.shake = 0.5; R.stop(0.08); R.impact(hx, hy, 0.4); R.heartHurt = 0.5;
      await wait(0.3);
    }
    R.chainDrain = true;
    A.setMusic("heartbeat");
    subEl.style.opacity = 1;
    kinetic(subEl, "사슬이 *피*를 마시기 시작했다.", { speed: 60, onKey: jolt });
    grayTarget = 1;
    await wait(3.4);
    unkinetic(subEl);
    R.camOverride = { x: hx, y: hy, z: fitAll().z * 1.9, speed: 1.2 };
    await wait(0.8);
    R.spawn("holyPillar", hx, fy, {}, "over", 2.6);
    A.sfx("boomBig"); A.sfx("thunder");
    R.flash = 0.9; R.flashColor = "255,240,210"; R.shake = 1; R.stop(0.25); R.impact(hx, hy, 1.2);
    R.heartDead = true;
    A.setMusic("none");
    await wait(2.4);
    subEl.style.opacity = 0;
    sealing = false;
    curtain.classList.add("on");
    await wait(1);

    // a hundred years of it
    panel("seal", { px: true, from: [0.45, 0.42, 1.35], to: [0.45, 0.3, 1.1], dur: 9 });
    await wait(1);
    await line("사슬은 나를 죽이지 않았다. 백 년 동안, 내 *피*를 퍼 올렸다.", 1.4);
    A.sfx("rumble");
    panel("p100", { px: true, from: [0.3, 0.45, 1.3], to: [0.7, 0.6, 1.25], dur: 11 });
    await wait(1);
    await line("백 년 후. 왕국은 내 피로 눈부시게 빛나고 있었다.", 1.6);
    panelsOff();
    await wait(1.4);
    A.setMusic("heartbeat");
    await epic("값없이 준 것은 사랑이 아니었다.", 0.8);
    await epic("*빼앗길* 이유였다.", 1);
    await epic("이번엔, 내가 *빼앗는다*.", 1.2);
    finish();
  }
  let sealing = false, sealT = 0;
  function fitAll() {
    const b = R.bounds(run);
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: Math.max(0.6, Math.min(3.6, R.vw / (b.x1 - b.x0), R.vh / (b.y1 - b.y0))) };
  }

  function finish() {
    if (ended) return;
    ended = true;
    skip.remove();
    closeModal();
    epicEl.classList.remove("on");
    subEl.style.opacity = 0;
    curtain.textContent = "";
    curtain.classList.add("on");
    panelsOff();
    A.setMusic("heartbeat");
    $("abyss").classList.add("on");
    setTimeout(() => {
      // the title, one syllable at a time, each one a heartbeat
      const logo = titleEl.querySelector(".logo");
      logo.innerHTML = "";
      [..."던전이 살아있다"].forEach((ch, i) => {
        const sp = document.createElement("span");
        sp.style.setProperty("--i", i);
        sp.innerHTML = ch === " " ? "&nbsp;" : ch;
        logo.appendChild(sp);
        if (ch !== " ") setTimeout(() => A.sfx("slam", 40 + i * 2), 130 * i + 260);
      });
      titleEl.classList.add("on");
      setTimeout(() => titleEl.classList.add("beat"), 1400);
    }, 1400);
    setTimeout(() => {
      $("abyss").classList.remove("on");
      titleEl.classList.remove("on", "beat");
      removeEventListener("resize", onResize);
      R.mode = "normal";
      R.targets = null; R.zoneTargets = [];
      R.roomsDirty = true;
      R.mons.clear();
      R.fx = [];
      R.corpses = [];
      R.chains = []; R.sealCircle = null; R.heartDead = false; R.chainDrain = false;
      R.camOverride = null;
      R.camSnap = true;
      api.done();
      curtain.classList.remove("on");
      setTimeout(() => (curtain.textContent = ""), 1300);
    }, 6200);
  }

  script();

  return {
    tick(dt) {
      const feel = R.timeScale(dt);
      const gdt = dt * feel;
      t += dt;
      for (const w of waits.filter((w) => t >= w.at)) w.res();
      waits = waits.filter((w) => t < w.at);
      if (storyOn) story.tick(dt);
      S.step(run, meta, gdt);
      if (run.spawnQ.length && run.spawnT > 0.32) run.spawnT = 0.32;
      run.phase = "wave";
      run.pick = null;
      for (const e of run.events) {
        R.onEvent(e, run);
        if (e.t === "spell") A.sfx(e.id === "pro_judge" ? "thunder" : e.id === "pro_meteor" ? "boom" : "fire");
        if (e.t === "death" && Math.random() < 0.3) A.sfx("death");
      }
      run.events.length = 0;
      // marching feet shake the floor
      if (march && knights().length && Math.floor(t * 2.2) !== Math.floor((t - dt) * 2.2)) R.shake = Math.max(R.shake, 0.12);
      // the seal: beams from the mages into the heart, creatures fading one by one, rings of runes
      if (sealing && Math.random() < dt * 9) {
        const ms = run.advs.filter((a) => a.skin === "sealmage"), m = ms[Math.floor(Math.random() * ms.length)];
        if (m) { const [mx, my] = R.advXY(m); R.bolt(mx + 6, my - 40, hx, hy, "#ffe8b0", 0.12); }
      }
      if (sealing) {
        sealT += dt;
        if (sealT > 0.7) {
          sealT = 0;
          const m = run.monsters.find((q) => q.hp > 0);
          if (m) { m.hp = 0; m.deadT = 0.01; run.events.push({ t: "monDeath", mid: m.id, w: m.w }); }
          const w = allWps[Math.floor(rnd() * allWps.length)], [x, y] = S.wpXY(w);
          R.spawn("runeCircle", x, y - 4, { palette: ["#1a1004", "#3e2808", "#6e4a10", "#b07a1c", "#e8b23a", "#ffe07a", "#fff8d8", "#ffffff"] }, "over", 1.6);
          R.rings.push({ x: hx, y: hy, age: 0, dur: 1.6, r: 260, color: "255,220,150" });
        }
        run.monsters = run.monsters.filter((m) => m.hp > 0);
      }
      R.gray += (grayTarget - R.gray) * Math.min(1, dt * 0.55);
      R.update(gdt);
      R.draw(run);
      R.present(run, dt);
    },
    tap(x, y) {
      if (!tapWait) return;
      let best = null, bd = Infinity;
      for (const p of S.WP) {
        if (p.y <= 130 || !run.rooms[S.zoneOf(p.id)]?.open) continue;
        const d = Math.hypot(p.x - x, p.y - y - 12);
        if (d < bd) { bd = d; best = p.id; }
      }
      if (best == null) return;
      const tw = tapWait;
      tapWait = null;
      tw.res(best);
    },
  };
}

// The prologue: three hundred years of guarding a kingdom, and the day the kingdom paid it back.
// Painted panels tell the golden age, the war, the sick prince the heart saved, the prince grown into a
// king raising a sword at its gate, and the people it fed standing behind him with torches.
// Then the player fights it out at full strength, is sealed in chains and stone, and in the dark
// learns the one thing it will build the dungeon on: love protects nothing; only fear does.

import p1 from "../assets/p1.jpg";
import p2 from "../assets/p2.jpg";
import p3 from "../assets/p3.jpg";
import pKing from "../assets/p_king.png";
import pMob from "../assets/p_mob.png";
import pSeal from "../assets/p_seal.png";
import p100 from "../assets/p_100.png";

const TYPES = ["water", "treasure", "nest", "library", "altar", "mushroom", "icecave", "web"];
// preload so a panel never pops in half-decoded
for (const src of [p1, p2, p3, pKing, pMob, pSeal, p100]) { const i = new Image(); i.src = src; }

export function playPrologue(api) {
  const { R, S, A, openModal, closeModal, h, cardEl } = api;
  const meta = S.newMeta();
  meta.runs = 1;
  const run = S.newRun(meta, 42);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // the golden age: every chamber dug out and dressed, monsters and villagers living side by side
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
    id: uid++, cls: "warrior", skin, npc: true, cell: w, next: null, prog: 0, lane: rnd() * 2 - 1, hp: 1, max: 1, courage: 1, courageMax: 1,
    gear: [], state: "walk", frozenT: 0, burnT: 0, poisonT: 0, slowT: 0, hitT: 0, spare: true, dead: false, out: false, wander: true, face: 1,
  });
  for (let i = 0; i < 12; i++) run.advs.push(npc("villager", allWps[Math.floor(rnd() * allWps.length)]));
  const knight = () => ({
    id: uid++, cls: "warrior", skin: rnd() < 0.22 ? "bannerman" : "knight", name: "기사", town: "왕도", lvl: 1, hp: 60, max: 60, atk: 3, rate: 1, speed: 0.6 + rnd() * 0.25,
    courage: 1e9, courageMax: 1e9, gear: [], cell: S.ENT_WP, next: null, prog: 0, zone: "entrance", trig: [], seen: [], state: "walk", cd: 0.5, healT: 1, disarmT: 0,
    lootT: 0, looted: true, slowT: 0, slowK: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, frozenT: 0, dmgBy: {}, srcBy: {},
    spare: null, mercyT: 0, lane: rnd() * 2 - 1, face: 1, hitT: 0, dead: false, out: false, diary: { lines: [] },
  });

  const [hx, fy] = S.wpXY(S.HEART_WP), hy = fy - 64;
  // the day of the seal is fought at dusk under a red moon, in the dungeon as it really looked
  R.mode = "normal";
  R.roomsDirty = true;
  R.mons.clear();
  R.night = 0.75;
  R.nightTarget = 0.75;
  R.gray = 0;
  R.heartDead = false;
  R.targets = null; R.zoneTargets = [];
  R.camOverride = { x: hx, y: hy, z: 6, speed: 1 };
  R.camSnap = true;

  const $ = (id) => document.getElementById(id);
  const curtain = $("curtain"), epicEl = $("epic"), titleEl = $("title"), story = $("story"), imgs = [...story.querySelectorAll("img")];
  curtain.textContent = "";
  curtain.style.transition = "none";
  curtain.classList.add("on");
  void curtain.offsetWidth;
  curtain.style.transition = "";

  // a tiny script runner: wait() counts real time, tap() waits for the player
  let t = 0, waits = [], tapWait = null, grayTarget = 0, ended = false, kills = 0, march = 0, panelI = 0;
  const wait = (s) => new Promise((res) => waits.push({ at: t + s, res }));
  const epic = async (text, hold, red = false) => {
    epicEl.textContent = text;
    epicEl.classList.toggle("red", red);
    epicEl.classList.add("on");
    await wait(hold);
    epicEl.classList.remove("on");
    await wait(1);
  };
  const say = (text, speech = false) => {
    const el = $("subtitle");
    if (!text) { el.style.opacity = 0; return; }
    el.innerHTML = speech ? `<span class="say">${api.esc(text)}</span>` : api.esc(text);
    el.style.opacity = 1;
  };
  const line = async (text, hold, speech = false) => { say(text, speech); await wait(hold); say(""); await wait(0.5); };
  /** Show a painted panel, slowly drifting toward a point of interest. */
  const panel = (src, { px = false, ox = "50%", oy = "50%", zoom = 1.18, dur = 14, kx = "0", ky = "0" } = {}) => {
    const cur = imgs[panelI % 2], next = imgs[(panelI + 1) % 2];
    panelI++;
    next.classList.remove("on", "go");
    next.classList.toggle("px", px);
    next.style.setProperty("--ox", ox); next.style.setProperty("--oy", oy);
    next.style.setProperty("--kz", zoom); next.style.setProperty("--kb", dur + "s");
    next.style.setProperty("--kx", kx); next.style.setProperty("--ky", ky);
    next.src = src;
    void next.offsetWidth;
    next.classList.add("on");
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add("go")));
    cur.classList.remove("on");
    story.classList.add("on");
  };
  const panelsOff = () => { story.classList.remove("on"); setTimeout(() => { if (!story.classList.contains("on")) imgs.forEach((i) => i.classList.remove("on", "go")); }, 1700); };
  const skip = h("button", "btn ghost", "건너뛰기 ▸▸");
  skip.id = "skip";
  if (api.meta.seenPrologue) document.body.appendChild(skip);
  skip.onclick = () => finish();

  function pickCard(ids, fizzle) {
    return new Promise((res) => {
      openModal((m) => {
        m.style.background = "#05030c88";
        const pn = m.appendChild(h("div", "panel"));
        pn.appendChild(h("h2", "", fizzle ? "힘이… 빠져나간다" : "전성기의 힘"));
        pn.appendChild(h("div", "sub", fizzle ? "카드를 골라 보세요" : "카드를 고르고, 기사단이 몰려 있는 곳을 누르세요"));
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
  /** Waypoints where knights are packed the tightest, best first, spaced apart. */
  const hotspots = () => {
    const ks = knights().map((a) => ({ w: S.advCell(a), p: S.advPos(a) }));
    const ranked = ks.map((k) => ({ w: k.w, n: ks.filter((o) => Math.hypot(o.p[0] - k.p[0], o.p[1] - k.p[1]) < 50).length })).sort((a, b) => b.n - a.n);
    const out = [];
    for (const r of ranked) if (!out.some((o) => near(o, r.w, 40))) out.push(r.w);
    return out;
  };
  const tap = () => new Promise((res) => {
    R.targets = S.WP.filter((w) => w.y > 130 && run.rooms[S.zoneOf(w.id)]?.open).map((w) => w.id);
    tapWait = { res };
  });
  const sendKnights = (n, gap = 0.16) => { for (let i = 0; i < n; i++) run.spawnQ.push(knight()); run.spawnT = 0.1; run.prologueGap = gap; };
  const blast = (id, w) => { run.hand = [{ id, uid: uid++ }]; S.playCard(run, meta, 0, w); };
  /** The floor from a waypoint toward a goal, one waypoint at a time. */
  const walk = (from, goal, n) => {
    const f = S.field(run, goal, false), out = [from];
    let cur = from;
    for (let i = 0; i < n; i++) {
      let best = null, bd = f[cur];
      for (const nb of S.WP[cur].nb) if (f[nb] < bd) { bd = f[nb]; best = nb; }
      if (best == null) break;
      out.push((cur = best));
    }
    return out;
  };
  const randomKnightW = () => { const ks = knights(); return ks.length ? S.advCell(ks[Math.floor(rnd() * ks.length)]) : allWps[Math.floor(rnd() * allWps.length)]; };

  async function volley(id, w) {
    const before = kills;
    let spots = [w, ...hotspots().filter((o) => !near(o, w, 40))];
    if (id === "pro_judge") {
      // the sky splits: strike after strike, arcs leaping between them
      spots = spots.slice(0, 6);
      while (spots.length < 6) spots.push(randomKnightW());
      for (let i = 0; i < spots.length; i++) {
        blast(id, spots[i]);
        if (i) { const [ax, ay] = S.wpXY(spots[i - 1]), [bx, by] = S.wpXY(spots[i]); R.bolt(ax, ay - 20, bx, by - 20, "#ffffff", 0.4); }
        await wait(0.17);
      }
    } else if (id === "pro_meteor") {
      // a shower of falling stars
      spots = spots.slice(0, 7);
      while (spots.length < 7) spots.push(randomKnightW());
      for (const s of spots) { blast(id, s); A.sfx("boomBig"); await wait(0.24); }
    } else {
      // a wall of fire running up the road toward the gate
      const road = walk(w, S.ENT_WP, 200).filter((_, i) => i % 5 === 0).slice(0, 14);
      for (const s of road) { blast(id, s); await wait(0.11); }
      for (const s of spots.slice(1, 4)) { blast(id, s); await wait(0.15); }
    }
    await wait(1.1);
    const n = kills - before;
    if (n > 0) api.banner(`기사 ${n}명 소멸`, "이것이 전성기의 심장");
  }

  async function script() {
    // press to begin: the browser lets sound start only after a touch, and the heartbeat is the first thing heard
    epicEl.innerHTML = '<span style="color:#ff3a5a;font-size:1.6em;display:inline-block;animation:beat 1.1s infinite">♥</span><br><span style="font-size:.6em;color:#a89cc8">눌러서 심장을 깨우세요</span>';
    epicEl.classList.add("on");
    await new Promise((res) => {
      const go = () => { removeEventListener("pointerdown", go); removeEventListener("keydown", go); res(); };
      addEventListener("pointerdown", go); addEventListener("keydown", go);
    });
    A.initAudio();
    epicEl.classList.remove("on");
    A.setMusic("heartbeat");
    await wait(1.4);
    await epic("삼백 년 동안,", 2.2);
    await epic("나는 이 왕국의 심장이었다.", 3);

    // the golden age
    A.setMusic("prologue");
    A.sfx("chime");
    panel(p1, { ox: "78%", oy: "40%", zoom: 1.22, dur: 16 });
    await wait(1.6);
    await line("내 피는 강이 되어 메마른 들판을 적셨고,", 3.6);
    await line("사람들은 내 문 앞에 무릎 꿇고 감사를 바쳤다.", 4);

    // the war
    A.sfx("horn");
    A.setMusic("war");
    panel(p2, { ox: "30%", oy: "55%", zoom: 1.2, dur: 14 });
    await wait(1.2);
    await line("적이 쳐들어오면, 나의 아이들이 그들의 방패가 되었다.", 3.8);
    await line("성벽 위의 사람들은 우리의 이름을 외쳤다.", 3.4);

    // the prince
    A.setMusic("heartbeat");
    A.sfx("chime");
    panel(p3, { ox: "52%", oy: "60%", zoom: 1.22, dur: 15 });
    await wait(1.4);
    await line("병든 어린 왕자가 실려 왔을 때,", 3.2);
    await line("나는 내 피를 나누어 그 아이를 살렸다.", 3.8);

    // the betrayal
    panelsOff();
    await wait(1.6);
    await epic("그 아이가 왕이 된 해.", 2.6);
    A.sfx("horn");
    A.setMusic("war");
    panel(pKing, { px: true, ox: "56%", oy: "30%", zoom: 1.2, dur: 13 });
    await wait(1.4);
    await line("“그 힘은 한때 왕국을 지켰다. 이제는 왕국을 위협한다.”", 4, true);
    await line("“신은 하나면 족하다. 괴물을 봉인하라.”", 3.8, true);
    A.sfx("rumble");
    A.sfx("babble", -300);
    panel(pMob, { px: true, ox: "50%", oy: "40%", zoom: 1.16, dur: 12 });
    await wait(1.2);
    await line("내가 먹이고 지켜 온 사람들이,", 3);
    A.sfx("babble", -200);
    await line("횃불을 들고 내 문 앞에 서 있었다.", 3.6);
    panelsOff();

    // full strength, one last time
    curtain.classList.remove("on");
    R.camOverride = { x: hx, y: hy, z: 5.5, speed: 1 };
    R.camSnap = true;
    await wait(1.2);
    R.camOverride = { ...fitAll(), speed: 0.5 };
    await wait(2.2);
    A.sfx("horn");
    R.shake = 0.6;
    const [gx, gy] = R.gateXY;
    R.camOverride = { x: gx + 80, y: gy + 40, z: 3, speed: 1.6 };
    await epic("왕국 기사단, 진격", 1.6, true);
    for (const v of run.advs) if (v.npc) { v.wander = false; v.flee = true; }
    sendKnights(28);
    march = 1;
    await wait(3.2);
    R.camOverride = { ...fitAll(), speed: 1.2 };
    await wait(1.4);
    const cards = ["pro_judge", "pro_meteor", "pro_pillar"];
    for (let i = 0; i < 3; i++) {
      const id = await pickCard(cards.slice());
      cards.splice(cards.indexOf(id), 1);
      api.toast?.("기사단이 몰린 곳을 누르세요");
      const w = await tap();
      R.targets = null;
      await volley(id, w);
      if (i === 0) {
        await line("그날, 나는 처음으로 인간을 죽였다.", 3.2);
        sendKnights(24, 0.12);
      }
      if (i === 1) {
        // the crowd at the gate: the people it fed, shouting for its death
        for (let k = 0; k < 6; k++) {
          setTimeout(() => { const [x, y] = R.gateXY; R.onText(x - 30 + Math.random() * 60, y - 30 - Math.random() * 30, ["괴물이다!", "봉인하라!", "신을 참칭한 괴물!", "죽여라!"][k % 4], "fear"); A.sfx("babble", -250 + k * 40); }, k * 380);
        }
        await line("그들은 나를, 괴물이라 불렀다.", 3.2);
        A.sfx("horn");
        sendKnights(30, 0.1);
        await wait(2.4);
      }
    }
    // the seal: a line of mages on the surface, a circle of runes over the whole dungeon,
    // the cards dying in your hand, chains from the sky one by one, and a pillar of light
    march = 0;
    A.setMusic("prologue");
    A.sfx("chant");
    R.camOverride = { ...fitAll(), speed: 0.8 };
    const ent = S.ZONES.entrance.wps;
    for (const i of [1, 3, 5, 7, 9]) {
      const m = npc("sealmage", ent[Math.min(ent.length - 1, i)]);
      m.wander = false; m.lane = 0;
      run.advs.push(m);
    }
    await epic("왕국 봉인 마법사단", 1.8, true);
    sealing = true;
    R.sealCircle = { x: hx, y: hy, r: 300, age: 0 };
    A.sfx("seal");
    await wait(2.2);
    for (let n = 0; n < 2; n++) {
      say(n ? "아무리 강한 힘을 골라도, 더는 닿지 않는다." : "");
      await pickCard(["pro_judge", "pro_meteor", "pro_pillar"], true);
      const w = await tap();
      R.targets = null;
      const [x, y] = S.wpXY(w);
      R.onText(x, y - 40, "…발동하지 않는다", "fear");
      R.spawn("poof", x, y, { palette: ["#2a2a2a", "#4a4a4a", "#6a6a6a", "#8a8a8a", "#aaaaaa", "#cccccc"] }, "over");
      A.sfx("fizzle");
      await wait(1.5);
    }
    say("");
    // chains
    R.camOverride = { x: hx, y: hy - 30, z: fitAll().z * 1.5, speed: 0.7 };
    await epic("사슬이 내려온다", 1.3, true);
    const anchors = [0.04, 0.18, 0.36, 0.64, 0.82, 0.96];
    for (let i = 0; i < anchors.length; i++) {
      R.chains.push({ x0: R.W * anchors[i], y0: -10, x1: hx + (i - 2.5) * 8, y1: hy + 4, t: 0 });
      await wait(0.42);
      A.sfx("clank");
      R.shake = 0.5; R.stop(0.08); R.impact(hx, hy, 0.4); R.heartHurt = 0.5;
      R.light(hx, hy, 80, "220,200,150", 0.4);
      await wait(0.35);
    }
    grayTarget = 1;
    say("심장의 고동이, 하나씩 멎어 간다.");
    A.setMusic("heartbeat");
    await wait(2.6);
    say("");
    // the pillar of light
    R.camOverride = { x: hx, y: hy, z: fitAll().z * 1.9, speed: 1.2 };
    await wait(0.8);
    R.spawn("holyPillar", hx, fy, {}, "over", 2.6);
    A.sfx("boomBig"); A.sfx("thunder");
    R.flash = 0.9; R.flashColor = "255,240,210"; R.shake = 1; R.stop(0.25); R.impact(hx, hy, 1.2);
    R.heartDead = true;
    A.setMusic("none");
    await wait(2.6);
    sealing = false;
    curtain.classList.add("on");
    await wait(1.2);
    panel(pSeal, { px: true, ox: "50%", oy: "45%", zoom: 1.12, dur: 10 });
    await wait(1.2);
    await line("사슬이 심장을 묶었고, 돌이 살을 덮었다.", 3.6);
    panelsOff();
    await wait(1.8);

    // what it learned in the dark
    A.sfx("rumble");
    await epic("어둠 속에서 백 년.", 2.4);
    await epic("나는 단 하나를 배웠다.", 2.4);
    await epic("그들이 사랑한 것은 내가 아니었다.", 2.8);
    await epic("내가 주는 것이었다.", 2.8, true);
    A.setMusic("heartbeat");
    await epic("사랑은 아무것도 지켜 주지 않는다.", 3);
    await epic("두려움만이 지켜 준다.", 3.4, true);
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
    curtain.textContent = "";
    curtain.classList.add("on");
    A.setMusic("heartbeat");
    say("");
    setTimeout(() => {
      // a hundred years on: the ruined gate under a red moon, and something red in the crack
      panel(p100, { px: true, ox: "75%", oy: "60%", zoom: 1.3, dur: 8 });
      say("백 년 후.");
    }, 1300);
    setTimeout(() => { say(""); panelsOff(); $("abyss").classList.add("on"); }, 5600);
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
    }, 7400);
    setTimeout(() => {
      $("abyss").classList.remove("on");
      titleEl.classList.remove("on", "beat");
      story.classList.remove("on");
      imgs.forEach((i) => i.classList.remove("on", "go"));
      R.mode = "normal";
      R.targets = null; R.zoneTargets = [];
      R.roomsDirty = true;
      R.mons.clear();
      R.fx = [];
      R.corpses = [];
      R.chains = []; R.sealCircle = null; R.heartDead = false;
      R.camOverride = null;
      R.camSnap = true;
      api.done();
      curtain.classList.remove("on");
      setTimeout(() => (curtain.textContent = ""), 1300);
    }, 12000);
  }

  script();

  return {
    tick(dt) {
      const feel = R.timeScale(dt);
      const gdt = dt * feel;
      t += dt;
      for (const w of waits.filter((w) => t >= w.at)) w.res();
      waits = waits.filter((w) => t < w.at);
      // villagers wander, then run for the gate when the knights come
      for (const v of run.advs) {
        if (!v.npc || v.out || !(v.wander || v.flee)) continue;
        if (v.next == null) {
          if (v.flee && v.cell === S.ENT_WP) { v.out = true; continue; }
          let nxt;
          if (v.flee) { const f = S.field(run, S.ENT_WP, false); nxt = S.WP[v.cell].nb.reduce((b, n) => (f[n] < f[b ?? v.cell] ? n : b), null); }
          else { const nb = S.WP[v.cell].nb; nxt = nb[Math.floor(rnd() * nb.length)]; }
          if (nxt == null) continue;
          v.next = nxt;
          const dx = S.WP[nxt].x - S.WP[v.cell].x;
          if (Math.abs(dx) > 0.5) v.face = dx > 0 ? 1 : -1;
          v.len = Math.max(1, Math.hypot(dx, S.WP[nxt].y - S.WP[v.cell].y));
        }
        v.prog += (gdt * (v.flee ? 90 : 18)) / v.len;
        if (v.prog >= 1) { v.cell = v.next; v.next = null; v.prog = 0; }
      }
      const gap = run.prologueGap ?? 0.16;
      S.step(run, meta, gdt);
      if (run.spawnQ.length && run.spawnT > gap) run.spawnT = gap;
      run.phase = "wave";
      run.pick = null;
      for (const e of run.events) {
        R.onEvent(e, run);
        if (e.t === "spell") A.sfx(e.id === "pro_judge" ? "thunder" : e.id === "pro_meteor" ? "boom" : "fire");
        if (e.t === "death") { kills++; if (kills % 3 === 0) A.sfx("death"); }
      }
      run.events.length = 0;
      // marching feet shake the floor
      if (march && knights().length && Math.floor(t * 2.2) !== Math.floor((t - dt) * 2.2)) R.shake = Math.max(R.shake, 0.12);
      // the seal: beams from the mages into the heart, monsters fading one by one, rings of runes
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

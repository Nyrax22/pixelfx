// The prologue: a hundred years ago, at full strength, on the day the dungeon was sealed.
// It is staged like a film: a close-up of the golden heart pulling back to the whole living dungeon,
// a horn and an army pouring in, three cards that each wipe out half of it, the chancellor's lie,
// the seal turning everything to stone, a dive into the dark where something opens its eyes,
// and the title slammed down over a single heartbeat.

const TYPES = ["water", "treasure", "nest", "library", "altar", "hall", "mushroom", "icecave", "hall", "web"];

export function playPrologue(api) {
  const { R, S, A, subtitle, openModal, closeModal, h, cardEl, chibi, cloneCanvas } = api;
  const meta = S.newMeta();
  meta.runs = 1;
  const run = S.newRun(meta, 42);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // the golden age: every cell a room, monsters and villagers living side by side
  for (let r = 0; r < S.ROWS; r++)
    for (let c = 0; c < S.COLS; c++) {
      const k = S.key(c, r);
      if (!run.rooms[k]) run.rooms[k] = { type: TYPES[Math.floor(rnd() * TYPES.length)], card: null };
      else if (run.rooms[k].type === "hall") run.rooms[k].card = null;
    }
  run.monsters = [];
  for (const [sp, c, r] of [["slime", 1, 1], ["bat", 2, 3], ["wisp", 3, 1], ["slime", 4, 3], ["ghost", 5, 1], ["frog", 2, 2], ["wisp", 0, 3], ["eyeball", 5, 2], ["slime", 3, 2], ["bat", 4, 1], ["frog", 1, 3], ["wisp", 0, 2]]) {
    const card = Object.values(S.CARDS).find((cd) => cd.kind === "monster" && cd.species === sp);
    S.addMonster(run, { ...card, hp: card.hp * 3 }, c, r);
  }
  run.hand = [];
  run.heart = { hp: 999, max: 999 };
  run.mana = 99;
  run.phase = "wave";
  run.pick = null;
  run.waves = new Array(99).fill(["warrior"]);
  run.spawnQ = [];
  let uid = 5000;
  const npc = (skin, c, r) => ({
    id: uid++, cls: "warrior", skin, npc: true, cell: [c, r], next: null, prog: 0, lane: rnd() * 2 - 1, hp: 1, max: 1, courage: 1, courageMax: 1,
    gear: [], state: "walk", frozenT: 0, burnT: 0, poisonT: 0, slowT: 0, hitT: 0, spare: true, dead: false, out: false, wander: true,
  });
  for (let i = 0; i < 10; i++) run.advs.push(npc("villager", 1 + Math.floor(rnd() * 5), Math.floor(rnd() * 5)));
  const knight = () => ({
    id: uid++, cls: "warrior", skin: rnd() < 0.22 ? "bannerman" : "knight", name: "기사", town: "왕도", lvl: 1, hp: 60, max: 60, atk: 3, rate: 1, speed: 0.55 + rnd() * 0.2,
    courage: 1e9, courageMax: 1e9, gear: [], cell: [...S.ENT], next: null, prog: 0, state: "walk", cd: 0.5, healT: 1, disarmT: 0,
    lootT: 0, looted: true, slowT: 0, slowK: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, frozenT: 0, dmgBy: {}, srcBy: {},
    spare: null, mercyT: 0, lane: rnd() * 2 - 1, face: 1, hitT: 0, dead: false, out: false, diary: { lines: [] },
  });

  const [hx, hy] = R.gw(...S.HEART), [ex, ey] = R.gw(...S.ENT);
  R.mode = "golden";
  R.roomsDirty = true;
  R.mons.clear();
  R.night = 0;
  R.nightTarget = 0;
  R.gray = 0;
  R.camOverride = { x: hx, y: hy + 2, z: 7, speed: 1 };
  R.camSnap = true;

  const $ = (id) => document.getElementById(id);
  const curtain = $("curtain"), epicEl = $("epic"), titleEl = $("title");
  curtain.textContent = "";
  curtain.style.transition = "none";
  curtain.classList.add("on");
  void curtain.offsetWidth;
  curtain.style.transition = "";

  // a tiny script runner: wait() counts game time, tap() waits for the player
  let t = 0, waits = [], tapWait = null, grayTarget = 0, ended = false, kills = 0, march = 0;
  const wait = (s) => new Promise((res) => waits.push({ at: t + s, res }));
  const epic = async (text, hold, red = false) => {
    epicEl.textContent = text;
    epicEl.classList.toggle("red", red);
    epicEl.classList.add("on");
    await wait(hold);
    epicEl.classList.remove("on");
    await wait(0.9);
  };
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
        pn.appendChild(h("div", "sub", fizzle ? "카드를 골라 보세요" : "카드를 고르고, 기사단이 몰려 있는 방을 누르세요"));
        const ch = pn.appendChild(h("div", "choices"));
        ids.forEach((id) => {
          const e = cardEl({ id }, true);
          if (fizzle) e.style.filter = "grayscale(1) brightness(.75)";
          else e.style.boxShadow = "0 0 0 2px #ffd25a, 0 0 26px #ffb02a88";
          e.onclick = () => { m.style.background = ""; closeModal(); A.sfx("pick"); res(id); };
          ch.appendChild(e);
        });
      }, { force: true });
    });
  }
  const knightCells = () => {
    const n = new Map();
    for (const a of run.advs) if (!a.npc && !a.dead && !a.out) { const c = S.advCell(a), k = S.key(...c); n.set(k, (n.get(k) ?? 0) + 1); }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => [k % S.COLS, (k / S.COLS) | 0]);
  };
  const tap = (cells) => new Promise((res) => { R.highlights = cells; tapWait = { cells, res }; });
  const sendKnights = (n, gap = 0.16) => { for (let i = 0; i < n; i++) run.spawnQ.push(knight()); run.spawnT = 0.1; run.prologueGap = gap; };
  const blast = (id, c, r) => { run.hand = [{ id, uid: uid++ }]; S.playCard(run, meta, 0, c, r); };

  async function volley(id, cell) {
    const before = kills;
    let cells = [cell, ...knightCells().filter((k) => k[0] !== cell[0] || k[1] !== cell[1])];
    if (id === "pro_judge") {
      // the sky splits: strike after strike, arcs leaping between them
      cells = cells.slice(0, 6);
      while (cells.length < 6) cells.push([1 + Math.floor(rnd() * 5), Math.floor(rnd() * 5)]);
      for (let i = 0; i < cells.length; i++) {
        blast(id, ...cells[i]);
        if (i) R.bolt(...R.gw(...cells[i - 1]), ...R.gw(...cells[i]), "#ffffff", 0.4);
        await wait(0.17);
      }
    } else if (id === "pro_meteor") {
      // a shower of stars
      cells = cells.slice(0, 7);
      while (cells.length < 7) cells.push([1 + Math.floor(rnd() * 5), Math.floor(rnd() * 5)]);
      for (const c of cells) { blast(id, ...c); A.sfx("boomBig"); await wait(0.24); }
    } else {
      // a wall of fire marching from the heart to the gate
      const row = cell[1];
      for (let c = S.COLS - 2; c >= 0; c--) { blast(id, c, row); await wait(0.15); }
      for (const c of cells.slice(0, 3)) { blast(id, ...c); await wait(0.15); }
    }
    await wait(1.1);
    const n = kills - before;
    if (n > 0) api.banner(`기사 ${n}명 소멸`, "이것이 전성기의 심장");
  }

  async function traitor() {
    A.sfx("rumble");
    await new Promise((res) => {
      openModal((m) => {
        m.style.background = "radial-gradient(circle at 50% 40%, #3a0614ee, #000000f4)";
        const pn = m.appendChild(h("div", ""));
        pn.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;max-width:640px";
        const cv = cloneCanvas(chibi("traitor", 0, "walk"));
        cv.style.cssText = "width:160px;height:192px;image-rendering:pixelated;filter:drop-shadow(0 0 24px #ff2a4a)";
        pn.appendChild(cv);
        pn.appendChild(h("div", "", `<span style="color:#d8b040;letter-spacing:.3em">왕국 재상 오르벤</span>`));
        const line = pn.appendChild(h("div", ""));
        line.style.cssText = "font-size:clamp(20px,3.4vw,30px);min-height:2.6em;color:#fff;text-shadow:0 2px 0 #000";
        const lines = ["모든 기사에게 고한다.", "던전이 북쪽 마을을 습격했다. 주민 서른이 죽었다.", "망설이지 마라. 심장을… 봉인하라."];
        let i = 0, done = false;
        const typeLine = () => {
          if (done) return;
          if (i >= lines.length) { setTimeout(close, 900); return; }
          let j = 0;
          const id = setInterval(() => {
            j++;
            line.textContent = lines[i].slice(0, j);
            if (j % 2) A.sfx("babble", -150);
            if (j >= lines[i].length) { clearInterval(id); i++; setTimeout(typeLine, 1000); }
          }, 55);
        };
        typeLine();
        const close = () => { if (done) return; done = true; m.style.background = ""; closeModal(); res(); };
        m.onclick = () => { if (i >= lines.length - 1) close(); };
      }, { force: true });
    });
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
    await wait(1.2);
    await epic("아주 오래전,", 2.2);
    await epic("사람과 오래된 것들이 함께 하나의 심장을 빚었다.", 3.2);
    // the reveal: the heart in close-up, pulling back to the whole golden dungeon
    A.setMusic("prologue");
    A.sfx("chime");
    curtain.classList.remove("on");
    await wait(1.5);
    R.camOverride = null;
    R.camOverride = { ...fitAll(), speed: 0.42 };
    subtitle("심장은 마을에 마나를 나누고, 길 잃은 이를 지켰다.");
    await wait(5.5);
    subtitle("사람들은 그것을 '살아 있는 던전'이라 불렀다.");
    await wait(3.5);
    subtitle("");
    // the horn
    A.sfx("horn");
    A.setMusic("war");
    R.shake = 0.6;
    R.camOverride = { x: ex + 70, y: ey, z: 3.2, speed: 1.6 };
    await epic("왕국 기사단, 진격", 1.6, true);
    for (const v of run.advs) if (v.npc) { v.wander = false; v.flee = true; }
    sendKnights(26);
    march = 1;
    await wait(3.4);
    R.camOverride = { ...fitAll(), speed: 1.2 };
    await wait(1.4);
    const cards = ["pro_judge", "pro_meteor", "pro_pillar"];
    for (let i = 0; i < 3; i++) {
      const id = await pickCard(cards.slice());
      cards.splice(cards.indexOf(id), 1);
      let cells = knightCells();
      if (!cells.length) cells = [[2, 2], [3, 2], [4, 2]];
      const cell = await tap(cells);
      R.highlights = [];
      await volley(id, cell);
      if (i === 0) {
        subtitle("심장은 먼저 사람을 해친 적이 없었다. 그저 지키고 있었을 뿐.");
        sendKnights(22, 0.12);
        await wait(3.2);
        subtitle("");
      }
      if (i === 1) {
        await traitor();
        A.sfx("horn");
        sendKnights(30, 0.1);
        await wait(2.6);
      }
    }
    // the seal: a circle of mages on the surface, a circle of runes over the whole dungeon,
    // chains from the sky one by one into the heart, the cards dying in your hand, and a pillar of light
    march = 0;
    A.setMusic("prologue");
    A.sfx("chant");
    R.camOverride = { ...fitAll(), speed: 0.8 };
    const mages = [];
    for (const [c, r] of [[S.ENT[0], S.ENT[1]], [1, 0], [2, 0], [3, 0], [4, 0]]) {
      const m = npc("sealmage", c, r);
      m.wander = false;
      m.lane = 0;
      run.advs.push(m);
      mages.push(m);
    }
    await epic("왕국 봉인 마법사단", 1.8, true);
    sealing = true;
    R.sealCircle = { x: hx, y: hy + 4, r: Math.max(R.W, R.H) * 0.62, age: 0 };
    A.sfx("seal");
    await wait(2.2);
    for (let n = 0; n < 2; n++) {
      subtitle(n ? "아무리 강한 힘을 골라도, 더는 닿지 않는다." : "");
      await pickCard(["pro_judge", "pro_meteor", "pro_pillar"], true);
      const cell = await tap(knightCells().length ? knightCells() : [[2, 1]]);
      R.highlights = [];
      const [x, y] = R.gw(cell[0], cell[1]);
      R.onText(x, y - 20, "…발동하지 않는다", "fear");
      R.spawn("poof", x, y + 16, { palette: ["#2a2a2a", "#4a4a4a", "#6a6a6a", "#8a8a8a", "#aaaaaa", "#cccccc"] }, "over");
      A.sfx("fizzle");
      await wait(1.5);
    }
    subtitle("");
    // chains
    R.camOverride = { x: hx - 40, y: hy - 70, z: fitAll().z * 1.35, speed: 0.7 };
    await epic("사슬이 내려온다", 1.3, true);
    const anchors = [0.05, 0.2, 0.38, 0.6, 0.8, 0.96];
    for (let i = 0; i < anchors.length; i++) {
      R.chains.push({ x0: R.W * anchors[i], y0: -10, x1: hx + (i - 2.5) * 3, y1: hy - 4, t: 0 });
      await wait(0.42);
      A.sfx("clank");
      R.shake = 0.5; R.stop(0.08); R.impact(hx, hy, 0.4); R.heartHurt = 0.5;
      R.light(hx, hy, 70, "180,220,255", 0.4);
      await wait(0.35);
    }
    grayTarget = 1;
    subtitle("심장의 고동이, 하나씩 멎어 간다.");
    A.setMusic("heartbeat");
    await wait(2.6);
    subtitle("");
    // the pillar of light
    R.camOverride = { x: hx, y: hy - 30, z: fitAll().z * 1.6, speed: 1.2 };
    await wait(0.8);
    R.spawn("holyPillar", hx, hy + 22, {}, "over", 2.6);
    A.sfx("boomBig"); A.sfx("thunder");
    R.flash = 0.9; R.flashColor = "220,240,255"; R.shake = 1; R.stop(0.25); R.impact(hx, hy, 1.2);
    R.heartDead = true;
    A.setMusic("none");
    await wait(2.6);
    sealing = false;
    subtitle("");
    await epic("자신을 믿었던 사람들이, 자신을 버렸다.", 3);
    // the dive: down through the floor into the dark, where something wakes
    R.camOverride = { x: hx - 120, y: R.H + 260, z: 2, speed: 0.7, free: true };
    A.setMusic("none");
    A.sfx("rumble");
    await wait(1.6);
    $("abyss").classList.add("on");
    await wait(1.2);
    await epic("그리고 봉인 아래에서, 무언가가 눈을 떴다.", 3, true);
    finish();
  }
  let sealing = false, sealT = 0;
  function fitAll() {
    const b = R.bounds(run);
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: Math.max(1, Math.min(3.6, R.vw / (b.x1 - b.x0), R.vh / (b.y1 - b.y0))) };
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
    subtitle("");
    setTimeout(() => { curtain.textContent = "백 년 후"; }, 1300);
    setTimeout(() => {
      // the title, one syllable at a time, each one a heartbeat
      curtain.textContent = "";
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
    }, 3800);
    setTimeout(() => {
      $("abyss").classList.remove("on");
      titleEl.classList.remove("on", "beat");
      R.mode = "normal";
      R.highlights = [];
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
    }, 8600);
  }

  script();

  return {
    tick(dt) {
      const feel = R.timeScale(dt);
      const gdt = dt * feel;
      t += dt;
      for (const w of waits.filter((w) => t >= w.at)) w.res();
      waits = waits.filter((w) => t < w.at);
      // villagers wander, then run for the exit when the knights come
      for (const v of run.advs) {
        if (!v.npc || v.out || !(v.wander || v.flee)) continue;
        if (!v.next) {
          if (v.flee && v.cell[0] === S.ENT[0] && v.cell[1] === S.ENT[1]) { v.out = true; continue; }
          const opts = v.flee ? S.findPath(run, v.cell, S.ENT, false) : S.neighbors(run, ...v.cell);
          if (!opts?.length) continue;
          v.next = v.flee ? opts[0] : opts[Math.floor(rnd() * opts.length)];
        }
        v.prog += gdt * (v.flee ? 0.9 : 0.3);
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
      if (march && run.advs.some((a) => !a.npc && !a.dead && !a.out) && Math.floor(t * 2.2) !== Math.floor((t - dt) * 2.2)) R.shake = Math.max(R.shake, 0.12);
      // the seal: monsters turn to stone one by one, blue circles bloom over the rooms
      if (sealing && Math.random() < dt * 9) {
        const m = run.advs.filter((a) => a.skin === "sealmage")[Math.floor(Math.random() * 5)];
        if (m) { const [mx, my] = R.advXY(m); R.bolt(mx + 6, my - 40, hx, hy - 6, "#bff4ff", 0.12); }
      }
      if (sealing) {
        sealT += dt;
        if (sealT > 0.7) {
          sealT = 0;
          const m = run.monsters.find((q) => q.hp > 0);
          if (m) { m.hp = 0; m.deadT = 0.01; run.events.push({ t: "monDeath", mid: m.id, c: m.c, r: m.r }); }
          const c = Math.floor(rnd() * S.COLS), r = Math.floor(rnd() * S.ROWS), [x, y] = R.gw(c, r);
          R.spawn("runeCircle", x, y + 16, { palette: ["#06142a", "#0c2a52", "#1a4a8a", "#2a7ac8", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"] }, "over", 1.6);
          R.rings.push({ x: hx, y: hy - 4, age: 0, dur: 1.6, r: 260, color: "150,210,255" });
        }
        run.monsters = run.monsters.filter((m) => m.hp > 0);
      }
      R.gray += (grayTarget - R.gray) * Math.min(1, dt * 0.55);
      R.update(gdt);
      R.draw(run);
      R.present(run, dt);
    },
    tap(cell) {
      if (!tapWait || !cell) return;
      if (!S.room(run, ...cell)) return;
      const w = tapWait;
      tapWait = null;
      w.res(cell);
    },
  };
}

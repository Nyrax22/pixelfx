// The prologue: a hundred years ago, at full strength, on the day the dungeon was sealed.
// No title screen. The player throws three overwhelming cards at the knights, sees a flash of the
// chancellor's lie, then the seal: cards that no longer answer, a shadow far below, and black.

const TYPES = ["water", "treasure", "nest", "library", "altar", "hall", "mushroom", "icecave", "hall", "web"];

export function playPrologue(api) {
  const { R, S, A, subtitle, openModal, closeModal, h, esc, cardEl, chibi, cloneCanvas } = api;
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
  for (const [sp, c, r] of [["slime", 1, 1], ["bat", 2, 3], ["wisp", 3, 1], ["slime", 4, 3], ["ghost", 5, 1], ["frog", 2, 0], ["wisp", 4, 4], ["eyeball", 5, 3], ["slime", 3, 2]]) {
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
  for (let i = 0; i < 6; i++) run.advs.push(npc("villager", 1 + Math.floor(rnd() * 5), Math.floor(rnd() * 5)));
  const knight = () => ({
    id: uid++, cls: "warrior", skin: "knight", name: "기사", town: "왕도", lvl: 1, hp: 60, max: 60, atk: 3, rate: 1, speed: 0.45,
    courage: 1e9, courageMax: 1e9, gear: [], cell: [...S.ENT], next: null, prog: 0, state: "walk", cd: 0.5, healT: 1, disarmT: 0,
    lootT: 0, looted: true, slowT: 0, slowK: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, frozenT: 0, dmgBy: {}, srcBy: {},
    spare: null, mercyT: 0, lane: rnd() * 2 - 1, face: 1, hitT: 0, dead: false, out: false, diary: { lines: [] },
  });

  R.mode = "golden";
  R.roomsDirty = true;
  R.mons.clear();
  R.night = 0;
  R.nightTarget = 0;
  R.gray = 0;
  A.setMusic("prologue");

  // a tiny script runner: wait() counts game time, tap() waits for the player
  let t = 0, waits = [], tapWait = null, grayTarget = 0, ended = false;
  const wait = (s) => new Promise((res) => waits.push({ at: t + s, res }));
  const skip = h("button", "btn ghost", "건너뛰기 ▸▸");
  skip.id = "skip";
  if (api.meta.seenPrologue) document.body.appendChild(skip);
  skip.onclick = () => finish();

  function pickCard(ids, fizzle) {
    return new Promise((res) => {
      openModal((m) => {
        const pn = m.appendChild(h("div", "panel"));
        pn.appendChild(h("h2", "", fizzle ? "힘이…" : "전성기의 힘"));
        pn.appendChild(h("div", "sub", fizzle ? "카드를 골라 보세요" : "카드를 고른 뒤, 기사단이 있는 방을 누르세요"));
        const ch = pn.appendChild(h("div", "choices"));
        ids.forEach((id) => {
          const e = cardEl({ id }, true);
          if (fizzle) e.style.filter = "grayscale(.8)";
          e.onclick = () => { closeModal(); A.sfx("pick"); res(id); };
          ch.appendChild(e);
        });
      }, { force: true });
    });
  }
  const knightCells = () => {
    const out = [];
    for (const a of run.advs) if (!a.npc && !a.dead && !a.out) { const c = S.advCell(a); if (!out.some((o) => o[0] === c[0] && o[1] === c[1])) out.push(c); }
    return out;
  };
  const tap = (cells) => new Promise((res) => { R.highlights = cells; tapWait = { cells, res }; });
  const sendKnights = (n) => { for (let i = 0; i < n; i++) run.spawnQ.push(knight()); run.spawnT = 0.2; };

  async function script() {
    subtitle("백 년 전.");
    await wait(3);
    subtitle("던전은 마을에 마나와 광물을 나눠 주고, 길 잃은 사람을 지켜 주었다.");
    await wait(4.5);
    subtitle("어느 날, 기사단이 왔다.");
    for (const v of run.advs) if (v.npc) { v.wander = false; v.flee = true; }
    sendKnights(5);
    await wait(4);
    const cards = ["pro_judge", "pro_meteor", "pro_pillar"];
    for (let i = 0; i < 3; i++) {
      subtitle("");
      const id = await pickCard(cards.slice());
      cards.splice(cards.indexOf(id), 1);
      run.hand = [{ id, uid: uid++ }];
      let cells = knightCells();
      if (!cells.length) cells = [[2, 2], [3, 2], [4, 2]];
      const cell = await tap(cells);
      R.highlights = [];
      S.playCard(run, meta, 0, cell[0], cell[1]);
      await wait(1.8);
      if (i === 0) {
        subtitle("던전은 먼저 인간을 해친 적이 없었다. 그저 지키고 있었을 뿐.");
        sendKnights(6);
        await wait(3.5);
      }
      if (i === 1) {
        await traitor();
        sendKnights(7);
        await wait(3);
      }
    }
    // the seal
    subtitle("봉인 마법사가 나타났다.");
    const mage = npc("sealmage", S.ENT[0], S.ENT[1]);
    mage.wander = false;
    run.advs.push(mage);
    A.sfx("seal");
    grayTarget = 1;
    await wait(2.5);
    for (let n = 0; n < 2; n++) {
      subtitle(n ? "아무리 강한 힘을 골라도, 더는 닿지 않는다." : "");
      await pickCard(["pro_judge", "pro_meteor", "pro_pillar"], true);
      const cell = await tap(knightCells().length ? knightCells() : [[3, 2]]);
      R.highlights = [];
      const [x, y] = R.gw(cell[0], cell[1]);
      R.onText(x, y - 20, "…발동하지 않는다", "fear");
      R.spawn("poof", x, y + 16, { palette: ["#2a2a2a", "#4a4a4a", "#6a6a6a", "#8a8a8a", "#aaaaaa", "#cccccc"] }, "over");
      A.sfx("fizzle");
      // the monsters fade one by one as the power drains away
      for (const m of run.monsters.slice(0, 4)) { m.hp = 0; m.deadT = 0.01; run.events.push({ t: "monDeath", mid: m.id, c: m.c, r: m.r }); }
      run.monsters = run.monsters.filter((m) => m.hp > 0);
      await wait(1.6);
    }
    subtitle("자신을 믿었던 인간들이, 자신을 버렸다.");
    await wait(3.4);
    subtitle("");
    document.getElementById("abyss").classList.add("on");
    A.sfx("thunder");
    await wait(3);
    finish();
  }
  async function traitor() {
    await new Promise((res) => {
      openModal((m) => {
        const pn = m.appendChild(h("div", "panel"));
        const row = pn.appendChild(h("div", "traitor"));
        const cv = cloneCanvas(chibi("traitor", 0, "walk"));
        row.appendChild(cv);
        row.appendChild(h("div", "", `<div style="color:var(--dim);font-size:15px">왕국 재상 오르벤</div>「던전이 북쪽 마을을 습격했다!<br>망설이지 말고 심장을 봉인하라!」`));
        const b = pn.appendChild(h("div", "row")).appendChild(h("button", "btn ghost", "……"));
        let done = false;
        const close = () => { if (done) return; done = true; closeModal(); res(); };
        b.onclick = close;
        setTimeout(close, 4200);
      }, { force: true });
    });
  }
  function finish() {
    if (ended) return;
    ended = true;
    skip.remove();
    closeModal();
    const cur = document.getElementById("curtain");
    cur.textContent = "";
    cur.classList.add("on");
    A.setMusic("heartbeat");
    subtitle("");
    setTimeout(() => { cur.textContent = "백 년 후"; }, 1300);
    setTimeout(() => {
      document.getElementById("abyss").classList.remove("on");
      R.mode = "normal";
      R.highlights = [];
      R.roomsDirty = true;
      R.mons.clear();
      R.fx = [];
      api.done();
      cur.classList.remove("on");
      setTimeout(() => (cur.textContent = ""), 1300);
    }, 4200);
  }

  script();

  return {
    tick(dt) {
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
        v.prog += dt * (v.flee ? 0.9 : 0.3);
        if (v.prog >= 1) { v.cell = v.next; v.next = null; v.prog = 0; }
      }
      S.step(run, meta, dt);
      run.phase = "wave";
      run.pick = null;
      for (const e of run.events) {
        R.onEvent(e, run);
        if (e.t === "spell") A.sfx(e.id === "pro_judge" ? "thunder" : e.id === "pro_meteor" ? "boom" : "fire");
        if (e.t === "death") A.sfx("death");
      }
      run.events.length = 0;
      R.gray += (grayTarget - R.gray) * Math.min(1, dt * 0.35);
      R.update(dt);
      R.draw(run);
    },
    tap(cell) {
      if (!tapWait || !cell) return;
      if (!tapWait.cells.some((c) => c[0] === cell[0] && c[1] === cell[1])) {
        // anywhere a knight could be is fine: be generous
        if (!S.room(run, ...cell)) return;
      }
      const w = tapWait;
      tapWait = null;
      w.res(cell);
    },
  };
}

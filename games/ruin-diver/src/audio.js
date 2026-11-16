// Little synthesized sounds, so the game ships with no audio files.

let ctx = null, master = null, muted = false, adMuted = false;

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted || adMuted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}
const apply = () => master && (master.gain.value = muted || adMuted ? 0 : 0.5);

export const audio = {
  unlock() {
    ensure();
    if (ctx?.state === "suspended") ctx.resume();
  },
  setMuted(m) {
    muted = m;
    apply();
  },
  setAdMuted(m) {
    adMuted = m;
    apply();
  },
  get muted() {
    return muted;
  },
  play(name, arg = 0) {
    const c = ensure();
    if (!c || muted || adMuted) return;
    const t = c.currentTime;
    const S = SOUNDS[name];
    if (S) S(c, t, arg);
  },
};

function tone(c, t, { f = 440, f2 = f, dur = 0.12, type = "square", vol = 0.2, delay = 0 }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t + delay);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + delay + dur);
  g.gain.setValueAtTime(0.0001, t + delay);
  g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
  o.connect(g).connect(master);
  o.start(t + delay);
  o.stop(t + delay + dur + 0.02);
}
function noise(c, t, { dur = 0.2, vol = 0.3, f = 800, delay = 0 }) {
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf;
  flt.type = "lowpass";
  flt.frequency.value = f;
  g.gain.value = vol;
  s.connect(flt).connect(g).connect(master);
  s.start(t + delay);
}

const SOUNDS = {
  coin: (c, t) => {
    tone(c, t, { f: 1320, dur: 0.06, type: "square", vol: 0.08 });
    tone(c, t, { f: 1760, dur: 0.1, type: "square", vol: 0.08, delay: 0.05 });
  },
  pickup: (c, t, order) => {
    const base = [660, 740, 880, 990, 1180][order] ?? 660;
    tone(c, t, { f: base, dur: 0.08, type: "triangle", vol: 0.25 });
    tone(c, t, { f: base * 1.5, dur: 0.14, type: "triangle", vol: 0.22, delay: 0.07 });
    if (order >= 2) tone(c, t, { f: base * 2, dur: 0.22, type: "sine", vol: 0.2, delay: 0.15 });
  },
  hit: (c, t) => {
    noise(c, t, { dur: 0.18, vol: 0.4, f: 1200 });
    tone(c, t, { f: 220, f2: 80, dur: 0.18, type: "sawtooth", vol: 0.15 });
  },
  clang: (c, t) => {
    tone(c, t, { f: 1400, f2: 900, dur: 0.25, type: "square", vol: 0.12 });
    noise(c, t, { dur: 0.1, vol: 0.2, f: 3000 });
  },
  drop: (c, t) => tone(c, t, { f: 600, f2: 150, dur: 0.35, type: "triangle", vol: 0.25 }),
  ascend: (c, t) => tone(c, t, { f: 300, f2: 900, dur: 0.35, type: "triangle", vol: 0.2 }),
  rumble: (c, t) => noise(c, t, { dur: 0.8, vol: 0.35, f: 300 }),
  escape: (c, t) => [523, 659, 784, 1047].forEach((f, i) => tone(c, t, { f, dur: 0.16, type: "square", vol: 0.12, delay: i * 0.08 })),
  reveal: (c, t, order) => {
    const f = [520, 600, 700, 820, 980][order] ?? 520;
    tone(c, t, { f, dur: 0.1, type: "triangle", vol: 0.2 });
  },
  newItem: (c, t) => [784, 988, 1175, 1568].forEach((f, i) => tone(c, t, { f, dur: 0.14, type: "triangle", vol: 0.18, delay: i * 0.06 })),
  upgrade: (c, t) => [440, 554, 659, 880].forEach((f, i) => tone(c, t, { f, dur: 0.1, type: "square", vol: 0.1, delay: i * 0.05 })),
  set: (c, t) => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(c, t, { f, dur: 0.18, type: "triangle", vol: 0.18, delay: i * 0.09 })),
  jump: (c, t) => tone(c, t, { f: 320, f2: 640, dur: 0.12, type: "square", vol: 0.07 }),
  land: (c, t) => noise(c, t, { dur: 0.08, vol: 0.18, f: 500 }),
  dig: (c, t) => noise(c, t, { dur: 0.06, vol: 0.22, f: 900 + Math.random() * 600 }),
  break: (c, t) => { noise(c, t, { dur: 0.22, vol: 0.35, f: 700 }); tone(c, t, { f: 180, f2: 70, dur: 0.15, type: "triangle", vol: 0.15 }); },
  rope: (c, t) => { tone(c, t, { f: 500, f2: 200, dur: 0.25, type: "triangle", vol: 0.15 }); noise(c, t, { dur: 0.25, vol: 0.12, f: 2000 }); },
  stomp: (c, t) => { tone(c, t, { f: 300, f2: 900, dur: 0.12, type: "square", vol: 0.12 }); noise(c, t, { dur: 0.1, vol: 0.2, f: 1500 }); },
  squeak: (c, t) => tone(c, t, { f: 2200, f2: 1600, dur: 0.08, type: "square", vol: 0.05 }),
  die: (c, t) => [392, 330, 262, 196].forEach((f, i) => tone(c, t, { f, dur: 0.2, type: "triangle", vol: 0.18, delay: i * 0.14 })),
  crack: (c, t) => noise(c, t, { dur: 0.12, vol: 0.2, f: 2500 }),
  boss: (c, t) => [110, 104, 98, 82].forEach((f, i) => tone(c, t, { f, dur: 0.35, type: "sawtooth", vol: 0.14, delay: i * 0.22 })),
  slam: (c, t) => { noise(c, t, { dur: 0.6, vol: 0.5, f: 250 }); tone(c, t, { f: 90, f2: 40, dur: 0.4, type: "sawtooth", vol: 0.2 }); },
  throw: (c, t) => noise(c, t, { dur: 0.2, vol: 0.2, f: 1200 }),
  heal: (c, t) => [660, 880, 1100].forEach((f, i) => tone(c, t, { f, dur: 0.1, type: "triangle", vol: 0.16, delay: i * 0.06 })),
  click: (c, t) => tone(c, t, { f: 900, dur: 0.04, type: "square", vol: 0.06 }),
  deny: (c, t) => tone(c, t, { f: 200, f2: 150, dur: 0.15, type: "square", vol: 0.1 }),
};

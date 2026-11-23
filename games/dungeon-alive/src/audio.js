// Every sound is synthesized: no files to load. Music box by day, drums and a heartbeat by night.

let ctx = null, master, sfxBus, musBus, noiseBuf;
let musicMode = "none", musicTimer = 0, nextNote = 0, step = 0, muted = false, bpm = 70;
const SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor

export function initAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  musBus = ctx.createGain(); musBus.gain.value = 0.35; musBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  musicTimer = setInterval(schedule, 60);
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.6; }
export const isMuted = () => muted;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
function tone(freq, t, dur, { type = "square", vol = 0.2, bus = sfxBus, slide = 0, attack = 0.005 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, { vol = 0.2, freq = 1200, q = 1, type = "bandpass", bus = sfxBus, sweep = 0 } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const last = {};
export function sfx(name, arg = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  // the same sound at most every 40 ms, so a crowd of hits doesn't clip
  if (last[name] && t - last[name] < 0.04) return;
  last[name] = t;
  switch (name) {
    case "pick": tone(midi(76), t, 0.12, { type: "triangle", vol: 0.25 }); tone(midi(83), t + 0.07, 0.18, { type: "triangle", vol: 0.25 }); break;
    case "play": tone(midi(72), t, 0.08, { type: "square", vol: 0.12 }); tone(midi(79), t + 0.05, 0.14, { type: "square", vol: 0.12 }); break;
    case "hover": tone(midi(88), t, 0.04, { type: "sine", vol: 0.06 }); break;
    case "deny": tone(150, t, 0.15, { type: "square", vol: 0.12, slide: 0.7 }); break;
    case "hit": noise(t, 0.08, { vol: 0.18, freq: 1800, q: 0.8 }); tone(180, t, 0.06, { type: "square", vol: 0.08, slide: 0.5 }); break;
    case "zap": tone(1400, t, 0.12, { type: "sawtooth", vol: 0.08, slide: 0.3 }); noise(t, 0.12, { vol: 0.14, freq: 4000, q: 2 }); break;
    case "thunder": noise(t, 0.9, { vol: 0.45, freq: 400, type: "lowpass", sweep: 0.2 }); tone(70, t, 0.6, { type: "sine", vol: 0.4, slide: 0.5 }); break;
    case "fire": noise(t, 0.5, { vol: 0.2, freq: 700, q: 0.6, sweep: 2 }); break;
    case "ice": for (let i = 0; i < 4; i++) tone(midi(96 - i * 3), t + i * 0.03, 0.12, { type: "sine", vol: 0.08 }); break;
    case "boom": noise(t, 0.7, { vol: 0.5, freq: 300, type: "lowpass", sweep: 0.3 }); tone(60, t, 0.5, { type: "sine", vol: 0.5, slide: 0.4 }); break;
    case "spike": noise(t, 0.05, { vol: 0.25, freq: 3000, q: 3 }); tone(900, t, 0.05, { type: "square", vol: 0.06, slide: 0.6 }); break;
    case "arrow": noise(t, 0.08, { vol: 0.1, freq: 2500, q: 4, sweep: 0.5 }); break;
    case "orb": tone(midi(84), t, 0.15, { type: "sine", vol: 0.08, slide: 1.5 }); break;
    case "combo": tone(midi(72 + SCALE[arg % 7] + 12 * Math.floor(arg / 7)), t, 0.16, { type: "square", vol: 0.14 }); tone(midi(79 + SCALE[arg % 7]), t + 0.04, 0.14, { type: "triangle", vol: 0.1 }); break;
    case "death": tone(midi(67), t, 0.1, { type: "square", vol: 0.1, slide: 0.5 }); for (let i = 0; i < 3; i++) tone(midi(88 + i * 4), t + 0.08 + i * 0.05, 0.1, { type: "sine", vol: 0.1 }); break;
    case "coin": tone(midi(88), t, 0.08, { type: "square", vol: 0.08 }); tone(midi(95), t + 0.06, 0.16, { type: "square", vol: 0.08 }); break;
    case "heart": tone(55, t, 0.25, { type: "sine", vol: 0.55, slide: 0.6 }); noise(t, 0.12, { vol: 0.15, freq: 200, type: "lowpass" }); break;
    case "heartHit": tone(90, t, 0.35, { type: "sawtooth", vol: 0.25, slide: 0.3 }); noise(t, 0.2, { vol: 0.3, freq: 600 }); break;
    case "babble": {
      // adventurers talk in a cute nonsense language
      const base = 300 + Math.random() * 300 + (arg || 0);
      for (let i = 0; i < 3 + (Math.random() * 3 | 0); i++) tone(base * (0.8 + Math.random() * 0.5), t + i * 0.07, 0.06, { type: "square", vol: 0.05, slide: 1.2 });
      break;
    }
    case "scream": for (let i = 0; i < 4; i++) tone(900 - i * 60, t + i * 0.05, 0.08, { type: "square", vol: 0.06, slide: 1.4 }); break;
    case "shriek": tone(1200, t, 0.25, { type: "square", vol: 0.08, slide: 2 }); break;
    case "summon": tone(midi(60), t, 0.2, { type: "triangle", vol: 0.15, slide: 2 }); break;
    case "place": tone(midi(67), t, 0.06, { type: "square", vol: 0.1 }); noise(t, 0.05, { vol: 0.12, freq: 900 }); break;
    case "room": noise(t, 0.4, { vol: 0.3, freq: 250, type: "lowpass" }); tone(80, t, 0.3, { type: "sine", vol: 0.3, slide: 0.7 }); break;
    case "secret": for (let i = 0; i < 6; i++) tone(midi(72 + [0, 3, 7, 10, 12, 15][i]), t + i * 0.08, 0.5, { type: "sine", vol: 0.1 }); break;
    case "page": noise(t, 0.12, { vol: 0.12, freq: 3000, q: 0.5 }); break;
    case "stamp": noise(t, 0.3, { vol: 0.6, freq: 200, type: "lowpass" }); tone(50, t, 0.3, { type: "sine", vol: 0.6 }); break;
    case "fanfare": [0, 4, 7, 12, 7, 12].forEach((n, i) => tone(midi(72 + n), t + i * 0.11, 0.3, { type: "square", vol: 0.1 })); break;
    case "hatch": noise(t, 0.08, { vol: 0.2, freq: 2000 }); tone(midi(79), t + 0.1, 0.2, { type: "triangle", vol: 0.15 }); break;
    case "mutant": [0, 4, 7, 11, 14, 19].forEach((n, i) => tone(midi(76 + n), t + i * 0.06, 0.4, { type: "square", vol: 0.09 })); break;
    case "seal": tone(midi(48), t, 2.5, { type: "sawtooth", vol: 0.08, slide: 0.5, attack: 0.4 }); noise(t, 2.5, { vol: 0.15, freq: 300, type: "lowpass", sweep: 0.3 }); break;
    case "fizzle": tone(300, t, 0.3, { type: "square", vol: 0.08, slide: 0.3 }); noise(t, 0.2, { vol: 0.08, freq: 800 }); break;
    case "power": [0, 7, 12, 16, 19, 24].forEach((n, i) => tone(midi(60 + n), t + i * 0.09, 0.6, { type: "triangle", vol: 0.12 })); break;
    case "wave": horn(t, 0.9); noise(t, 0.4, { vol: 0.35, freq: 120, type: "lowpass" }); tone(55, t, 0.5, { type: "sine", vol: 0.5, slide: 0.5 }); break;
    case "horn": horn(t, 2.2); horn(t + 0.05, 2.2, 1.5); break;
    case "roar":
      tone(110, t, 1.2, { type: "sawtooth", vol: 0.3, slide: 0.35 }); tone(82, t, 1.4, { type: "square", vol: 0.15, slide: 0.4 });
      noise(t, 1.2, { vol: 0.6, freq: 500, type: "lowpass", sweep: 0.15 }); tone(45, t, 1, { type: "sine", vol: 0.8, slide: 0.5 });
      break;
    case "slam": tone(50, t, 0.5, { type: "sine", vol: 0.8, slide: 0.4 }); noise(t, 0.35, { vol: 0.5, freq: 260, type: "lowpass" }); tone(midi(arg || 48), t, 0.8, { type: "sawtooth", vol: 0.06 }); break;
    case "rumble": noise(t, 3.5, { vol: 0.5, freq: 90, type: "lowpass" }); tone(32, t, 3.5, { type: "sine", vol: 0.5, attack: 0.8 }); break;
    case "boomBig": noise(t, 1.4, { vol: 0.7, freq: 500, type: "lowpass", sweep: 0.12 }); tone(48, t, 1.2, { type: "sine", vol: 0.8, slide: 0.35 }); break;
    case "chime": [0, 7, 12, 19].forEach((n, i) => tone(midi(84 + n), t + i * 0.09, 1.2, { type: "sine", vol: 0.08 })); break;
  }
}

// a brass-like swell: detuned saws through a filter that opens and closes
function horn(t, dur, mul = 1) {
  if (!ctx) return;
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = "lowpass"; f.Q.value = 2;
  f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(1400, t + dur * 0.3); f.frequency.linearRampToValueAtTime(300, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.15); g.gain.setValueAtTime(0.22, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g); g.connect(sfxBus);
  for (const d of [-6, 0, 7]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth"; o.frequency.value = midi(45) * mul; o.detune.value = d;
    o.connect(f); o.start(t); o.stop(t + dur + 0.05);
  }
}

export function setMusic(mode, heartBpm = 70) {
  bpm = heartBpm;
  if (mode === musicMode) return;
  musicMode = mode;
  step = 0;
  if (ctx) nextNote = ctx.currentTime + 0.1;
}

// a tiny sequencer, scheduled a little ahead of time
const BOX = [72, 75, 79, 82, 80, 79, 75, 77, 72, 75, 79, 84, 82, 79, 77, 75];
const CHOIR = [[48, 55, 60, 63], [44, 51, 56, 60], [46, 53, 58, 62], [43, 50, 55, 59]];
function schedule() {
  if (!ctx || muted || musicMode === "none") return;
  while (nextNote < ctx.currentTime + 0.25) {
    const t = nextNote;
    if (musicMode === "day") {
      const n = BOX[step % BOX.length];
      tone(midi(n), t, 0.9, { type: "sine", vol: 0.12, bus: musBus });
      tone(midi(n + 12), t, 0.4, { type: "triangle", vol: 0.03, bus: musBus });
      if (step % 4 === 0) tone(midi(48 + [0, 3, 5, 7][(step / 4) % 4 | 0]), t, 1.6, { type: "triangle", vol: 0.07, bus: musBus });
      nextNote += 0.36;
    } else if (musicMode === "night") {
      const beatLen = 60 / Math.max(70, bpm);
      const s = step % 8;
      if (s === 0 || s === 3) { tone(55, t, 0.22, { type: "sine", vol: 0.5, bus: musBus, slide: 0.6 }); noise(t, 0.06, { vol: 0.12, freq: 150, type: "lowpass", bus: musBus }); }
      if (s === 1 || s === 4) tone(48, t, 0.18, { type: "sine", vol: 0.35, bus: musBus, slide: 0.6 });
      if (s === 6) { tone(110, t, 0.2, { type: "triangle", vol: 0.15, bus: musBus, slide: 0.7 }); noise(t, 0.08, { vol: 0.06, freq: 900, bus: musBus }); }
      if (step % 16 === 0) tone(midi(43), t, beatLen * 8, { type: "sawtooth", vol: 0.025, bus: musBus, attack: 0.5 });
      nextNote += beatLen / 2;
    } else if (musicMode === "prologue" || musicMode === "war") {
      // a big choir; in war, timpani and marching drums under it
      const ch = CHOIR[(step / 4 | 0) % CHOIR.length];
      if (step % 4 === 0) for (const n of ch) {
        tone(midi(n), t, 2.9, { type: "sawtooth", vol: 0.028, bus: musBus, attack: 0.5 });
        tone(midi(n + 12), t, 2.9, { type: "sine", vol: 0.05, bus: musBus, attack: 0.5 });
        tone(midi(n + 12) * 1.004, t, 2.9, { type: "triangle", vol: 0.03, bus: musBus, attack: 0.7 });
      }
      if (step % 4 === 0) tone(midi(ch[0] - 12), t, 2.9, { type: "sawtooth", vol: 0.05, bus: musBus, attack: 0.3 });
      if (musicMode === "war") {
        tone(65, t, 0.4, { type: "sine", vol: 0.7, bus: musBus, slide: 0.5 }); noise(t, 0.15, { vol: 0.25, freq: 180, type: "lowpass", bus: musBus });
        if (step % 2) { noise(t + 0.35, 0.08, { vol: 0.18, freq: 1800, bus: musBus }); noise(t + 0.525, 0.06, { vol: 0.12, freq: 1800, bus: musBus }); }
      } else if (step % 4 === 0) tone(55, t, 1.2, { type: "sine", vol: 0.45, bus: musBus, slide: 0.6 });
      nextNote += 0.7;
    } else if (musicMode === "heartbeat") {
      tone(55, t, 0.25, { type: "sine", vol: 0.5, bus: musBus, slide: 0.6 });
      tone(50, t + 0.22, 0.25, { type: "sine", vol: 0.35, bus: musBus, slide: 0.6 });
      nextNote += 1.1;
    } else if (musicMode === "meta") {
      const n = BOX[(step * 3) % BOX.length] - 12;
      tone(midi(n), t, 1.4, { type: "sine", vol: 0.09, bus: musBus });
      nextNote += 0.72;
    } else nextNote += 0.5;
    step++;
  }
}

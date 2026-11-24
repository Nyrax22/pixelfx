// Words that arrive like ink soaking into paper and leave like ash: each character blurs in,
// settles with a glow, and on the way out drifts up and burns away. Words wrapped in *stars*
// are the ones that matter: blood red, trembling, and they land with a thud.

let sound = null;
/** Give the text a voice: called with "ink" per character and "key" per marked word. */
export function setKineticSound(fn) { sound = fn; }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Write `text` into `el` with the arrival animation. Returns how long the arrival takes (ms).
 * Options: speed (ms per character), shake (callback when a key word lands).
 */
export function kinetic(el, text, { speed = 62, onKey = null, quiet = false } = {}) {
  clearTimeout(el._kt);
  (el._kts ?? []).forEach(clearTimeout);
  el._kts = [];
  el.classList.remove("kt-out");
  el.classList.add("kt");
  let i = 0, html = "";
  const keys = [];
  // split into words (kept whole on one line), marking *key* words
  for (const part of text.split(/(\*[^*]+\*)/)) {
    if (!part) continue;
    const key = part.startsWith("*") && part.endsWith("*");
    const body = key ? part.slice(1, -1) : part;
    for (const word of body.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) { html += word.includes("\n") ? "<br>" : " "; continue; }
      html += `<span class="w${key ? " key" : ""}">`;
      if (key) keys.push(i);
      for (const ch of word) { html += `<span class="c" style="--i:${i}">${esc(ch)}</span>`; i++; }
      html += "</span>";
    }
  }
  el.style.setProperty("--sp", speed + "ms");
  el.innerHTML = html;
  if (!quiet && sound) for (let k = 0; k < i; k += 2) el._kts.push(setTimeout(() => sound("ink"), k * speed));
  for (const k of keys) el._kts.push(setTimeout(() => { sound?.("key"); onKey?.(); }, k * speed + 260));
  return i * speed + 700;
}

/** Burn the current text away. Returns how long that takes (ms). */
export function unkinetic(el) {
  const n = el.querySelectorAll(".c").length;
  el.classList.add("kt-out");
  return Math.min(1400, n * 22 + 900);
}

export const KINETIC_CSS = `
.kt .w { display: inline-block; white-space: nowrap; }
.kt .c { display: inline-block; opacity: 0; filter: blur(7px); transform: translateY(.18em) scale(1.35); animation: ktIn .9s cubic-bezier(.2,.8,.25,1) forwards; animation-delay: calc(var(--i) * var(--sp, 62ms)); }
.kt .key .c { color: #ff3a4a; animation: ktKey 1s cubic-bezier(.2,1.4,.3,1) forwards, ktJit .11s steps(2) infinite; animation-delay: calc(var(--i) * var(--sp, 62ms)), calc(var(--i) * var(--sp, 62ms) + 1s); text-shadow: 0 0 14px #ff0022, 0 0 34px #a0001a, 0 3px 0 #000; }
.kt.kt-out .c { animation: ktOut 1s ease-in forwards; animation-delay: calc(var(--i) * 22ms); }
@keyframes ktIn { 0% { opacity: 0; filter: blur(7px); transform: translateY(.18em) scale(1.35); } 45% { opacity: 1; filter: blur(0); text-shadow: 0 0 22px #ffb08a, 0 0 4px #fff; } 100% { opacity: 1; filter: blur(0); transform: none; } }
@keyframes ktKey { 0% { opacity: 0; transform: scale(2.6); filter: blur(10px); } 55% { opacity: 1; transform: scale(.92); filter: blur(0); } 100% { opacity: 1; transform: none; filter: blur(0); } }
@keyframes ktJit { 0% { translate: 0 0; } 50% { translate: .6px -.6px; } 100% { translate: -.6px .4px; } }
@keyframes ktOut { 0% { opacity: 1; filter: blur(0); } 100% { opacity: 0; filter: blur(9px); transform: translateY(-.7em) scale(.92); color: #ff8a5a; text-shadow: 0 0 18px #ff4a1a; } }
`;

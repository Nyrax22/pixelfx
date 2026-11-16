// A thin wrapper over the Poki SDK. On Poki, the page loads the SDK and window.PokiSDK exists; anywhere
// else every call is a safe no-op, and rewarded breaks show a short placeholder so the flow can be tested.
// Guards keep Poki's rules: no duplicate gameplayStart/Stop, no events during ads, audio muted during ads.

const sdk = () => (typeof window !== "undefined" ? window.PokiSDK : undefined);
let playing = false, inAd = false;
let onMute = () => {};
let placeholder = null;

export const poki = {
  get inAd() {
    return inAd;
  },
  /** muteFn(true) when an ad starts, muteFn(false) when it ends. show(ms) runs the off-Poki stand-in. */
  async init(muteFn, showPlaceholder) {
    onMute = muteFn;
    placeholder = showPlaceholder;
    try {
      await sdk()?.init();
    } catch {}
  },
  loadingFinished() {
    try {
      sdk()?.gameLoadingFinished();
    } catch {}
  },
  gameplayStart() {
    if (playing || inAd) return;
    playing = true;
    try {
      sdk()?.gameplayStart();
    } catch {}
  },
  gameplayStop() {
    if (!playing || inAd) return;
    playing = false;
    try {
      sdk()?.gameplayStop();
    } catch {}
  },
  /** A midroll: only when going from a break back into gameplay. Poki decides whether one plays. */
  async commercialBreak() {
    this.gameplayStop();
    inAd = true;
    onMute(true);
    try {
      await sdk()?.commercialBreak();
    } catch {}
    onMute(false);
    inAd = false;
  },
  /** A rewarded video. Resolves true only when the reward should be given. */
  async rewardedBreak() {
    this.gameplayStop();
    inAd = true;
    onMute(true);
    let ok = false;
    try {
      if (sdk()) ok = !!(await sdk().rewardedBreak());
      else ok = await placeholder?.(1200);
    } catch {
      ok = false;
    }
    onMute(false);
    inAd = false;
    return ok;
  },
};

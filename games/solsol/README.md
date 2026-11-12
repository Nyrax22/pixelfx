# 솔솔섬 (Solsol Island)

A small, cozy 3D island where you catch bugs, fish, and gather shells and flowers to fill a 40-entry field guide.
One self-contained `index.html` (Three.js r128 from cdnjs). Open it with any static server:

```sh
npx serve games/solsol   # or: python3 -m http.server -d games/solsol
```

- **Move**: WASD / arrows (Shift to run) · touch: left-side joystick
- **Action**: Space · touch: yellow button — catch, fish, pick up, talk
- **Guide**: B · **Camera**: Q/E or drag · **Mute**: M

Day and night run on a 24-minute cycle (1 real second = 1 game minute). Some creatures only appear at night.
Running scares the shy ones. When fishing, wait through the small nibbles and press on the big dip.
Progress saves to `localStorage`.

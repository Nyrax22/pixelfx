# 한뼘 정원 (Hanbbyeom Garden)

You are shrunk to the size of a fingertip in a back garden. Flowers tower like trees, ants are as big as you,
and a sparrow lands like a mountain. Instead of catching anything, you sketch the garden's small neighbours
into a sketchbook: keep the right distance (too close and they get nervous and leave, too far and you can't
see), hold still, and the drawing fills in. Every creature also has a brief "special moment" (a ladybug opening
its wings, a frog puffing its throat) that earns a second page when you sketch it then.

24 creatures and 7 found objects, a 10-minute day from morning dew to firefly night, platforming up leaves,
mushrooms and an upturned flower pot, and gliding on a dandelion seed. One self-contained `index.html`
(Three.js r128 from cdnjs); the sketchbook drawings are rendered from the 3D models at runtime.

```sh
npx serve games/hanbbyeom   # or: python3 -m http.server -d games/hanbbyeom
```

- **Move**: WASD / arrows, Shift to run · touch: left-side joystick
- **Jump**: Space (hold in the air to glide) · **Sketch**: hold E
- **Sketchbook**: B · **Look around**: drag, Q · **Mute**: M

Progress saves to `localStorage`.

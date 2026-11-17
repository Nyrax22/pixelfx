# Painted sprites (PixelLab)

`atlas.png` packs every painted sprite; `atlas.json` maps a name to `[x, y, w, h]` in it. `src/pix.js` loads it at boot.
The game falls back to its code-drawn sprites for anything missing, so the atlas can grow a piece at a time.

Made with PixelLab (pixellab.ai) on the free trial, 36 generations in all:

| What | PixelLab tool | Size |
|---|---|---|
| Explorer: 4 views, walk 6f, idle 4f, jump 9f | `create_character` (standard, side) + `animate_character` (east only; west is mirrored) | 28×28 frames, feet at y=25 |
| Creatures and supplies (bat, slimes, skull, mushroom, oil, crate, chests, ores…) | `create_1_direction_object`, sidescroller | 24px sheet |
| 31 relics and 6 materials | `create_1_direction_object`, sidescroller | 16px sheet |
| Bosses, altar, merchant, spring, exit sign | `create_1_direction_object`, sidescroller | 48px sheet |
| Dirt and stone terrain | `create_sidescroller_tileset` (standard) | 16px Wang tiles, drawn on a half-tile offset grid |

Names: `p_*` explorer frames, `i_<item id>` relics, `m_<material>` materials, `t_dirt` / `t_stone` tilesets, the rest by what they are.

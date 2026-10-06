# `public/textures/jute/` — credits

All four are **generated images supplied by the repository owner**, not CC0
textures, and the licence is **not established**. See the section "Generated
images — provenance recorded, licence NOT established" in the repository root
`CREDITS.md`.

| Served | Source generation (in `Ai-Images/`) |
| --- | --- |
| `jute-0.jpg` | `Coarse_jute_hessian_sacking_texture_20261005201537.jpg` |
| `jute-1.jpg` | `Close-up_of_jute_hessian_sacking_20261005201527.jpg` |
| `jute-2.jpg` | `Coarse_jute_hessian_sacking_texture_20261005201541.jpg` |
| `jute-3.jpg` | `Jute_hessian_sacking_texture_20261005201531.jpg` |

- Processing: square centre crop, resized to 400 × 400, q74. The weave is
  high-frequency and eats bitrate, so these are deliberately small; they are
  seen from three metres across a counter.
- One per sack, because a stack of sacks is a stack of *different* sacks and
  the eye finds a repeated texture before it has worked out what it is looking
  at.
- Albedo only. The normal and roughness maps are **not** shipped — each is
  derived from its own file's luminance at runtime by `useSacking()` in
  `src/three/surfaces.ts`, the same Sobel path every other surface in that file
  uses.
- Applied as a single repeat, not a tile, so they do not need to be seamless
  and no attempt was made to make them so.

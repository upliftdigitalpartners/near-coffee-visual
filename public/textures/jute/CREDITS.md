# `public/textures/jute/` — credits

`jute.jpg` is a **generated image supplied by the repository owner**, not a
CC0 texture, and its licence is **not established**. See the section
"Generated images — provenance recorded, licence NOT established" in the
repository root `CREDITS.md`.

- Source generation: `Ai-Images/Coarse_jute_hessian_sacking_texture_20261005201537.jpg`
- Processing: square centre crop, resized to 640 × 640, q80.
- Used as the albedo for the sacks of green coffee behind the counter. The
  normal and roughness maps are **not** shipped — they are derived from this
  file's own luminance at runtime by `useSacking()` in `src/three/surfaces.ts`,
  the same Sobel path every other surface in that file uses.
- It is applied as a single repeat, not a tile, so it does not need to be
  seamless and no attempt was made to make it so.

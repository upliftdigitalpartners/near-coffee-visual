# `public/textures/sign/` — credits

All four are **generated images supplied by the repository owner**, not
public-domain photographs, and the licence is **not established**. See the
section "Generated images — provenance recorded, licence NOT established" in
the repository root `CREDITS.md`.

| Served | Source generation (in `Ai-Images/`) | Where it hangs |
| --- | --- | --- |
| `porch-front.jpg` | `Painted_wooden_coffee_sign_20261005201519.jpg` | Sheltered face of the porch board, `src/three/Porch.tsx` |
| `porch-back.jpg` | `Wooden_sign_reading_Near_Coffee_20261005201523.jpg` | Its weather face, same board |
| `counter.jpg` | `Wooden_sign_reading_near_coffee_20261005201513.jpg` | North wall above the counter, `src/three/Fixtures.tsx` |
| `spare.jpg` | `Hand-painted_wooden_coffee_sign_20261005201509.jpg` | The old board, leaning by the door, same file |

Each is cropped to the ratio of the plank it is mapped onto — 2.5:1 for the
two porch faces, 1.55:1 for the counter board, 1.9:1 for the spare — so no
lettering is stretched. Sizes and quality are set by how close a visitor gets:
1024 × 410 at q85 for the face you stand under, down to 560 × 295 at q80 for
the one on the floor nine metres away.

If the licence does not hold, the fallback is `signTexture()` in
`src/wall/sign.ts`, which draws a board on a canvas and is still in the tree.
It covers one sign; the other three would be deleted rather than replaced,
because four hand-painted boards reading the same two words only works when
they are visibly four different boards.

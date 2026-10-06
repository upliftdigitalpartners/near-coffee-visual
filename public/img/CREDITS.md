# `public/img/` — credits

Both files here are **generated images supplied by the repository owner**, not
public-domain photographs, and their licence is **not established**. See the
section "Generated images — provenance recorded, licence NOT established" in
the repository root `CREDITS.md` for what is open and what closing it requires.

| File | Source generation (in `Ai-Images/`) | Used by |
| --- | --- | --- |
| `barn.jpg`, `barn-sm.jpg` | `Timber_barn_standing_in_snow_20261005201449.jpg` | `src/ui/Arrival.tsx`, and `og:image` in `index.html` |
| `pastries.jpg` | `Bakery_goods_on_wooden_board_20261005201453.jpg` | the menu on the seated card, `src/App.tsx` |

Processing, from the 1376 × 768 originals: `barn.jpg` resized to 1920 × 1072 at
q72 and `barn-sm.jpg` to 960 × 536 at q68; `pastries.jpg` cropped to the middle
3.2:1 band, resized to 1100 × 344, saturation × 0.92 and brightness × 0.88, at
q74. The grade is baked in rather than applied as a CSS filter — see the note
in `src/styles.css`.

Do not confuse these with `public/textures/teton-range.jpg`, which **is** public
domain (National Park Service) and is credited separately.

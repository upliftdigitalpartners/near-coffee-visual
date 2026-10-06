# `public/img/` — credits

Every file here is a **generated image supplied by the repository owner**, not
a public-domain photograph, and the licence is **not established**. See the
section "Generated images — provenance recorded, licence NOT established" in
the repository root `CREDITS.md` for what is open and what closing it requires.

## The barn, four skies

Chosen on the visitor's local hour by `skyFor()` in `src/ui/still.ts`, with a
`-sm` variant of each for narrow screens. `barn-dusk.jpg` is also the
`og:image` in `index.html`.

| Served | Source generation (in `Ai-Images/`) |
| --- | --- |
| `barn-dawn` | `Weathered_timber_barn_in_snow_20261005201445.jpg` |
| `barn-day` | `Weathered_timber_barn_in_snow_20261005201440.jpg` |
| `barn-dusk` | `Timber_barn_standing_in_snow_20261005201449.jpg` |
| `barn-night` | `Timber_barn_in_snow_valley_20261005201404.jpg` |

Resized to 1920 × 1072 at q70, and 960 × 536 at q66. Each band carries its own
grade in `src/styles.css`; none of it is baked into these files.

## The bake, four boards

Picked on the local date by `plate` in `src/App.tsx`, so the case changes daily
and everyone sitting down on the same morning sees the same thing.

| Served | Source generation |
| --- | --- |
| `pastries-0.jpg` | `Bakery_goods_on_wooden_board_20261005201453.jpg` |
| `pastries-1.jpg` | `Bakery_goods_on_wooden_board_20261005201457.jpg` |
| `pastries-2.jpg` | `Bakery_goods_on_wooden_board_20261005201501.jpg` |
| `pastries-3.jpg` | `Bakery_goods_on_wooden_board_20261005201505.jpg` |

Cropped to the middle 3.2:1 band, resized to 1100 × 344, saturation × 0.92 and
brightness × 0.88, q72. The grade is baked in rather than applied as a CSS
filter — see the note in `src/styles.css`.

Do not confuse any of these with `public/textures/teton-range.jpg`, which **is**
public domain (National Park Service) and is credited separately.

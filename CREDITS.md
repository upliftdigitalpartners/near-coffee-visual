# Credits

Every third-party asset in this repository, what it is, and on what terms it
can be used. Nothing here requires attribution; it is recorded anyway, because
knowing exactly where an asset came from and under what licence is the
difference between being able to trade under this domain one day and hoping you
can.

Per-asset copies of the relevant entries also sit next to the files themselves,
in `public/textures/CREDITS.md` and `public/textures/planks/CREDITS.md`.

## Photographs

**`public/textures/teton-range.jpg`** — "Teton Range Panorama Spring",
National Park Service.

- Source: Wikimedia Commons, `File:Teton Range Panorama Spring (52111822752).jpg`
- Licence: **Public domain.** A work of the United States federal government,
  prepared by an officer or employee as part of their official duties, and so
  not subject to copyright in the US (17 U.S.C. § 105).
- Downloaded at 3840px wide from the original 16745 × 4637.

## Textures and environment maps

**`public/textures/planks/`** — `dark_wooden_planks`, diffuse / normal /
roughness / ambient occlusion, 1k JPG. **`public/hdri/bergen_1k.hdr`** — used
for image-based lighting only, never drawn as a background.

- Source: https://polyhaven.com
- Licence: **CC0.** Public domain dedication — no attribution required, no
  restriction on commercial use, no share-alike.

## Fonts

Loaded from Google Fonts. Both are under the SIL Open Font License 1.1, which
permits commercial use and embedding. They should be self-hosted before this
carries real traffic — not for licensing reasons but for privacy and for the
render-blocking round trip.

## Generated in code — no third party involved

These look like assets and are not. They are drawn to a canvas at runtime, so
there is no file to license and no provenance to check.

| What | Where |
| --- | --- |
| Soapstone counter, and the oven's firebrick | `src/three/surfaces.ts` |
| Cast iron, chrome and brass — roughness maps and normals derived from them | `src/three/surfaces.ts` |
| The lever espresso machine, modelled from lathed profiles | `src/three/EspressoMachine.tsx` |
| The cast-iron parlour stove | `src/three/Stove.tsx` |
| The cup, its swept handle and its saucer | `src/three/Crockery.tsx` |
| The turned three-legged stools | `src/three/Stool.tsx` |
| The tripod pedestal tables | `src/three/Table.tsx` |
| The doser coffee grinder | `src/three/Grinder.tsx` |
| Worn table tops — boards, polish and cup rings | `src/three/tabletop.ts` |
| Powder-coated enamel, chipped and dusted with grounds | `src/three/surfaces.ts` |
| Walked paths, threshold grit and the grime up the walls | `src/three/macro.ts` |
| Roof dust, eave bleaching and the stove's smoke stain | `src/three/macro.ts` |
| Firebrick in courses, sooted | `src/three/surfaces.ts` |
| Limewash for the bakery, silvering for the porch | `src/three/coats.ts` |
| The bed of coals behind the oven door | `src/three/Bakery.tsx` |
| The painted porch sign | `src/wall/sign.ts` |
| Glazed stoneware for the cups and crockery | `src/three/surfaces.ts` |
| Crusted snow, its drifts, wind ripple and bare patches | `src/three/Backdrop.tsx` |
| The conifers in the middle ground, and their needles | `src/three/Trees.tsx` |
| Where the snow is still deep, across the whole valley | `src/three/Backdrop.tsx` |
| The chalkboard, and the day's bake written on it | `src/wall/bake.ts` |
| Pinned napkins | `src/wall/napkins.ts` |
| All ambient sound and the radio's synthesised fallback | `src/audio/` |

## Generated images — provenance recorded, licence NOT established

**All sixteen** generations supplied by the repository owner and committed in
`0f935d8` ("added media") are now in use. The originals stay in `Ai-Images/` at
the repository root; that directory is not served and is not part of the build.
What is served is the twenty files cut from them:

**Four skies, one per quarter of the day** (`public/img/barn-*.jpg`, each with
a `-sm` variant). The arrival screen picks one on the visitor's local hour —
see `src/ui/still.ts`. `barn-dusk.jpg` is also the `og:image`.

| Served | Source generation |
| --- | --- |
| `barn-dawn` | `Weathered_timber_barn_in_snow_20261005201445.jpg` |
| `barn-day` | `Weathered_timber_barn_in_snow_20261005201440.jpg` |
| `barn-dusk` | `Timber_barn_standing_in_snow_20261005201449.jpg` |
| `barn-night` | `Timber_barn_in_snow_valley_20261005201404.jpg` |

**Four boards, one per place** (`public/textures/sign/`).

| Served | Source generation | Where |
| --- | --- | --- |
| `porch-front.jpg` | `Painted_wooden_coffee_sign_20261005201519.jpg` | The sheltered face of the hanging porch board |
| `porch-back.jpg` | `Wooden_sign_reading_Near_Coffee_20261005201523.jpg` | Its weather face |
| `counter.jpg` | `Wooden_sign_reading_near_coffee_20261005201513.jpg` | The north wall above the counter |
| `spare.jpg` | `Hand-painted_wooden_coffee_sign_20261005201509.jpg` | The old board, leaning by the door |

**Four weaves, one per sack** (`public/textures/jute/jute-0..3.jpg`), from
`Coarse_…201537`, `Close-up_…201527`, `Coarse_…201541` and `Jute_…201531` in
that order. Albedo only — the normal and roughness maps are derived from each
file's own luminance at runtime by `useSacking()` in `src/three/surfaces.ts`.

**Four bakes, one per day of a four-day cycle** (`public/img/pastries-0..3.jpg`),
from `Bakery_goods_on_wooden_board_…201453`, `…201457`, `…201501` and `…201505`.
The menu card picks one on the local date.

Processing, from the 1376 × 768 originals: barns resized to 1920 × 1072 (q70)
and 960 × 536 (q66); signs cropped to the ratio of the plank each is mapped
onto, so none is stretched; jute square-cropped to 400 × 400 (q74); pastries
cropped to the middle 3.2:1 band, 1100 × 344, saturation × 0.92 and brightness
× 0.88 baked in (q72). Nothing else was changed.

**These are not CC0 and this file does not claim they are.** Read the paragraph
under *Video* below: it was written before any generated asset existed here and
it applies to these in full. Specifically, still open:

- **Which tool produced them, under which account, on which tier.** The
  filenames and timestamps are all this repository records, and the terms that
  decide whether these can be used commercially are the terms of that account
  at the time of generation, not a property of the files.
- **Whether the output terms permit commercial use.** Several providers grant
  commercial rights on paid tiers only, and some assert no copyright in the
  output at all — which is not the same as granting you one.
- **Whether the files carry invisible provenance watermarking.** Several
  providers apply it by default. Re-encoding, as done here, does not reliably
  remove it and is not an attempt to.
- **Whether a generated image of a real, identifiable place** — these are
  recognisably the Moulton barns on Mormon Row — raises anything beyond
  copyright. The Teton photograph in the section above is public domain
  precisely because its provenance was checked; these have not been.

None of that was checkable from the environment this work was done in: the
egress policy blocks nearly every host, so no terms were read. The images are
in use because the owner supplied them for that purpose; the licence question
is recorded here, unresolved, and is the owner's to close before this trades.

If the answer turns out to be no, the swap is small and local, and it is worth
knowing the cost before it has to be paid:

- **Signs** fall back to `signTexture()` in `src/wall/sign.ts`, which still
  exists and still works. The two extra boards are deleted rather than
  replaced.
- **Sacks** fall back to a flat material. `useSacking()` keeps its shape; only
  the maps go.
- **The arrival screen** falls back to the warm-doorway gradient it had before,
  and `src/ui/still.ts` is deleted along with the inline preload script in
  `index.html`.
- **The pastry band** has no substitute and is simply dropped.

## Video, if any is ever added

`public/video/` is empty of clips and the site is built and tested that way.
Both slots — `fire.mp4` behind the stove and oven doors, and `arrival.mp4`
behind the loading wordmark — are optional, probed at runtime, and silently
skipped when absent. See `public/video/README.md` for what each one needs.

**Nothing here may be added without recording its provenance in this file
first.** Every asset in this project is public domain or CC0, which is what
makes trading under this domain possible, and generated video is neither. If
a clip is produced by an image or video model, the entry has to say which
tool, under which account tier, and on what output terms — and whether the
file carries invisible provenance watermarking, which several providers apply
by default. "Generated by X" is not the same claim as "CC0" and must not be
filed under the table above.

That was not checkable from the environment this was built in: the egress
policy blocks nearly every host, so no terms were read and none are asserted
here.

## Assets that were wanted and are not here

Every piece of furniture and equipment in the building is **modelled rather
than downloaded**. The intention was CC0 glTF for all of it; every source is
unreachable from the environment this work was carried out in, so it is built
in code from lathed and swept profiles instead — see `EspressoMachine.tsx`,
`Stove.tsx`, `Crockery.tsx`, `Stool.tsx`, `Table.tsx` and `Grinder.tsx`. That
is a real improvement on the boxes and cylinders they replaced, and it is not
the same thing as a scanned or sculpted asset.

`polyhaven.com`, `dl.polyhaven.org`, `cdn.polyhaven.com`,
`sketchfab.com` and `ambientcg.com` are all refused at the egress proxy with a
403 before the request leaves the network. That is an organisation network
policy, not a fixable bug, and routing around a policy denial is not something
to do quietly.

The same block is why there is one photographic PBR texture set here rather
than three. The counter was separated from the floor by generating a stone
material in code instead; the floor and the furniture are separated from the
siding by grain scale rather than by being different timber. See
`src/three/surfaces.ts` and `GRAIN` in `src/three/wood.ts`.

When those hosts are reachable, or when the files are dropped into `public/`
by hand, the work is: fetch better CC0 models than these — scanned or
sculpted, with the wear and asymmetry code does not give you; add a
`CREDITS.md` beside them recording asset name,
author, source URL and licence; and swap the primitives out. Poly Haven's
models are uniformly CC0. Sketchfab is **not** — its CC0 filter must be applied
per download and the licence checked per asset, because the default there is
CC-BY, which is not the same thing at all.

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
| Crusted snow for the valley floor | `src/three/Backdrop.tsx` |
| The chalkboard, and the day's bake written on it | `src/wall/bake.ts` |
| Pinned napkins | `src/wall/napkins.ts` |
| All ambient sound and the radio's synthesised fallback | `src/audio/` |

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

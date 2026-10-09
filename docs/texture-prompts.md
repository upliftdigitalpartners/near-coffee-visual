# Texture prompts

Four surfaces in this building are drawn on a canvas rather than photographed,
because `polyhaven.com`, `ambientcg.com` and `sketchfab.com` are all refused at
the egress proxy before the request leaves the network. See the last section of
`CREDITS.md`. Generated flats would close that gap, and these are the four
worth spending generations on, in order.

Read **The craft rules** first. They matter more than any of the prompts, and
rule 2 is the one that most often ruins a generated texture.

---

## The craft rules

**1. Flat to camera.** Orthographic, filling the frame corner to corner. No
perspective, no edge of the object, no background, no props, no composition.
This is a swatch, not a photograph of a thing.

**2. Evenly lit — no light in the picture at all.** No directional light, no
cast shadow, no specular highlight, no vignette, no falloff toward the corners.

This is the important one. The normal, roughness and AO maps are **derived from
the albedo's own luminance** by Sobel filter — see `heights()` and
`normalFrom()` in `src/three/surfaces.ts`. The renderer cannot tell the
difference between "this pixel is dark because the material is dark" and "this
pixel is dark because the photographer's light fell off there". Any shading
baked into the image becomes permanent fake geometry that stays lit from the
same direction however the sun moves through the barn. A flat, boring,
evenly-lit swatch makes a better material than a beautiful photograph.

**3. Photographic.** Not illustrated, not stylised, not a render, not PBR
"material ball" output. A scan of the real thing.

**4. Square is ideal; 16:9 is fine.** 1024 × 1024 or larger is the target —
the pipeline derives at 512 from a 1024 source. Your generator produced
1376 × 768 last time, which crops to square cleanly *provided nothing in the
middle reads as the subject.* Keep the material uniform across the frame.

**5. Don't try to make it seamless.** Generators are bad at it and the attempt
usually costs you the texture's character. Tiling is handled here with an
offset-and-heal pass.

**6. Deliver it a shade lighter and flatter than the target.** Every one of
these materials carries a `color` tint that **multiplies** the albedo, and
multiplication cannot lighten — the same thing that sank the porch's silvered
boards and the first pass of the coffee sacks. A source that is already as dark
as the finished surface has nowhere to go. Mid-tone, moderate contrast.

**Shared negative prompt**

```
dramatic lighting, directional light, cast shadow, specular highlight,
vignette, depth of field, bokeh, perspective, angled view, object edges,
background, props, styled composition, illustration, painting, 3d render,
cgi, material sphere, text, watermark, border, frame, oversaturated
```

Generate **three or four of each** — the variance between takes is the whole
reason this works, and the one that reads best as a material is rarely the one
that reads best as a picture.

---

## 1. Interior floorboards — the biggest win

**What it replaces.** Nothing, yet — and that is the problem. The floor is
currently the *same photograph as the walls*, `textures/planks/diff_1k.jpg`,
run at a different grain scale (`GRAIN.floor = 1.25`) and tinted `#8a6d4b`.
Grain scale separates them a little; they are still the same timber. In the
frame from your own table at midday the tabletop and the floorboards are hard
to tell apart, and that is the single largest remaining "this is CG" tell in
the room.

**Scale.** One tile covers **1.08 m** of floor. That means roughly **six boards
across the width of the image**, running top to bottom.

> A flat overhead scan of a hundred-year-old pine barn floor, six wide boards
> running vertically, each about 175mm across, with visible gaps and old square
> nail heads along the joints. Deep warm brown, worn smooth and faintly
> polished in the middle of each board where feet have crossed it for decades,
> drier and greyer toward the edges. Open grain, a few knots, scattered scuffs
> and shallow dents. Dry timber, not varnished, not lacquered, not new.
> Photographed flat on, evenly lit, filling the frame edge to edge.

Add to the negative prompt: `parquet, herringbone, laminate, varnish, gloss,
new wood, sanded, clean, rug, furniture, shoes, feet`.

---

## 2. Soapstone, for the counter

**What it replaces.** `soapstoneAlbedo()` in `src/three/surfaces.ts` — veins
drawn with 2D canvas calls, nine offset passes so they wrap. It is competent
and it reads as drawn, because real veining branches and terminates in ways a
loop does not.

**Scale.** One tile covers **1.1 m**. It is a slab, so there are no repeating
units — just that much stone. The counter is the one surface in the room that
is not timber and it is three metres from the seated camera.

**Tint applied in code:** `#b4bab6`, roughness 0.34–0.72 (oiled, takes a
sheen). Deliver lighter than the finished look.

> A flat scan of oiled soapstone slab, dark blue-grey to charcoal with a green
> cast, crossed by pale irregular calcite veins that branch and taper and run
> out rather than crossing the whole frame. Fine granular stone body with
> subtle mottling between the veins. Matte to low sheen. Photographed flat on,
> evenly lit, filling the frame edge to edge, no slab edges visible.

Add to the negative prompt: `marble, carrara, white marble, polished, mirror
finish, granite speckle, tile, grout, countertop scene, kitchen`.

---

## 3. Firebrick, for the oven and the stove

**What it replaces.** The drawn courses in `useFirebrick()`. It took three
passes to stop reading as glazed subway tile — narrower joints, a separate
height field so the normal comes off the joints rather than the colour, and
`normalScale` down to 0.3. It is acceptable now. A photograph would be better.

**Scale — match this exactly or the swap will not line up.** **Five bricks
across and fourteen courses**, laid in **half-bond** (every other row offset by
half a brick). Joints about **10mm on a 230mm brick**, which is much finer than
house brick and is precisely what the first pass got wrong.

**Colours in use now:** brick faces range `#847053` to `#ae9a75` — buff, tan,
sandy, *not* red. Mortar `#6f675b`, a grey-green lime.

> A flat scan of an old firebrick oven lining, five buff-coloured bricks across
> and fourteen courses high, laid in half bond with thin grey-green lime mortar
> joints about 10mm wide. Refractory brick in sandy tan and pale brown, each
> brick a slightly different shade, matte and chalky with no glaze whatsoever.
> Arrises slightly chipped and rounded with age, faces irregular, a dusting of
> soot darkening toward the top of the frame. Photographed flat on, evenly lit,
> filling the frame edge to edge.

Add to the negative prompt: `red brick, house brick, subway tile, glazed,
shiny, wide grout, clean, new, modern, white mortar, running bond`.

---

## 4. Cast iron, for the stove and the espresso machine

**What it replaces.** `metal()` with `useCastIron()`'s parameters — blotches
drawn on a canvas. The weakest of the four as a *problem*, because dark matte
metal is the easiest thing to fake, but it is used on three objects
(`Stove.tsx`, `Bakery.tsx`, `EspressoMachine.tsx`) so one good map goes a long
way.

**Scale.** Roughly **30 cm** of surface — close enough to see the casting
texture, far enough that it is not a macro shot of one pit.

**In use:** colour `#3a3634`, metalness 0.62, roughness 0.55–0.92.

> A flat scan of old sand-cast iron, the body of a wood stove a century in use.
> Near-black warm charcoal grey, finely pitted all over from the casting sand,
> with patches worn smoother and very slightly lighter where hands and cloths
> have passed. Matte, no shine, no plating. A faint warm cast in the darkest
> areas. Photographed flat on, evenly lit, filling the frame edge to edge.

Add to the negative prompt: `rust, orange rust, corrosion, patina, polished
metal, chrome, steel plate, brushed metal, rivets, machinery, engine`.

---

## When they arrive

Drop them anywhere and say so. Processing is a crop to square, a resize to
1024, an offset-and-heal pass for tiling, and a swap in the relevant `use*()`
hook — the normal, roughness and AO still derive from the albedo, so each one
is a single file, not a set of four.

**Provenance first, as always.** These are generated images and therefore not
CC0. Every one gets an entry in `CREDITS.md` under "Generated images —
provenance recorded, licence NOT established", with the source generation named
against the served file, before it is used. That section also records what each
set falls back to if the licence question closes the wrong way; for all four of
these the fallback is simply the procedural canvas that is there now, which
stays in the tree.

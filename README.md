# Near Coffee

A converted homestead barn below the Tetons, open in a browser tab.

Not a website *about* a coffee shop — a coffee shop that happens to be on the
internet. You are sitting at a table near the back. The sliding door is open on
the Teton range, the sun is going down behind it, and the light in the café
matches the clock on your own wall.

```bash
npm install && npm run dev
```

## Caching

`vercel.json` sets the headers GitHub Pages will not let you set, which is the
main reason to be on Vercel at all. Pages caps *everything* at `max-age=600`,
including files with a content hash in the name — so a returning visitor
re-downloads the whole bundle every ten minutes.

- `/assets/*` is `immutable, max-age=31536000`. Safe because Vite puts a
  content hash in those filenames: a changed file is a changed URL.
- `/textures/*` gets a week, deliberately **not** immutable. The Teton
  photograph is served from `public/` with a stable name, so if it is ever
  replaced an immutable cache would keep serving the old one to everybody who
  had already loaded it.

## Where it runs

Live at **https://room.nearcoffee.space**

Vercel, project `nearcoffee/near-coffee-room`. Redeploy with:

```bash
npm run deploy:vercel
```

Pass `--scope nearcoffee` if you ever run the CLI by hand — without it the
deploy silently re-resolves to a project named after the directory, creates a
second one, reports success, and changes nothing on the live site.

The marketing homepage stays on GitHub Pages in `fahimalamwork/near-coffee-space-site`
and links here. The old `/room/` path on that host is now a redirect, so
anything shared before the move still works.

Vite uses a relative `base` and the photograph is fetched through
`import.meta.env.BASE_URL`, left over from the subpath days — harmless, and it
keeps the build servable from anywhere.

## Where it is

The building is a **Mormon Row** barn — the homesteads at Antelope Flats inside
Grand Teton National Park, of which the Moulton barns are the best known. It is
a real place, and it is the reason the setting and the structure agree with each
other: weathered vertical board-and-batten siding, a timber frame, a gable roof,
and the entire range standing behind it with no foothills in the way.

## What it does today

**The window knows what time it is.** The light is driven by the visitor's own
local clock, through a full sunrise-to-night model. The clock at the bottom of
the screen opens a scrubber so you can walk the whole day without waiting.

**You can walk through it.** Scrolling walks a route of five stops — your
table, the counter, the napkin wall, the chalkboard, the doorway — easing
*within* each leg so the camera settles at every stop rather than gliding
through the middle ones. It is a camera move, not a page scroll; there is no
page.

**Things respond.** Pointing at the cup, the radio or the strung bulbs names
them; the bulbs can be switched on and off.

**The radio goes around the world.** It starts on a hand-picked house set, and
"elsewhere" moves to another country — Bangladesh, Japan, Senegal, Iceland —
playing whatever is actually on air there now. Stations come from Radio
Browser, filtered to HTTPS and to codecs a browser will decode; dead ones are
walked past automatically, which is most of the work, because community-listed
streams die constantly.

Not Radio Garden: their station API is undocumented, returns 403 to anything
that is not their own front end, and publishes no terms permitting use.

## How it is built

Three.js via React Three Fiber. Real geometry, real lights, real shadows.

| File | What it owns |
| --- | --- |
| `src/three/Barn.tsx` | The structure — siding, roof, floor, frame |
| `src/three/Backdrop.tsx` | The photographed range, and the ground under it |
| `src/three/Fixtures.tsx` | Counter, shelves, bulbs, and what is on them |
| `src/three/Bakery.tsx` | The room through the back wall, and its oven |
| `src/three/Porch.tsx` | Deck, posts, shed roof, bench and sign |
| `src/three/EspressoMachine.tsx` | The lever machine, turned on a lathe |
| `src/three/Stove.tsx` | The cast-iron parlour stove |
| `src/three/Crockery.tsx` | The cup, its handle and its saucer |
| `src/three/Stool.tsx` | The turned three-legged stool |
| `src/three/Table.tsx` | The tripod pedestal tables |
| `src/three/Grinder.tsx` | The doser grinder, and its shake |
| `src/scene/zones.ts` | Where you are allowed to stand |
| `src/scene/seats.ts` | The four seats, and what each one looks at |
| `src/order/order.ts` | The menu, and the timed ordering sequence |
| `src/audio/kitchen.ts` | Grinder, steam and chime, synthesised |
| `src/three/CameraRig.tsx` | Damped look, scroll dolly, breathing |
| `src/three/lighting.ts` | Daylight palette → a physical sun |
| `src/three/wood.ts` | The barn's timber, at three grain scales |
| `src/three/surfaces.ts` | Surfaces that are not timber — stone, glazed china |
| `src/three/Shafts.tsx` | Ray-marched sunlight through the gaps in the siding |
| `src/three/Grade.tsx` | The look applied after the tone mapper |
| `src/scene/daylight.ts` | The 24-hour light model |
| `src/scene/debug.ts` | Pinning the clock and the camera, for comparable frames |

### The siding is individual boards

This is the one decision the whole scene rests on. The walls are not a surface
with a wood texture; they are separate boards with real gaps between them. So
the sun genuinely gets through and lays stripes across the floor, and those
stripes swing round on their own as the day moves. Nothing about texturing a
flat wall reproduces that, and without it there would be little reason to be in
3D at all.

### The light gets to be an object

The gaps between the boards throw stripes on the floor. What was missing was
the part in between — the blades of lit air standing between the wall and the
floor, which at low sun in a dusty barn is most of what you actually see.

It ray-marches. Every pixel walks its view ray from the camera to whatever the
depth buffer recorded, asks at each step whether that point in mid-air can see
the sun, and integrates what scatters back. The design handoff is emphatic that
the cheap way does not work — a solid additive volume leaves a hard seam
wherever it crosses furniture — and marching sidesteps it entirely: the march
*ends* at the depth buffer, so a shaft crossing the counter is occluded by the
counter for free. There is no volume, so there is no seam.

It renders its own depth-from-sun rather than reading the shadow map, which was
not the plan. `src/three/Shafts.tsx` records why at length; the short version is
that under three r185 the packed-RGBA shadow target every tutorial reads is a
dummy that is never written, and the real one is a comparison-mode depth
texture that could not be made to sample correctly from inside a
post-processing effect on the driver available to check against.

### The photograph

"Teton Range Panorama Spring", **National Park Service — public domain**, via
Wikimedia Commons, in `public/textures/`. NPS photographs are works of the US
government and carry no copyright, which is why it is this image rather than a
better-composed one from a stock site: this one is unambiguously safe to put on
a domain you may one day trade under.

The left quarter of the frame has a ploughed road and a parked car. Rather than
re-cut the file, the UVs start past them — the download stays pristine and the
crop is one constant.

### Things that are solved, not guessed

Each of these was a visible defect first:

- **The photograph's horizon must land at eye level.** The valley floor is a
  flat plane, so its horizon is at eye height exactly; if the horizon inside the
  photograph is anywhere else, the ground cuts across the picture as a hard
  band. `CENTRE_Y` is derived from that, not dialled in.
- **The ground disc must be much larger than the backdrop cylinder.** The rim of
  a finite plane always sits *above* the true horizon, so a same-size disc shows
  its own edge as a grey line across the doorway.
- **The backdrop cylinder must be far taller than the photograph.** Sized to the
  photograph, its top edge is about 18° up — inside the field of view — and
  reads as the top of a stage flat. Instead it runs to 70m and the texture
  covers only the lower band; everything above samples past `v = 1` and
  clamp-to-edge smears the photograph's top row, which is open sky.
- **The door has to stay small.** At five metres wide it stopped being
  something you look *through*: stand near it and it exceeds the whole field of
  view, the barn vanishes, and you are looking at an unframed photograph.
- **Granite, then timber, must stay darker than the sky behind it.** Left
  bright, the range dissolves into it.
- **The valley floor cannot *meet* the photograph, only dissolve into it.** The
  ground plane's far rim is cut off where the backdrop cylinder occludes it,
  62m out, and at eye height that rim sits 1.4° below true horizon — while the
  photograph's horizon is at eye level by construction. A strip of photographed
  foreground is therefore always left standing above the modelled snow with a
  hard edge between them, and oversizing the disc does not help, because the
  disc is not what ends. It now fades out over its last thirty metres and lets
  the photograph's own foreground carry the distance.
- **There was no tone mapping at all.** The `Canvas` asks for ACES, and
  `@react-three/postprocessing` sets `gl.toneMapping = NoToneMapping` the
  moment a composer mounts — so with post enabled, which is always, nothing
  mapped anything and every value over 1.0 clipped flat to white. Sixteen per
  cent of the cup in the frame from your table was pure 255 with a bloom halo
  round it, which is why a mug read as a light source. Tone mapping is now an
  effect *in* the chain, AgX per the handoff, followed by a small contrast and
  saturation look — because AgX is deliberately flat and is only half a
  pipeline.
- **A tint does not separate two surfaces; grain scale does.** The siding, the
  floor and the furniture all came off one plank set at one scale, so identical
  knots at identical size turned up on the wall behind you and the table in
  front of you, and from a seated camera the tabletop and the floorboards
  stopped being separate objects.

#### Reproducing a frame

The scene is driven by your clock, live weather, a scroll position and a
pointer, which is right for a visitor and useless for checking a render — no
two frames are of the same thing, so nothing can be compared before and after a
change. Three query parameters pin it, and are inert unless present:

```
?hour=19.6     force the time of day
?stop=3        stand exactly at camera station 3, no easing, no sway
?napkins=11    fill the wall with stand-in notes
?sit=0         start seated, for checking the seat views and the panel
```

`?hour=19.6` is the one to use. Dusk is where every rendering bug in this scene
has shown up first, and several of them are invisible at midday.

## A note on verification

`HiddenDocumentDriver` in `Scene.tsx` is development-only. Headless preview
panes keep `document.visibilityState` at `'hidden'`, and browsers do not fire
`requestAnimationFrame` in a hidden document — so the scene builds correctly,
the GL context is healthy, and nothing ever draws. That failure looks exactly
like a broken renderer and is not one. It never runs in a production build.

## The napkin wall

One line each, pinned to the boards beside the door, gone after seven days.
Notes fade as they age, so the wall always carries a gradient of old and new.

**Live, and shared.** Backed by Supabase with row-level security: anyone may
read unexpired notes and pin one of up to 90 characters, and nobody may edit or
delete through the public key — verified by trying. Schema and policies are in
[docs/napkin-wall-backend.md](docs/napkin-wall-backend.md), along with the
moderation notes worth reading before this is linked anywhere busy.

## Presence

Anonymous silhouettes at the other tables — billboarded dark shapes that fade
in when someone arrives and are reclaimed when they go. You cannot talk to
them, name them, or learn anything about them. You just register that the far
table is taken.

**Live.** Heartbeats every 10s to Supabase; a visitor is gone after 32s of
silence. Nothing identifying is stored — the id is random, lives in
`sessionStorage` and dies with the tab. `BroadcastChannel` remains the
fallback when no endpoint is configured.

## Not built yet

- **Downloaded CC0 assets.** Every piece of furniture and equipment in the
  building is now modelled rather than primitive — but modelled *here*, in
  code, from lathed and swept profiles, not scanned or sculpted. Blocked on
  reach, not on effort: Poly Haven, its CDN, Sketchfab and ambientCG are all
  refused at this network's egress proxy. See CREDITS.md.
- **A second and third photographic PBR set**, for the same reason. The counter
  is separated from the floor by generating a stone material in code instead;
  the rest is separated by grain scale.

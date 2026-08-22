# Near Coffee

A converted homestead barn below the Tetons, open in a browser tab.

Not a website *about* a coffee shop — a coffee shop that happens to be on the
internet. You are sitting at a table near the back. The sliding door is open on
the Teton range, the sun is going down behind it, and the light in the room
matches the clock on your own wall.

```bash
npm install && npm run dev
```

## Where it runs

Live at **https://www.nearcoffee.space/room/**

The domain is a GitHub Pages site in a separate repo,
`fahimalamwork/near-coffee-space-site`, whose root is the existing Near Coffee
page — a single 3.36 MB `index.html`. This build is published into `room/`
there and touches nothing else, so the homepage is unaffected and the room can
be removed in one commit.

```bash
npm run deploy
```

That builds, clones the site repo, replaces `room/`, and pushes. It aborts if
anything outside `room/` has changed — the homepage is not ours to overwrite.

Because it has to sit under a subpath, Vite uses a relative `base` and the
photograph is fetched through `import.meta.env.BASE_URL`. An absolute
`/textures/...` works only at the domain root and 404s everywhere else.

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

**You can walk to the door.** Scrolling dollies the camera from the table up
toward the opening. It is a camera move, not a page scroll — there is no page.

**Things respond.** Pointing at the cup, the radio or the strung bulbs names
them; the bulbs can be switched on and off.

## How it is built

Three.js via React Three Fiber. Real geometry, real lights, real shadows.

| File | What it owns |
| --- | --- |
| `src/three/Barn.tsx` | The structure — siding, roof, floor, frame |
| `src/three/Backdrop.tsx` | The photographed range, and the ground under it |
| `src/three/Fixtures.tsx` | Counter, tables, bulbs, stove, your cup |
| `src/three/CameraRig.tsx` | Damped look, scroll dolly, breathing |
| `src/three/lighting.ts` | Daylight palette → a physical sun |
| `src/three/wood.ts` | Procedural weathered barn board |
| `src/scene/daylight.ts` | The 24-hour light model |

### The siding is individual boards

This is the one decision the whole scene rests on. The walls are not a surface
with a wood texture; they are separate boards with real gaps between them. So
the sun genuinely gets through and lays stripes across the floor, and those
stripes swing round on their own as the day moves. Nothing about texturing a
flat wall reproduces that, and without it there would be little reason to be in
3D at all.

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

### A note on verification

`HiddenDocumentDriver` in `Scene.tsx` is development-only. Headless preview
panes keep `document.visibilityState` at `'hidden'`, and browsers do not fire
`requestAnimationFrame` in a hidden document — so the scene builds correctly,
the GL context is healthy, and nothing ever draws. That failure looks exactly
like a broken renderer and is not one. It never runs in a production build.

## The napkin wall

One line each, pinned to the boards beside the door, gone after seven days.
Notes fade as they age, so the wall always carries a gradient of old and new.

It currently runs **local to each browser** — every behaviour is real except
the sharing, and the interface says "only you can see these" rather than
pretending otherwise. Turning it on is two environment variables and no code
changes: see [docs/napkin-wall-backend.md](docs/napkin-wall-backend.md), which
also covers the moderation you want in place first.

## Not built yet

- Anonymous silhouettes of whoever else is here right now
- Today's bake

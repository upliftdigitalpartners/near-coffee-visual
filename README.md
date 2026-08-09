# Near Coffee

A small stone coffee house on a moraine below the Tetons, open in a browser tab.

Not a website *about* a coffee shop — a coffee shop that happens to be on the
internet. The room is modelled on the [Tip Top House](https://en.wikipedia.org/wiki/Tip_Top_House)
on the summit of Mount Washington: rough-cut granite, mortar set deep, one and
a half storeys, plain rectangular openings cut through a very thick wall.

```bash
npm install && npm run dev
```

## What it does today

**The window knows what time it is.** The view outside is driven by the
visitor's own local clock. Open it at six in the morning and the peaks are
burning pink with the stars still out; open it at midnight and the oil lamp on
the counter is the only light in the world.

The clock at the bottom of the screen opens a scrubber, so you can walk the
whole day without waiting for it.

## How it is built

Layered 2.5D, not 3D. Each layer is an SVG drawn in a 1000×700 design space,
stacked at a declared depth and offset by pointer position or device tilt.

| Depth | Layer |
| --- | --- |
| 0.02 | `View` — sky, stars, the range, the flats |
| 0.30 | `Glass` |
| 0.42 | `RoomShell` — granite wall, window reveal, ceiling, floor |
| 0.50 | `LightShaft` |
| 0.56 | `DustMotes` |
| 0.60 | `RoomFurniture` — counter, shelf, oil lamp |
| 1.00 | `TableForeground` — your table, your cup |

Depth 0 is the Grand Teton at infinity; depth 1 is the edge of the table you
are sitting at. The pivot sits at 0.35 — roughly the plane of the glass — so
everything nearer than the window slides one way and the world beyond it
slides the other. That is what makes the stone reveal scrape across the peaks
when you shift in your seat, and it is the single effect the whole scene rests
on.

### Swapping in real artwork

Every layer is a self-contained component that takes `{ light, viewBox }` and
returns an SVG. Nothing else knows or cares what is inside it. To replace a
procedurally drawn layer with a painted one, swap the component body for an
`<image>` — the depth, the parallax, and the daylight plumbing keep working
untouched. That is the whole reason the art is structured this way.

### The daylight model

`src/scene/daylight.ts` is keyframes on a 24-hour clock, interpolated with
smoothstep. Two facts about the site decide everything in it:

- The window faces **west**. The sun therefore rises *behind* the building and
  sets *behind the range*.
- So the peaks catch alpenglow at dawn and collapse to silhouette at dusk, and
  low evening sun is the only time a real shaft of light crosses the floor.

Some things that were learned the hard way and are easy to undo by accident:

- `afterglow` must sit near zero through the middle of the day. Left running,
  it flattens the entire sky to cream.
- `peakLight` must stay **darker** than `skyHorizon` in daylight. Granite is
  not bright; when it is, the range dissolves into the sky.
- The haze band wants to be restrained. Turned up, the foot of the range goes
  lighter than the sky and the mountains read as fog.

### Framing

The design band is 1000×700 rendered with `slice`, so on a wide screen roughly
`y 70..630` survives the crop. On portrait the viewBox grows a lot (see
`src/scene/viewport.ts`) — otherwise a phone scales up ~1.16× and you end up
looking at a third of the width with the room gone. That is why every
background shape extends well past the nominal band.

## Not built yet

- Ambient sound, and a radio synced so everyone on the site hears the same
  track at the same timestamp
- Anonymous silhouettes of whoever else is here right now
- The napkin wall — one line each, fading after seven days
- Today's bake

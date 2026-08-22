# Handoff: Near Coffee — interactive 3D coffee shop

## Overview

A browser-based 3D coffee shop. The visitor steps through the door of a converted barn on Mormon Row, Wyoming, walks around, sits down, orders, reads stories off the objects, leaves a note on the wall, and changes the time of day. The goal is that it feels like entering a real place, not browsing a website.

Brand: **Near Coffee**. Tagline: *a barn on mormon row · open whenever you are.*

## About the design files

The files in this bundle are a **design reference built in HTML + three.js**. They are a working prototype showing intended look, lighting, motion and behavior — not production code to lift wholesale.

The task is to **recreate this experience in the target codebase's environment** using its established patterns (React Three Fiber, a Vue/three wrapper, a bundled TypeScript three.js app, or whatever the project already uses). If no environment exists yet, React Three Fiber + TypeScript + Vite is the natural choice for this design: the scene is already structured as discrete, declarative objects that map cleanly onto R3F components.

The prototype is a single ES module with no build step, because it had to run directly in a browser. Expect to restructure it. What must survive restructuring is the **lighting model, the material values, and the interaction flows** — those are the design.

## Fidelity

**High fidelity.** Colors, materials, light intensities per time of day, camera anchors, copy, and timings are all final and tuned. Recreate them exactly. Several values look arbitrary but are the result of long iteration — the "gotchas" section explains which ones are load-bearing.

The 2D overlay (brand, nav, panels) is also high fidelity: exact type, spacing and colors are given below.

---

## The space

One barn interior, one back bakery, one porch. All one continuous world — there is no scene switching, the camera just moves.

Coordinates: Y is up, units are metres. The barn runs along Z.

| Constant | Value | Meaning |
|---|---|---|
| `W` | 9 | barn width (x from −4.5 to 4.5) |
| `Z_FRONT` | −7 | front/door wall |
| `Z_BACK` | 6 | back/counter wall |
| `WALL_H` | 4.0 | eave height |
| `RIDGE_H` | 6.1 | ridge height |
| `DOOR_W` / `DOOR_H` | 2.8 / 3.3 | doorway opening |
| `EYE` | 1.58 | standing eye height |
| `SIT` | 1.16 | seated eye height |

**Structure:** plank floor; vertical-board side walls built as `ShapeGeometry` with rectangular holes punched for windows (not planes with overlaid frames — the holes are real); front wall split into two piers plus a header over the doorway; back wall with a 1.8m-wide opening at x 1.5–3.3 leading to the bakery; two gable ends; a pitched two-plane roof; a ridge beam and tie beams every 2.6m.

**Windows:** three on the −X wall at z = 0.6, 3.0, −2.4 (1.5 × 1.4, sill 1.15); one on the +X wall at z = 3.4 (1.4 × 1.2, sill 1.6); one in the bakery on +X. Each gets a mullioned frame and a glass pane.

**Counter:** runs x −3.6 → 0.9 at z 4.35. Slab top at y 1.05, brass foot rail. Back bar shelves at y 1.62 and 2.14 against the back wall.

**On/behind the counter:** lever espresso machine at x −2.5; grinder at x −1.55; glass pastry case at x −0.15 holding croissants and scones; chalkboard menu at x −2.2, y 2.85; cup stacks, bean jars, knock box, milk jug, napkins.

**Room:** wood stove at (3.5, 0, 1.0) with flue and a woodpile; a two-top at (−2.9, −2.6); a two-top at (2.5, 2.3); a long communal fir table centred near (−0.2, −0.2), 1.05 × 3.0; a window bar along the −X wall at x −4.24 with two stools; a record player at (3.9, −1.6); a cork pinboard on the −X wall at z −5.0; three framed photographs on the +X wall.

**Bakery:** x 0.2 → 4.4, z 6 → 9.8, ceiling 2.9. Deck oven with a lit door, work bench with dough, three racks of loaves, its own window and pendant bulb.

**Porch:** deck 3.2m deep in front of the barn, posts, a shed roof pitched −0.13 rad, a bench at x −2.3, and a hanging painted sign at x 3.2 (kept out of the doorway sightline deliberately).

**Landscape:** a snow plane (radius 1500), three layered mountain ridges as fractal `ShapeGeometry` silhouettes at z −425 / −675 / −1050 with heights 130 / 215 / 245, an instanced treeline of 260 firs, and a Mormon-Row buck-rail fence.

---

## Lighting — the heart of it

Four named light states, selectable by the visitor, plus `live` which picks one from the actual current time in `America/Denver`.

```
dawn   04:30–08:30    day  08:30–17:30    dusk  17:30–21:00    night  otherwise
```

Per-state values (all of these are tuned; copy them):

| | dawn | day | dusk | night |
|---|---|---|---|---|
| sun hour | 6.4 | 12.5 | 19.6 | 1.3 |
| sun color | `#ffb173` | `#ffeed2` | `#ff8f45` | `#8fa6d8` |
| sun intensity | 2.5 | 4.2 | 3.4 | 0.5 |
| hemisphere sky | `#9aa0a8` | `#bcc8d6` | `#8a857f` | `#2e3138` |
| hemisphere intensity | 0.8 | 1.3 | 0.85 | 0.42 |
| ambient | 1.15 | 1.7 | 1.15 | 0.44 |
| exposure | 1.5 | 1.85 | 1.8 | 1.9 |
| bulb intensity | 9 | 5.5 | 12 | 15 |
| sky gradient | `#24406b` `#cc7f50` `#f5bb7d` | `#5286c6` `#9dc0e2` `#cfe0f2` | `#3b3750` `#9b5a5e` `#ee9560` | `#05080f` `#0b1220` `#131c2e` |
| snow tint | `#bcc4dc` | `#b9c5d5` | `#c9b3ac` | `#9fb2cf` |
| fog | `#2a2436` | `#9fb5cf` | `#3a2a2c` | `#0d1120` |
| label | first light | high day | last light | deep night |

Transitions between states are lerped per frame (`k = min(1, dt * 1.4)`), never cut.

**The rig:**
- One `DirectionalLight` sun, 4096² shadow map, `radius` 3.2, `bias` −0.0007, `normalBias` 0.03. Its position is derived from the hour: it rises in +Z and sets through the doorway in −Z, which is what makes dusk the best-looking state.
- One `HemisphereLight`, ground `#4a3a2c`. **Deliberately desaturated** — see gotchas.
- One `AmbientLight` `#ffe2c0` at 0.22 base, scaled per state.
- One `DirectionalLight` "bounce" `#c9c1b4` standing in for floor/wall interreflection.
- Three hanging bulbs at (0, −4.0), (0, −1.0), (−1.6, 2.6), each an emissive sphere plus a `PointLight` `#ffb163`, distance 11, decay 2. **These must not cast shadows.**
- A `RectAreaLight` in every opening (3 side windows, 1 east window, 1 bakery window, 1 doorway at 1.5× boost). Colour is the state's horizon colour pulled 45% toward white. Requires `RectAreaLightUniformsLib.init()`.
- Warm point lights inside the stove and the oven, flickering on a two-frequency sine.
- A counter lamp and a bakery pendant.

**Post-processing:** `EffectComposer` → `RenderPass` → `UnrealBloomPass(strength 0.11, radius 0.55, threshold 1.02)` → `OutputPass`. Tone mapping is **AgX**, not ACES. The whole thing is wrapped in try/catch and falls back to direct rendering.

**Environment:** a *static* neutral grey PMREM built from a 16×64 canvas gradient (`#95908a` → `#837d77` → `#6b655e`), `environmentIntensity` 0.8. Not a scene probe — see gotchas.

**Sky:** a radius-500 `SphereGeometry`, `BackSide`, `depthTest: false`, `depthWrite: false`, `renderOrder: -1000`, `toneMapped: false`. It is a pure backdrop that costs no depth range.

**Camera:** `PerspectiveCamera(56°, aspect, 0.2, 1900)`.

---

## Materials

Every box in the scene uses a **bevelled** geometry, not `BoxGeometry` — an `ExtrudeGeometry` of a rounded rectangle with `bevelThickness = bevelSize = min(w,h,d) * 0.11`, 2 bevel segments. This is the single biggest contributor to the render not looking like a toy: every edge catches a highlight. Geometries are cached by dimension key.

Wood textures are generated procedurally at 1024² onto a canvas: per-board colour drift, ~96 fine bezier grain fibres per board, knots with grain swirling around them, a shadowed seam gutter between boards, nail heads, and weathering blotches. Normal and roughness maps are derived from each albedo by Sobel filter **at 512²** (deriving at full 1024² blocks the main thread for seconds on load).

| Material | Base | Roughness | Metalness | envMapIntensity |
|---|---|---|---|---|
| floor | tex `#6a5138`/`#2c2014`, tint `#9c9285` | 0.78 | 0 | 0.15 |
| wall | tex `#5b3d26`/`#241408`, tint `#8d7b6c` | 0.90 | 0 | 0.35 |
| wall (exterior) | tex `#4a3120`, tint `#7d6e60` | 0.96 | 0 | 0.30 |
| beam | tex, tint `#6b5644` | 0.93 | 0 | 0.30 |
| ceiling | tex `#4e3421`, tint `#7f6e5e` | 0.96 | 0 | 0.28 |
| slab (counters, tables) | tex `#7b6a55`/`#33291d`, tint `#a39c92` | 0.72 | 0 | 0.15 |
| brass | `#87724f` | 0.58 | 1 | 0.80 |
| steel | `#9e9a94` | 0.40 | 1 | 1.20 |
| black (machine, stove) | `#191512` | 0.56 | 0.45 | 0.60 |
| glass | `#f2f8fa`, opacity 0.10, `depthWrite: false` | 0.02 | 0 | 1.20 |
| cream (cups) | `#e6dccb` | 0.62 | 0 | 0.22 |
| paper | `#dcd0b4` | 0.96 | 0 | 0.20 |
| cork | `#8a6a41` | 0.97 | 0 | 0.20 |
| snow | `#c9d2de` + generated normal | 0.78 | 0 | 0.55 |
| fir | `#141c14`, flat shaded, double sided | 1.0 | 0 | 0.12 |
| bark | `#241d16` | 1.0 | 0 | 0.12 |
| crust (bakery) | `#b8813f` | 0.74 | 0 | 0.50 |
| linen | `#8f8676` | 1.0 | 0 | 0.20 |
| figure (people) | `#2b211a` | 0.95 | 0 | 0.30 |

Firs are a merged four-tier cone geometry, not a single cone, with per-tree height variation.

---

## Camera and movement

The camera is a rig with a position and a yaw/pitch, eased exponentially toward a target each frame — never snapped.

```
k = 1 - 0.001 ^ (dt * (travelling ? (cinematic ? 0.42 : 0.9) : 2.2))
```

Named anchors:

| Name | Position | Looks at |
|---|---|---|
| room | (0, 1.58, −1.4) | (0, 1.5, 5.4) |
| counter | (−1.6, 1.58, 0.4) | (−2.0, 1.8, 5.2) |
| bakery | (0.9, 1.58, 6.3) | (3.0, 1.5, 9.8) |
| porch | (−0.45, 1.58, −8.2) | (1.6, 105, −900) |
| approach | (0, 1.58, −10.4) | (0, 2.2, 6) |
| door | (0, 1.58, −5.4) | (0, 2.0, −40) |

Free movement: drag to look (yaw ×0.0032/px, pitch ×0.0026/px clamped to −0.55…0.45), scroll or W/S to walk, A/D to turn. Movement is constrained to four axis-aligned zones (main room, doorway, porch deck, bakery) so the visitor cannot walk through walls.

Always-on camera life: a breathing bob (slower and deeper when seated), a slow lateral sway, a faster step bob while moving, and a small parallax offset following the mouse (yaw ×0.075, pitch ×0.045).

**Entry sequence** on "step inside": approach → 2.3s → door (+ door chime) → 0.8s → footstep → 5.0s → room; hint shown at 8.2s. Easing is slowed to `0.42` for the whole sequence. Audio is enabled automatically here, since it's the visitor's first gesture.

---

## Interactions

### Hover
Raycast every frame against a registry of hotspot meshes (max distance 22). On enter: show a cursor-following italic label, switch cursor to pointer, lift the object's `emissive` to `#6a4a24` at `0.16 + pulse*0.1` where pulse is a 3.4 rad/s sine, and play a soft 760Hz tick. Invisible proxy meshes highlight their parent group's meshes instead.

### Clickable objects
| Object | Label | Action |
|---|---|---|
| espresso machine | the machine | story |
| grinder | the grinder | story |
| pastry case | this morning's bake | open menu |
| chalkboard | read the board | open menu |
| wood stove | the stove | story |
| photographs | the photographs | story |
| oven | the oven | story |
| porch sign | near coffee — since the barn | story |
| record player | the record player | toggle radio |
| pinboard | the wall of notes | open note panel |
| four seat markers | (seat name) | sit |

Click is suppressed if the pointer moved more than 6px since pointerdown, so dragging to look never triggers an object.

### Seats
Four: the window seat (−2.9, −2.6), the chair by the stove (2.6, 1.6), the long table (−0.2, 0.4), the porch bench (−2.3, −8.9). Sitting drops the eye to 1.16, points the camera at that seat's view, and opens a panel with a short passage and an "Order something" button.

### Ordering
A timed sequence with synthesized sound, not an instant result.

*Drinks:* "grinding" at 0s (1.9s of swept band-passed noise, grinder mesh physically shakes) → "Tamped. Pulling the shot." at 2.1s (3.4s hiss) → "Steaming the milk." at 5.7s (2.2s hiss) → cup appears at 8.2s with a chime and a new steam source.

*Pastries:* "off the tray" at 0s → "Warming it through." at 0.9s → arrives at 2.4s.

The cup lands on the visitor's table if seated, otherwise on the counter, and the status line says which.

### Notes
A textarea, 120 char max. Pinned notes render as canvas-textured paper quads on the cork board, laid out in a jittered 4-column grid, showing the most recent 10. Persisted in `localStorage` under `nearcoffee.notes`, expiring after 7 days, capped at 40 stored. Pinning walks the camera to the door.

### Presence
Between 0 and 3 seated figures appear depending on the hour (3 in the morning, 2 midday, 1 afternoon, 0 at night), with a matching line of copy. Figures breathe and shift their weight. **This is currently simulated, not real presence** — see open questions.

### Audio
All synthesized with the Web Audio API; there are no audio files.
- Room tone: looping brown noise through a lowpass whose cutoff is modulated by a 0.06Hz LFO — reads as wind on the barn.
- Fire crackle: random short square-wave blips, 180–1600ms apart, gated on room volume.
- Radio: four rotating chords of detuned sine/triangle oscillators through a lowpass, 4.6s apart, with slow attack and release.
- One-shots: door chime (three-note arpeggio), footsteps (throttled to 340ms), hover tick, order-ready chime, machine hiss and grinder whir as band-passed noise bursts.

Two independent toggles: **sound** (room tone, effects) and **radio** (music, also spins the record platter).

### Ambient motion
Wind gusts on a two-frequency sine sway all 260 firs (instanced matrix update per frame) and rock the hanging bulbs on their cords. Dust motes drift and rise, brightening and warming based on how directly the sun faces any opening. Snow falls outside on 1400 particles. Steam rises from live sources. The stove and oven flicker. The record platter spins only when the radio is on.

---

## The 2D overlay

Fonts: **Playfair Display** (400/500, plus italic) for display and labels; **DM Sans** (300/400/500) for body and meta.

Palette:
```
espresso    #1c1410      cream   #f0e8dc
dark-brown  #2a1f18      latte   #c4a882
umber       #3d2e24      gold    #b8935a
```

Every overlay cluster sits on a "chip": `rgba(18,12,9,.56)`, `backdrop-filter: blur(10px)`, `1px solid rgba(184,147,90,.16)`, radius 3px. The whole overlay carries `text-shadow: 0 1px 14px rgba(8,5,3,.9)`. This matters — without it the pale text vanishes against snow on the porch.

**Layout:** a single fixed left column (`left: 40px; top: 34px; bottom: 34px; flex-column; gap: 18px`) holding the brand block, the nav (auto-margined to centre optically), and the note controls. A separate fixed bottom-right strip holds the hint and the clock. The light controls sit top-right. Laying these out as independent fixed elements causes overlaps at small viewports; keep the column.

- Brand: `near coffee` at 30px Playfair, `letter-spacing: .34em`, lowercase; tagline 13px Playfair italic `.12em`; presence lines 10.5px DM Sans `.16em` under a hairline rule.
- Nav: 15px Playfair, `.1em`, `rgba(240,232,220,.86)`, active item full cream and indented 30px with a 12px gold rule sliding in.
- Pills: 12.5px Playfair, `.14em`, `rgba(20,14,10,.56)` background, gold-tinted border; active pill inverts to latte on espresso.
- Clock line: `7:36pm · last light · 24°F · snow`.
- Panels: 392px wide, `rgba(18,13,10,.82)` + 18px blur, 34px padding, `z-index: 10`. Kicker 9.5px gold uppercase `.28em`; heading 27px Playfair 400; body 13.5px DM Sans 300 at 1.95 line-height. Slide in from 24px right over 0.45s `cubic-bezier(.4,0,.2,1)`. While any panel is open, `body.panel-open` fades the hint/clock out.
- Opening curtain: full-bleed `#0b0907`, brand at 44px `.4em`, staggered fade-ins at 0.3s/0.8s/1.5s, and a "step inside" button that enables after 1.4s.

---

## Gotchas — please read before changing lighting

These cost a lot of iteration to find. Each one produced a convincing-looking bug that pointed somewhere else entirely.

1. **Point lights must not cast shadows.** Cube-map shadows from the ceiling bulbs self-shadow every upward-facing surface in this geometry — counter tops, shelves, tables go black. The lit/shadowed boundary then picks up whatever warm light is strongest and reads as coloured banding along every horizontal edge. The bug looks like a material or post-processing problem and is not. The sun still casts.

2. **Don't use a scene-sampling reflection probe.** A `CubeCamera` probe captures the bulbs and the coloured sky through the openings; glossy horizontal surfaces then mirror that cast back as red at dusk and violet at night. The static neutral PMREM is deliberate.

3. **GTAO was removed.** It produced its own banding on horizontal surfaces here and could not be tuned out. If you want ambient occlusion, budget real time for it and verify at **dusk** specifically, which is the worst case — not at day.

4. **No additive volumetric light shafts.** A solid additive volume always leaves a hard seam where it intersects furniture; a depth-based soft-particle fade is not sufficient because the beam's back face is depth-culled. Correct god rays need ray-marching. The current design carries sunlight with lit dust instead, which is artifact-free.

5. **Keep the depth range tight.** `near 0.2 / far 1900`. The landscape is scaled to fit rather than modelled at true distance, and the sky is a non-depth backdrop. A far plane in the thousands destroys precision for any depth-based effect.

6. **The sky must not be tone mapped.** AgX crushes a saturated daylight blue into navy. `scene.background` gets tone mapped; the backdrop sphere with `toneMapped: false` does not.

7. **AgX needs roughly 1.5–1.9× the exposure of ACES.** If you switch tone mappers, every exposure value above is wrong.

8. **Derive normal/roughness maps at 512², not 1024².** Full-resolution Sobel on five textures blocks the main thread for seconds during load.

9. **Desaturate the hemisphere light.** It ignores occlusion, so a saturated sky colour paints every upward-facing interior surface with outdoor colour even under a roof.

10. **Nothing is axis-aligned.** Chairs carry a random ±0.17 rad rotation and ±6.5cm offset, tables a random rotation, cups a random spin. Perfect alignment is a strong tell.

---

## Suggested implementation order

1. Barn shell, floor, walls with real window openings, roof. Get the proportions right first.
2. Lighting rig and the four time-of-day states. Verify at dusk before going further.
3. Materials and the bevelled box helper.
4. Camera rig, anchors, zone constraints, easing.
5. Furniture, counter, bakery, props.
6. Hotspots, hover feedback, panels, copy.
7. Ordering sequence, notes, presence.
8. Audio.
9. Ambient motion and the entry sequence.
10. Post-processing last — it is the easiest thing to over-tune early.

## Copy

All object stories, menu items and panel text are written in the owner's first-person voice and are in the prototype verbatim. **Treat this copy as placeholder written by a designer** — the owner intends to replace it with their own. Keep the voice: plain, specific, a little dry, no marketing register.

Menu: drip 3, cortado 4, flat white 4, pour-over 5, stovetop hot chocolate 4, butter croissant 4, morning bun 4, sourdough and jam 5.

## Assets

- Three photographs on the east wall, loaded from `images/frame-1.jpg`, `frame-2.jpg`, `frame-3.jpg`. These came from the existing Near Coffee site and are placeholders for the owner's own photography.
- Everything else is generated at runtime: all wood, snow, the sky gradient, the chalkboard, the painted sign, and the pinned notes are drawn to canvas in code. There are no texture files to ship.
- Fonts load from Google Fonts. Self-host them in production.
- three.js r184 via CDN import map. Pin the version.

## Files

- `Near Coffee Room.html` — document, import map, all 2D overlay markup and CSS, opening curtain.
- `room-scene.js` — the entire 3D scene: geometry, materials, lighting, camera rig, interaction, audio, animation loop.
- `images/frame-1.jpg`, `frame-2.jpg`, `frame-3.jpg` — wall photographs.

Append `?debug=1` to the URL to expose `window.nearCoffee` with `pause()`, `resume()`, `step(n, dt)`, `goTo(anchor)`, and toggles for individual lighting features. Useful for reproducing a specific frame.

## Open questions for the owner

- Presence ("two others here") is simulated from the clock. Should it be wired to something real — a websocket, a presence service — or stay as atmosphere?
- Ambient audio is synthesized. A field recording from the actual site would be better if one exists.
- Is the room meant to drive a real action (visit, subscribe, buy beans) or purely to be lingered in? Nothing currently converts.

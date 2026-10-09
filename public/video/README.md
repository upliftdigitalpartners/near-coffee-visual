# Clips

Both files here are **optional**. Nothing in `public/video/` is required for
the site to work, and the site is tested with the directory empty — each one
is probed with a HEAD request and silently skipped if it is not there, so a
missing file never puts a failed media load in anyone's console.

Do not add a clip without adding its provenance to `CREDITS.md` first. See the
note there: generated video is **not** CC0, and this project's licensing story
has been clean so far.

---

## `fire.mp4`

What burns in the stove's mica window and in the oven's mouth.
See `src/three/fire.ts`.

| | |
| --- | --- |
| Size | 256 × 128, or 128 × 64. It is mapped to a 20cm plane and a 74cm one |
| Length | 3–6 seconds |
| Loop | **Must be seamless.** A visible cut is a blink, and nobody blinks at a fire |
| Framing | Fill the frame with the coal bed. No chimney, no logs sticking out, no background — this is seen *through* a door that is already modelled |
| Light | Brightest along the bottom, dark into the top corners. The drawn fallback in `fire.ts` is the composition to match |
| Motion | Slow. Embers and heat shimmer, not a bonfire |
| Codec | H.264 MP4, no audio track |
| Weight | Under 400KB. It decodes every frame of every frame of the scene |

It replaces a drawn coal bed that is good enough to ship, so it only earns its
place if the motion is genuinely better than a static map. Flickering light in
the room is already handled in `Stove.tsx` by a point light on two
frequencies — the clip does not need to carry that.

## `arrival.mp4`

What plays behind the wordmark while the barn loads.
See `src/ui/Arrival.tsx`.

| | |
| --- | --- |
| Size | 1280 × 720 is plenty. It dissolves in over the still at 86% |
| Length | 4–8 seconds, seamless loop |
| Subject | The barn from outside, in snow. Slow push or a locked-off shot |
| Motion | **Slow.** This plays while someone waits; fast motion makes the wait feel longer |
| Composition | Keep the **top left** quiet — the wordmark sits there — and the bottom 60px, which is the progress rule. The centre is free; it was not when this was first written, and the note has been corrected |
| Grade | Don't. The grade is applied in CSS per sky, so a clip that arrives pre-graded gets it twice |
| Codec | H.264 MP4, no audio |
| Weight | Under 1.5MB. It competes for bandwidth with the scene it is covering |

A long or heavy clip is self-defeating: every byte it takes is a byte the
barn is not loading, and the screen exists to make the load shorter, not to
be watched.

There is a still there already, and it is not a placeholder: `src/ui/still.ts`
picks one of four photographs of the barn on the visitor's local hour, and
`styles.css` grades each one to match the room it is about to hand over to. A
clip only earns its place if the motion is worth more than that choice, which
means it has to work at every hour or be dropped in favour of four of them —
one per sky — named `arrival-dawn.mp4` and so on. That is not wired up; say so
and it is a ten-line change to `Arrival.tsx`.

Skipped entirely under `prefers-reduced-motion`.

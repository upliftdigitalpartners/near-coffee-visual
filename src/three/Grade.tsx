import { useMemo } from 'react'
import { BlendFunction, Effect } from 'postprocessing'
import * as THREE from 'three'

/**
 * The look, applied after the tone mapper.
 *
 * AgX is deliberately flat. It exists to get a very wide range of light into a
 * displayable one without clipping or hue-shifting, and it does that by
 * spending contrast and saturation — which is the right trade, but it is only
 * half of a pipeline. Every production that ships AgX puts a look on top of
 * it; Blender ships several and calls them "punchy", "high contrast" and so
 * on. Without one the room comes back correct and lifeless: nothing clipped,
 * nothing black, everything the colour of weak tea.
 *
 * Two controls, both in display space, both applied after the mapping:
 *
 *   saturation  gives back what the shoulder took out of the strong colours,
 *               without pushing the neutrals anywhere. Kept to 1.14: at night
 *               the whole room is lit by one warm bulb, so every pixel shares
 *               a hue, and anything stronger turns the walls a lurid red
 *               rather than amber.
 *   contrast    pivots about middle grey, so it deepens the shadows and firms
 *               up the highlights without moving the exposure.
 *
 * Kept modest on purpose. The point of tone mapping this scene was to stop the
 * cup and the sunlit floor clipping flat to white, and a hard contrast curve
 * here would simply reintroduce the clipping one stage later.
 */

const fragmentShader = /* glsl */ `
uniform float uSaturation;
uniform float uContrast;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  // Pivot on middle grey rather than 0.5: pivoting on 0.5 lifts everything
  // below it and the shadows go milky, which is the opposite of the intent.
  c = (c - 0.18) * uContrast + 0.18;
  outputColor = vec4(max(c, vec3(0.0)), inputColor.a);
}
`

class GradeEffect extends Effect {
  constructor(saturation: number, contrast: number) {
    super('Grade', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uSaturation', new THREE.Uniform(saturation)],
        ['uContrast', new THREE.Uniform(contrast)],
      ]),
    })
  }
}

export function Grade({
  saturation = 1.14,
  contrast = 1.07,
}: {
  saturation?: number
  contrast?: number
}) {
  const effect = useMemo(() => new GradeEffect(saturation, contrast), [saturation, contrast])
  return <primitive object={effect} />
}

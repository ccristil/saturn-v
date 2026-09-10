import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Vector3, Object3D, Group } from 'three'
import { advanceSpin } from './spin'
import { applyLivery } from './livery'
import { Dimension } from './Dimension'

// A second vehicle parked beside the Saturn V for scale.
//
// The whole point is that the comparison is honest, so nothing here is eyeballed: the
// Saturn V is measured live out of the scene, and the guest is scaled by the ratio of
// their real heights. Move the guest's model, or re-tune the Saturn V's assembly, and
// the comparison stays true without anyone editing a magic number.

const SATURN_V_M = 110.6 // real height of the Apollo Saturn V, launch escape tower included
const M_TO_FT = 3.28084

// If the Saturn V can't be measured (renamed nodes, model swap), fall back to the
// height it had when this was written rather than rendering a wrong-size rocket
// silently — and say so in the console.
const SATURN_V_UNITS_FALLBACK = 115
const GROUND_Y_FALLBACK = 0
const SATURN_V_LEFT_FALLBACK = -10 // the S-IC's radius

const SLIDE_S = 1.2 // a guest that slides in (or back out) always takes exactly this long
const DIM_GAP = 6 // height dimensions stand this far clear of each vehicle's widest point

function smootherstep(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// Measure the assembled Saturn V by finding a node only it has, then walking up to
// the group R3F mounted it in. Y-spin doesn't affect the height, so this is stable.
function measureSaturnV(root: Object3D) {
  const marker = root.getObjectByName('S-IC')
  if (!marker) return null
  let node: Object3D = marker
  while (node.parent && !(node.parent as { isScene?: boolean }).isScene) {
    node = node.parent
    // Stack records the vehicle's bounds as assembled. Prefer them: measured live, a
    // comparison opened while the stages are still closing up after an explode would
    // be scaled against a stack far taller than the real one.
    const assembled = node.userData.assembledBox as Box3 | undefined
    if (assembled) return assembled.clone()
  }
  const box = new Box3().setFromObject(node)
  return box.isEmpty() ? null : box
}

export function preloadCompare(model: string) {
  useGLTF.preload(`${import.meta.env.BASE_URL}${model}`)
}

export function Compare({
  model,
  heightM,
  x,
  spin = false,
  enterFrom = 0,
  present = true,
  onSettled,
  labels,
}: {
  model: string // path relative to BASE_URL
  heightM: number // real-world height, in metres
  x: number // where to park it, on the Saturn V's left (−) or right (+)
  spin?: boolean // turn in place, in step with the Saturn V
  enterFrom?: number // slide in from this far right of `x` (0 = appear in place)
  present?: boolean // false slides it back out the way it came
  onSettled?: (parked: boolean) => void // a slide finished: parked, or gone
  labels?: { saturn: string; guest: string } // mark both vehicles' heights, in feet
}) {
  const spinGroup = useRef<Group>(null)
  const slideGroup = useRef<Group>(null)
  const prog = useRef(enterFrom ? 0 : 1) // 1 = parked at x
  const settled = useRef<boolean | null>(null) // the last state reported via onSettled
  const url = `${import.meta.env.BASE_URL}${model}`
  const { scene } = useGLTF(url)
  const root = useThree((s) => s.scene)

  const fit = useMemo(() => {
    applyLivery(model, scene)
    const sat = measureSaturnV(root)
    if (!sat) {
      // eslint-disable-next-line no-console
      console.warn('[Compare] Saturn V not found in the scene — falling back to a fixed scale.')
    }
    const satHeight = sat ? sat.max.y - sat.min.y : SATURN_V_UNITS_FALLBACK
    const groundY = sat ? sat.min.y : GROUND_Y_FALLBACK
    const satLeft = sat ? sat.min.x : SATURN_V_LEFT_FALLBACK

    // The guest's own bounds, in its own units — this model ships off-origin.
    const box = new Box3().setFromObject(scene)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())

    const guestHeight = satHeight * (heightM / SATURN_V_M)
    const scale = guestHeight / size.y
    // pre-scale nudge: put the model's own base on the origin, axis centred
    const offset: [number, number, number] = [-center.x, -box.min.y, -center.z]
    return { scale, offset, groundY, satHeight, satLeft, guestHeight, guestHalfWidth: (size.x / 2) * scale }
  }, [scene, root, heightM, model])

  useFrame((_, delta) => {
    // Both vehicles start at rotation 0 and advance by the same delta, so they stay in
    // step for as long as the comparison is up.
    advanceSpin(spinGroup.current, delta, spin)

    // Fixed-duration slide, so it lands the same way every time it's rehearsed.
    const goal = present ? 1 : 0
    if (prog.current !== goal) {
      const dir = goal > prog.current ? 1 : -1
      prog.current = Math.max(0, Math.min(1, prog.current + (dir * delta) / SLIDE_S))
    }
    if (prog.current === goal && settled.current !== present) {
      settled.current = present
      onSettled?.(present)
    }
    if (slideGroup.current) {
      slideGroup.current.position.x = x + enterFrom * (1 - smootherstep(prog.current))
    }
  })

  return (
    <group position-y={fit.groundY}>
      <group ref={slideGroup} position-x={x + enterFrom}>
        <group scale={fit.scale}>
          <group ref={spinGroup}>
            <group position={fit.offset}>
              <primitive object={scene} />
            </group>
          </group>
        </group>
        {labels && (
          <Dimension
            x={fit.guestHalfWidth + DIM_GAP}
            height={fit.guestHeight}
            name={labels.guest}
            feet={Math.round(heightM * M_TO_FT)}
          />
        )}
      </group>
      {labels && (
        <Dimension
          x={fit.satLeft - DIM_GAP}
          height={fit.satHeight}
          name={labels.saturn}
          feet={Math.round(SATURN_V_M * M_TO_FT)}
        />
      )}
    </group>
  )
}

import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Vector3, Object3D, Group } from 'three'
import { advanceSpin } from './spin'
import { applyLivery } from './livery'

// A second vehicle parked beside the Saturn V for scale.
//
// The whole point is that the comparison is honest, so nothing here is eyeballed: the
// Saturn V is measured live out of the scene, and the guest is scaled by the ratio of
// their real heights. Move the guest's model, or re-tune the Saturn V's assembly, and
// the comparison stays true without anyone editing a magic number.

const SATURN_V_M = 110.6 // real height of the Apollo Saturn V, launch escape tower included

// If the Saturn V can't be measured (renamed nodes, model swap), fall back to the
// height it had when this was written rather than rendering a wrong-size rocket
// silently — and say so in the console.
const SATURN_V_UNITS_FALLBACK = 115
const GROUND_Y_FALLBACK = 0

// Measure the assembled Saturn V by finding a node only it has, then walking up to
// the group R3F mounted it in. Y-spin doesn't affect the height, so this is stable.
function measureSaturnV(root: Object3D) {
  const marker = root.getObjectByName('S-IC')
  if (!marker) return null
  let node: Object3D = marker
  while (node.parent && !(node.parent as { isScene?: boolean }).isScene) node = node.parent
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
}: {
  model: string // path relative to BASE_URL
  heightM: number // real-world height, in metres
  x: number // where to park it, on the Saturn V's left (−) or right (+)
  spin?: boolean // turn in place, in step with the Saturn V
}) {
  const spinGroup = useRef<Group>(null)
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

    // The guest's own bounds, in its own units — this model ships off-origin.
    const box = new Box3().setFromObject(scene)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())

    const scale = (satHeight * (heightM / SATURN_V_M)) / size.y
    // pre-scale nudge: put the model's own base on the origin, axis centred
    const offset: [number, number, number] = [-center.x, -box.min.y, -center.z]
    return { scale, offset, groundY }
  }, [scene, root, heightM, model])

  // Both vehicles start at rotation 0 and advance by the same delta, so they stay in
  // step for as long as the comparison is up.
  useFrame((_, delta) => advanceSpin(spinGroup.current, delta, spin))

  return (
    <group position={[x, fit.groundY, 0]} scale={fit.scale}>
      <group ref={spinGroup}>
        <group position={fit.offset}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  )
}

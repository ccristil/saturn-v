import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import { Vector3, Group } from 'three'

const FOIL = '#0c81cf' // LeaderFactor accent-blue-bright — the active leader line
const RULE = '#3a4056' // muted slate — inactive leader line, reads on the navy backdrop
const DRAW_MS = 300

// Leader-line dimensions in the callout's local (billboarded) plane.
const OUT = 12 // horizontal run to the elbow
const UP = 8 // vertical run to the tag

type Props = {
  target: [number, number, number]
  tag: string
  active: boolean
  // A card is open on the right. Mirror the elbow so the tag runs left, clear of it —
  // otherwise the tag lands on top of the card's text.
  flip?: boolean
  onSelect: () => void
}

export function Callout({ target, tag, active, flip = false, onSelect }: Props) {
  const groupRef = useRef<Group>(null)
  const prog = useRef(active ? 1 : 0)
  const [p, setP] = useState(active ? 1 : 0)

  useFrame((state, delta) => {
    // Billboard: copy the camera's orientation so the whole L lies flat in the
    // view plane and reads straight-on from any rocket rotation.
    if (groupRef.current) groupRef.current.quaternion.copy(state.camera.quaternion)

    const goal = active ? 1 : 0
    if (prog.current !== goal) {
      const dir = goal > prog.current ? 1 : -1
      prog.current = Math.max(0, Math.min(1, prog.current + (dir * (delta * 1000)) / DRAW_MS))
      setP(prog.current)
    }
  })

  // L-shape built in local XY: start at the anchor, run out to the elbow, up to the tag.
  const out = flip ? -OUT : OUT
  const start = new Vector3(0, 0, 0)
  const elbow = new Vector3(out, 0, 0)
  const tagEnd = new Vector3(out, UP, 0)
  const full = [start, elbow, tagEnd]

  // Foil overlay draws in: first half start→elbow, second half elbow→tag.
  const elbowP = start.clone().lerp(elbow, Math.min(1, p * 2))
  const drawn: Vector3[] =
    p <= 0.5 ? [start, elbowP] : [start, elbow, elbow.clone().lerp(tagEnd, p * 2 - 1)]

  return (
    <group ref={groupRef} position={target}>
      <Line points={full} color={RULE} lineWidth={1} />
      {p > 0.01 && <Line points={drawn} color={FOIL} lineWidth={2} />}
      {/* zIndexRange keeps tags under the DOM overlays (card / HUD / progress, z-index 20)
          — drei's default is ~16.7M, which paints them over the card. */}
      <Html position={[out, UP, 0]} center zIndexRange={[10, 0]}>
        <button
          className={active ? 'callout-tag' : 'callout-tag callout-tag--inactive'}
          onClick={onSelect}
        >
          {tag}
        </button>
      </Html>
    </group>
  )
}

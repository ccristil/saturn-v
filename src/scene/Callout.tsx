import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import { Vector3 } from 'three'

const FOIL = '#d4a24c'
const RULE = '#2a3444'
const DRAW_MS = 300

type Props = {
  target: [number, number, number]
  tag: string
  active: boolean
  onSelect: () => void
}

export function Callout({ target, tag, active, onSelect }: Props) {
  const t = new Vector3(target[0], target[1], target[2])
  const elbow = new Vector3(t.x + 9, t.y, t.z + 7) // 90° elbow out from the vehicle
  const tagEnd = new Vector3(elbow.x, elbow.y + 5, elbow.z)

  const prog = useRef(active ? 1 : 0)
  const [, force] = useState(0)

  useFrame((_, delta) => {
    const goal = active ? 1 : 0
    if (prog.current !== goal) {
      const dir = goal > prog.current ? 1 : -1
      prog.current = Math.max(0, Math.min(1, prog.current + (dir * (delta * 1000)) / DRAW_MS))
      force((n) => n + 1)
    }
  })

  // Full static polyline for the inactive rule marker.
  const full = [t, elbow, tagEnd]

  // Foil overlay draws in: first half extends target→elbow, second half elbow→tag.
  const p = prog.current
  const elbowP = t.clone().lerp(elbow, Math.min(1, p * 2))
  const drawn: Vector3[] =
    p <= 0.5 ? [t, elbowP] : [t, elbow, elbow.clone().lerp(tagEnd, p * 2 - 1)]

  return (
    <group>
      <Line points={full} color={RULE} lineWidth={1} />
      {p > 0.01 && <Line points={drawn} color={FOIL} lineWidth={2} />}
      <Html position={tagEnd.toArray()} center>
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

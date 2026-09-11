import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import type { Group } from 'three'

// An engineering-drawing height dimension: a vertical line from the ground to the top of
// a vehicle, closed by a short tick at each end, with the height written above it. It
// stands in the vehicles' own plane (z = 0), so from the compare camera it reads true.

const INK = '#aab4cf' // light slate — holds up on a washed-out projector without taking the accent
const TICK = 2.5 // half-length of the end ticks, scene units

// The floor's contact-shadow pass draws every mesh with one plain depth material. drei's
// Line is an instanced mesh whose real segments only exist in its own shader, so under
// that material it draws its template quad at the line's origin instead — here, on the
// floor. So the lines live on their own layer: the main camera is told to see it, the
// shadow camera (layer 0 only) never does.
export const DIM_LAYER = 1

export function Dimension({
  x,
  height,
  name,
  feet,
}: {
  x: number
  height: number // scene units, measured up from the ground
  name: string
  feet: number
}) {
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    camera.layers.enable(DIM_LAYER)
    group.current?.traverse((o) => o.layers.set(DIM_LAYER))
  }, [camera])

  return (
    <group position-x={x}>
      <group ref={group}>
        <Line points={[[0, 0, 0], [0, height, 0]]} color={INK} lineWidth={1.5} />
        <Line points={[[-TICK, 0, 0], [TICK, 0, 0]]} color={INK} lineWidth={1.5} />
        <Line points={[[-TICK, height, 0], [TICK, height, 0]]} color={INK} lineWidth={1.5} />
      </group>
      {/* Anchored at the top tick; the label lifts itself clear in CSS, so the gap stays
          the same in pixels however far back the camera is. */}
      <Html position={[0, height, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="dim-label">
          <span className="dim-label__name">{name}</span>
          <span className="dim-label__value">
            {feet.toLocaleString()}
            <span className="dim-label__unit">ft</span>
          </span>
        </div>
      </Html>
    </group>
  )
}

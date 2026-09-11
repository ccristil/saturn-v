import { forwardRef, useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import type { Group } from 'three'
import { DIM_LAYER } from './Dimension'

// One stage's bracket: a ] standing beside the rocket, its ends turned in toward the
// vehicle, with a short stub out to the numbered tag at its midpoint.
//
// It's drawn one unit tall — y 0 is the bottom of the stage, y 1 the top — and
// Brackets stretches and places it every frame, so a moving stage never re-renders
// the lines. drei's line widths are in pixels, so the stretch doesn't thicken them.

const INK = '#aab4cf' // the dimension lines' slate
const COLUMN = 14 // the bracket's distance from the rocket's axis — clear of the S-IC fins (r 9.9)
const TICK = 2 // end ticks, turned in toward the rocket
const STUB = 3 // run out to the tag

const V = (x: number, y: number): [number, number, number] => [x, y, 0]
const BRACKET = [V(COLUMN - TICK, 0), V(COLUMN, 0), V(COLUMN, 1), V(COLUMN - TICK, 1)]
const LEAD = [V(COLUMN, 0.5), V(COLUMN + STUB, 0.5)]

type Props = { tag: string; onSelect: () => void }

export const Bracket = forwardRef<Group, Props>(function Bracket({ tag, onSelect }, ref) {
  const lines = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  // Same as Dimension: the lines live on their own layer, out of the contact-shadow pass.
  useLayoutEffect(() => {
    camera.layers.enable(DIM_LAYER)
    lines.current?.traverse((o) => o.layers.set(DIM_LAYER))
  }, [camera])

  return (
    <group ref={ref}>
      <group ref={lines}>
        <Line points={BRACKET} color={INK} lineWidth={1.5} />
        <Line points={LEAD} color={INK} lineWidth={1.5} />
      </group>
      {/* zIndexRange keeps tags under the DOM overlays (HUD / progress, z-index 20)
          — drei's default is ~16.7M, which paints them over everything. */}
      <Html position={LEAD[1]} zIndexRange={[10, 0]}>
        <button className="bracket-tag" onClick={onSelect}>
          {tag}
        </button>
      </Html>
    </group>
  )
})

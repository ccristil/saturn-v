import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'

// Grounds the rocket like a hero object on a dark studio floor: a soft contact shadow
// under the base, read against a faint radial floor glow that fades to transparent well
// before its edge (so the void backdrop is untouched — no hard floor line). The S-IC is
// the fixed explode reference, so the base footprint never moves → a one-frame shadow
// bake (frames={1}) stays correct through explode. Mounted inside <Suspense> so it bakes
// after the model has loaded.
//
// `bakeKey` is the one thing that does change the footprint: a second vehicle parked
// beside the Saturn V. When it changes, the shadow is remounted so it bakes again —
// otherwise the guest's shadow stays burned into the floor after it leaves. `live` is for
// a guest still on the move (the statue sliding in or out): the shadow follows it every
// frame until it comes to rest. It's also on while "What came home?" is up: the S-IC fades
// away and back (Homecoming.tsx fades the shadow, by name, along with it), and a baked
// shadow would come back empty.

const BASE_Y = -1 // just below the lowest engine geometry

// The shadow bakes over a square of floor, always centred on the Saturn V's axis. 54
// units frames the Saturn V alone; a guest parked beside it (its axis at `guestX`) grows
// the square until it takes the guest in too, or the guest's shadow is clipped mid-blob
// at the edge.
//
// Grows, never shifts: drei blurs the shadow by drawing a plane that sits at the world
// origin rather than under its shadow camera, so a square moved off the origin slides the
// shadow sideways by that offset on every blur pass — four of them. Shifted toward a
// guest on the right, the guest's shadow landed well to the left of the Saturn V.
const SOLO = 54
const withGuest = (guestX: number) => 2 * (Math.abs(guestX) + 20)

function floorTexture(): CanvasTexture {
  const s = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(58,72,96,0.62)')
  g.addColorStop(0.35, 'rgba(36,47,64,0.3)')
  g.addColorStop(0.7, 'rgba(22,29,41,0.09)')
  g.addColorStop(1, 'rgba(22,29,41,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function Ground({
  bakeKey = '',
  guestX = 0,
  live = false,
}: {
  bakeKey?: string
  guestX?: number
  live?: boolean
}) {
  const tex = useMemo(floorTexture, [])

  // ContactShadows draws into its render target assuming the renderer clears it first,
  // but the EffectComposer switches autoClear off for the whole renderer. Uncleared, each
  // shadow render lands on top of the last one's blurred result: anything moving leaves
  // copies of its shadow behind, and a still one is re-blurred every frame until it
  // spreads into a pool. So autoClear goes back on for the shadow pass alone (useFrame
  // priority 0) and is handed back before the composer renders (priority 1).
  const gl = useThree((s) => s.gl)
  const autoClear = useRef(false)
  useFrame(() => {
    autoClear.current = gl.autoClear
    gl.autoClear = true
  }, -1)
  useFrame(() => {
    gl.autoClear = autoClear.current
  }, 0.5)

  // Re-bake a beat after the scene changes, not in the same commit: whatever left has
  // to be out of the scene graph before the shadow camera renders, or it bakes the
  // thing we're trying to erase.
  const size = bakeKey ? withGuest(guestX) : SOLO
  const [bake, setBake] = useState(bakeKey)
  useEffect(() => {
    const id = window.setTimeout(() => setBake(bakeKey), 120)
    return () => clearTimeout(id)
  }, [bakeKey])
  return (
    <group position={[0, BASE_Y, 0]}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={-1}>
        <circleGeometry args={[70, 64]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} />
      </mesh>
      <group name="Ground_Shadow">
        <ContactShadows
          key={bake}
          position={[0, 0.05, 0]}
          scale={size}
          resolution={1024}
          blur={2.2}
          far={16}
          opacity={0.75}
          color="#04060a"
          // ContactShadows restarts its frame count whenever it re-renders, so dropping
          // back to 1 when `live` ends takes exactly one more bake — guest at rest.
          frames={live ? Infinity : 1}
        />
      </group>
    </group>
  )
}

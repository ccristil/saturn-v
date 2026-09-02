import { useEffect, useMemo, useState } from 'react'
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
// otherwise the guest's shadow stays burned into the floor after it leaves.

const BASE_Y = -1 // just below the lowest engine geometry

// The shadow bakes over a square of floor. 54 units frames the Saturn V alone; with a
// guest parked to its left the box has to grow and shift, or the guest's shadow is
// clipped mid-blob at the box edge — which is what makes a wide-skirted vehicle like
// the N1 read as a hard dark pool rather than a shadow.
const SOLO = { x: 0, scale: 54 }
const WITH_GUEST = { x: -14, scale: 86 }

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

export function Ground({ bakeKey = '' }: { bakeKey?: string }) {
  const tex = useMemo(floorTexture, [])

  // Re-bake a beat after the scene changes, not in the same commit: whatever left has
  // to be out of the scene graph before the shadow camera renders, or it bakes the
  // thing we're trying to erase.
  const box = bakeKey ? WITH_GUEST : SOLO
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
      <ContactShadows
        key={bake}
        position={[box.x, 0.05, 0]}
        scale={box.scale}
        resolution={1024}
        blur={2.2}
        far={16}
        opacity={0.75}
        color="#04060a"
        frames={1}
      />
    </group>
  )
}

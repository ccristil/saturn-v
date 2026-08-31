import { useMemo } from 'react'
import { ContactShadows } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'

// Grounds the rocket like a hero object on a dark studio floor: a soft contact shadow
// under the base, read against a faint radial floor glow that fades to transparent well
// before its edge (so the void backdrop is untouched — no hard floor line). The S-IC is
// the fixed explode reference, so the base footprint never moves → a one-frame shadow
// bake (frames={1}) stays correct through explode. Mounted inside <Suspense> so it bakes
// after the model has loaded.

const BASE_Y = -1 // just below the lowest engine geometry

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

export function Ground() {
  const tex = useMemo(floorTexture, [])
  return (
    <group position={[0, BASE_Y, 0]}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={-1}>
        <circleGeometry args={[70, 64]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} />
      </mesh>
      <ContactShadows
        position={[0, 0.05, 0]}
        scale={54}
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

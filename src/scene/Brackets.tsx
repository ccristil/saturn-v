import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Vector3, type Camera, type Group, type Object3D } from 'three'
import { Bracket } from './Bracket'
import { hotspots } from '../content/hotspots'

// Places one bracket beside each stage, spanning the stage's real height.
//
// The stage's nodes are found once but measured every frame: stages move (the
// brackets mount the instant a reassemble starts, every stage still exploded upward),
// and a one-shot measurement left the markers hanging where the stages had been.
//
// Each stage's lower end is hidden inside the shroud of the one below it, so a
// bracket starts where the bracket below it ends — they butt up into one chain, a
// small gap apart, and can't overlap. Each is turned to face the camera about the
// vertical axis only, so it stays upright and always on screen-right of the rocket.

const GAP = 1.6 // scene units between neighbouring brackets, so each reads as its own stage

const box = new Box3()
const right = new Vector3()
const spans = hotspots.map(() => [0, 0])
const byBottom = hotspots.map((_, i) => i)
const lowestFirst = (a: number, b: number) => spans[a][0] - spans[b][0]

export function Brackets({ onSelect }: { onSelect: (i: number) => void }) {
  const brackets = useRef<(Group | null)[]>([])
  const nodes = useRef<Object3D[][]>([])
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  // This group sits at the scene origin, on the rocket's axis, so world y is its y.
  const place = (cam: Camera) => {
    hotspots.forEach((h, i) => {
      box.makeEmpty()
      for (const n of nodes.current[i] ?? []) {
        n.updateWorldMatrix(true, false)
        box.expandByObject(n)
      }
      spans[i][0] = box.isEmpty() ? h.span[0] : box.min.y
      spans[i][1] = box.isEmpty() ? h.span[1] : box.max.y
    })

    right.set(1, 0, 0).applyQuaternion(cam.quaternion)
    const yaw = Math.atan2(-right.z, right.x)

    byBottom.sort(lowestFirst)
    let below = -Infinity
    for (const i of byBottom) {
      const lo = Math.max(spans[i][0], below) + GAP / 2
      const hi = spans[i][1] - GAP / 2
      below = Math.max(below, spans[i][1])
      const b = brackets.current[i]
      if (!b) continue
      b.position.y = lo
      b.scale.y = Math.max(hi - lo, 0.01)
      b.rotation.y = yaw
    }
  }

  useLayoutEffect(() => {
    nodes.current = hotspots.map((h) => {
      const found: Object3D[] = []
      for (const name of h.bracket) {
        const before = found.length
        scene.traverse((n) => {
          if (n.name === name) found.push(n)
        })
        if (found.length === before) console.warn(`[brackets] no "${name}" node in the model (bracket ${h.tag})`)
      }
      return found
    })
    place(camera) // before the first paint, so no bracket flashes at the wrong height
  }, [scene, camera])

  useFrame((state) => place(state.camera))

  return (
    <group>
      {hotspots.map((h, i) => (
        <Bracket
          key={h.id}
          ref={(el) => {
            brackets.current[i] = el
          }}
          tag={h.tag}
          onSelect={() => onSelect(i)}
        />
      ))}
    </group>
  )
}

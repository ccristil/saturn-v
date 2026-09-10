import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Vector3, Matrix4, Group, Object3D } from 'three'
import { Callout } from './Callout'
import { hotspots } from '../content/hotspots'

const ORIGIN: [number, number, number] = [0, 0, 0]
const box = new Box3()
const center = new Vector3()
const invGroup = new Matrix4()

// Resolves each hotspot's leader-line target: if the hotspot names an `anchor`
// node, we find that node in the live scene and pin the callout to its real center
// (converted into this group's local space) instead of a hardcoded guess.
//
// The nodes are found once but measured every frame. Stages move: the callouts
// mount the instant a reassemble starts, with every stage still exploded upward,
// and a one-shot measurement there left the tags hanging where the stages had been.
export function Callouts({
  activeIndex,
  flip = false,
  onSelect,
}: {
  activeIndex: number | null
  flip?: boolean // a card is open — run the leader lines left, away from it
  onSelect: (i: number) => void
}) {
  const groupRef = useRef<Group>(null)
  const pins = useRef<(Group | null)[]>([])
  const anchors = useRef<Object3D[][]>([])
  const scene = useThree((s) => s.scene)

  const place = () => {
    const g = groupRef.current
    if (!g) return
    g.updateWorldMatrix(true, false)
    invGroup.copy(g.matrixWorld).invert()
    hotspots.forEach((h, i) => {
      const pin = pins.current[i]
      if (!pin) return
      box.makeEmpty()
      for (const n of anchors.current[i] ?? []) {
        n.updateWorldMatrix(true, false)
        box.expandByObject(n)
      }
      if (box.isEmpty()) pin.position.set(...h.target)
      else pin.position.copy(box.getCenter(center).applyMatrix4(invGroup))
    })
  }

  useLayoutEffect(() => {
    anchors.current = hotspots.map((h) => {
      const found: Object3D[] = []
      if (h.anchor) {
        scene.traverse((n) => {
          if (n.name === h.anchor || (n.name && n.name.startsWith(h.anchor + '.'))) found.push(n)
        })
      }
      return found
    })
    place() // before the first paint, so no tag flashes at its fallback target
  }, [scene])

  useFrame(place)

  return (
    <group ref={groupRef}>
      {hotspots.map((h, i) => (
        <group
          key={h.id}
          ref={(el) => {
            pins.current[i] = el
          }}
        >
          <Callout
            target={ORIGIN}
            tag={h.tag}
            active={i === activeIndex}
            flip={flip}
            onSelect={() => onSelect(i)}
          />
        </group>
      ))}
    </group>
  )
}

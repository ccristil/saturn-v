import { useLayoutEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Box3, Vector3, Matrix4, Group } from 'three'
import { Callout } from './Callout'
import { hotspots } from '../content/hotspots'

// Resolves each hotspot's leader-line target: if the hotspot names an `anchor`
// node, we find that node in the live scene and use its real center (converted
// into this group's local space) instead of a hardcoded guess. The center offset
// applied by <Center> cancels out because both the anchor node and this group
// carry it, so the math is correct regardless of layout-effect ordering.
export function Callouts({
  activeIndex,
  onSelect,
}: {
  activeIndex: number | null
  onSelect: (i: number) => void
}) {
  const groupRef = useRef<Group>(null)
  const scene = useThree((s) => s.scene)
  const [targets, setTargets] = useState<Record<string, [number, number, number]>>({})

  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    scene.updateMatrixWorld(true)
    const invGroup = new Matrix4().copy(g.matrixWorld).invert()
    const next: Record<string, [number, number, number]> = {}
    for (const h of hotspots) {
      if (!h.anchor) {
        next[h.id] = h.target
        continue
      }
      const box = new Box3()
      let found = false
      scene.traverse((n) => {
        if (n.name === h.anchor || (n.name && n.name.startsWith(h.anchor + '.'))) {
          box.expandByObject(n)
          found = true
        }
      })
      if (found && !box.isEmpty()) {
        const c = box.getCenter(new Vector3()).applyMatrix4(invGroup)
        next[h.id] = [c.x, c.y, c.z]
      } else {
        next[h.id] = h.target
      }
    }
    setTargets(next)
  }, [scene])

  return (
    <group ref={groupRef}>
      {hotspots.map((h, i) => (
        <Callout
          key={h.id}
          target={targets[h.id] ?? h.target}
          tag={h.tag}
          active={i === activeIndex}
          onSelect={() => onSelect(i)}
        />
      ))}
    </group>
  )
}

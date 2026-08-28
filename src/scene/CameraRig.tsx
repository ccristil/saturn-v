import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export type CamPose = {
  position: [number, number, number]
  lookAt: [number, number, number]
}

const DURATION = 1.0 // seconds
const ARC = 0.15 // fraction of travel distance the path bulges outward

function smootherstep(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function CameraRig({ pose }: { pose: CamPose }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  const from = useRef(new Vector3())
  const ctrl = useRef(new Vector3())
  const to = useRef(new Vector3())
  const fromTarget = useRef(new Vector3())
  const toTarget = useRef(new Vector3())
  const t = useRef(1) // 1 = settled, no animation in flight
  const key = useRef('')

  useFrame((_, delta) => {
    const poseKey = pose.position.join(',') + '|' + pose.lookAt.join(',')

    // A new pose starts a fresh tween from wherever the camera currently is.
    if (poseKey !== key.current) {
      key.current = poseKey
      from.current.copy(camera.position)
      to.current.set(pose.position[0], pose.position[1], pose.position[2])
      fromTarget.current.copy(controls ? controls.target : new Vector3())
      toTarget.current.set(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2])
      // Control point: midpoint pushed outward from origin for a curved path.
      const mid = from.current.clone().add(to.current).multiplyScalar(0.5)
      const outward = mid
        .clone()
        .normalize()
        .multiplyScalar(from.current.distanceTo(to.current) * ARC)
      ctrl.current.copy(mid.add(outward))
      t.current = 0
      if (controls) controls.enabled = false
    }

    if (t.current < 1) {
      t.current = Math.min(1, t.current + delta / DURATION)
      const e = smootherstep(t.current)
      const one = 1 - e
      // Quadratic bezier: (1-e)^2*from + 2(1-e)e*ctrl + e^2*to
      const p = from.current
        .clone()
        .multiplyScalar(one * one)
        .add(ctrl.current.clone().multiplyScalar(2 * one * e))
        .add(to.current.clone().multiplyScalar(e * e))
      camera.position.copy(p)
      if (controls) {
        controls.target.lerpVectors(fromTarget.current, toTarget.current, e)
        controls.update()
        if (t.current >= 1) controls.enabled = true
      } else {
        camera.lookAt(toTarget.current)
      }
    }
  })

  return null
}

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3, Matrix4, Object3D } from 'three'
import { applyStageIsolate, clearStageIsolate } from './isolate'
import { computeStageMoves, type StageMove } from './explode'

const MODEL_URL = `${import.meta.env.BASE_URL}models/saturn-v.glb`

// These three parts ship ~20 units off-axis in -Z in the source file. Pull each
// back so its center sits on the stack (world z = 0). Idempotent (guarded flag).
const DISPLACED = ['Interstage', 'S-II_Top', 'Instrument_Unit']

function fixDisplacedParts(root: Object3D) {
  if (root.userData.__displacementFixed) return
  root.updateMatrixWorld(true)
  root.traverse((node) => {
    if (!DISPLACED.includes(node.name)) return
    const box = new Box3().setFromObject(node)
    if (box.isEmpty()) return
    const c = box.getCenter(new Vector3()) // current world center
    const parent = node.parent
    if (!parent) {
      node.position.add(new Vector3(0, 0, -c.z))
    } else {
      parent.updateMatrixWorld(true)
      const inv = new Matrix4().copy(parent.matrixWorld).invert()
      const cur = c.clone().applyMatrix4(inv)
      const desired = new Vector3(c.x, c.y, 0).applyMatrix4(inv)
      node.position.add(desired.sub(cur))
    }
    node.updateMatrixWorld(true)
  })
  root.userData.__displacementFixed = true
}

const EXPLODE_S = 1.2 // seconds for the full separate/reassemble
function smootherstep(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function Stack({
  isolateStages,
  exploded = false,
}: {
  isolateStages?: string[]
  exploded?: boolean
}) {
  const { scene } = useGLTF(MODEL_URL)
  const moves = useRef<StageMove[]>([])
  const prog = useRef(0)

  // Run once, synchronously, before <Center> measures the bounds.
  useMemo(() => {
    fixDisplacedParts(scene)
    moves.current = computeStageMoves(scene)
  }, [scene])

  useEffect(() => {
    if (isolateStages && isolateStages.length) applyStageIsolate(scene, isolateStages)
    else clearStageIsolate(scene)
    return () => clearStageIsolate(scene)
  }, [isolateStages, scene])

  useFrame((_, delta) => {
    const goal = exploded ? 1 : 0
    if (prog.current === goal) return
    const dir = goal > prog.current ? 1 : -1
    prog.current = Math.max(0, Math.min(1, prog.current + (dir * delta) / EXPLODE_S))
    const e = smootherstep(prog.current)
    for (const m of moves.current) {
      m.node.position.copy(m.base).addScaledVector(m.offset, e)
    }
  })

  return <primitive object={scene} />
}

useGLTF.preload(MODEL_URL)

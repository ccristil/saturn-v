import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3, Matrix4, Object3D } from 'three'
import { applyStageIsolate, clearStageIsolate } from './isolate'
import { computeStageMoves, type StageMove } from './explode'
import { addSpacecraftTop } from './nosecone'
import { addMarkings } from './markings'
import { addWeathering } from './weathering'
import { applyMetallicLook } from './materials'
import { addEngineDetail } from './enginedetail'

const MODEL_URL = `${import.meta.env.BASE_URL}models/saturn-v.glb`

// Assemble the stack into one flush body:
//  - fixZ: the three connector rings ship ~20 units off-axis in -Z → pull to z = 0.
//  - dy: cumulative downward nudge (world units) to close the visible inter-stage
//    gaps; upper stages carry the shift of everything below them. Tuned visually.
// Idempotent (guarded flag). S-IC (base) is the fixed reference, so it's omitted.
const ASSEMBLE: { name: string; dy: number; fixZ: boolean }[] = [
  { name: 'Interstage', dy: -1.0, fixZ: true },
  { name: 'S-II', dy: -3.0, fixZ: false },
  { name: 'S-II_Top', dy: -4.0, fixZ: true },
  { name: 'S-IVB', dy: -7.0, fixZ: false },
  { name: 'Instrument_Unit', dy: -7.9, fixZ: true },
]

function fixDisplacedParts(root: Object3D) {
  if (root.userData.__displacementFixed) return
  root.updateMatrixWorld(true)
  root.traverse((node) => {
    const cfg = ASSEMBLE.find((f) => f.name === node.name)
    if (!cfg) return
    const box = new Box3().setFromObject(node)
    if (box.isEmpty()) return
    const c = box.getCenter(new Vector3()) // current world center
    const desiredWorld = new Vector3(c.x, c.y + cfg.dy, cfg.fixZ ? 0 : c.z)
    const parent = node.parent
    if (!parent) {
      node.position.add(desiredWorld.clone().sub(c))
    } else {
      parent.updateMatrixWorld(true)
      const inv = new Matrix4().copy(parent.matrixWorld).invert()
      const cur = c.clone().applyMatrix4(inv)
      const desired = desiredWorld.applyMatrix4(inv)
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
    addSpacecraftTop(scene) // rebuild the missing spacecraft + escape tower on top of the IU
    addMarkings(scene) // add the Apollo 11 markings (S-IC flag + red "USA", S-II "UNITED STATES")
    addWeathering(scene) // base scorch + body grime streaks (launch-day look)
    addEngineDetail(scene) // corrugated tube-wall ribs on the F-1 nozzles
    applyMetallicLook(scene) // metal reflects the environment; painted body stays satin
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

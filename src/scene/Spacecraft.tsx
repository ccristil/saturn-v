import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Group, Matrix4, Vector3, type Mesh, type Object3D } from 'three'
import { measureSaturnV, SATURN_V_M, SATURN_V_UNITS_FALLBACK } from './Compare'
import { applyLivery } from './livery'
import { buildCSM, LM_HATCH_Y } from './csm'

// The Apollo spacecraft as it flew once the Saturn V was done with it: the Command/
// Service Module docked nose-to-nose with the Lunar Module, the S-IVB left behind.
//
// The LM is a real model (CMFDesign's, CC BY 4.0). It stands the way it landed — legs
// out — and the legs are fused into the same meshes as everything else, so they can't be
// folded. That is exactly the configuration for the last two hours docked in lunar orbit:
// Apollo 11's gear went down during LM activation ("Landing Gear Deploy, Fire", 098:14:35
// GET) and Eagle undocked at about 100:12. The CSM isn't in any asset we have, so csm.ts
// builds it from primitives.
//
// Authored in metres and scaled by the live Saturn V's units-per-metre, so it parks beside
// the rocket at true size. The slow roll about the long axis echoes the "barbecue roll"
// flown on the way out and back — presentation licence: that roll was only ever flown with
// the gear stowed, never in lunar orbit.

const DEG = Math.PI / 180

// The model's proportions don't all agree with the real LM — its legs splay ~18% wider than
// the real 9.45 m footpad span — so it's scaled by its body: the descent stage (4.22 m
// across, 78.8 model units) and ascent stage (4.29 m, 80.7 units) agree on 0.0534 m per
// unit (measured with lab/measure-lm.cjs).
const LM_M_PER_UNIT = 0.0534
// The LM's overhead docking hatch, in the glb's own scene space: the centre of the flat
// hatch disc on the ascent stage roof. It sits LM_HATCH_Y up the CSM's axis.
const LM_HATCH = new Vector3(-1.35, 41.86, 65.9)
// Docked clocking: the LM's front (forward hatch, porch, ladder leg) sits 60° round from the
// CM's crew hatch toward the crew's right (CSM/LM Operational Data Book, Fig. 2-4). The
// model's ladder leg lies along its −X/+Z diagonal; after the flip that's 225° in the CSM's
// frame, so it's rolled a further −165°.
const LM_ROLL = -165 * DEG
// The model has its roof antennas erected as on the lunar surface; in flight they were
// stowed, and nothing on a real LM crosses the CM's outline. Anything standing more than
// `from` metres off the roof within [rMin, rMax] of the tunnel axis would spear the Command
// Module's cone, so it's squashed down to a stub (`keep` of its height above `from`).
const TRIM = { rMin: 0.58, rMax: 1.0, from: 0.25, keep: 0.15 }

function trimDockingAntennas(root: Object3D): void {
  if (root.userData.__dockTrimmed) return
  root.updateMatrixWorld(true)
  const toRoot = new Matrix4().copy(root.matrixWorld).invert()
  const v = new Vector3()
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const rel = toRoot.clone().multiply(mesh.matrixWorld)
    const back = rel.clone().invert()
    const pos = mesh.geometry.attributes.position
    let touched = false
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(rel)
      const r = Math.hypot(v.x - LM_HATCH.x, v.z - LM_HATCH.z) * LM_M_PER_UNIT
      const d = (v.y - LM_HATCH.y) * LM_M_PER_UNIT
      if (r < TRIM.rMin || r > TRIM.rMax || d <= TRIM.from) continue
      v.y = LM_HATCH.y + (TRIM.from + (d - TRIM.from) * TRIM.keep) / LM_M_PER_UNIT
      v.applyMatrix4(back)
      pos.setXYZ(i, v.x, v.y, v.z)
      touched = true
    }
    if (touched) {
      pos.needsUpdate = true
      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    }
  })
  root.userData.__dockTrimmed = true
}

// Built once and reused: the button can be toggled any number of times in a talk.
let csmCache: Group | null = null

export function preloadSpacecraft(model: string) {
  useGLTF.preload(`${import.meta.env.BASE_URL}${model}`)
}

export function Spacecraft({
  model,
  position,
  rotation,
  rollSpeed,
}: {
  model: string // the LM, path relative to BASE_URL
  position: [number, number, number] // where the middle of the stack floats, scene units
  rotation: [number, number, number] // orients the stack's long axis (Euler, radians)
  rollSpeed: number // roll about the long axis, radians per second
}) {
  const roll = useRef<Group>(null)
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}${model}`)
  const root = useThree((s) => s.scene)
  const csm = useMemo(() => (csmCache ??= buildCSM()), [])

  const fit = useMemo(() => {
    applyLivery(model, scene)
    trimDockingAntennas(scene)
    const sat = measureSaturnV(root)
    if (!sat) {
      // eslint-disable-next-line no-console
      console.warn('[Spacecraft] Saturn V not found in the scene — falling back to a fixed scale.')
    }
    const unitsPerM = (sat ? sat.max.y - sat.min.y : SATURN_V_UNITS_FALLBACK) / SATURN_V_M
    const box = new Box3().setFromObject(scene)
    const lmFar = (LM_HATCH.y - box.min.y) * LM_M_PER_UNIT // hatch to footpads, metres
    return { unitsPerM, mid: (LM_HATCH_Y + lmFar) / 2 }
  }, [scene, root, model])

  useFrame((_, delta) => {
    if (roll.current) roll.current.rotation.y += delta * rollSpeed
  })

  // Stack axis is local +Y: engine bell at 0, CM docking ring at DOCK_Y, then the LM
  // hanging off it upside down (its roof on the CM, its gear furthest out).
  return (
    <group position={position} rotation={rotation}>
      <group scale={fit.unitsPerM}>
        <group ref={roll}>
          <group position-y={-fit.mid}>
            <primitive object={csm} />
            <group position-y={LM_HATCH_Y} rotation-y={LM_ROLL}>
              <group rotation-x={Math.PI} scale={LM_M_PER_UNIT}>
                <group position={[-LM_HATCH.x, -LM_HATCH.y, -LM_HATCH.z]}>
                  <primitive object={scene} />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

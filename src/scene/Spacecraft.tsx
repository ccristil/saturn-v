import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { measureSaturnV, SATURN_V_M, SATURN_V_UNITS_FALLBACK } from './Compare'
import { applyLivery } from './livery'

// The Apollo spacecraft as it flew once the Saturn V was done with it: the Command/
// Service Module docked nose-to-nose with the Lunar Module, the S-IVB left behind.
//
// The LM is a real model (CMFDesign's, CC BY 4.0). It stands the way it landed — legs
// out — and the legs are fused into the same meshes as everything else, so they can't be
// folded. That matches lunar orbit just before undocking, once the crew had deployed the
// gear; on the coast out they were still stowed. The CSM isn't in any asset we have, so
// it's built here from primitives, as nosecone.ts builds the launch configuration — this
// time without the boost cover (it left with the escape tower), so the bare Command
// Module cone and the Service Module's engine bell show.
//
// Authored in metres and scaled by the live Saturn V's units-per-metre, so it parks
// beside the rocket at true size. The whole stack rolls slowly about its long axis — the
// "barbecue roll" the real one flew to keep the sun from cooking one side.

const LM_HEIGHT_M = 7.04 // footpads to the top of the ascent stage, gear deployed
// The LM's overhead docking hatch, in the glb's own scene space: the centre of the flat
// hatch disc on the ascent stage roof. The CSM's apex mates here.
const LM_HATCH = new Vector3(-1.35, 41.86, 65.9)

// CSM proportions, metres — close enough to read as the real thing, not a drawing.
const SM_R = 1.955 // the CM and SM share this radius (3.91 m across)
const NOZZLE = { length: 2.8, exitR: 1.25, throatR: 0.5 } // the part standing out of the SM
const SM_LENGTH = 4.7 // body only; 7.5 m with the bell
const CM = { length: 2.95, topR: 0.55 }
// The docking tunnel between the CM's apex and the LM hatch. A little longer than life:
// the model's VHF antenna stands proud of the LM roof and would otherwise spear the cone.
const NECK = { length: 0.6, r: 0.42 }
const DOCK_Y = NOZZLE.length + SM_LENGTH + CM.length + NECK.length

// Built once and reused: the button can be toggled any number of times in a talk.
let csmCache: Group | null = null

function buildCSM(): Group {
  const g = new Group()
  g.name = 'CSM'
  const smMat = new MeshStandardMaterial({ color: 0xcdd2d8, metalness: 0.6, roughness: 0.4 })
  // the CM flew wrapped in aluminised Mylar — close to a mirror
  const cmMat = new MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.85, roughness: 0.25 })
  const bellMat = new MeshStandardMaterial({ color: 0x3a3e45, metalness: 0.6, roughness: 0.45, side: DoubleSide })
  const shieldMat = new MeshStandardMaterial({ color: 0x5a4a3a, metalness: 0.2, roughness: 0.7 })
  const add = (geo: CylinderGeometry | BoxGeometry, mat: MeshStandardMaterial, y: number) => {
    const m = new Mesh(geo, mat)
    m.position.y = y
    g.add(m)
    return m
  }

  // Engine bell (open, so it reads as a bell and not a solid cone), then the SM body.
  let y = 0
  add(new CylinderGeometry(NOZZLE.throatR, NOZZLE.exitR, NOZZLE.length, 40, 1, true), bellMat, NOZZLE.length / 2)
  y += NOZZLE.length
  add(new CylinderGeometry(SM_R, SM_R, SM_LENGTH, 48), smMat, y + SM_LENGTH / 2)
  // The four RCS thruster quads, up near the SM's forward end.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4
    const quad = add(new BoxGeometry(0.22, 0.9, 0.7), smMat, y + SM_LENGTH - 1.0)
    quad.position.x = Math.cos(a) * (SM_R + 0.11)
    quad.position.z = Math.sin(a) * (SM_R + 0.11)
    quad.rotation.y = -a // local x points radially out
  }
  y += SM_LENGTH

  // Command Module: the heat-shield rim, the cone, the docking tunnel.
  add(new CylinderGeometry(SM_R + 0.01, SM_R + 0.01, 0.1, 48), shieldMat, y + 0.05)
  add(new CylinderGeometry(CM.topR, SM_R, CM.length, 48), cmMat, y + CM.length / 2)
  y += CM.length
  add(new CylinderGeometry(NECK.r, NECK.r, NECK.length, 24), smMat, y + NECK.length / 2)
  return g
}

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
  rollSpeed: number // barbecue roll about the long axis, radians per second
}) {
  const roll = useRef<Group>(null)
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}${model}`)
  const root = useThree((s) => s.scene)
  const csm = useMemo(() => (csmCache ??= buildCSM()), [])

  const fit = useMemo(() => {
    applyLivery(model, scene)
    const sat = measureSaturnV(root)
    if (!sat) {
      // eslint-disable-next-line no-console
      console.warn('[Spacecraft] Saturn V not found in the scene — falling back to a fixed scale.')
    }
    const unitsPerM = (sat ? sat.max.y - sat.min.y : SATURN_V_UNITS_FALLBACK) / SATURN_V_M
    const box = new Box3().setFromObject(scene)
    const lmScale = LM_HEIGHT_M / (box.max.y - box.min.y) // metres per LM model unit
    const lmFar = (LM_HATCH.y - box.min.y) * lmScale // hatch to footpads, metres
    return { unitsPerM, lmScale, mid: (DOCK_Y + lmFar) / 2 }
  }, [scene, root, model])

  useFrame((_, delta) => {
    if (roll.current) roll.current.rotation.y += delta * rollSpeed
  })

  // Stack axis is local +Y: engine bell at 0, CM apex at DOCK_Y, then the LM hanging
  // off it upside down (its roof on the CM, its gear furthest out).
  return (
    <group position={position} rotation={rotation}>
      <group scale={fit.unitsPerM}>
        <group ref={roll}>
          <group position-y={-fit.mid}>
            <primitive object={csm} />
            <group position-y={DOCK_Y} rotation-x={Math.PI} scale={fit.lmScale}>
              <group position={[-LM_HATCH.x, -LM_HATCH.y, -LM_HATCH.z]}>
                <primitive object={scene} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

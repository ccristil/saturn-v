import {
  Object3D,
  Group,
  Mesh,
  Box3,
  Vector3,
  Quaternion,
  Matrix4,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  MeshStandardMaterial,
  type Material,
} from 'three'

// The devPilot GLB is a launch-vehicle-only model: its topmost geometry is the
// Instrument Unit ring, so the stack ends flat with no spacecraft or escape tower.
// This rebuilds the missing top — Spacecraft-LM Adapter, Command/Service Module,
// Boost Protective Cover, and Launch Escape System — from primitives, in the spirit
// of the "primitives for the parts the model doesn't have" fallback. No new asset;
// works wifi-off. Sections follow the on-pad reference photo (bottom → top): SLA
// white flare, black adapter band, service module, boost protective cover (white
// cone over the command module), an open-lattice escape tower, the escape motor
// canister, and the nose probe at the tip.
//
// Everything is sized as a multiple of the Instrument Unit's measured radius R
// (real IU radius ≈ 3.302 m), so the assembly scales to whatever the model reports
// at runtime and stays flush with the real ring — it can't drift the way hand-typed
// coordinates can. Attached as a child of the `Instrument_Unit` node so it rides the
// explode animation and dims with isolate exactly like the top stage it sits on.

// Palette — kept close to the model's own body so the new top reads as one vehicle,
// not a bolted-on gray cap. The escape tower is a lightened metallic gray (a truss,
// not a solid black spike) so it sits with the rest of the rocket instead of against it.
const BODY = 0xdadee4 // white body panels (SLA / service module)
const COVER = 0xe7eaef // boost protective cover — the brightest white, like the ref
const BAND = 0x2b313b // dark bands/rings — charcoal, not pure black
const TOWER = 0x969ca4 // escape tower truss — lightened metallic gray
const MOTOR = 0xd7d0c2 // escape solid-rocket motor — pale tan canister
const PROBE = 0x3d434c // nose probe / Q-ball — dark, thin

// Smooth stacked sections, bottom → top. A `frustum` is a (possibly straight)
// cylinder section; a `cone` tapers to a point. Thin frustums double as dark bands.
type Piece = {
  kind: 'frustum' | 'cone'
  rBottom: number // × R
  rTop: number // × R (ignored for cone — apex is a point)
  height: number // × R
  gap: number // × R — vertical offset from the previous piece's top (overlap if < 0)
  color: number
  metalness: number
  roughness: number
}

// Bottom of the stack up to the boost protective cover. The escape tower + motor +
// probe are built separately above this (the tower is a truss, not a stacked solid).
const LOWER: Piece[] = [
  // Spacecraft-LM Adapter — the big white flare from the IU diameter to the CSM.
  { kind: 'frustum', rBottom: 1.0, rTop: 0.62, height: 2.4, gap: 0, color: BODY, metalness: 0.35, roughness: 0.55 },
  // Black adapter band — the distinctive dark ring with position markings in the ref.
  { kind: 'frustum', rBottom: 0.635, rTop: 0.635, height: 0.24, gap: 0, color: BAND, metalness: 0.4, roughness: 0.6 },
  // Service Module — white cylinder at the CSM diameter.
  { kind: 'frustum', rBottom: 0.62, rTop: 0.6, height: 0.95, gap: 0, color: BODY, metalness: 0.4, roughness: 0.5 },
  // Command-module interface ring.
  { kind: 'frustum', rBottom: 0.62, rTop: 0.62, height: 0.08, gap: 0, color: BAND, metalness: 0.4, roughness: 0.6 },
  // Boost Protective Cover — the clean white cone over the command module.
  { kind: 'frustum', rBottom: 0.6, rTop: 0.16, height: 1.55, gap: 0, color: COVER, metalness: 0.28, roughness: 0.5 },
]

// Escape tower (open truss) geometry, all × R.
const TOWER_H = 2.6
const TOWER_BASE = 0.3 // half-spread of the legs at the bottom (splayed A-frame)
const TOWER_TOP = 0.07 // half-spread near the top
const TOWER_OVERLAP = 0.2 // dip the legs into the cover shoulder
const LEG_R = 0.03
const RING_TUBE = 0.022

// Add a thin strut between two local points (used for the truss legs).
function strut(group: Group, a: Vector3, b: Vector3, radius: number, mat: Material): void {
  const dir = new Vector3().subVectors(b, a)
  const len = dir.length()
  const mesh = new Mesh(new CylinderGeometry(radius, radius, len, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize())
  group.add(mesh)
}

export function addSpacecraftTop(root: Object3D): void {
  if (root.userData.__noseAdded) return

  let iu: Object3D | undefined
  root.traverse((n) => {
    if (!iu && n.name === 'Instrument_Unit') iu = n
  })
  if (!iu) return

  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(iu)
  if (box.isEmpty()) return
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const R = Math.max(size.x, size.z) / 2 // IU body radius, in world units
  const topY = box.max.y

  const group = new Group()
  group.name = 'Spacecraft_Top'

  // --- Smooth stacked sections: SLA → cover ---
  let cursor = 0 // world units above the IU top, running upward
  for (const p of LOWER) {
    const h = p.height * R
    const geo =
      p.kind === 'cone'
        ? new ConeGeometry(p.rBottom * R, h, 48)
        : new CylinderGeometry(p.rTop * R, p.rBottom * R, h, 48)
    const mat = new MeshStandardMaterial({ color: p.color, metalness: p.metalness, roughness: p.roughness })
    const mesh = new Mesh(geo, mat)
    cursor += p.gap * R
    mesh.position.y = cursor + h / 2
    group.add(mesh)
    cursor += h
  }

  // --- Launch Escape tower: open A-frame lattice (4 tapering legs + cross rings) ---
  const towerMat = new MeshStandardMaterial({ color: TOWER, metalness: 0.6, roughness: 0.45 })
  const yBottom = cursor - TOWER_OVERLAP * R
  const yTop = yBottom + TOWER_H * R
  const baseH = TOWER_BASE * R
  const topH = TOWER_TOP * R
  // Legs on the ±X and ±Z axes so a front-on view reads as a clean converging A-frame.
  for (const [ax, az] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    strut(
      group,
      new Vector3(ax * baseH, yBottom, az * baseH),
      new Vector3(ax * topH, yTop, az * topH),
      LEG_R * R,
      towerMat,
    )
  }
  // Horizontal cross rings suggest the lattice bays.
  for (const f of [0.06, 0.32, 0.58, 0.84, 1]) {
    const ry = yBottom + f * (yTop - yBottom)
    const rr = baseH + (topH - baseH) * f
    const ring = new Mesh(new TorusGeometry(rr, RING_TUBE * R, 8, 20), towerMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = ry
    group.add(ring)
  }

  // --- Escape motor canister + nose probe, stacked above the tower ---
  const motorMat = new MeshStandardMaterial({ color: MOTOR, metalness: 0.4, roughness: 0.5 })
  const probeMat = new MeshStandardMaterial({ color: PROBE, metalness: 0.5, roughness: 0.5 })
  const motorH = 0.95 * R
  const motor = new Mesh(new CylinderGeometry(0.13 * R, 0.15 * R, motorH, 24), motorMat)
  motor.position.y = yTop + motorH / 2
  group.add(motor)
  const capH = 0.3 * R
  const cap = new Mesh(new ConeGeometry(0.13 * R, capH, 24), motorMat)
  cap.position.y = yTop + motorH + capH / 2
  group.add(cap)
  const probeH = 0.7 * R
  const probe = new Mesh(new CylinderGeometry(0.012 * R, 0.03 * R, probeH, 10), probeMat)
  probe.position.y = yTop + motorH + capH + probeH / 2
  group.add(probe)

  // --- Parent the assembly to the IU node, preserving the desired world transform ---
  // Desired world transform: sit on the IU top center, world-up, unit scale.
  const worldM = new Matrix4().compose(
    new Vector3(center.x, topY, center.z),
    new Quaternion(),
    new Vector3(1, 1, 1),
  )
  // Express that as a transform local to the IU node (robust to the model's up-axis
  // rotation / scale), then parent to it so it inherits explode + isolate.
  iu.updateWorldMatrix(true, false)
  const local = new Matrix4().copy(iu.matrixWorld).invert().multiply(worldM)
  local.decompose(group.position, group.quaternion, group.scale)
  iu.add(group)
  iu.updateMatrixWorld(true)

  root.userData.__noseAdded = true
}

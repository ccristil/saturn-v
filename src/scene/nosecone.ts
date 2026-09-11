import {
  Object3D,
  Group,
  Mesh,
  Box3,
  Vector3,
  Quaternion,
  Matrix4,
  CircleGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  MeshStandardMaterial,
  DoubleSide,
  FrontSide,
  type Material,
  type Side,
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
//
// It's built to come apart, for the Spacecraft button's transposition and docking
// (Spacecraft.tsx drives it): the adapter's lower 7 ft is a fixed ring that stays on the
// S-IVB and its upper 21 ft is four panels hinged at their base, the black band along their
// top edge; the service module + interface ring are one group (`Nose_CSM`, swapped for the
// detailed CSM while that plays) and the cover + escape tower another (`LES`, jettisoned).
// At rest every piece sits exactly where the single-piece version did.

// Palette — kept close to the model's own body so the new top reads as one vehicle,
// not a bolted-on gray cap. The escape tower is a lightened metallic gray (a truss,
// not a solid black spike) so it sits with the rest of the rocket instead of against it.
const BODY = 0xdadee4 // white body panels (SLA / service module)
const COVER = 0xe7eaef // boost protective cover — the brightest white, like the ref
const BAND = 0x2b313b // dark bands/rings — charcoal, not pure black
const TOWER = 0x969ca4 // escape tower truss — lightened metallic gray
const MOTOR = 0xd7d0c2 // escape solid-rocket motor — pale tan canister
const PROBE = 0x3d434c // nose probe / Q-ball — dark, thin
const DECK = 0x4b5058 // the S-IVB's forward deck under the LM — only seen with the adapter open

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

// The adapter's split: a fixed lower ring stays with the S-IVB, four panels above. Drawn
// shorter than the real one (7 ft of 28): the LM model's stowed legs are longer than the
// real LM's, so it perches on this ring's rim rather than standing inside it.
const SLA_FIXED = 0.1
const PANEL_SPAN = Math.PI / 2

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
  const material = (p: Piece, side: Side = FrontSide) =>
    new MeshStandardMaterial({ color: p.color, metalness: p.metalness, roughness: p.roughness, side })
  const [sla, band, sm, ring, cover] = LOWER

  // --- Spacecraft-LM Adapter: a fixed lower ring + four panels (double-sided — once they
  // open, their insides show) ---
  const slaH = sla.height * R
  const bandH = band.height * R
  const fixedH = SLA_FIXED * slaH
  const rAt = (y: number) => (sla.rBottom + ((sla.rTop - sla.rBottom) * y) / slaH) * R
  const slaMat = material(sla, DoubleSide)
  const fixed = new Mesh(new CylinderGeometry(rAt(fixedH), rAt(0), fixedH, 48, 1, true), slaMat)
  fixed.name = 'SLA_Fixed'
  fixed.position.y = fixedH / 2
  group.add(fixed)
  const deck = new Mesh(new CircleGeometry(rAt(0), 48), new MeshStandardMaterial({ color: DECK, metalness: 0.3, roughness: 0.7 }))
  deck.name = 'SLA_Deck'
  deck.rotation.x = -Math.PI / 2
  deck.position.y = 0.01 * R
  group.add(deck)
  // Each panel hangs from a pivot on the chord between its bottom corners, so it swings out
  // about that line (rotation.x of `SLA_Panel_k_Open`) with its corners staying put.
  const bandMat = material(band, DoubleSide)
  const panelH = slaH - fixedH
  const chord = rAt(fixedH) * Math.cos(PANEL_SPAN / 2)
  for (let k = 0; k < 4; k++) {
    const phi = PANEL_SPAN / 2 + k * PANEL_SPAN
    const hinge = new Group()
    hinge.name = `SLA_Panel_${k}`
    hinge.position.set(Math.sin(phi) * chord, fixedH, Math.cos(phi) * chord)
    hinge.rotation.y = phi
    hinge.userData.rest = hinge.position.clone()
    const open = new Group()
    open.name = `SLA_Panel_${k}_Open`
    const arc = (rTop: number, rBottom: number, h: number, y: number, mat: Material) => {
      const geo = new CylinderGeometry(rTop, rBottom, h, 12, 1, true, -PANEL_SPAN / 2, PANEL_SPAN)
      geo.translate(0, y + h / 2, -chord)
      open.add(new Mesh(geo, mat))
    }
    arc(rAt(slaH), rAt(fixedH), panelH, 0, slaMat)
    arc(band.rTop * R, band.rBottom * R, bandH, panelH, bandMat)
    hinge.add(open)
    group.add(hinge)
  }

  // --- Service module + CM interface ring, then the boost protective cover ---
  let cursor = slaH + bandH // world units above the IU top, running upward
  const stack = (p: Piece, parent: Group, base = 0) => {
    const h = p.height * R
    const geo =
      p.kind === 'cone'
        ? new ConeGeometry(p.rBottom * R, h, 48)
        : new CylinderGeometry(p.rTop * R, p.rBottom * R, h, 48)
    const mesh = new Mesh(geo, material(p))
    cursor += p.gap * R
    mesh.position.y = cursor + h / 2 - base
    parent.add(mesh)
    cursor += h
  }
  const noseCSM = new Group()
  noseCSM.name = 'Nose_CSM'
  stack(sm, noseCSM)
  stack(ring, noseCSM)
  group.add(noseCSM)
  // The escape system is one group with its origin at the cover's base, so it can fly off
  // and pitch over about its own foot.
  const les = new Group()
  les.name = 'LES'
  const lesBase = cursor
  les.position.y = lesBase
  les.userData.rest = les.position.clone()
  stack(cover, les, lesBase)
  group.add(les)

  // --- Launch Escape tower: open A-frame lattice (4 tapering legs + cross rings) ---
  const towerMat = new MeshStandardMaterial({ color: TOWER, metalness: 0.6, roughness: 0.45 })
  const yBottom = cursor - TOWER_OVERLAP * R - lesBase
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
      les,
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
    const ringMesh = new Mesh(new TorusGeometry(rr, RING_TUBE * R, 8, 20), towerMat)
    ringMesh.rotation.x = Math.PI / 2
    ringMesh.position.y = ry
    les.add(ringMesh)
  }

  // --- Escape motor canister + nose probe, stacked above the tower ---
  const motorMat = new MeshStandardMaterial({ color: MOTOR, metalness: 0.4, roughness: 0.5 })
  const probeMat = new MeshStandardMaterial({ color: PROBE, metalness: 0.5, roughness: 0.5 })
  const motorH = 0.95 * R
  const motor = new Mesh(new CylinderGeometry(0.13 * R, 0.15 * R, motorH, 24), motorMat)
  motor.position.y = yTop + motorH / 2
  les.add(motor)
  const capH = 0.3 * R
  const cap = new Mesh(new ConeGeometry(0.13 * R, capH, 24), motorMat)
  cap.position.y = yTop + motorH + capH / 2
  les.add(cap)
  const probeH = 0.7 * R
  const probe = new Mesh(new CylinderGeometry(0.012 * R, 0.03 * R, probeH, 10), probeMat)
  probe.position.y = yTop + motorH + capH + probeH / 2
  les.add(probe)

  // The layout Spacecraft.tsx needs to fit the real spacecraft to this adapter (world units,
  // above the IU top): R sets its scale, the band's top is where the service module sits.
  group.userData.tde = { R, fixedTop: fixedH, bandTop: slaH + bandH }

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

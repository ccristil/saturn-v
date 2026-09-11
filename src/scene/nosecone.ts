import {
  Object3D,
  Group,
  Mesh,
  Box3,
  Vector2,
  Vector3,
  Quaternion,
  Matrix4,
  CircleGeometry,
  CylinderGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  DoubleSide,
  FrontSide,
  type BufferGeometry,
  type Material,
  type Side,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CM_HALF_ANGLE, CM_SHOULDER_TUBE, CM_STATIONS as CM, SM_AFT_Y, SM_RADIUS, coneR } from './csm'

// The devPilot GLB is a launch-vehicle-only model: its topmost geometry is the
// Instrument Unit ring, so the stack ends flat with no spacecraft or escape tower.
// This rebuilds the missing top — Spacecraft-LM Adapter, Command/Service Module,
// Boost Protective Cover, and Launch Escape System — from primitives, in the spirit
// of the "primitives for the parts the model doesn't have" fallback. No new asset;
// works wifi-off. Sections follow the on-pad reference photo (bottom → top): SLA
// white flare, black adapter band, service module, boost protective cover (white
// cone over the command module), an open-lattice escape tower, the escape motor,
// and the nose cone and Q-ball at the tip.
//
// Everything is sized off the Instrument Unit's measured radius R (real IU radius ≈
// 3.302 m), so the assembly scales to whatever the model reports at runtime and stays
// flush with the real ring — it can't drift the way hand-typed coordinates can. The
// adapter is authored in multiples of R; from the service module up it's real size, in
// metres × (R / 3.302), taken from the detailed CSM in csm.ts — so the service module
// matches the one the Spacecraft button swaps in, and the cover fits the command module
// it comes off. Attached as a child of the `Instrument_Unit` node so it rides the
// explode animation and dims with isolate exactly like the top stage it sits on.
//
// It's built to come apart, for the Spacecraft button's transposition and docking
// (Spacecraft.tsx drives it): the adapter's lower 7 ft is a fixed ring that stays on the
// S-IVB and its upper 21 ft is four panels hinged at their base, the black band along their
// top edge; the service module is one group (`Nose_CSM`, swapped for the detailed CSM while
// that plays) and the cover + escape tower another (`LES`, jettisoned). At rest every piece
// sits exactly where the single-piece version did.

// Palette — kept close to the model's own body so the new top reads as one vehicle,
// not a bolted-on gray cap. The escape tower is a lightened metallic gray (a truss,
// not a solid black spike) so it sits with the rest of the rocket instead of against it.
const BODY = 0xdadee4 // white body panels (SLA / service module)
const COVER = 0xe7eaef // boost protective cover — the brightest white, like the ref
const BAND = 0x2b313b // dark bands/rings — charcoal, not pure black
const TOWER = 0x969ca4 // escape tower truss — lightened metallic gray
const MOTOR = 0xd7d0c2 // escape solid-rocket motor — pale tan canister
const PROBE = 0x3d434c // the escape motor's nozzles and the Q-ball at the tip — dark
const DECK = 0x4b5058 // the S-IVB's forward deck under the LM — only seen with the adapter open

// The real Instrument Unit's radius. R is the model's, so R / IU_RADIUS_M is scene units per
// metre — Spacecraft.tsx sizes the real spacecraft by the same ratio.
export const IU_RADIUS_M = 3.302

const DEG = Math.PI / 180
const UP = new Vector3(0, 1, 0)

// A (possibly tapered) section of the adapter. Thin ones double as dark bands.
type Piece = {
  rBottom: number // × R
  rTop: number // × R
  height: number // × R
  color: number
  metalness: number
  roughness: number
}

const LOWER: Piece[] = [
  // Spacecraft-LM Adapter — the big white flare from the IU diameter to the CSM.
  { rBottom: 1.0, rTop: 0.62, height: 2.4, color: BODY, metalness: 0.35, roughness: 0.55 },
  // Black adapter band — the distinctive dark ring with position markings in the ref.
  { rBottom: 0.635, rTop: 0.635, height: 0.24, color: BAND, metalness: 0.4, roughness: 0.6 },
]

// The adapter's split: a fixed lower ring stays with the S-IVB, four panels above. Drawn
// shorter than the real one (7 ft of 28): the LM model's stowed legs are longer than the
// real LM's, so it perches on this ring's rim rather than standing inside it.
const SLA_FIXED = 0.1
const PANEL_SPAN = Math.PI / 2

// From the service module up, in metres at csm.ts's stations.
const COVER_GAP = 0.03 // the boost protective cover stands this far off the command module's skin
const COVER_CAP = 0.45 // radius of the rounded cap closing it over the docking ring and probe
// Launch escape system (Apollo Operations Handbook): a 10 ft titanium truss on the CM's tower
// wells — square, ~4 ft across at its foot and ~2 ft under the motor — then the 26 in escape
// motor (15 ft 3 in, its four nozzles canted 35° out at its base), the tower jettison motor
// (47 in), and the nose cone and Q-ball: 33 ft from the tower's foot to the tip.
const TRUSS_H = 3.05
const TRUSS_TOP = 0.42 // the corners' radius under the motor
const TRUSS_FRAMES = [0.8, 1.55, 2.3] // square frames, metres above the foot — the first clears the cover's cap
const MOTOR_R = 0.33

// A thin strut between two points — tapered if rb is given — as geometry to merge.
function strut(a: Vector3, b: Vector3, ra: number, rb = ra, segments = 8): BufferGeometry {
  const dir = new Vector3().subVectors(b, a)
  const geo = new CylinderGeometry(rb, ra, dir.length(), segments)
  geo.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()))
  const mid = a.clone().add(b).multiplyScalar(0.5)
  return geo.translate(mid.x, mid.y, mid.z)
}

// Parts that share a material, merged into one mesh — one draw call.
function merged(geos: BufferGeometry[], mat: Material, name: string): Object3D {
  const geo = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  if (!geo) {
    // eslint-disable-next-line no-console
    console.error(`[nosecone] could not merge the ${name} parts`)
    return new Object3D()
  }
  const mesh = new Mesh(geo, mat)
  mesh.name = name
  return mesh
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
  const std = (color: number, metalness: number, roughness: number, side: Side = FrontSide) =>
    new MeshStandardMaterial({ color, metalness, roughness, side })
  const material = (p: Piece, side: Side = FrontSide) => std(p.color, p.metalness, p.roughness, side)
  const [sla, band] = LOWER

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

  // ================= From the service module up: real size, metres × m =================
  const m = R / IU_RADIUS_M // scene units per metre
  const bandTop = slaH + bandH

  // --- Service module, up to the fairing the CM sits in. The Spacecraft button swaps it for
  // the detailed CSM, whose SM sits on the band just the same ---
  const smH = (CM.fairingTop - SM_AFT_Y) * m
  const sm = new Mesh(new CylinderGeometry(SM_RADIUS * m, SM_RADIUS * m, smH, 48), std(BODY, 0.4, 0.5))
  sm.position.y = bandTop + smH / 2
  const noseCSM = new Group()
  noseCSM.name = 'Nose_CSM'
  noseCSM.add(sm)
  group.add(noseCSM)

  // --- The escape system is one group with its origin at the cover's base, so it can fly off
  // and pitch over about its own foot ---
  const les = new Group()
  les.name = 'LES'
  les.position.y = bandTop + smH
  les.userData.rest = les.position.clone()
  group.add(les)
  const ly = (y: number) => (y - CM.fairingTop) * m // a CSM station → up from the cover's base

  // Boost protective cover: the CM's own outline stood COVER_GAP off it — round the toroidal
  // shoulder, then straight up the 33° sidewall — closed over the docking ring and probe by a
  // rounded cap (a sphere on the axis, tangent to the sidewall).
  const ha = CM_HALF_ANGLE
  const tube = CM_SHOULDER_TUBE + COVER_GAP
  const shoulder = SM_RADIUS - CM_SHOULDER_TUBE // the shoulder's centre ring: the CM is SM-wide there
  const outline: [number, number][] = [
    [0, CM.fairingTop - 0.02],
    [SM_RADIUS - 0.02, CM.fairingTop - 0.02], // tucked into the SM's top edge
  ]
  for (let i = 0; i <= 9; i++) {
    const a = -30 * DEG + ((ha + 30 * DEG) * i) / 9
    outline.push([shoulder + tube * Math.cos(a), CM.shoulder + tube * Math.sin(a)])
  }
  const wall = coneR(0) + COVER_GAP / Math.cos(ha) // the stood-off sidewall: r = wall − y·tan(ha)
  const capY = (wall - COVER_CAP / Math.cos(ha)) / Math.tan(ha)
  for (let i = 0; i <= 6; i++) {
    const a = ha + ((Math.PI / 2 - ha) * i) / 6
    outline.push([COVER_CAP * Math.cos(a), capY + COVER_CAP * Math.sin(a)])
  }
  const cover = new Mesh(new LatheGeometry(outline.map(([r, y]) => new Vector2(r * m, ly(y))), 64), std(COVER, 0.28, 0.5))
  cover.name = 'LES_Cover'
  les.add(cover)

  // Launch escape tower: four legs bolted down through the cover onto the CM's tower wells, a
  // square truss narrowing under the motor, framed and X-braced in three bays.
  const foot = CM.towerWell
  const head = foot + TRUSS_H
  const corner = (c: number, y: number) => {
    const r = coneR(foot) + ((TRUSS_TOP - coneR(foot)) * (y - foot)) / TRUSS_H
    const phi = (45 + 90 * c) * DEG // on the diagonals, so a front view reads as the classic tapered truss
    return new Vector3(Math.sin(phi) * r * m, ly(y), Math.cos(phi) * r * m)
  }
  const levels = [...TRUSS_FRAMES.map((d) => foot + d), head]
  const truss: BufferGeometry[] = []
  for (let c = 0; c < 4; c++) {
    truss.push(strut(corner(c, foot), corner(c, head), 0.08 * m)) // leg
    for (let i = 0; i < levels.length - 1; i++) {
      const [y0, y1] = [levels[i], levels[i + 1]]
      truss.push(
        strut(corner(c, y0), corner(c + 1, y0), 0.05 * m), // frame
        strut(corner(c, y0), corner(c + 1, y1), 0.04 * m), // X-bracing
        strut(corner(c + 1, y0), corner(c, y1), 0.04 * m),
      )
    }
  }
  les.add(merged(truss, std(TOWER, 0.6, 0.45), 'LES_Tower'))

  // Escape motor + tower jettison motor on the tower's head, then the nose cone (where the
  // canards fold) and the Q-ball; the escape motor's four nozzles poke out between the legs.
  const section = (rBottom: number, rTop: number, y0: number, y1: number) =>
    new CylinderGeometry(rTop * m, rBottom * m, (y1 - y0) * m, 32).translate(0, ly((y0 + y1) / 2), 0)
  les.add(
    merged(
      [
        section(TRUSS_TOP, MOTOR_R, head - 0.05, head + 0.4), // the escape motor's skirt
        section(MOTOR_R, MOTOR_R, head + 0.4, head + 5.84), // escape motor, then tower jettison motor
        section(MOTOR_R, 0.1, head + 5.84, head + 6.74), // nose cone
      ],
      std(MOTOR, 0.4, 0.5),
      'LES_Motor',
    ),
  )
  const dark: BufferGeometry[] = [section(0.1, 0, head + 6.74, head + 7.02)] // Q-ball
  const cant = 35 * DEG
  for (let c = 0; c < 4; c++) {
    const phi = c * 90 * DEG
    const out = new Vector3(Math.sin(phi) * Math.sin(cant), -Math.cos(cant), Math.cos(phi) * Math.sin(cant))
    const throat = new Vector3(Math.sin(phi) * 0.26 * m, ly(head + 0.12), Math.cos(phi) * 0.26 * m)
    dark.push(strut(throat, throat.clone().addScaledVector(out, 0.34 * m), 0.07 * m, 0.15 * m, 16))
  }
  les.add(merged(dark, std(PROBE, 0.5, 0.5), 'LES_Nozzles'))

  // The layout Spacecraft.tsx needs to fit the real spacecraft to this adapter (world units,
  // above the IU top): R sets its scale, the band's top is where the service module sits.
  group.userData.tde = { R, fixedTop: fixedH, bandTop }

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

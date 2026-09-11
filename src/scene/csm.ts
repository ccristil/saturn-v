import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  Shape,
  SphereGeometry,
  SplineCurve,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// The Apollo Block II Command/Service Module — Apollo 11's "Columbia" — rebuilt from
// primitives, as it flew in lunar orbit: launch escape tower and boost cover long gone,
// high-gain antenna swung out, docked at the apex to the Lunar Module.
//
// Dimensions come from the Apollo Operations Handbook's station numbers (Fig 1-2), the
// Apollo Spacecraft News Reference and NASA's CM shape reports; finishes from the
// flight photos (AS11-37-5443/5444/5446, AS09-20-3064) and the pre-flight colour shot of
// this exact vehicle, S69-32370. Where sources disagree the choice is noted.
//
// Authored in metres along +Y: y is the height above the engine bell's exit plane, and
// the docking-ring face — where the LM mates — is at DOCK_Y. Clock angles (phi) run about
// that axis from the CM's crew hatch (NASA −Z) toward the crew's right (NASA +Y), which
// lands the hatch on +Z and +Y on +X — the same sense CylinderGeometry/LatheGeometry use.
//
// It's a lot of small parts, merged into one mesh per material — per module, so the service
// module can be let go on its own (Homecoming.tsx) — so the whole vehicle is about twenty-five
// draw calls; it still has to hold 60fps on integrated graphics. The two
// booms that rode folded for launch (high-gain antenna, EVA floodlight) merge separately,
// onto pivots, so Spacecraft.tsx can swing them out.

const DEG = Math.PI / 180
const R = 1.956 // the CM's widest point and the SM share this radius: 154 in (3.91 m) across

// --- Stations, metres above the bell's exit (AOH Fig 1-2 via X_S/X_C station numbers) ---
const H = {
  smAft: 2.972, // SM aft bulkhead (X_S 200) — 9 ft 9 in of bell shows below it
  quad: 6.045, // RCS quad centres, 2 ft 10 in below the SM top
  smTop: 6.909, // SM forward bulkhead / fairing base (X_S 355)
  heatShield: 7.018, // centre of the CM's aft heat shield, hidden inside the fairing
  fairingTop: 7.442, // (X_C 14)
  shoulder: 7.572, // the CM's widest point
  coneStart: 7.679, // where the 33° sidewall begins
  seam: 9.148, // crew-compartment / forward heat shield joint (X_C ≈ 81)
  towerWell: 9.22, // the four launch-escape-tower wells, where the tower's legs bolted on
  flatTop: 9.754, // the small flat top around the docking ring
  handle: 9.83, // EVA ring handle (X_C 108)
  dock: 9.887, // docking-ring face (X_C 110.25) — the LM's tunnel ring butts against it
}
export const DOCK_Y = H.dock
// The LM's docking tunnel stands 16 in (0.41 m) above its overhead hatch; its hatch disc
// therefore sits this far past the mating plane.
export const LM_HATCH_Y = H.dock + 0.41
// The SM's aft bulkhead — where the CSM sits on the Spacecraft-LM Adapter.
export const SM_AFT_Y = H.smAft
// The folding booms' pivot rotation.x when stowed for launch (0 = deployed, as built).
export const HGA_STOWED = Math.PI / 2 // high-gain antenna: boom straight aft, beside the engine bell
export const FLOOD_STOWED = 115 * DEG // EVA floodlight: folded down flat against the fairing
// What the rocket's stand-in (nosecone.ts) needs so its service module matches this one and
// its boost protective cover fits over this command module.
export const SM_RADIUS = R
export const CM_STATIONS = H
export const CM_HALF_ANGLE = 33 * DEG // the sidewall's half-angle
export const CM_SHOULDER_TUBE = 0.196 // the toroidal shoulder's section radius (7.7 in)

const TAN = Math.tan(CM_HALF_ANGLE)
export const coneR = (h: number) => 1.924 - TAN * (h - H.coneStart) // 33° half-angle sidewall
const TOP_R = coneR(H.flatTop) // ≈ 0.58 m

// --- Clock positions (phi, from the hatch toward +Y) ---
const QUADS = [352.75, 82.75, 172.75, 262.75].map((d) => d * DEG) // A, B, C, D: axes − 7°15′
const SEAMS = [13, 63, 133, 193, 243, 313].map((d) => d * DEG) // radial beams, sectors 1–6
const MARKINGS = [133, 313].map((d) => d * DEG) // "UNITED STATES" + flag, on the sector 2/3 and 5/6 beams
const ECS = [128, 308].map((d) => d * DEG) // the two ECS radiators, under the markings
const SCIMITARS = [130, 310].map((d) => d * DEG) // beside the marking beams, mid-SM (Love's unroll; the AOH end view is schematic)
const HGA = 217.75 * DEG // high-gain antenna hinge: 37.75° from +Z toward −Y
const FLOODLIGHT = 58 * DEG // EVA floodlight boom, aft of the right side window
const UMBILICAL = 177.7 * DEG // CM–SM umbilical: +Z, 2°20′ toward +Y

type Key =
  | 'mylar'
  | 'alu'
  | 'panel'
  | 'white'
  | 'dark'
  | 'black'
  | 'glass'
  | 'copper'
  | 'bronze'
  | 'brass'
  | 'bellLow'
  | 'bellHigh'
  | 'bellIn'
  | 'dish'
  | 'lights'
  | 'decal'

// The CM flew wrapped in strips of aluminised Kapton tape, laid apex to base — a mirror
// that isn't quite one piece. Meridional strips of slightly different brightness with
// faint seams, so it reads as foil rather than chrome. Kept faint: past a few metres the
// real seams vanish, and strong ones turn the cone into a pleated Gemini capsule.
function tapeTexture(): CanvasTexture {
  const w = 512
  const h = 16
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')!
  const strips = 64
  for (let i = 0; i < strips; i++) {
    const v = 226 + ((i * 37) % 7) * 2
    g.fillStyle = `rgb(${v},${v},${v + 3})`
    g.fillRect((i * w) / strips, 0, w / strips + 1, h)
    g.fillStyle = 'rgba(70,74,82,0.12)'
    g.fillRect((i * w) / strips, 0, 1, h)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  return tex
}

function drawFlag(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 ? '#e4e4e0' : '#b22234'
    g.fillRect(x, y + (i * h) / 13, w, h / 13 + 0.5)
  }
  const cw = w * 0.4
  const ch = (h * 7) / 13
  g.fillStyle = '#3c3b6e'
  g.fillRect(x, y, cw, ch)
  g.fillStyle = '#e4e4e0'
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 6; c++) g.fillRect(x + 4 + c * (cw / 6.2), y + 3 + r * (ch / 5.2), 2, 2)
}

// "UNITED" over "STATES" in black stencil on a white patch, the flag directly beneath —
// as on CSM-107 in S69-32370. Repainted once the stencil face has loaded.
function markingTexture(): CanvasTexture {
  const W = 512
  const HH = 400
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = HH
  const g = canvas.getContext('2d')!
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  const paint = () => {
    g.clearRect(0, 0, W, HH)
    g.fillStyle = '#e4e4e0'
    g.fillRect(8, 8, W - 16, 238)
    g.fillStyle = '#111111'
    g.font = "600 118px 'Barlow Condensed', 'Arial Narrow', sans-serif"
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('UNITED', W / 2, 72)
    g.fillText('STATES', W / 2, 186)
    drawFlag(g, W / 2 - 110, 272, 220, 116)
    tex.needsUpdate = true
  }
  paint()
  document.fonts?.load("600 118px 'Barlow Condensed'").then(paint, () => {})
  return tex
}

function materials(): Record<Key, Material> {
  const std = (color: number, metalness: number, roughness: number) =>
    new MeshStandardMaterial({ color, metalness, roughness })
  return {
    // Metalness 0.8, not 1: a true mirror reflects the navy void and renders black.
    mylar: new MeshStandardMaterial({ color: 0xffffff, map: tapeTexture(), metalness: 0.8, roughness: 0.3, envMapIntensity: 1.15 }),
    // SM skin: bright aluminium. Any more metal and it mirrors the navy void — a grey slab.
    alu: std(0xdfe3e8, 0.3, 0.4),
    panel: std(0x9aa0a6, 0.5, 0.5), // seams, aft bulkhead, radiator tube lines
    white: std(0xdfe1df, 0, 0.85), // radiator paint — kept under the bloom threshold
    dark: std(0x3a3d42, 0.45, 0.55),
    black: std(0x141416, 0, 0.8), // anti-glare surrounds, port throats
    glass: std(0x0b0d10, 0, 0.08),
    copper: std(0xb8826a, 0.45, 0.45), // docking ring, RCS port rings, the CM/SM seal line
    bronze: std(0xa07a52, 0.6, 0.4), // RCS thruster bells
    brass: std(0xc9a672, 0.6, 0.4), // the bells' ring bands
    // SPS nozzle: satin blue-grey in the flight photos. Low metalness for the same reason —
    // mirroring the void, it read as a black hole.
    bellLow: std(0x98a6b0, 0.2, 0.55), // titanium skirt
    bellHigh: std(0x7c878f, 0.2, 0.6), // columbium upper section + its stiffener rings
    bellIn: std(0x4a4f57, 0.3, 0.6),
    dish: new MeshStandardMaterial({ color: 0x2c2f34, metalness: 0.2, roughness: 0.6, side: 2 }), // DoubleSide
    lights: new MeshBasicMaterial({ vertexColors: true }),
    decal: new MeshStandardMaterial({ map: markingTexture(), transparent: true, alphaTest: 0.5, metalness: 0, roughness: 0.8 }),
  }
}

// --- placement helpers ---
const Y = new Vector3(0, 1, 0)
const radial = (phi: number) => new Vector3(Math.sin(phi), 0, Math.cos(phi))
const tangent = (phi: number) => new Vector3(Math.cos(phi), 0, -Math.sin(phi)) // toward increasing phi
const around = (phi: number, r: number, y: number) => new Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r)
const M = (pos: Vector3, rot: Euler | Quaternion = new Euler()) =>
  new Matrix4().compose(pos, rot instanceof Quaternion ? rot : new Quaternion().setFromEuler(rot), new Vector3(1, 1, 1))
// local +Z points radially out at phi, local +X along increasing phi
const facing = (phi: number) => new Euler(0, phi, 0)
// lying on the CM's sidewall at phi: local +Z is the cone's outward normal, +Y up the slant
const onCone = (phi: number, extraTilt = 0) => new Euler(-33 * DEG - extraTilt, phi, 0, 'YXZ')
// a point on the sidewall at height h, lifted `lift` metres off it along the normal
const conePt = (phi: number, h: number, lift = 0) =>
  around(phi, coneR(h) + lift * Math.cos(33 * DEG), h + lift * Math.sin(33 * DEG))
// bend a flat-authored plate (x across, y up the slant, z out of the skin) onto the sidewall
// centred at phi/h, so a wide panel hugs the cone instead of standing off it at its edges
const wrapOnCone = (geo: BufferGeometry, phi: number, h: number, lift: number) => {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const hh = h + p.getY(i) * Math.cos(33 * DEG)
    const v = conePt(phi + p.getX(i) / coneR(hh), hh, lift + p.getZ(i))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

export function buildCSM(): Group {
  const mats = materials()
  // Parts collect by material into `into`: the service module, the command module, or one of
  // the two folding booms, which merge separately onto their own pivots.
  const parts = new Map<Key, BufferGeometry[]>()
  const cmParts = new Map<Key, BufferGeometry[]>()
  const hgaParts = new Map<Key, BufferGeometry[]>()
  const floodParts = new Map<Key, BufferGeometry[]>()
  let into = parts
  const add = (key: Key, geo: BufferGeometry, m?: Matrix4) => {
    if (m) geo.applyMatrix4(m)
    const flat = geo.index ? geo.toNonIndexed() : geo
    if (flat !== geo) geo.dispose()
    const list = into.get(key) ?? []
    list.push(flat)
    into.set(key, list)
  }
  const lathe = (pts: [number, number][], segments = 96) => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), segments)
  const ring = (r: number, tube: number, y: number, key: Key, seg = 96) =>
    add(key, new TorusGeometry(r, tube, 6, seg), M(new Vector3(0, y, 0), new Euler(Math.PI / 2, 0, 0)))
  const strut = (a: Vector3, b: Vector3, radius: number, key: Key, seg = 8) => {
    const d = b.clone().sub(a)
    add(key, new CylinderGeometry(radius, radius, d.length(), seg), M(a.clone().add(b).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(Y, d.normalize())))
  }
  // a band of cylinder skin between two clock angles (centre phi, width in radians)
  const skin = (key: Key, r: number, y0: number, y1: number, phi: number, width: number) =>
    add(key, new CylinderGeometry(r, r, y1 - y0, Math.max(4, Math.round(width / (3 * DEG))), 1, true, phi - width / 2, width), M(new Vector3(0, (y0 + y1) / 2, 0)))

  // ================= SPS engine bell =================
  // A radiation-cooled bell: titanium from the exit up to the 40:1 point (r ≈ 1.0 m), the
  // darker columbium section above it, stiffener rings, a dark interior.
  const bell = new SplineCurve(
    [
      [1.25, 0],
      [1.14, 0.5],
      [1.0, 1.0],
      [0.82, 1.6],
      [0.62, 2.2],
      [0.39, 2.84],
    ].map(([r, y]) => new Vector2(r, y)),
  ).getPoints(40) // control point 2 (the Ti/Cb joint) lands exactly on sample 16
  const asPts = (ps: Vector2[]) => ps.map((p) => [p.x, p.y] as [number, number])
  add('bellLow', lathe(asPts(bell.slice(0, 17)), 72))
  add('bellHigh', lathe(asPts(bell.slice(16)), 72))
  add('bellIn', lathe(asPts(bell.map((p) => new Vector2(p.x - 0.012, p.y)).reverse()), 72))
  for (const [i, tube] of [
    [0, 0.022],
    [16, 0.03],
    [26, 0.016],
    [34, 0.016],
  ])
    ring(bell[i].x + 0.004, tube, bell[i].y, 'bellHigh', 72)
  add('dark', new CylinderGeometry(0.45, 0.45, H.smAft - 2.84, 32, 1, true), M(new Vector3(0, (2.84 + H.smAft) / 2, 0)))

  // ================= Service Module =================
  add('alu', new CylinderGeometry(R, R, H.smTop - H.smAft, 128, 1, true), M(new Vector3(0, (H.smAft + H.smTop) / 2, 0)))
  // aft bulkhead, the heat shield round the engine, the rim
  add('panel', new CircleGeometry(R, 96), M(new Vector3(0, H.smAft, 0), new Euler(Math.PI / 2, 0, 0)))
  add('dark', new CircleGeometry(0.62, 48), M(new Vector3(0, H.smAft - 0.004, 0), new Euler(Math.PI / 2, 0, 0)))
  ring(R - 0.012, 0.025, H.smAft, 'alu', 128)
  // the six radial-beam seams, plus the edges of the four narrow quad panels
  for (const phi of SEAMS)
    add('panel', new BoxGeometry(0.014, H.smTop - H.smAft, 0.006), M(around(phi, R + 0.002, (H.smAft + H.smTop) / 2), facing(phi)))
  for (const phi of QUADS)
    for (const side of [-1, 1]) {
      const p = phi + (side * 0.42) / R
      add('panel', new BoxGeometry(0.012, 2.44, 0.006), M(around(p, R + 0.002, H.smTop - 1.22), facing(p)))
    }
  // ECS radiators: two white fields low on opposite sides, ~120° round and 1 m tall (John
  // Love's Apollo 8–14 SM unroll), tube lines across them. Skins laid over the seams stand
  // 1 cm off the skin, so the seams pass under them rather than drawing through.
  for (const phi of ECS) {
    const w = 120 * DEG
    skin('white', R + 0.01, 3.3, 4.32, phi, w)
    for (let k = 0; k < 7; k++) skin('panel', R + 0.014, 3.37 + k * 0.14, 3.385 + k * 0.14, phi, w)
  }
  // "UNITED STATES" + flag, just aft of the radiator band
  for (const phi of MARKINGS) skin('decal', R + 0.01, 6.2, 6.86, phi, 0.84 / R)

  // --- RCS quads: bracket, housing, four banded bronze thrusters canted 10° outboard ---
  const thruster = () => {
    const outer = lathe(
      [
        [0.034, 0],
        [0.034, 0.09],
        [0.028, 0.105],
        [0.045, 0.15],
        [0.06, 0.22],
        [0.071, 0.3],
      ],
      20,
    )
    return outer
  }
  for (const phi of QUADS) {
    const out = radial(phi)
    const tan = tangent(phi)
    const c = around(phi, R + 0.16, H.quad)
    add('panel', new BoxGeometry(0.16, 0.2, 0.12), M(around(phi, R + 0.04, H.quad), facing(phi)))
    add('alu', new BoxGeometry(0.28, 0.34, 0.22), M(c, facing(phi)))
    const engines: [Vector3, number, number][] = [
      [Y.clone(), 0.17, 0],
      [Y.clone().negate(), 0.17, 0],
      [tan.clone(), 0.14, 0.05],
      [tan.clone().negate(), 0.14, -0.05],
    ]
    for (const [dir, half, stagger] of engines) {
      const d = dir.clone().addScaledVector(out, Math.tan(10 * DEG)).normalize()
      const base = c.clone().addScaledVector(dir, half).add(new Vector3(0, stagger, 0))
      const q = new Quaternion().setFromUnitVectors(Y, d)
      add('bronze', thruster(), M(base, q))
      add('black', new CircleGeometry(0.066, 16), M(base.clone().addScaledVector(d, 0.295), new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), d)))
      for (const [y, r] of [
        [0.16, 0.05],
        [0.21, 0.058],
        [0.26, 0.066],
      ])
        add('brass', new TorusGeometry(r, 0.006, 5, 16), M(base.clone().addScaledVector(d, y), new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), d)))
    }
  }

  // --- VHF scimitar antennas: D-shaped white fins, flat edge along the skin ---
  const fin = new Shape()
  fin.moveTo(0, -0.225)
  fin.absellipse(0, 0, 0.21, 0.225, -Math.PI / 2, Math.PI / 2, false, 0)
  fin.lineTo(0, -0.225)
  for (const phi of SCIMITARS) {
    const geo = new ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: false, curveSegments: 16 })
    geo.translate(0, 0, -0.015)
    add('white', geo, M(around(phi, R, 5.2), new Euler(0, phi - Math.PI / 2, 0)))
    add('panel', new BoxGeometry(0.06, 0.5, 0.02), M(around(phi, R + 0.005, 5.2), facing(phi)))
  }

  // --- high-gain antenna, deployed: hinge box on the aft rim, boom, four dishes + horn.
  // Everything past the hinge box folds, so it goes to hgaParts ---
  const hgaHinge = around(HGA, R + 0.2, H.smAft + 0.02)
  {
    const out = radial(HGA)
    add('panel', new BoxGeometry(0.22, 0.34, 0.24), M(around(HGA, R + 0.1, H.smAft + 0.1), facing(HGA)))
    into = hgaParts
    const boomA = hgaHinge
    const boomB = around(HGA, R + 1.15, H.smAft - 0.05)
    strut(boomA, boomB, 0.045, 'white', 10)
    add('panel', new BoxGeometry(0.18, 0.18, 0.18), M(boomB, facing(HGA)))
    // the array faces outboard and a little forward; it is steerable, so this is a choice
    const n = out.clone().addScaledVector(Y, 0.35).normalize()
    const xa = new Vector3().crossVectors(Y, n).normalize()
    const ya = new Vector3().crossVectors(n, xa)
    const frame = new Matrix4().makeBasis(xa, ya, n).setPosition(boomB.clone().addScaledVector(out, 0.36))
    const local = (m: Matrix4) => frame.clone().multiply(m)
    const at = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z)
    const DR = 0.394 // 31 in dishes
    const DZ = 0.12
    for (const [x, y] of [
      [-0.43, -0.43],
      [0.43, -0.43],
      [-0.43, 0.43],
      [0.43, 0.43],
    ]) {
      const dish = lathe(
        Array.from({ length: 8 }, (_, i) => {
          const r = (DR * i) / 7
          return [r, DZ * (r / DR) ** 2] as [number, number]
        }),
        32,
      )
      dish.rotateX(Math.PI / 2) // open toward local +Z
      add('dish', dish, local(at(x, y, 0)))
      // rim, ribs and feed thick enough to hold a pixel at the app's framing — any thinner
      // and they sparkle on and off as the stack rolls
      add('white', new TorusGeometry(DR, 0.02, 5, 40), local(at(x, y, DZ)))
      for (let k = 0; k < 8; k++) {
        const t = (k * Math.PI) / 4
        const a = new Vector3(x, y, 0.004).applyMatrix4(frame)
        const b = new Vector3(x + DR * Math.cos(t), y + DR * Math.sin(t), DZ).applyMatrix4(frame)
        strut(a, b, 0.016, 'white', 4)
      }
      strut(new Vector3(x, y, 0).applyMatrix4(frame), new Vector3(x, y, 0.24).applyMatrix4(frame), 0.016, 'white', 6)
      add('white', new SphereGeometry(0.028, 8, 6), local(at(x, y, 0.25)))
    }
    add('white', new BoxGeometry(0.28, 0.28, 0.3), local(at(0, 0, 0.02)))
    add('panel', new BoxGeometry(1.2, 0.06, 0.06), local(at(0, 0, -0.06)))
    add('panel', new BoxGeometry(0.06, 1.2, 0.06), local(at(0, 0, -0.06)))
    into = parts
  }

  // ================= Forward fairing: EPS radiator band =================
  add(
    'alu',
    lathe([
      [R, H.smTop - 0.004],
      [R, 7.26],
      [R - 0.012, 7.35],
      [R - 0.032, 7.41],
      [1.9, H.fairingTop],
    ]),
  )
  for (let k = 0; k < 8; k++) {
    const phi = (22.5 + k * 45) * DEG
    const w = 25 * DEG
    skin('white', R + 0.004, H.smTop, H.smTop + 0.33, phi, w)
    for (const y of [6.99, 7.07, 7.15]) skin('panel', R + 0.007, y, y + 0.012, phi, w)
  }
  // EVA floodlight on its boom (it folds, so floodParts), running lights, docking spotlight
  // door, rendezvous beacon
  const floodHinge = around(FLOODLIGHT, R - 0.02, 7.2)
  {
    const base = floodHinge
    const tip = base.clone().addScaledVector(radial(FLOODLIGHT).addScaledVector(Y, 0.6).normalize(), 0.9)
    into = floodParts
    strut(base, tip, 0.022, 'bronze', 8)
    add('white', new BoxGeometry(0.12, 0.1, 0.12), M(tip, facing(FLOODLIGHT)))
    into = parts
    add('panel', new BoxGeometry(0.2, 0.14, 0.05), M(around(327 * DEG, R + 0.01, 7.2), facing(327 * DEG)))
    // rendezvous beacon: just clear of the umbilical housing's −Y side
    add('panel', new CylinderGeometry(0.05, 0.06, 0.1, 12), M(around(188 * DEG, R + 0.03, 7.18), new Euler(0, 188 * DEG, Math.PI / 2)))
    const lamp = (phi: number, y: number, hex: string) => {
      const geo = new SphereGeometry(0.035, 10, 8)
      const c = new Color(hex)
      geo.setAttribute('color', new Float32BufferAttribute(new Array(geo.attributes.position.count).fill([c.r, c.g, c.b]).flat(), 3))
      add('lights', geo, M(around(phi, R + 0.02, y)))
    }
    for (const y of [7.05, 3.124]) {
      lamp(45 * DEG, y, '#3cff6a')
      lamp(315 * DEG, y, '#ff3b30')
      lamp(135 * DEG, y, '#ffb000')
      lamp(225 * DEG, y, '#ffb000')
    }
    lamp(188 * DEG, 7.24, '#ffffff')
  }
  // the thin copper seal line where the CM sits in the fairing
  ring(1.905, 0.01, H.fairingTop + 0.005, 'copper', 128)

  // --- CM–SM umbilical housing: bridges the fairing onto the lower CM cone, standing
  // ~0.25 m proud of the SM outline (AS11-37-5444) ---
  {
    const s = new Shape()
    s.moveTo(R - 0.02, 6.7)
    s.lineTo(R - 0.02, H.fairingTop)
    s.lineTo(coneR(7.9) - 0.02, 7.9)
    s.lineTo(coneR(7.9) + 0.12, 7.9)
    s.lineTo(R + 0.25, 7.35)
    s.lineTo(R + 0.25, 6.95)
    s.lineTo(R + 0.02, 6.7)
    const geo = new ExtrudeGeometry(s, { depth: 0.46, bevelEnabled: false })
    geo.translate(0, 0, -0.23)
    add('panel', geo, M(new Vector3(), new Euler(0, UMBILICAL - Math.PI / 2, 0)))
  }

  // ================= Command Module =================
  // Merged apart from the service module, so the two can be let go separately (Homecoming.tsx)
  into = cmParts
  // aft heat shield (hidden), the 7.7 in toroidal shoulder, the 33° sidewall, the forward
  // heat shield continuing it to a small flat top around the docking ring
  const cm: [number, number][] = [
    [0.001, H.heatShield],
    [0.964, H.heatShield + 0.1],
    [1.356, H.heatShield + 0.2],
    [1.651, H.heatShield + 0.3],
  ]
  for (let a = -66.8; a <= 33.01; a += 9.98)
    cm.push([R - CM_SHOULDER_TUBE + CM_SHOULDER_TUBE * Math.cos(a * DEG), H.shoulder + CM_SHOULDER_TUBE * Math.sin(a * DEG)])
  cm.push([coneR(8.4), 8.4], [coneR(9.1), 9.1], [coneR(H.flatTop - 0.008), H.flatTop - 0.008], [TOP_R, H.flatTop], [TOP_R - 0.01, H.flatTop], [0.437, H.flatTop])
  add('mylar', lathe(cm, 128))
  ring(coneR(H.seam) + 0.003, 0.006, H.seam, 'panel', 96) // forward heat shield joint
  // docking ring (copper), EVA ring handle on eight posts, and the docking probe: it leads
  // the approach and, docked, sits inside the LM's tunnel (buildLMTunnel — the tunnel is the
  // LM's, so it travels with the LM)
  add('copper', new CylinderGeometry(0.435, 0.435, H.dock - H.flatTop, 64, 1, true), M(new Vector3(0, (H.flatTop + H.dock) / 2, 0)))
  add('copper', new RingGeometry(0.33, 0.435, 64), M(new Vector3(0, H.dock, 0), new Euler(-Math.PI / 2, 0, 0)))
  ring(0.5, 0.013, H.handle, 'alu', 64)
  for (let k = 0; k < 8; k++) strut(around(k * 45 * DEG, 0.5, H.flatTop), around(k * 45 * DEG, 0.5, H.handle), 0.008, 'alu', 5)
  add('dark', new CircleGeometry(0.34, 32), M(new Vector3(0, H.dock - 0.02, 0), new Euler(-Math.PI / 2, 0, 0)))
  add('alu', new CylinderGeometry(0.035, 0.05, 0.3, 12), M(new Vector3(0, H.dock + 0.15, 0)))
  add('alu', new SphereGeometry(0.045, 10, 8), M(new Vector3(0, H.dock + 0.33, 0)))
  // four launch-escape-tower wells just above the joint
  for (let k = 0; k < 4; k++) {
    const phi = (45 + k * 90) * DEG
    add('black', new BoxGeometry(0.12, 0.12, 0.02), M(conePt(phi, H.towerWell, 0.003), onCone(phi)))
  }
  // sextant and scanning-telescope ports, opposite the hatch just aft of the forward heat shield
  for (const phi of [173.4, 186.6].map((d) => d * DEG)) add('black', new CircleGeometry(0.09, 20), M(conePt(phi, 8.98, 0.005), onCone(phi)))

  // windows: dark anti-glare surround + glossy glass
  const windowAt = (phi: number, h: number, w: number, ht: number, tilt = 0) => {
    add('black', new BoxGeometry(w + 0.12, ht + 0.12, 0.02), M(conePt(phi, h, 0.006), onCone(phi, tilt)))
    add('glass', new BoxGeometry(w, ht, 0.03), M(conePt(phi, h, 0.012), onCone(phi, tilt)))
  }
  // unified crew hatch: a raised panel with a dark seal line and the round hatch window,
  // bent to the cone (laid flat, its side edges stood 6–7 cm off the skin)
  add('black', wrapOnCone(new BoxGeometry(0.92, 0.8, 0.012, 16), 0, 8.57, 0.004))
  add('mylar', wrapOnCone(new BoxGeometry(0.86, 0.74, 0.02, 16), 0, 8.57, 0.01))
  const disc = (r: number, depth: number) => new CylinderGeometry(r, r, depth, 28).rotateX(Math.PI / 2)
  add('black', disc(0.14, 0.02), M(conePt(0, 8.67, 0.024), onCone(0)))
  add('glass', disc(0.115, 0.03), M(conePt(0, 8.67, 0.028), onCone(0)))
  for (const phi of [33, 327].map((d) => d * DEG)) windowAt(phi, 8.81, 0.2, 0.31, 22 * DEG) // rendezvous: look forward
  for (const phi of [58, 302].map((d) => d * DEG)) windowAt(phi, 8.44, 0.3, 0.3)
  // CM RCS ports: copper rings with dark throats — pitch pairs on the hatch meridian,
  // roll figure-eights either side of it, yaw pairs at ±Y
  const port = (phi: number, h: number, sx = 1, sy = 1) => {
    add('copper', new CircleGeometry(0.055, 18).scale(sx, sy, 1), M(conePt(phi, h, 0.004), onCone(phi)))
    add('black', new CircleGeometry(0.026, 12).scale(sx, 1, 1), M(conePt(phi, h, 0.006), onCone(phi)))
  }
  const pair = (phi: number, h: number, spread: number, sx = 1, sy = 1) => {
    const r = coneR(h)
    port(phi - spread / r, h, sx, sy)
    port(phi + spread / r, h, sx, sy)
  }
  pair(0, 9.29, 0.1)
  pair(0, 7.77, 0.1)
  pair(90 * DEG, 7.73, 0.12)
  pair(270 * DEG, 7.73, 0.12)
  // roll: two stretched ports side by side — one figure-eight ~0.4 m long, around the cone
  for (const phi of [46, 314].map((d) => d * DEG)) pair(phi, 7.82, 0.1, 1.8, 1.5)
  // S-band omni antennas, 45° off the axes just above the shoulder
  for (let k = 0; k < 4; k++) {
    const phi = (45 + k * 90) * DEG
    add('black', new CircleGeometry(0.04, 12), M(conePt(phi, 7.72, 0.004), onCone(phi)))
  }

  // ================= one mesh per material =================
  const meshes = (map: Map<Key, BufferGeometry[]>, prefix: string) => {
    const out: Mesh[] = []
    for (const [key, geos] of map) {
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) {
        // eslint-disable-next-line no-console
        console.error(`[csm] could not merge the "${key}" parts of ${prefix}`)
        continue
      }
      const mesh = new Mesh(merged, mats[key])
      mesh.name = `${prefix}_${key}`
      out.push(mesh)
    }
    return out
  }
  // The service module (with the engine bell and both booms) and the command module are
  // each a group, one mesh per material — a few more draw calls for the materials they share.
  const group = new Group()
  group.name = 'CSM'
  const smGroup = new Group()
  smGroup.name = 'CSM_SM'
  smGroup.add(...meshes(parts, 'CSM'))
  const cmGroup = new Group()
  cmGroup.name = 'CSM_CM'
  cmGroup.add(...meshes(cmParts, 'CM'))
  group.add(smGroup, cmGroup)
  // A folding boom: its parts re-expressed about the hinge, on a pivot whose rotation.x
  // swings it about the SM's tangent there (0 = deployed, as built).
  const boom = (name: string, map: Map<Key, BufferGeometry[]>, at: Vector3, phi: number) => {
    const hinge = new Group()
    hinge.name = name
    hinge.position.copy(at)
    hinge.rotation.y = phi
    hinge.updateMatrix()
    const toHinge = hinge.matrix.clone().invert()
    const pivot = new Group()
    pivot.name = `${name}_Pivot`
    for (const mesh of meshes(map, name)) {
      mesh.geometry.applyMatrix4(toHinge)
      pivot.add(mesh)
    }
    hinge.add(pivot)
    smGroup.add(hinge)
  }
  boom('CSM_HGA', hgaParts, hgaHinge, HGA)
  boom('CSM_Floodlight', floodParts, floodHinge, FLOODLIGHT)
  return group
}

// The LM's docking tunnel: 16 in of sleeve standing off its roof, and the ring that butts
// against the CM's docking ring. Built in the CSM's frame (it spans DOCK_Y → LM_HATCH_Y),
// but it's the LM's — Spacecraft.tsx carries it with the LM until the two are docked.
export function buildLMTunnel(): Group {
  const group = new Group()
  group.name = 'LM_Tunnel'
  const sleeve = new Mesh(
    new CylinderGeometry(0.45, 0.45, LM_HATCH_Y - H.dock, 48, 1, true),
    new MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.45, roughness: 0.55, side: DoubleSide }),
  )
  sleeve.position.y = (H.dock + LM_HATCH_Y) / 2
  const rim = new Mesh(new TorusGeometry(0.465, 0.022, 6, 48), new MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.5 }))
  rim.rotation.x = Math.PI / 2
  rim.position.y = H.dock + 0.02
  group.add(sleeve, rim)
  return group
}

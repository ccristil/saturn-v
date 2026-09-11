import { Matrix3, Matrix4, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Material, type Mesh, type Object3D } from 'three'

// The Lunar Module's landing gear, folded for the ride inside the Spacecraft-LM Adapter and
// swung out again later: gearFold(root).set(g), g = 1 deployed (the shipped model, exactly),
// g = 0 stowed.
//
// The model (CMFDesign's Tinkercad LM) fuses the gear into the same colour meshes as the
// rest of the vehicle, so there are no leg nodes to rotate — this moves vertices. Each leg
// is treated as the linkage it is (Rogers, "Apollo Lunar Module Landing Gear", NASA 1972,
// figs. 2–3):
//
//   primary strut — ladder and footpad with it — swings inward about its upper hinge at
//                   the outrigger, until it hangs nearly vertical beside the descent-stage
//                   corner; its lower section telescopes shorter as it goes;
//   secondary struts (two per leg) — each pivots at its fixed inboard fitting and follows
//                   the primary strut's junction, its piston rod sliding into its cylinder;
//   deployment truss (the gold X between them) — each arm pivots where it meets the
//                   descent stage and follows its secondary strut, stretching as needed.
//
// That is how the real gear stowed: Rogers fig. 2 shows the stowed primary strut hanging
// just inside vertical with the footpad under the descent stage's lower corner, not
// folded up against the top. The model's legs splay wider than the real ones (41° off
// vertical), so swinging them upright drops its footpads: stowed, they hang about 0.6 m lower
// than deployed (the telescoping takes back 0.29 m of that). Bounds are left at the deployed
// values — every fold state stays inside each mesh's deployed bounding sphere — but the
// bounding *boxes* don't cover the stowed footpads' lower reach.
//
// Everything below is measured from the glb in its own scene space (Y up, the LM standing
// on its legs; 0.0534 m per unit), where the overhead hatch sits at (-1.35, 41.86, 65.9).

const DEG = Math.PI / 180

// Stop the swing this far short of vertical: the strut then clears the descent stage's
// chamfered corner (and its crumpled foil) with a little air.
const STOW_MARGIN = 2.5 * DEG
// How much shorter the primary strut gets when stowed, glb units (5.5 ≈ 0.29 m). The ladder
// leg sets the limit: its ladder runs to within 7 units of the footpad, and only the plain
// strut below the ladder can close up.
const TELESCOPE = 5.5

// Materials, by the name each carries (its intended sRGB colour, see livery.ts).
const GOLD = 'color_14789940' // descent-stage foil, footpads, the truss X
const DARK = 'color_2829873' // outrigger hinge housings, secondary-strut cylinders

type V3 = readonly [number, number, number]
type Rod = {
  pivot: V3 // centre of the inboard fitting — fixed to the descent stage
  j: number // where it meets the primary strut: distance down the axis from the hinge
  split: number // along the rod from the pivot: beyond this is the sliding piston rod
}
type Arm = { from: V3; to: V3; rod: 0 | 1 } // truss arm: body end → end riding `rod`
type Leg = {
  hinge: V3 // primary strut's top, where it meets the outrigger — the hinge point
  axis: V3 // unit, down the primary strut
  seg: readonly [number, number] // stretch of plain lower strut that telescopes (axial)
  rods: readonly [Rod, Rod]
  arms: readonly [Arm, Arm]
}

// Measured from the glb's vertices (lab/ scripts, not shipped):
//   hinge/axis — the primary strut is one long cylinder, radius ≈ 1 unit; its axis is the
//     line through circle fits to its top and bottom end rings (the strut surface then sits
//     at r = 1.00 ± 0.1 all along it), and the hinge is the top ring's centre, just below
//     the black outrigger housing. All four lean 41.2° off vertical.
//   seg — the plain run of strut between the junction and the footpad fitting (on the
//     ladder leg, between the foot of the ladder and the fitting).
//   rods — pivot: centroid of the inboard fitting; j: where the rod's line meets the axis;
//     split: just past the end of the black cylinder.
//   arms — centroids of the gold X's end rings; each crosses to the far side's strut.
const LEGS: readonly Leg[] = [
  // ladder leg (-X/+Z)
  {
    hinge: [-39.83, -14.79, 103.98],
    axis: [-0.44977, -0.75271, 0.48076],
    seg: [45.28, 51.93],
    rods: [
      { pivot: [-56.51, -42.99, 94.66], j: 37.17, split: 17.69 },
      { pivot: [-29.14, -43.11, 122.01], j: 37.59, split: 17.66 },
    ],
    arms: [
      { from: [-44.69, -43.08, 95.18], to: [-44.15, -43.21, 119.47], rod: 1 },
      { from: [-29.42, -43.25, 110.25], to: [-54.18, -43, 110.61], rod: 0 },
    ],
  },
  // +X/+Z
  {
    hinge: [34.89, -14.71, 104.82],
    axis: [0.48067, -0.7528, 0.44973],
    seg: [39.88, 52.15],
    rods: [
      { pivot: [25.61, -43.07, 121.56], j: 37.79, split: 17.73 },
      { pivot: [52.87, -43.03, 94.21], j: 36.48, split: 17.65 },
    ],
    arms: [
      { from: [27.48, -42.91, 107.76], to: [50.96, -42.8, 107.85], rod: 1 },
      { from: [40.11, -42.82, 94.62], to: [39.93, -43.14, 119.02], rod: 0 },
    ],
  },
  // +X/-Z
  {
    hinge: [36.11, -15.27, 29.78],
    axis: [0.44994, -0.7527, -0.48063],
    seg: [39.13, 50.84],
    rods: [
      { pivot: [52.41, -43.08, 39.34], j: 36.49, split: 17.62 },
      { pivot: [25.18, -43.02, 12.1], j: 36.32, split: 17.64 },
    ],
    arms: [
      { from: [40.7, -42.73, 38.04], to: [40.54, -43.2, 14.44], rod: 1 },
      { from: [26.49, -42.91, 23.68], to: [50.19, -43.07, 23.89], rod: 0 },
    ],
  },
  // -X/-Z
  {
    hinge: [-39.35, -15.39, 28.82],
    axis: [-0.48048, -0.75303, -0.44954],
    seg: [38.95, 48.53],
    rods: [
      { pivot: [-29.7, -42.96, 12.49], j: 35.21, split: 17.63 },
      { pivot: [-56.96, -43.01, 39.94], j: 36.45, split: 17.75 },
    ],
    arms: [
      { from: [-29.76, -42.95, 24.98], to: [-54.89, -43.01, 25.64], rod: 1 },
      { from: [-43.28, -42.74, 38.42], to: [-42.99, -43.12, 14.49], rod: 0 },
    ],
  },
]

// Classification envelopes, glb units.
const FIX = 0.4 // primary-strut vertices less than this far down from the hinge stay put
const STRUT_R = 6.5 // primary strut + ladder + junction, radius about the axis
const PAD_R = 12 // footpad, radius about the axis
const ROD_R = 2.9 // secondary strut capsule
const ROD_CLEAR = 1.6 // …but not the primary strut (r ≈ 1) where they meet it
const ARM_R = 1.8 // truss arm capsule
const ARM_SKIP = 1.5 // leave the arm's first stretch (in the descent stage's foil) alone

export type GearFold = { set(g: number): void }

// ---------------------------------------------------------------------------------------

type Attr = BufferAttribute | InterleavedBufferAttribute
type Vec = [number, number, number]

// A part moves its vertices by  p' = R (p - C) + C + k·w·D  (root space), w per vertex.
type Part = { R: Float64Array; C: Vec; D: Vec; k: number }

type Batch = {
  part: number
  start: number
  end: number
  pos: Float32Array
  pStride: number
  pOff: number
  nor: Float32Array
  nStride: number
  nOff: number
  toLocal: Float64Array // 4x4 column-major, root → mesh local
  toLocalN: Float64Array // 3x3 column-major normal matrix of the same
}

const sub = (a: V3, b: V3): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): Vec => {
  const l = len(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
// distance from p to the segment a + x·dir, x ∈ [0, length]; also returns x
function segDist(p: V3, a: V3, dir: V3, length: number): { d: number; x: number } {
  const w = sub(p, a)
  const x = Math.max(0, Math.min(length, dot(w, dir)))
  return { d: Math.hypot(w[0] - dir[0] * x, w[1] - dir[1] * x, w[2] - dir[2] * x), x }
}

// Rotation about unit axis k by angle a, into out (3x3 row-major).
function axisAngle(out: Float64Array, k: V3, a: number): void {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const t = 1 - c
  const x = k[0]
  const y = k[1]
  const z = k[2]
  out[0] = c + x * x * t
  out[1] = x * y * t - z * s
  out[2] = x * z * t + y * s
  out[3] = y * x * t + z * s
  out[4] = c + y * y * t
  out[5] = y * z * t - x * s
  out[6] = z * x * t - y * s
  out[7] = z * y * t + x * s
  out[8] = c + z * z * t
}
// Shortest rotation taking unit a onto unit b, into out (3x3 row-major).
function align(out: Float64Array, a: V3, b: V3): void {
  const vx = a[1] * b[2] - a[2] * b[1]
  const vy = a[2] * b[0] - a[0] * b[2]
  const vz = a[0] * b[1] - a[1] * b[0]
  const h = 1 / (1 + dot(a, b)) // these parts never turn anywhere near 180°
  out[0] = 1 - (vy * vy + vz * vz) * h
  out[1] = -vz + vx * vy * h
  out[2] = vy + vx * vz * h
  out[3] = vz + vx * vy * h
  out[4] = 1 - (vx * vx + vz * vz) * h
  out[5] = -vx + vy * vz * h
  out[6] = -vy + vx * vz * h
  out[7] = vx + vy * vz * h
  out[8] = 1 - (vx * vx + vy * vy) * h
}
function rot(R: Float64Array, v: V3, out: Vec): Vec {
  const x = v[0]
  const y = v[1]
  const z = v[2]
  out[0] = R[0] * x + R[1] * y + R[2] * z
  out[1] = R[3] * x + R[4] * y + R[5] * z
  out[2] = R[6] * x + R[7] * y + R[8] * z
  return out
}

function access(a: Attr): { arr: Float32Array; stride: number; off: number } {
  const ia = a as InterleavedBufferAttribute
  if (ia.isInterleavedBufferAttribute) return { arr: ia.data.array as Float32Array, stride: ia.data.stride, off: ia.offset }
  const ba = a as BufferAttribute
  return { arr: ba.array as Float32Array, stride: ba.itemSize, off: 0 }
}

function matName(m: Material | Material[]): string {
  return (Array.isArray(m) ? m[0]?.name : m.name) ?? ''
}

export function gearFold(root: Object3D): GearFold {
  const cached = root.userData.__gearFold as GearFold | undefined
  if (cached) return cached

  // --- per-leg geometry, precomputed -------------------------------------------------
  const legs = LEGS.map((L) => {
    const k = unit([L.axis[2], 0, -L.axis[0]]) // horizontal, ⊥ the leg: axis × down
    const stow = Math.acos(-L.axis[1]) - STOW_MARGIN
    const out = unit([L.axis[0], 0, L.axis[2]]) // horizontal, outward along the leg
    const rods = L.rods.map((r) => {
      const J: Vec = [L.hinge[0] + L.axis[0] * r.j, L.hinge[1] + L.axis[1] * r.j, L.hinge[2] + L.axis[2] * r.j]
      const d = sub(J, r.pivot)
      const dir = unit(d)
      const start: Vec = [r.pivot[0] - dir[0] * 3, r.pivot[1] - dir[1] * 3, r.pivot[2] - dir[2] * 3]
      return { ...r, dir, l0: len(d), start }
    })
    const arms = L.arms.map((a) => {
      const d = sub(a.to, a.from)
      return { ...a, dir: unit(d), l0: len(d), off: sub(a.to, L.rods[a.rod].pivot) }
    })
    return { ...L, k, stow, out, rods, arms }
  })

  // --- classify every vertex -----------------------------------------------------------
  // part index: leg*5 + (0 primary, 1-2 secondary struts, 3-4 truss arms)
  root.updateMatrixWorld(true)
  const toRoot = new Matrix4().copy(root.matrixWorld).invert()
  const v = new Vector3()
  const nv = new Vector3()
  const rel = new Matrix4()
  const relN = new Matrix3()
  type Pending = { part: number; mesh: number; i: number; p: Vec; n: Vec; w: number }
  const pending: Pending[] = []
  const meshes: { pos: Attr; nor: Attr; toLocal: Float64Array; toLocalN: Float64Array }[] = []
  const seen = new Set<unknown>()

  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || seen.has(mesh.geometry)) return
    seen.add(mesh.geometry)
    const pos = mesh.geometry.attributes.position as Attr | undefined
    const nor = mesh.geometry.attributes.normal as Attr | undefined
    if (!pos || !nor) return
    rel.copy(toRoot).multiply(mesh.matrixWorld)
    relN.getNormalMatrix(rel)
    const inv = rel.clone().invert()
    const mi = meshes.length
    meshes.push({ pos, nor, toLocal: Float64Array.from(inv.elements), toLocalN: Float64Array.from(new Matrix3().getNormalMatrix(inv).elements) })
    const name = matName(mesh.material)
    const gold = name === GOLD
    const dark = name === DARK
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(rel)
      const p: Vec = [v.x, v.y, v.z]
      let part = -1
      let w = 0
      for (let li = 0; li < legs.length && part < 0; li++) {
        const L = legs[li]
        const h = sub(p, L.hinge)
        // cheap reject: nothing of a leg lies inboard of its outrigger or far to its side
        const along = h[0] * L.out[0] + h[2] * L.out[2]
        const side = h[0] * L.k[0] + h[2] * L.k[2]
        if (along < -8 || Math.abs(side) > 26 || h[1] > 3) continue
        const a = dot(h, L.axis)
        const r = Math.hypot(h[0] - L.axis[0] * a, h[1] - L.axis[1] * a, h[2] - L.axis[2] * a)
        // secondary struts: cylinder, fitting and piston rod — never the gold
        if (!gold && r >= ROD_CLEAR) {
          let best = ROD_R
          for (let ri = 0; ri < 2; ri++) {
            const R = L.rods[ri]
            const s = segDist(p, R.start, R.dir, R.l0 + 3)
            if (s.d <= best) {
              best = s.d
              part = li * 5 + 1 + ri
              w = s.x - 3 > R.split ? 1 : 0
            }
          }
          if (part >= 0) break
        }
        // truss arms: gold only, clear of the descent stage
        if (gold) {
          let best = ARM_R
          for (let ai = 0; ai < 2; ai++) {
            const A = L.arms[ai]
            const s = segDist(p, A.from, A.dir, A.l0)
            if (s.d <= best && s.x >= ARM_SKIP) {
              best = s.d
              part = li * 5 + 3 + ai
              w = dot(sub(p, A.from), A.dir)
            }
          }
          if (part >= 0) break
        }
        // primary strut, ladder, footpad
        if (dark || a < FIX) continue
        const s0 = L.seg[0]
        const s1 = L.seg[1]
        const inPad = a >= s1 - 1
        if (inPad ? r <= PAD_R : r <= STRUT_R && !gold) {
          part = li * 5
          w = a <= s0 ? 0 : a >= s1 ? 1 : (a - s0) / (s1 - s0)
        }
      }
      if (part < 0) continue
      nv.fromBufferAttribute(nor, i).applyMatrix3(relN).normalize()
      pending.push({ part, mesh: mi, i, p, n: [nv.x, nv.y, nv.z], w })
    }
  })

  // --- pack into typed arrays, grouped by (part, mesh) --------------------------------
  pending.sort((a, b) => a.part - b.part || a.mesh - b.mesh || a.i - b.i)
  const N = pending.length
  const P = new Float32Array(N * 3) // rest position, root space
  const Nn = new Float32Array(N * 3) // rest normal, root space
  const W = new Float32Array(N)
  const I = new Uint32Array(N)
  const restP = new Float32Array(N * 3) // the shipped local values, for an exact g = 1
  const restN = new Float32Array(N * 3)
  const batches: Batch[] = []
  pending.forEach((q, k) => {
    P.set(q.p, k * 3)
    Nn.set(q.n, k * 3)
    W[k] = q.w
    I[k] = q.i
    const m = meshes[q.mesh]
    const ap = access(m.pos)
    const an = access(m.nor)
    const bp = q.i * ap.stride + ap.off
    const bn = q.i * an.stride + an.off
    restP.set([ap.arr[bp], ap.arr[bp + 1], ap.arr[bp + 2]], k * 3)
    restN.set([an.arr[bn], an.arr[bn + 1], an.arr[bn + 2]], k * 3)
    const last = batches[batches.length - 1]
    if (last && last.part === q.part && last.pos === ap.arr && last.pOff === ap.off && last.nor === an.arr && last.nOff === an.off) last.end++
    else
      batches.push({
        part: q.part,
        start: k,
        end: k + 1,
        pos: ap.arr,
        pStride: ap.stride,
        pOff: ap.off,
        nor: an.arr,
        nStride: an.stride,
        nOff: an.off,
        toLocal: m.toLocal,
        toLocalN: m.toLocalN,
      })
  })
  const touched: Attr[] = []
  for (const mi of new Set(pending.map((q) => q.mesh))) touched.push(meshes[mi].pos, meshes[mi].nor)
  const nBatch = batches.length
  const nTouched = touched.length
  const nLegs = legs.length

  // --- per-frame state, allocated once ---------------------------------------------
  const parts: Part[] = []
  for (let k = 0; k < nLegs * 5; k++) parts.push({ R: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), C: [0, 0, 0], D: [0, 0, 0], k: 0 })
  const tmp: Vec = [0, 0, 0]
  const dir: Vec = [0, 0, 0]
  const M = new Float64Array(9) // toLocal · R, 3x3 row-major
  const MN = new Float64Array(9) // toLocalN · R
  const T: Vec = [0, 0, 0]
  const DL: Vec = [0, 0, 0]
  let current = 1

  function setPart(part: Part, c: V3, d: Vec, k: number): void {
    part.C[0] = c[0]
    part.C[1] = c[1]
    part.C[2] = c[2]
    part.D[0] = d[0]
    part.D[1] = d[1]
    part.D[2] = d[2]
    part.k = k
  }

  function pose(fold: number): void {
    for (let li = 0; li < nLegs; li++) {
      const L = legs[li]
      const pr = parts[li * 5]
      axisAngle(pr.R, L.k, fold * L.stow)
      rot(pr.R, L.axis, tmp)
      setPart(pr, L.hinge, tmp, -fold * TELESCOPE)
      for (let ri = 0; ri < 2; ri++) {
        const R = L.rods[ri]
        // the junction rides the primary strut, above its telescoping section
        dir[0] = L.hinge[0] + pr.D[0] * R.j - R.pivot[0]
        dir[1] = L.hinge[1] + pr.D[1] * R.j - R.pivot[1]
        dir[2] = L.hinge[2] + pr.D[2] * R.j - R.pivot[2]
        const l = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2])
        dir[0] /= l
        dir[1] /= l
        dir[2] /= l
        const part = parts[li * 5 + 1 + ri]
        align(part.R, R.dir, dir)
        setPart(part, R.pivot, dir, l - R.l0)
      }
      for (let ai = 0; ai < 2; ai++) {
        const A = L.arms[ai]
        const rp = parts[li * 5 + 1 + A.rod]
        const pivot = L.rods[A.rod].pivot
        // the arm's far end rides its secondary strut's (rigid) cylinder
        rot(rp.R, A.off, tmp)
        dir[0] = pivot[0] + tmp[0] - A.from[0]
        dir[1] = pivot[1] + tmp[1] - A.from[1]
        dir[2] = pivot[2] + tmp[2] - A.from[2]
        const l = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2])
        dir[0] /= l
        dir[1] /= l
        dir[2] /= l
        const part = parts[li * 5 + 3 + ai]
        align(part.R, A.dir, dir)
        setPart(part, A.from, dir, l / A.l0 - 1)
      }
    }
  }

  function write(): void {
    for (let bi = 0; bi < nBatch; bi++) {
      const b = batches[bi]
      const pt = parts[b.part]
      const R = pt.R
      const L = b.toLocal // column-major 4x4
      const LN = b.toLocalN // column-major 3x3
      // M = toLocal₃ · R ;  T = toLocal₃ · (C − R·C) + toLocal.t ;  DL = toLocal₃ · D · k
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          M[r * 3 + c] = L[r] * R[c] + L[4 + r] * R[3 + c] + L[8 + r] * R[6 + c]
          MN[r * 3 + c] = LN[r] * R[c] + LN[3 + r] * R[3 + c] + LN[6 + r] * R[6 + c]
        }
      rot(R, pt.C, tmp)
      const cx = pt.C[0] - tmp[0]
      const cy = pt.C[1] - tmp[1]
      const cz = pt.C[2] - tmp[2]
      for (let r = 0; r < 3; r++) {
        T[r] = L[r] * cx + L[4 + r] * cy + L[8 + r] * cz + L[12 + r]
        DL[r] = (L[r] * pt.D[0] + L[4 + r] * pt.D[1] + L[8 + r] * pt.D[2]) * pt.k
      }
      const pos = b.pos
      const nor = b.nor
      const pStride = b.pStride
      const pOff = b.pOff
      const nStride = b.nStride
      const nOff = b.nOff
      for (let k = b.start; k < b.end; k++) {
        const x = P[k * 3]
        const y = P[k * 3 + 1]
        const z = P[k * 3 + 2]
        const w = W[k]
        const o = I[k] * pStride + pOff
        pos[o] = M[0] * x + M[1] * y + M[2] * z + T[0] + DL[0] * w
        pos[o + 1] = M[3] * x + M[4] * y + M[5] * z + T[1] + DL[1] * w
        pos[o + 2] = M[6] * x + M[7] * y + M[8] * z + T[2] + DL[2] * w
        const nx = Nn[k * 3]
        const ny = Nn[k * 3 + 1]
        const nz = Nn[k * 3 + 2]
        const q = I[k] * nStride + nOff
        nor[q] = MN[0] * nx + MN[1] * ny + MN[2] * nz
        nor[q + 1] = MN[3] * nx + MN[4] * ny + MN[5] * nz
        nor[q + 2] = MN[6] * nx + MN[7] * ny + MN[8] * nz
      }
    }
  }

  function restore(): void {
    for (let bi = 0; bi < nBatch; bi++) {
      const b = batches[bi]
      const pos = b.pos
      const nor = b.nor
      for (let k = b.start; k < b.end; k++) {
        const o = I[k] * b.pStride + b.pOff
        pos[o] = restP[k * 3]
        pos[o + 1] = restP[k * 3 + 1]
        pos[o + 2] = restP[k * 3 + 2]
        const q = I[k] * b.nStride + b.nOff
        nor[q] = restN[k * 3]
        nor[q + 1] = restN[k * 3 + 1]
        nor[q + 2] = restN[k * 3 + 2]
      }
    }
  }

  const fold: GearFold = {
    set(g: number) {
      const x = g >= 1 ? 1 : g <= 0 ? 0 : g
      if (x === current) return
      current = x
      if (x === 1) restore()
      else {
        pose(1 - x)
        write()
      }
      for (let t = 0; t < nTouched; t++) touched[t].needsUpdate = true
    },
  }
  root.userData.__gearFold = fold
  return fold
}

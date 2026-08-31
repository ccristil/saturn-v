import {
  Object3D,
  Group,
  Mesh,
  Box3,
  Vector3,
  Matrix4,
  TorusGeometry,
  MeshStandardMaterial,
} from 'three'

// The GLB's F-1 engines are smooth bells. The real F-1 nozzle has a distinctive
// corrugated extension — dozens of fine horizontal tube-wall ribs wrapping the bell
// (see the Houston display reference). This adds that: a dense stack of thin metal
// rings hugging each nozzle's measured profile, so the engines read as real hardware
// in the dive-in.
//
// Each F-1 engine node (F1, F1001..F1004) holds two meshes: an *_Metal_0 upper
// housing and an *_RollingShuttle_0 **nozzle bell** — the flaring cone, narrow at the
// throat and wide at the exit. It's the bell we rib. Rings are built in world space
// around each nozzle's axis, then parented (world transform preserved) to the S-IC
// node so they ride explode + dim with isolate, same as the engines.

// The GLTF importer strips dots, so the five engine nodes are F1, F1001..F1004.
const ENGINE_RE = /^F1\d*$/

// Ribs span this fraction of the nozzle bell height, from just above the exit
// (bottom, widest) up toward the throat (top, narrowest).
const RIB_FROM = 0.04
const RIB_TO = 0.82
const RIB_COUNT = 38

function nozzleMesh(engine: Object3D): Mesh | null {
  let found: Mesh | null = null
  engine.traverse((o) => {
    const m = o as Mesh
    if (!found && m.isMesh && /RollingShuttle/i.test(m.name)) found = m
  })
  return found
}

// Centroid (mean x,z) of a mesh's vertices within a Y-band. Over the exit ring — a
// full, radially-symmetric circle — this lands on the nozzle's true axis.
function bandCentroid(mesh: Mesh, yLo: number, yHi: number): { cx: number; cz: number } {
  const v = new Vector3()
  let sx = 0
  let sz = 0
  let cnt = 0
  const pos = mesh.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    if (v.y >= yLo && v.y <= yHi) {
      sx += v.x
      sz += v.z
      cnt++
    }
  }
  return cnt > 0 ? { cx: sx / cnt, cz: sz / cnt } : { cx: 0, cz: 0 }
}

// The bell's surface radius per Y-slice: MEDIAN radial distance from the axis (robust
// to any stray vertices), gap-filled across empty slices, then smoothed.
function bellProfile(mesh: Mesh, cx: number, cz: number, yMin: number, yMax: number, n: number): number[] {
  const buckets: number[][] = Array.from({ length: n }, () => [])
  const v = new Vector3()
  const span = yMax - yMin || 1
  const pos = mesh.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    const idx = Math.floor(((v.y - yMin) / span) * n)
    if (idx < 0 || idx >= n) continue
    buckets[idx].push(Math.hypot(v.x - cx, v.z - cz))
  }
  const prof = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const b = buckets[i]
    if (b.length === 0) continue
    b.sort((a, c) => a - c)
    prof[i] = b[Math.floor(b.length * 0.5)]
  }
  // Fill empty slices (low-poly mesh) by interpolation.
  for (let i = 0; i < n; i++) {
    if (prof[i] > 0) continue
    let l = i - 1
    while (l >= 0 && prof[l] <= 0) l--
    let r = i + 1
    while (r < n && prof[r] <= 0) r++
    if (l >= 0 && r < n) prof[i] = prof[l] + (prof[r] - prof[l]) * ((i - l) / (r - l))
    else if (l >= 0) prof[i] = prof[l]
    else if (r < n) prof[i] = prof[r]
  }
  // Smooth per-slice noise so ribs follow a clean cone.
  const smoothed = prof.slice()
  for (let i = 0; i < n; i++) {
    let sum = 0
    let cnt = 0
    for (let j = Math.max(0, i - 1); j <= Math.min(n - 1, i + 1); j++) {
      sum += prof[j]
      cnt++
    }
    smoothed[i] = sum / cnt
  }
  return smoothed
}

export function addEngineDetail(root: Object3D): void {
  if (root.userData.__engineDetail) return

  let sic: Object3D | undefined
  root.traverse((n) => {
    if (!sic && n.name === 'S-IC') sic = n
  })
  if (!sic) return

  root.updateMatrixWorld(true)

  const engines: Object3D[] = []
  root.traverse((n) => {
    if (ENGINE_RE.test(n.name)) engines.push(n)
  })

  const worldGroup = new Group()
  worldGroup.name = 'EngineDetail'
  const ribMat = new MeshStandardMaterial({
    color: 0x60636a,
    metalness: 0.85,
    roughness: 0.4,
    envMapIntensity: 1.3,
  })

  const N = 56
  for (const eng of engines) {
    const nozzle = nozzleMesh(eng)
    if (!nozzle) continue
    nozzle.updateWorldMatrix(true, false)
    const box = new Box3().setFromObject(nozzle)
    if (box.isEmpty()) continue
    const yMin = box.min.y
    const yMax = box.max.y
    const bellH = yMax - yMin
    const axis = bandCentroid(nozzle, yMin, yMin + 0.15 * bellH) // exit-ring axis
    const cx = axis.cx
    const cz = axis.cz
    const prof = bellProfile(nozzle, cx, cz, yMin, yMax, N)

    for (let k = 0; k < RIB_COUNT; k++) {
      const f = RIB_FROM + (RIB_TO - RIB_FROM) * (k / (RIB_COUNT - 1))
      const y = yMin + f * bellH
      const r = prof[Math.min(N - 1, Math.floor(f * N))]
      if (!(r > 0)) continue
      const tube = Math.max(0.012, r * 0.02)
      const ring = new Mesh(new TorusGeometry(r + tube * 0.3, tube, 6, 48), ribMat)
      ring.rotation.x = Math.PI / 2
      ring.position.set(cx, y, cz)
      worldGroup.add(ring)
    }
  }

  sic.updateWorldMatrix(true, false)
  const local = new Matrix4().copy(sic.matrixWorld).invert()
  local.decompose(worldGroup.position, worldGroup.quaternion, worldGroup.scale)
  sic.add(worldGroup)
  sic.updateMatrixWorld(true)

  root.userData.__engineDetail = true
}

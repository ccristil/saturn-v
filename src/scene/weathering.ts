import {
  Object3D,
  Group,
  Mesh,
  Box3,
  Vector3,
  Matrix4,
  CylinderGeometry,
  MeshStandardMaterial,
  CanvasTexture,
  SRGBColorSpace,
  FrontSide,
} from 'three'

// Launch-day weathering — bolder than clean CAD, still believable. Two full-360°
// overlays wrap the white stages:
//   1. Base scorch — soot pooled at the engine junction with irregular flame licks
//      rising up between the engines, so the S-IC base reads as fired hardware.
//   2. Body grime — faint vertical streaks running down the S-IC and S-II skins
//      (rain/handling staining that drips from panel seams), plus a few horizontal
//      seam-dirt lines.
// Each overlay is a thin cylinder hugging the measured skin radius, parented to its
// stage (world transform preserved) so it rides explode + dims with isolate.

// The true skin radius of a stage within a height band: median radial distance of its
// vertices from the vehicle axis (median shrugs off systems tunnels / stray fins).
function stageRadius(stage: Object3D, yLo: number, yHi: number): number | null {
  const v = new Vector3()
  const radii: number[] = []
  stage.updateWorldMatrix(true, false)
  stage.traverse((o) => {
    const m = o as Mesh
    const geo = m.geometry
    if (!m.isMesh || !geo?.attributes?.position) return
    m.updateWorldMatrix(true, false)
    const pos = geo.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 4000))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      if (v.y >= yLo && v.y <= yHi) radii.push(Math.hypot(v.x, v.z))
    }
  })
  if (radii.length < 8) return null
  radii.sort((a, b) => a - b)
  return radii[Math.floor(radii.length * 0.5)]
}

function texFromCanvas(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// Base scorch: a dark band pooled at the bottom with soft vertical licks rising out
// of it. Wide canvas = the full circumference; height maps to the scorch band.
function scorchTexture(): CanvasTexture {
  const w = 1024
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // Pooled soot at the base, fading up.
  const g = ctx.createLinearGradient(0, h, 0, 0) // bottom → top
  g.addColorStop(0, 'rgba(14,11,9,0.82)')
  g.addColorStop(0.28, 'rgba(16,13,11,0.45)')
  g.addColorStop(0.6, 'rgba(18,15,12,0.12)')
  g.addColorStop(1, 'rgba(18,15,12,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Irregular flame licks rising from the base.
  const licks = 32
  for (let i = 0; i < licks; i++) {
    const x = Math.random() * w
    const width = 12 + Math.random() * 50
    const top = h * (0.4 + Math.random() * 0.5) // how high the lick reaches (from base)
    const lg = ctx.createLinearGradient(0, h, 0, h - top)
    const a = 0.3 + Math.random() * 0.34
    lg.addColorStop(0, `rgba(12,10,8,${a})`)
    lg.addColorStop(1, 'rgba(12,10,8,0)')
    ctx.fillStyle = lg
    ctx.fillRect(x - width / 2, h - top, width, top)
  }
  return texFromCanvas(canvas)
}

// Body grime: mostly transparent, with thin vertical drip-streaks and a few faint
// horizontal seam lines. Tall canvas so streaks stay crisp down the stage.
function grimeTexture(): CanvasTexture {
  const w = 1024
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  // Vertical drips — start somewhere up the body and run down, fading out.
  const streaks = 120
  for (let i = 0; i < streaks; i++) {
    const x = Math.random() * w
    const startY = Math.random() * h * 0.7
    const len = h * (0.12 + Math.random() * 0.45)
    const width = 1 + Math.random() * 3
    const a = 0.07 + Math.random() * 0.13
    const lg = ctx.createLinearGradient(0, startY, 0, startY + len)
    lg.addColorStop(0, `rgba(44,37,29,${a})`)
    lg.addColorStop(1, 'rgba(44,37,29,0)')
    ctx.fillStyle = lg
    ctx.fillRect(x - width / 2, startY, width, len)
  }

  // A handful of heavier, longer stains for accent.
  const heavy = 18
  for (let i = 0; i < heavy; i++) {
    const x = Math.random() * w
    const startY = Math.random() * h * 0.5
    const len = h * (0.25 + Math.random() * 0.5)
    const width = 2 + Math.random() * 5
    const a = 0.16 + Math.random() * 0.14
    const lg = ctx.createLinearGradient(0, startY, 0, startY + len)
    lg.addColorStop(0, `rgba(38,31,24,${a})`)
    lg.addColorStop(1, 'rgba(38,31,24,0)')
    ctx.fillStyle = lg
    ctx.fillRect(x - width / 2, startY, width, len)
  }

  // A few horizontal seam-dirt lines.
  const seams = 6
  for (let i = 0; i < seams; i++) {
    const y = (i + 0.5) * (h / seams) + (Math.random() - 0.5) * 30
    ctx.fillStyle = `rgba(38,33,28,${0.07 + Math.random() * 0.06})`
    ctx.fillRect(0, y, w, 1 + Math.random() * 2)
  }
  return texFromCanvas(canvas)
}

// A full-360° overlay cylinder hugging the skin, carrying a weathering texture.
function overlay(rad: number, yCenter: number, height: number, tex: CanvasTexture): Mesh {
  const geo = new CylinderGeometry(rad, rad, height, 96, 1, true)
  const mat = new MeshStandardMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    roughness: 0.9,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
  const mesh = new Mesh(geo, mat)
  mesh.position.y = yCenter
  return mesh
}

// Attach a set of world-space overlay meshes under a stage, preserving a
// world-origin/world-up frame so they stay concentric and ride explode + isolate.
function attach(stage: Object3D, name: string, meshes: Mesh[]): void {
  const wg = new Group()
  wg.name = name
  for (const m of meshes) wg.add(m)
  stage.updateWorldMatrix(true, false)
  const local = new Matrix4().copy(stage.matrixWorld).invert()
  local.decompose(wg.position, wg.quaternion, wg.scale)
  stage.add(wg)
  stage.updateMatrixWorld(true)
}

export function addWeathering(root: Object3D): void {
  if (root.userData.__weathered) return

  let sic: Object3D | undefined
  let s2: Object3D | undefined
  root.traverse((n) => {
    if (!sic && n.name === 'S-IC') sic = n
    if (!s2 && n.name === 'S-II') s2 = n
  })
  if (!sic) return
  root.updateMatrixWorld(true)

  // --- S-IC: base scorch + body grime ---
  const sicBox = new Box3().setFromObject(sic)
  if (!sicBox.isEmpty()) {
    const yMin = sicBox.min.y
    const h = sicBox.max.y - yMin
    const rad =
      (stageRadius(sic, yMin + 0.28 * h, yMin + 0.52 * h) ??
        Math.min(sicBox.max.x - sicBox.min.x, sicBox.max.z - sicBox.min.z) / 2) + 0.03

    const scorchH = 0.3 * h
    const scorch = overlay(rad, yMin + scorchH / 2, scorchH, scorchTexture())
    // Grime over the upper ~80% of the stage (clear of the scorch band).
    const grimeH = 0.78 * h
    const grime = overlay(rad, yMin + 0.55 * h, grimeH, grimeTexture())
    attach(sic, 'Weathering-SIC', [scorch, grime])
  }

  // --- S-II: body grime only ---
  if (s2) {
    const s2Box = new Box3().setFromObject(s2)
    if (!s2Box.isEmpty()) {
      const y2 = s2Box.min.y
      const h2 = s2Box.max.y - y2
      const rad2 =
        (stageRadius(s2, y2 + 0.35 * h2, y2 + 0.7 * h2) ??
          Math.min(s2Box.max.x - s2Box.min.x, s2Box.max.z - s2Box.min.z) / 2) + 0.03
      const grime2 = overlay(rad2, y2 + 0.5 * h2, 0.9 * h2, grimeTexture())
      attach(s2, 'Weathering-SII', [grime2])
    }
  }

  root.userData.__weathered = true
}

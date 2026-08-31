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

// Apollo Saturn V first-stage markings — the US flag and the red "USA" — that the
// launch-vehicle-only GLB doesn't carry. (The black roll-pattern bands ARE baked
// into the model's texture, so only the flag + lettering are missing.) Placement
// follows the on-pad reference photo: flag mid-lower on the S-IC, red "USA" below it.
//
// Each marking is drawn to a canvas at runtime (no image files to 404) and mapped
// onto a thin cylinder-segment decal that hugs the first-stage skin. The decal's arc
// width is derived from the texture's aspect ratio, so nothing gets stretched. The
// decals are parented to the `S-IC` node so they ride the explode animation and dim
// with isolate exactly like the stage they sit on. Placed on ONE face (photo-accurate),
// aimed at the home camera. Sizes derive from the live stage bounds, tuned via screenshots.

const USA_RED = '#bd2a26' // the red "USA" lettering
const FLAG_RED = '#b22234'
const FLAG_WHITE = '#f4f5f7'
const FLAG_NAVY = '#3c3b6e'

// Which face the markings sit on, as a rotation about the vehicle's vertical axis.
// Tuned so they face the home camera (which sits at +X/+Z). Radians.
const FACE_ANGLE = 0.33

// --- Canvas texture builders --------------------------------------------------

type Marking = { tex: CanvasTexture; w: number; h: number }

function texFromCanvas(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// addMarkings runs while the GLB loads — before the self-hosted Barlow Condensed
// woff2 is necessarily ready. Draw immediately (fallback font), then repaint once
// the real font resolves and flag the texture for re-upload.
function repaintOnFontReady(paint: () => void, tex: CanvasTexture): void {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts?.load) return
  fonts
    .load('600 120px "Barlow Condensed"')
    .then(() => {
      paint()
      tex.needsUpdate = true
    })
    .catch(() => {})
}

// A horizontal word (e.g. "USA"), letter-spaced so the condensed face reads as the
// blockier lettering on the real vehicle.
function textTexture(text: string, color: string): Marking {
  const w = 360
  const h = 180
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const paint = () => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '14px'
    ctx.font = `600 132px "Barlow Condensed", sans-serif`
    ctx.fillText(text, w / 2 + 7, h / 2 + 4) // +7: offset for the trailing letter-space
  }
  paint()
  const tex = texFromCanvas(canvas)
  repaintOnFontReady(paint, tex)
  return { tex, w, h }
}

// A vertical column of letters (U/N/I/T/E/D / S/T/A/T/E/S), each upright and stacked
// top → bottom, as "UNITED STATES" runs down the second stage. A space = a gap cell.
function verticalTextTexture(text: string, color: string): Marking {
  const cells = text.split('')
  const cellW = 130
  const cellH = 138
  const canvas = document.createElement('canvas')
  canvas.width = cellW
  canvas.height = cellH * cells.length
  const ctx = canvas.getContext('2d')!
  const paint = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(cellH * 0.92)}px "Barlow Condensed", sans-serif`
    cells.forEach((ch, i) => {
      if (ch === ' ') return
      ctx.fillText(ch, cellW / 2, i * cellH + cellH / 2)
    })
  }
  paint()
  const tex = texFromCanvas(canvas)
  repaintOnFontReady(paint, tex)
  return { tex, w: canvas.width, h: canvas.height }
}

function flagTexture(): Marking {
  const w = 494
  const h = 260
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const stripeH = h / 13
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? FLAG_RED : FLAG_WHITE
    ctx.fillRect(0, i * stripeH, w, stripeH)
  }
  const cantonW = w * 0.4
  const cantonH = stripeH * 7
  ctx.fillStyle = FLAG_NAVY
  ctx.fillRect(0, 0, cantonW, cantonH)
  // Simplified 9×11 alternating star field — reads as stars from across a room.
  ctx.fillStyle = FLAG_WHITE
  const cols = 11
  const rows = 9
  const dx = cantonW / (cols + 1)
  const dy = cantonH / (rows + 1)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 !== 0) continue
      ctx.beginPath()
      ctx.arc((c + 1) * dx, (r + 1) * dy, dx * 0.22, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return { tex: texFromCanvas(canvas), w, h }
}

// The true skin radius of the first stage within a height band, sampled straight
// from the S-IC geometry (median radial distance of its vertices from the vehicle
// axis). Median shrugs off the systems tunnels and any stray fin vertices, so the
// decals sit flush on the actual body instead of a slightly-too-large estimate.
function bodyRadiusInBand(sic: Object3D, yLo: number, yHi: number): number | null {
  const v = new Vector3()
  const radii: number[] = []
  sic.updateWorldMatrix(true, false)
  sic.traverse((o) => {
    const m = o as Mesh
    const geo = m.geometry
    if (!m.isMesh || !geo?.attributes?.position) return
    m.updateWorldMatrix(true, false)
    const pos = geo.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 4000)) // cap the work
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      if (v.y >= yLo && v.y <= yHi) radii.push(Math.hypot(v.x, v.z))
    }
  })
  if (radii.length < 8) return null
  radii.sort((a, b) => a - b)
  return radii[Math.floor(radii.length * 0.5)]
}

// (Engine soot/scorch now lives in weathering.ts, alongside the body grime streaks.)

// --- Decal placement ----------------------------------------------------------

type Decal = {
  mark: Marking
  yCenter: number // world Y
  height: number // world units — arc width is derived from the texture aspect ratio
  opaque?: boolean // flag is opaque; text is an alpha cutout
}

function addDecal(parent: Group, rad: number, d: Decal): void {
  // Match the physical patch to the texture's aspect so it can't stretch/squish:
  // arcWidth / height === texW / texH  →  thetaLength = height·(texW/texH) / rad.
  const thetaLength = (d.height * (d.mark.w / d.mark.h)) / rad
  const geo = new CylinderGeometry(rad, rad, d.height, 96, 1, true, -thetaLength / 2, thetaLength)
  const mat = new MeshStandardMaterial({
    map: d.mark.tex,
    transparent: false,
    alphaTest: d.opaque ? 0 : 0.5,
    side: FrontSide,
    roughness: 0.62,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
  const mesh = new Mesh(geo, mat)
  mesh.position.y = d.yCenter
  parent.add(mesh)
}

export function addMarkings(root: Object3D): void {
  if (root.userData.__markingsAdded) return

  let sic: Object3D | undefined
  let s2: Object3D | undefined
  root.traverse((n) => {
    if (!sic && n.name === 'S-IC') sic = n
    if (!s2 && n.name === 'S-II') s2 = n
  })
  if (!sic) return

  root.updateMatrixWorld(true)
  const sicBox = new Box3().setFromObject(sic)
  if (sicBox.isEmpty()) return
  const yMin = sicBox.min.y
  const yMax = sicBox.max.y
  const h = yMax - yMin
  // Measure the first stage's true skin radius across the marking band so the decals
  // sit flush. Fall back to the S-II diameter (a fin-free 33-ft stage), then to the
  // fin-inclusive S-IC bbox, only if the geometry sample comes up empty.
  const measured = bodyRadiusInBand(sic, yMin + 0.28 * h, yMin + 0.52 * h)
  let bodyR: number
  if (measured != null) {
    bodyR = measured
  } else if (s2) {
    const b = new Box3().setFromObject(s2)
    bodyR = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2
  } else {
    bodyR = ((sicBox.max.x - sicBox.min.x) / 2) * 0.55
  }
  const rad = bodyR + 0.02 // barely proud of the skin; polygonOffset keeps it from z-fighting

  const aim = new Group()
  aim.rotation.y = FACE_ANGLE

  // US flag — mid-lower first stage, on the white body below the baked roll band.
  addDecal(aim, rad, {
    mark: flagTexture(),
    yCenter: yMin + 0.47 * h,
    height: 2.3,
    opaque: true,
  })
  // "USA" in red — below the flag, kept on the white body (clear of the dark skirt).
  addDecal(aim, rad, {
    mark: textTexture('USA', USA_RED),
    yCenter: yMin + 0.36 * h,
    height: 2.6,
  })

  // Parent to the S-IC node, preserving a world-origin/world-up transform so the
  // concentric decals stay centered on the vehicle axis and ride explode + isolate.
  const worldGroup = new Group()
  worldGroup.name = 'Markings'
  worldGroup.add(aim)
  sic.updateWorldMatrix(true, false)
  const local = new Matrix4().copy(sic.matrixWorld).invert()
  local.decompose(worldGroup.position, worldGroup.quaternion, worldGroup.scale)
  sic.add(worldGroup)
  sic.updateMatrixWorld(true)

  // "UNITED STATES" — vertical, black, on the second stage (where it lives on the
  // real vehicle). Parented to S-II so it rides that stage's explode move + isolate.
  if (s2) {
    const s2Box = new Box3().setFromObject(s2)
    const y2 = s2Box.min.y
    const h2 = s2Box.max.y - y2
    const measured2 = bodyRadiusInBand(s2, y2 + 0.45 * h2, y2 + 0.8 * h2)
    const rad2 =
      (measured2 ?? Math.max(s2Box.max.x - s2Box.min.x, s2Box.max.z - s2Box.min.z) / 2) + 0.02

    const aim2 = new Group()
    aim2.rotation.y = FACE_ANGLE
    addDecal(aim2, rad2, {
      mark: verticalTextTexture('UNITED STATES', '#14181f'),
      yCenter: y2 + 0.62 * h2,
      height: 0.5 * h2,
    })

    const wg2 = new Group()
    wg2.name = 'Markings-S2'
    wg2.add(aim2)
    s2.updateWorldMatrix(true, false)
    const local2 = new Matrix4().copy(s2.matrixWorld).invert()
    local2.decompose(wg2.position, wg2.quaternion, wg2.scale)
    s2.add(wg2)
    s2.updateMatrixWorld(true)
  }

  root.userData.__markingsAdded = true
}

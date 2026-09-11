import { Box3, Mesh, MeshStandardMaterial, Object3D } from 'three'

// Repaint a guest vehicle into the colours it actually flew in.
//
// The Sketchfab N1 ships in a plain white-and-grey studio livery, which is wrong and
// — worse for a size comparison — makes it read as a second Saturn V. The real N1 was
// olive-green over its three conical stages with white only from the payload shroud
// up; that green/white split is the silhouette everyone recognises.
//
// The split is by height in the model's own space (it measures y 56.8 → 95.1, an
// artefact of the Sketchfab export — Compare re-bases it at render time). Painted
// surfaces below the shroud line go olive; the black engines and the dark lattice
// interstages keep their own darks, since those read as shadow on the real vehicle.

const N1_SHROUD_Y = 76.2 // top of Block V — everything above is the white payload stack
const N1_OLIVE = '#6b7052' // grey-green of the launch photos, not a saturated forest green
const N1_LATTICE = '#39412c' // the tank domes seen through the open interstage trusses

// Material names in the N1 glb. "N1_White"/"N1_dtails" are painted surface (shells,
// fairings, bands); "N1_Motor" is the engines; "mtal_simple" is bare hardware.
const N1_PAINTED = /^(N1_White|N1_dtails)$/
const N1_TRUSS = /^N1_Green$/

function paint(mesh: Mesh, color: string, roughness: number): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  // The shared material is also on parts that must stay white, so clone per mesh.
  const painted = mats.map((m) => {
    if (!(m instanceof MeshStandardMaterial)) return m
    const c = m.clone()
    c.color.set(color)
    c.roughness = roughness
    c.metalness = 0
    c.needsUpdate = true
    return c
  })
  mesh.material = Array.isArray(mesh.material) ? painted : painted[0]
}

function paintN1(root: Object3D): void {
  root.updateWorldMatrix(true, true)
  const box = new Box3()
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name ?? ''
    if (N1_TRUSS.test(name)) {
      paint(mesh, N1_LATTICE, 0.7)
      return
    }
    if (!N1_PAINTED.test(name)) return
    box.setFromObject(mesh)
    if (box.isEmpty() || box.max.y > N1_SHROUD_Y) return // payload stack: stays white
    paint(mesh, N1_OLIVE, 0.6)
  })
}

// The Statue of Liberty scan ships 0.9 metallic. The studio environment is a few lit
// panels, not a sky, so a surface that metallic mostly mirrors the navy void and renders
// near black. The real statue's skin is verdigris — a mineral crust over the copper, not
// bare metal — so take it back to a dull, mostly diffuse finish. The scan's texture is
// grey (it carries the folds and shading, not the colour), so tint it: the texture is
// multiplied by the patina green. Its one material is used by nothing else, so no clone.
const LIBERTY_PATINA = '#a9dcc6' // pale verdigris; multiplies the grey scan

function dullLiberty(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof MeshStandardMaterial)) continue
      m.color.set(LIBERTY_PATINA)
      m.metalness = 0.15
      m.roughness = 0.75
      m.needsUpdate = true
    }
  })
}

// The Tinkercad LM ships every surface fully matte (glTF's default roughness of 1), which
// turns the gold foil wrap on the descent stage into mustard paint. Give the foil a
// metallic sheen to catch the studio lights and take the rest down to satin. Its
// materials are used by nothing else, so no clone.
const LM_FOIL = /^color_14789940$/ // the gold Kapton wrap

function sheenLM(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof MeshStandardMaterial)) continue
      const foil = LM_FOIL.test(m.name)
      m.metalness = foil ? 0.6 : 0.15
      m.roughness = foil ? 0.4 : 0.6
      m.needsUpdate = true
    }
  })
}

// Runs once per loaded model (useGLTF caches the scene, so guard it).
export function applyLivery(model: string, root: Object3D): void {
  if (root.userData.__liveryPainted) return
  if (/n1/i.test(model)) paintN1(root)
  else if (/liberty/i.test(model)) dullLiberty(root)
  else if (/lunar-module/i.test(model)) sheenLM(root)
  root.userData.__liveryPainted = true
}

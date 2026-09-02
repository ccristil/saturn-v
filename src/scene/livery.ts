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

// Runs once per loaded model (useGLTF caches the scene, so guard it).
export function applyLivery(model: string, root: Object3D): void {
  if (root.userData.__liveryPainted) return
  if (/n1/i.test(model)) paintN1(root)
  root.userData.__liveryPainted = true
}

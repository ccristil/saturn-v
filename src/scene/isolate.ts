import { Box3, Vector3, Object3D, Mesh, Material, MeshStandardMaterial, Color } from 'three'

// TODO: replace spatial selection with a real mesh-name → stage map so
// Hotspot.isolate can drive this by name (also needed for exploded-stage view).
const KEEP_BOTTOM_FRACTION = 0.18
const DIM = 0.18 // how far dimmed meshes drop toward black

function dimMaterial(src: Material): Material {
  const clone = src.clone()
  if (clone instanceof MeshStandardMaterial) {
    clone.color = clone.color.clone().multiplyScalar(DIM)
    clone.emissive = new Color(0x000000)
    clone.metalness = Math.min(clone.metalness, 0.2)
  } else {
    // Generic fallback for any non-standard material.
    const anyMat = clone as unknown as { color?: Color }
    if (anyMat.color) anyMat.color = anyMat.color.clone().multiplyScalar(DIM)
  }
  clone.needsUpdate = true
  return clone
}

export function applyEngineIsolate(root: Object3D): void {
  const box = new Box3().setFromObject(root)
  const thresholdY = box.min.y + (box.max.y - box.min.y) * KEEP_BOTTOM_FRACTION

  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const centerY = new Box3().setFromObject(mesh).getCenter(new Vector3()).y
    if (centerY <= thresholdY) return // keep engines/base lit

    if (mesh.userData.__origMat === undefined) {
      mesh.userData.__origMat = mesh.material
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => dimMaterial(m))
        : dimMaterial(mesh.material)
    }
  })
}

export function clearEngineIsolate(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh && mesh.userData.__origMat !== undefined) {
      mesh.material = mesh.userData.__origMat as Material | Material[]
      mesh.userData.__origMat = undefined
    }
  })
}

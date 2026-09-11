import { Object3D, Mesh, Material, MeshStandardMaterial, Color } from 'three'

// The devPilot model groups meshes under named stage nodes: S-IC, S-II, S-IVB,
// Interstage, S-II_Top, Instrument_Unit (with engines nested inside their stage).
// isolate keeps the named stages' subtrees lit and dims everything else.

const DIM = 0.18 // how far dimmed meshes drop toward black

function dimMaterial(src: Material): Material {
  const clone = src.clone()
  if (clone instanceof MeshStandardMaterial) {
    clone.color = clone.color.clone().multiplyScalar(DIM)
    clone.emissive = new Color(0x000000)
    clone.metalness = Math.min(clone.metalness, 0.2)
  } else {
    const anyMat = clone as unknown as { color?: Color }
    if (anyMat.color) anyMat.color = anyMat.color.clone().multiplyScalar(DIM)
  }
  // Each stage's ends hide inside the shroud of its neighbour, often on the very
  // same radius (S-II's aft skirt and the interstage are both r 5.05). Lit alike
  // the z-fight is invisible; lit vs dimmed it shimmers grey. Bias dimmed meshes
  // toward the camera so the shroud — the outer skin — wins those ties.
  clone.polygonOffset = true
  clone.polygonOffsetFactor = -1
  clone.polygonOffsetUnits = -4
  clone.needsUpdate = true
  return clone
}

export function applyStageIsolate(root: Object3D, keepStages: string[]): void {
  const keep = new Set(keepStages)

  const walk = (node: Object3D, kept: boolean) => {
    const nowKept = kept || keep.has(node.name)
    const mesh = node as Mesh
    if (mesh.isMesh && !nowKept && mesh.userData.__origMat === undefined) {
      mesh.userData.__origMat = mesh.material
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => dimMaterial(m))
        : dimMaterial(mesh.material)
    }
    for (const child of node.children) walk(child, nowKept)
  }

  walk(root, false)
}

export function clearStageIsolate(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh && mesh.userData.__origMat !== undefined) {
      mesh.material = mesh.userData.__origMat as Material | Material[]
      mesh.userData.__origMat = undefined
    }
  })
}

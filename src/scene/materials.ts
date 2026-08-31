import { Object3D, Mesh, MeshStandardMaterial } from 'three'

// Give the model a more believable metallic read once there's an environment to
// reflect (see <Environment> in App.tsx): the engines and metal rings reflect like
// real hardware, while the painted body keeps a satin — not glossy — finish so it
// still looks like Apollo 11's matte white paint rather than plastic.
//
// Runs once, editing the GLB's shared materials in place. isolate.ts clones these
// when it dims a stage, so the tuned look is preserved through hotspots.

type Kind = 'metal' | 'body' | 'detail'

// The devPilot meshes are named by material family: "*_Non_Metal_*" is the painted
// body, "*_Metal_*" is bare metal (engines, rings, skirts). Check Non_Metal first —
// it contains "Metal" as a substring.
function classify(meshName: string): Kind {
  if (/Non_Metal/i.test(meshName)) return 'body'
  if (/Metal/i.test(meshName)) return 'metal'
  return 'detail'
}

function tune(mat: MeshStandardMaterial, kind: Kind): void {
  if (kind === 'metal') {
    mat.metalness = 0.92
    mat.roughness = Math.min(mat.roughness || 0.5, 0.32)
    mat.envMapIntensity = 1.5
  } else if (kind === 'body') {
    mat.metalness = Math.min(mat.metalness || 0, 0.1)
    mat.roughness = 0.52 // satin — a soft sheen, not a mirror
    mat.envMapIntensity = 0.55
  } else {
    mat.envMapIntensity = 0.7
  }
  mat.needsUpdate = true
}

export function applyMetallicLook(root: Object3D): void {
  if (root.userData.__matTuned) return
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const kind = classify(mesh.name)
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (m instanceof MeshStandardMaterial) tune(m, kind)
    }
  })
  root.userData.__matTuned = true
}

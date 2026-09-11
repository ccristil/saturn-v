import type { Material, Mesh, Object3D } from 'three'

// Fades whole parts of the scene out and back in (Homecoming.tsx lets the vehicle go piece by
// piece). Materials are shared across a model — one "Metal" for every stage — so each mesh
// gets its own transparent clone for as long as the fader lives, and its own material back
// from restore(). Same bookkeeping as isolate.ts, under its own key, so the two never trade
// each other's materials.
//
// Build every fader before anything starts to fade: a transparent material is a different
// shader, and compiling them all at once up front beats a stall as each part starts to go.
// The clones are kept on the mesh between runs, never disposed: disposing them would throw
// their compiled shaders away, and every run would stall compiling them again. So the first
// run of a session compiles them, and the rest start clean.

const KEY = '__fadeMat' // the mesh's own material, while a fader holds it
const CLONES = '__fadeClones' // its transparent clones, and which material they were made from

type Kept = { from: Material | Material[]; clones: Material[] }

export type Fader = {
  set(alpha: number): void // 1 = as built, 0 = gone (hidden outright)
  restore(): void
}

export function fader(nodes: Object3D[]): Fader {
  const shown = nodes.map((n) => n.visible)
  const faded: { mesh: Mesh; clones: Material[]; base: number[] }[] = []
  for (const node of nodes)
    node.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh || mesh.userData[KEY] !== undefined) return
      const own = mesh.material
      const list = Array.isArray(own) ? own : [own]
      let kept = mesh.userData[CLONES] as Kept | undefined
      if (!kept || kept.from !== own) {
        const clones = list.map((m) => {
          const c = m.clone()
          c.transparent = true
          return c
        })
        kept = { from: own, clones }
        mesh.userData[CLONES] = kept
      }
      const base = list.map((m) => m.opacity)
      kept.clones.forEach((c, i) => (c.opacity = base[i])) // a run dropped mid-fade left them faded
      mesh.userData[KEY] = own
      mesh.material = Array.isArray(own) ? kept.clones : kept.clones[0]
      faded.push({ mesh, clones: kept.clones, base })
    })

  let alpha = 1
  return {
    set(a) {
      nodes.forEach((n, i) => (n.visible = shown[i] && a > 0))
      if (a === alpha) return
      alpha = a
      for (const f of faded) f.clones.forEach((c, i) => (c.opacity = f.base[i] * a))
    },
    restore() {
      nodes.forEach((n, i) => (n.visible = shown[i]))
      for (const f of faded) {
        f.mesh.material = f.mesh.userData[KEY] as Material | Material[]
        f.mesh.userData[KEY] = undefined
      }
      faded.length = 0
    },
  }
}

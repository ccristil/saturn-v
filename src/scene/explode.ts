import { Object3D, Vector3, Matrix4 } from 'three'

// Cumulative upward offset (world units) for each top-level stage group, bottom → top.
// Engines are nested under their stage, so they travel with it; opening these gaps
// reveals each stage's engine cluster. Tuned live.
export const STAGE_OFFSETS: { name: string; dy: number }[] = [
  { name: 'S-IC', dy: 0 },
  { name: 'Interstage', dy: 14 },
  { name: 'S-II', dy: 28 },
  { name: 'S-II_Top', dy: 42 },
  { name: 'S-IVB', dy: 56 },
  { name: 'Instrument_Unit', dy: 70 },
]

export type StageMove = { node: Object3D; base: Vector3; offset: Vector3 }

// For each stage, capture its base local position and the parent-local vector that
// equals a world-up offset of `dy` (robust to the model's up-axis rotation/scale).
// Call AFTER any displacement fixup so bases are final.
export function computeStageMoves(root: Object3D): StageMove[] {
  root.updateMatrixWorld(true)
  const byName = new Map<string, Object3D>()
  root.traverse((n) => {
    if (n.name && !byName.has(n.name)) byName.set(n.name, n)
  })

  const moves: StageMove[] = []
  for (const { name, dy } of STAGE_OFFSETS) {
    const node = byName.get(name)
    if (!node || !node.parent) continue
    if (dy === 0) {
      moves.push({ node, base: node.position.clone(), offset: new Vector3() })
      continue
    }
    node.parent.updateMatrixWorld(true)
    const inv = new Matrix4().copy(node.parent.matrixWorld).invert()
    const wp = new Vector3().setFromMatrixPosition(node.matrixWorld)
    const a = wp.clone().applyMatrix4(inv)
    const b = wp.clone().add(new Vector3(0, dy, 0)).applyMatrix4(inv)
    moves.push({ node, base: node.position.clone(), offset: b.sub(a) })
  }
  return moves
}

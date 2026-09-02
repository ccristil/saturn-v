import type { Group } from 'three'

// The slow turn used on the deck's last slide. Shared so every vehicle on screen
// turns at the same rate, from the same start — two rockets side by side have to
// rotate together or the comparison reads as an animation glitch.

export const SPIN_SPEED = 0.35 // rad/s — ~18s per revolution

// Advance one frame of the turn. When the spin stops, ease the rotation back to front
// (0) rather than leaving the vehicle parked at an arbitrary angle — markings and
// callouts have to line up again for the walkthrough.
export function advanceSpin(group: Group | null, delta: number, spin: boolean) {
  if (!group) return
  if (spin) {
    group.rotation.y += delta * SPIN_SPEED
    return
  }
  if (group.rotation.y === 0) return
  // Normalize to (-π, π], then ease toward 0 by the shorter way round.
  let cur = group.rotation.y % (Math.PI * 2)
  if (cur > Math.PI) cur -= Math.PI * 2
  else if (cur < -Math.PI) cur += Math.PI * 2
  const next = cur * (1 - Math.min(1, delta * 3))
  group.rotation.y = Math.abs(next) < 0.002 ? 0 : next
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Quaternion, Vector3, type Group, type Object3D } from 'three'
import { DockedLM, rigFor, timeAt, uAt, useSpacecraftParts } from './Spacecraft'
import { DOCK_Y } from './csm'
import { fader, type Fader } from './fade'
import { clearStageIsolate } from './isolate'
import type { CamPose } from './CameraRig'

// "What came home?" — the spacecraft card's button. Of the whole stack only the command module
// came back; everything else was let go on the way. This lets the vehicle go piece by piece, in
// the order Apollo 11 did, until the command module is alone, and turns it slowly. Which parts
// go in each beat, its timing and its camera are content: HOMECOMING in hotspots.ts.
//
// Like Spacecraft.tsx it's a pure function of one timeline number `u` (beat k fades its parts
// out as u runs from k−1 to k), so closing it rewinds exactly: everything fades back, fast,
// while the camera flies home. The rocket's own nose has no command module under its cover, so
// the detailed CSM and the LM go into it at their launch positions — the same parts, from the
// same cache, as the Spacecraft button's.
//
// Stacked, the LM model is too tall for the adapter (LM_STOWED_DEPTH in Spacecraft.tsx): it
// perches on the adapter's fixed ring with its roof up inside the engine bell, and the
// Spacecraft view never shows it until the bell has pulled clear. Here the bell stays put while
// the LM comes into view, so the LM sits lower instead, its tunnel just clear of the bell; its
// folded legs sink into the Instrument Unit, out of sight until that goes too.

const BELL_GAP = 0.1 // metres between the SPS bell's exit and the top of the LM's tunnel
const REWIND = 4 // beats per second when closing
const SHADOW = 'Ground_Shadow' // the floor's contact shadow (Ground.tsx) — it goes with the S-IC
const Y = new Vector3(0, 1, 0)
const _roll = new Quaternion()
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smoothstep = (t: number) => t * t * (3 - 2 * t)

type Beat = { name: string; parts: string[]; seconds: number; hold: number; camera: CamPose }

// Every node carrying one of these names: a stage, a nosecone part, the LM, the SM.
function findParts(root: Object3D, names: string[], beat: string): Object3D[] {
  const found: Object3D[] = []
  for (const name of names) {
    const before = found.length
    root.traverse((n) => {
      if (n.name === name) found.push(n)
    })
    // eslint-disable-next-line no-console
    if (found.length === before) console.warn(`[homecoming] no "${name}" in the scene (beat "${beat}")`)
  }
  if (names.includes('S-IC')) {
    const shadow = root.getObjectByName(SHADOW)
    if (shadow) found.push(shadow)
  }
  return found
}

export function Homecoming({
  model,
  beats,
  spinSpeed,
  present,
  onBeat,
  onSettled,
  at,
}: {
  model: string // the LM, path relative to BASE_URL
  beats: Beat[] // the zoom-out, one beat per part let go, then the command module alone
  spinSpeed: number // its turn at the end, radians per second
  present: boolean // false rewinds it; onSettled fires once the rocket is whole again
  onBeat: (beat: number) => void // which beat is playing — picks the camera
  onSettled: () => void
  at?: number // pins the timeline here instead of playing (the lab)
}) {
  const root = useThree((s) => s.scene)
  const { lm, csm, tunnel, booms, fold } = useSpacecraftParts(model)
  // The nose to build in. It can be opened while the rocket is still loading, so keep looking.
  const [top, setTop] = useState<Object3D | null>(() => root.getObjectByName('Spacecraft_Top') ?? null)
  const rig = useMemo(() => (top ? rigFor(top) : null), [top])
  const csmNode = useRef<Group>(null)
  const lmNode = useRef<Group>(null)
  const faders = useRef<Fader[] | null>(null)
  const clock = useRef({ t: 0, u: 0, roll: 0, beat: -1, settled: false, was: present })

  // However it ends — rewound, or dropped mid-fade — leave the rocket whole.
  useEffect(
    () => () => {
      faders.current?.forEach((f) => f.restore())
      faders.current = null
      if (rig) rig.noseCSM.visible = true
      fold.set(1) // and the shared LM model as it shipped
    },
    [rig, fold],
  )

  useFrame((_, dt) => {
    if (!top) {
      const found = root.getObjectByName('Spacecraft_Top')
      if (found) setTop(found)
      return
    }
    const csmN = csmNode.current
    const lmN = lmNode.current
    if (!rig || !csmN || !lmN) return
    // Every fader up front (see fade.ts), once the CSM and LM are in the nose. A hotspot's
    // dimming is cleared first, or its dimmed materials would be taken for the parts' own.
    if (!faders.current) {
      clearStageIsolate(root)
      faders.current = beats.map((b) => fader(findParts(root, b.parts, b.name)))
    }
    const c = clock.current
    const last = beats.length - 1
    const turning = (u: number) => clamp01(u - (last - 1)) // how far into the closing beat
    if (at !== undefined) {
      c.u = at
    } else if (present) {
      if (!c.was) {
        c.t = timeAt(c.u, beats) // reopened mid-rewind: carry on from here
        c.settled = false
        c.beat = -1
      }
      c.t += dt
      c.u = uAt(c.t, beats)
      c.roll += dt * spinSpeed * turning(c.u)
    } else {
      if (c.was) c.roll = Math.atan2(Math.sin(c.roll), Math.cos(c.roll)) // unwind the short way
      const before = c.u
      c.u = Math.max(0, c.u - dt * REWIND)
      c.roll = turning(before) > 0 ? (c.roll * turning(c.u)) / turning(before) : 0
      if (c.u === 0 && !c.settled) {
        c.settled = true
        onSettled()
      }
    }
    c.was = present
    const u = c.u

    // The detailed CSM takes over from the rocket's stand-in as soon as anything goes.
    rig.noseCSM.visible = u <= 0
    csmN.visible = u > 0
    lmN.visible = u > 0
    const stacked = rig.keys.at[0]
    csmN.position.copy(stacked.p)
    csmN.quaternion.copy(_roll.setFromAxisAngle(Y, c.roll)).multiply(stacked.q)
    // The LM upright under the CSM, in the docked frame — whose flip puts the tunnel's ring
    // (DOCK_Y up that frame) DOCK_Y below its origin — lowered until the ring sits BELL_GAP
    // under the bell's exit.
    lmN.position.set(0, stacked.p.y + DOCK_Y - BELL_GAP, 0)
    lmN.quaternion.copy(rig.keys.at[4].q)
    fold.set(0) // legs folded, as it rode
    // The booms rode folded in the adapter too, and stowed they'd only poke into the LM.
    if (booms.hga) booms.hga.visible = false
    if (booms.flood) booms.flood.visible = false
    faders.current.forEach((f, k) => {
      if (k > 0) f.set(1 - smoothstep(clamp01(u - (k - 1))))
    })

    const beat = Math.ceil(u)
    if (present && at === undefined && beat !== c.beat) {
      c.beat = beat
      onBeat(beat)
    }
  })

  if (!top || !rig) return null
  // Mounted inside the rocket's own nose group, as the Spacecraft view is; metres inside.
  return createPortal(
    <group scale={rig.k}>
      <group ref={csmNode} visible={false}>
        <primitive object={csm} />
      </group>
      <group ref={lmNode} visible={false}>
        {/* HOMECOMING names it "LM": the fade gets a group of its own, lmNode's visibility stays ours */}
        <group name="LM">
          <DockedLM lm={lm} tunnel={tunnel} />
        </group>
      </group>
    </group>,
    top,
  )
}

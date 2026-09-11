import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Group, Matrix4, Quaternion, Vector3, type Mesh, type Object3D } from 'three'
import { applyLivery } from './livery'
import { buildCSM, buildLMTunnel, FLOOD_STOWED, HGA_STOWED, LM_HATCH_Y, SM_AFT_Y } from './csm'
import { gearFold, type GearFold } from './lmgear'
import { IU_RADIUS_M } from './nosecone'
import type { CamPose } from './CameraRig'

// The Apollo spacecraft coming out of the rocket: Apollo 11's transposition, docking and
// extraction, played on the Saturn V's own nose (nosecone.ts builds the adapter to come apart).
//
// After the S-IVB's translunar burn, the CSM separated, the adapter's four panels swung open
// and flew off, and the CSM backed away, turned end over end, came back and docked with the
// Lunar Module — still sitting on top of the S-IVB — then pulled it out. The LM never flew
// itself out. It plays as timed beats (SPACECRAFT_VIEW in hotspots.ts holds each beat's
// duration, pause and camera): the escape tower goes first (really three minutes after
// launch), then separation, the turn, docking, extraction, and a last beat that skips ahead
// to lunar orbit, where the legs come down (Apollo 11: "Landing Gear Deploy, Fire" at
// 098:14:35 GET, two hours before undocking) and the pair rolls slowly — that roll is
// presentation licence.
//
// Everything is a pure function of one number, `u` (0 = stacked; beat k runs u from k−1 to
// k), so it rewinds exactly: closing it plays the whole thing backwards, fast, while the
// camera flies home. The lab can pin it at any u.
//
// The CSM comes from csm.ts, the LM from CMFDesign's model (CC BY 4.0); both are sized from
// the adapter nosecone.ts built (itself scaled from the model's measured Instrument Unit), so
// the spacecraft fits the rocket it comes out of.

const DEG = Math.PI / 180

// The model's proportions don't all agree with the real LM — its legs splay ~18% wider than
// the real 9.45 m footpad span — so it's scaled by its body: the descent stage (4.22 m
// across, 78.8 model units) and ascent stage (4.29 m, 80.7 units) agree on 0.0534 m per
// unit (measured with lab/measure-lm.cjs).
const LM_M_PER_UNIT = 0.0534
// The LM's overhead docking hatch, in the glb's own scene space: the centre of the flat
// hatch disc on the ascent stage roof. Docked, it sits LM_HATCH_Y up the CSM's axis.
const LM_HATCH = new Vector3(-1.35, 41.86, 65.9)
// Docked clocking: the LM's front (forward hatch, porch, ladder leg) sits 60° round from the
// CM's crew hatch toward the crew's right (CSM/LM Operational Data Book, Fig. 2-4). The
// model's ladder leg lies along its −X/+Z diagonal; after the flip that's 225° in the CSM's
// frame, so it's rolled a further −165°.
const LM_ROLL = -165 * DEG
// The model has its roof antennas erected as on the lunar surface; in flight they were
// stowed, and nothing on a real LM crosses the CM's outline. Anything standing more than
// `from` metres off the roof within [rMin, rMax] of the tunnel axis would spear the Command
// Module's cone, so it's squashed down to a stub (`keep` of its height above `from`).
const TRIM = { rMin: 0.58, rMax: 1.0, from: 0.25, keep: 0.15 }

function trimDockingAntennas(root: Object3D): void {
  if (root.userData.__dockTrimmed) return
  root.updateMatrixWorld(true)
  const toRoot = new Matrix4().copy(root.matrixWorld).invert()
  const v = new Vector3()
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const rel = toRoot.clone().multiply(mesh.matrixWorld)
    const back = rel.clone().invert()
    const pos = mesh.geometry.attributes.position
    let touched = false
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(rel)
      const r = Math.hypot(v.x - LM_HATCH.x, v.z - LM_HATCH.z) * LM_M_PER_UNIT
      const d = (v.y - LM_HATCH.y) * LM_M_PER_UNIT
      if (r < TRIM.rMin || r > TRIM.rMax || d <= TRIM.from) continue
      v.y = LM_HATCH.y + (TRIM.from + (d - TRIM.from) * TRIM.keep) / LM_M_PER_UNIT
      v.applyMatrix4(back)
      pos.setXYZ(i, v.x, v.y, v.z)
      touched = true
    }
    if (touched) {
      pos.needsUpdate = true
      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    }
  })
  root.userData.__dockTrimmed = true
}

// --- The choreography: metres, in the adapter's frame (y up from the Instrument Unit's top,
// on the rocket's axis) ---
const CLOCK = 20 * DEG // the CSM's roll on the rocket
const LES_POP_M = 4 // beat 1: the escape tower pops clear of the CM it covered,
const LES_UP_M = 45 // then accelerates off,
const LES_ACROSS_M = 8 // away to one side,
const LES_TILT = 0.35 // pitching over (radians)
const SEPARATE_M = 12 // beat 2: the CSM backs off this far before turning;
const PANEL_OPEN = 45 * DEG // the adapter panels swing out to 45°
const PANEL_OPENS = 0.35 // over this much of the beat, then spring free —
const PANEL_FLING = 55 * DEG // tumbling on,
const PANEL_OUT_M = 30 // flying out
const PANEL_DROP_M = 8 // and falling back
const TURN_PIVOT = new Vector3(0, 5.2, 0) // beat 3: the CSM turns end over end about its middle,
const TURN_AXIS = new Vector3(0, 0, 1) // pitching across the picture
// How far the folded LM reaches below its hatch (footpad rims; lab/lmfit.cjs). This model's
// legs are longer than the real LM's, so stowed it's too tall for the space under the SPS
// bell: it perches on the adapter's fixed ring, and stays hidden until the bell is clear.
const LM_STOWED_DEPTH = 6.56
const EXTRACT_M = 12 // beat 5: the CSM pulls the LM this far out
const ORBIT_M = new Vector3(5, 6, 0) // beat 6: the pair drifts clear while the legs come down
const LM_SHOWS = 1.15 // the LM appears once the bell has cleared its roof — the panels still hide it
const HGA_SHOWS = 1.3 // so does the stowed high-gain antenna, until the CSM is clear of it
const REWIND = 4 // beats per second when closing
const BEATS = 7 // stacked + six moves — the content supplies each one's timing and camera

const Y = new Vector3(0, 1, 0)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

type Pose = { p: Vector3; q: Quaternion }
type Keys = { q0: Quaternion; pivot: Vector3; at: Pose[] }

// Where the CSM is at the end of each beat. The LM's place in the adapter follows from the
// docked pose, so the two always meet exactly.
function keyPoses(stackY: number, hatchAt: number): Keys {
  const q0 = new Quaternion().setFromAxisAngle(Y, CLOCK)
  const qd = new Quaternion().setFromAxisAngle(TURN_AXIS, Math.PI).multiply(q0)
  const stacked = { p: new Vector3(0, stackY, 0), q: q0 }
  const backedOff = { p: new Vector3(0, stackY + SEPARATE_M, 0), q: q0 }
  const pivot = backedOff.p.clone().add(TURN_PIVOT.clone().applyQuaternion(q0))
  const turned = { p: pivot.clone().sub(TURN_PIVOT.clone().applyQuaternion(qd)), q: qd }
  const docked = { p: new Vector3(0, hatchAt + LM_HATCH_Y, 0), q: qd }
  const extracted = { p: docked.p.clone().add(new Vector3(0, EXTRACT_M, 0)), q: qd }
  const orbit = { p: extracted.p.clone().add(ORBIT_M), q: qd }
  return { q0, pivot, at: [stacked, stacked, backedOff, turned, docked, extracted, orbit] }
}

const _turn = new Quaternion()
const _v = new Vector3()
function csmPose(u: number, K: Keys, p: Vector3, q: Quaternion): void {
  const k = Math.min(BEATS - 1, Math.max(1, Math.ceil(u)))
  const t = clamp01(u - (k - 1))
  // backing off is a push, then a coast: clear of the LM's roof fast, easing to a stop
  const s = k === 2 ? 1 - (1 - t) ** 3 : smootherstep(t)
  if (k === 3) {
    // the turn: about the CSM's middle, which stays put
    q.copy(_turn.setFromAxisAngle(TURN_AXIS, Math.PI * s)).multiply(K.q0)
    p.copy(K.pivot).sub(_v.copy(TURN_PIVOT).applyQuaternion(q))
  } else {
    q.copy(K.at[k].q)
    p.lerpVectors(K.at[k - 1].p, K.at[k].p, s)
  }
}

type Beat = { seconds: number; hold: number; camera: CamPose }

// Timeline position after t seconds of playing: beat 0 is only a pause (the camera arriving),
// then each beat's move runs u from k−1 to k over `seconds` and holds for `hold`.
export function uAt(t: number, beats: Beat[]): number {
  let T = beats[0].hold
  if (t < T) return 0
  for (let k = 1; k < beats.length; k++) {
    const b = beats[k]
    if (t < T + b.seconds) return k - 1 + (t - T) / b.seconds
    T += b.seconds
    if (t < T + b.hold) return k
    T += b.hold
  }
  return beats.length - 1
}
// …and back: the play time at timeline position u (to carry on forward after a rewind).
export function timeAt(u: number, beats: Beat[]): number {
  let T = beats[0].hold
  if (u <= 0) return 0
  for (let k = 1; k < beats.length; k++) {
    if (u <= k) return T + (u - (k - 1)) * beats[k].seconds
    T += beats[k].seconds + beats[k].hold
  }
  return T
}

// The adapter nosecone.ts built, and where the spacecraft goes in it.
export function rigFor(top: Object3D) {
  const layout = top.userData.tde as { R: number; fixedTop: number; bandTop: number } | undefined
  if (!layout) throw new Error('[Spacecraft] the rocket has no adapter to open (nosecone.ts layout missing)')
  const need = (name: string) => {
    const o = top.getObjectByName(name)
    if (!o) throw new Error(`[Spacecraft] nosecone part "${name}" is missing`)
    return o
  }
  const k = layout.R / IU_RADIUS_M // scene units per metre
  const les = need('LES')
  return {
    k,
    noseCSM: need('Nose_CSM'),
    les,
    lesRest: les.userData.rest as Vector3,
    panels: [0, 1, 2, 3].map((i) => {
      const hinge = need(`SLA_Panel_${i}`)
      return {
        hinge,
        open: need(`SLA_Panel_${i}_Open`),
        rest: hinge.userData.rest as Vector3,
        out: new Vector3(Math.sin(hinge.rotation.y), 0, Math.cos(hinge.rotation.y)),
      }
    }),
    // stacked, the SM's aft end sits on the adapter's band; the LM's footpads on its fixed ring
    keys: keyPoses(layout.bandTop / k - SM_AFT_Y, layout.fixedTop / k + LM_STOWED_DEPTH + 0.02),
  }
}
type Rig = ReturnType<typeof rigFor>

// The rocket's own parts: the escape tower flies off in beat 1, the adapter opens in beat 2.
function poseNose(rig: Rig, u: number): void {
  const { k } = rig
  rig.noseCSM.visible = u <= 0 // the detailed CSM takes over as soon as anything moves
  const s = clamp01(u)
  rig.les.visible = u < 1
  // the pop is near-instant: the cover fits the CM, but the detailed CSM's umbilical housing
  // (on the far side) stands proud of its skirt until it's off
  const rise = LES_POP_M * smootherstep(clamp01(s / 0.06)) + (LES_UP_M - LES_POP_M) * clamp01((s - 0.06) / 0.94) ** 2
  rig.les.position.set(rig.lesRest.x + LES_ACROSS_M * k * s * s, rig.lesRest.y + rise * k, rig.lesRest.z)
  rig.les.rotation.z = -LES_TILT * s * s
  const sp = clamp01(u - 1)
  const opening = smootherstep(clamp01(sp / PANEL_OPENS))
  const flying = smootherstep(clamp01((sp - PANEL_OPENS) / (1 - PANEL_OPENS)))
  for (const panel of rig.panels) {
    panel.hinge.visible = u < 2
    panel.open.rotation.x = PANEL_OPEN * opening + PANEL_FLING * flying
    panel.hinge.position.copy(panel.rest).addScaledVector(panel.out, PANEL_OUT_M * k * flying)
    panel.hinge.position.y -= PANEL_DROP_M * k * flying
  }
}

type Booms = { hga: Object3D | undefined; flood: Object3D | undefined }
const _p = new Vector3()
const _q = new Quaternion()
const _roll = new Quaternion()

function pose(rig: Rig, u: number, roll: number, csmNode: Group, lmNode: Group, booms: Booms, fold: GearFold): void {
  poseNose(rig, u)
  // Legs folded for the adapter until the last beat — lunar orbit — brings them down.
  fold.set(smootherstep(clamp01(u - (BEATS - 2))))
  csmPose(u, rig.keys, _p, _q)
  csmNode.visible = u > 0
  csmNode.position.copy(_p)
  csmNode.quaternion.copy(_roll.setFromAxisAngle(Y, roll)).multiply(_q)
  // The LM waits in the adapter, placed so the docked CSM meets it exactly; once docked it
  // rides with the CSM.
  lmNode.visible = u >= LM_SHOWS
  if (u < 4) {
    lmNode.position.copy(rig.keys.at[4].p)
    lmNode.quaternion.copy(rig.keys.at[4].q)
  } else {
    lmNode.position.copy(csmNode.position)
    lmNode.quaternion.copy(csmNode.quaternion)
  }
  // The high-gain antenna and floodlight swing out during the turn.
  const deploy = smootherstep(clamp01(u - 2))
  if (booms.hga) {
    booms.hga.visible = u >= HGA_SHOWS
    booms.hga.rotation.x = HGA_STOWED * (1 - deploy)
  }
  if (booms.flood) {
    booms.flood.visible = u >= 2
    booms.flood.rotation.x = FLOOD_STOWED * (1 - deploy)
  }
}

// Built once and reused: the button can be pressed any number of times in a talk.
let csmCache: Group | null = null
let tunnelCache: Group | null = null

// The spacecraft's parts, shared with Homecoming.tsx (the two are never up at once): the
// detailed CSM and the LM's tunnel, built once; the LM from its glb, repainted and trimmed
// once; and its gear fold, which is cached on the model, so both drive the same one.
export function useSpacecraftParts(model: string) {
  const { scene: lm } = useGLTF(`${import.meta.env.BASE_URL}${model}`)
  const csm = useMemo(() => (csmCache ??= buildCSM()), [])
  const tunnel = useMemo(() => (tunnelCache ??= buildLMTunnel()), [])
  const booms = useMemo<Booms>(
    () => ({ hga: csm.getObjectByName('CSM_HGA_Pivot'), flood: csm.getObjectByName('CSM_Floodlight_Pivot') }),
    [csm],
  )
  useMemo(() => {
    applyLivery(model, lm)
    trimDockingAntennas(lm)
  }, [model, lm])
  const fold = useMemo(() => gearFold(lm), [lm])
  return { lm, csm, tunnel, booms, fold }
}

// The LM in the CSM's docked frame: its tunnel, then the LM flipped roof-first onto it.
export function DockedLM({ lm, tunnel }: { lm: Object3D; tunnel: Object3D }) {
  return (
    <>
      <primitive object={tunnel} />
      <group position-y={LM_HATCH_Y} rotation-y={LM_ROLL}>
        <group rotation-x={Math.PI} scale={LM_M_PER_UNIT}>
          <group position={[-LM_HATCH.x, -LM_HATCH.y, -LM_HATCH.z]}>
            <primitive object={lm} />
          </group>
        </group>
      </group>
    </>
  )
}

export function preloadSpacecraft(model: string) {
  useGLTF.preload(`${import.meta.env.BASE_URL}${model}`)
}

export function Spacecraft({
  model,
  beats,
  rollSpeed,
  present,
  onBeat,
  onSettled,
  at,
}: {
  model: string // the LM, path relative to BASE_URL
  beats: Beat[] // seven: stacked + the six moves, each with its timing and camera
  rollSpeed: number // the last beat's slow roll, radians per second
  present: boolean // false rewinds it; onSettled fires once it's stacked again
  onBeat: (beat: number) => void // which beat is playing — picks the camera
  onSettled: () => void
  at?: number // pins the timeline here instead of playing (the lab)
}) {
  const root = useThree((s) => s.scene)
  const { lm, csm, tunnel, booms, fold } = useSpacecraftParts(model)
  // The adapter to open. S can be pressed while the rocket is still loading, so keep looking
  // for it until it's there.
  const [top, setTop] = useState<Object3D | null>(() => root.getObjectByName('Spacecraft_Top') ?? null)
  const rig = useMemo(() => (top ? rigFor(top) : null), [top])
  const csmNode = useRef<Group>(null)
  const lmNode = useRef<Group>(null)
  const clock = useRef({ t: 0, u: 0, roll: 0, beat: -1, settled: false, was: present })

  useEffect(() => {
    // eslint-disable-next-line no-console
    if (beats.length !== BEATS) console.warn(`[Spacecraft] expected ${BEATS} beats, got ${beats.length}`)
  }, [beats])

  // However it ends — rewound, or dropped mid-move — leave the rocket whole.
  useEffect(
    () => () => {
      if (rig) poseNose(rig, 0)
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
    if (!rig || !csmNode.current || !lmNode.current) return
    const c = clock.current
    const last = BEATS - 1
    const lastBeat = (u: number) => clamp01(u - (last - 1)) // how far into the final beat
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
      c.roll += dt * rollSpeed * lastBeat(c.u)
    } else {
      if (c.was) c.roll = Math.atan2(Math.sin(c.roll), Math.cos(c.roll)) // unwind the short way
      const before = c.u
      c.u = Math.max(0, c.u - dt * REWIND)
      c.roll = lastBeat(before) > 0 ? (c.roll * lastBeat(c.u)) / lastBeat(before) : 0
      if (c.u === 0 && !c.settled) {
        c.settled = true
        onSettled()
      }
    }
    c.was = present
    pose(rig, c.u, c.roll, csmNode.current, lmNode.current, booms, fold)
    const beat = Math.ceil(c.u)
    if (present && at === undefined && beat !== c.beat) {
      c.beat = beat
      onBeat(beat)
    }
  })

  if (!top || !rig) return null
  // Mounted inside the rocket's own nose group, so it shares the adapter's frame (and rides
  // an explode reassembling underneath it); metres inside, scaled to scene units.
  return createPortal(
    <group scale={rig.k}>
      <group ref={csmNode} visible={false}>
        <primitive object={csm} />
      </group>
      <group ref={lmNode} visible={false}>
        <DockedLM lm={lm} tunnel={tunnel} />
      </group>
    </group>,
    top,
  )
}

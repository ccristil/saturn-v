export type Hotspot = {
  id: string
  order: number // 1-indexed, drives keyboard nav
  tag: string // "01" — shown in the callout marker
  title: string
  subtitle: string // one-line hook
  target: [number, number, number] // fallback point the leader line hits
  anchor?: string // model node name to anchor the leader line to (overrides target at runtime)
  camera: {
    position: [number, number, number]
    lookAt: [number, number, number]
  }
  body: string[] // paragraphs
  specs?: { label: string; value: string }[]
  image?: { src: string; alt: string; credit: string }
  isolate?: string[] // stage node names to keep lit; everything else dims
}

// Model credit — CC BY requires attribution.
export const MODEL_CREDIT = '“Apollo Saturn V Launch Vehicle” by devPilot · CC BY'

// devPilot model is ~91 units tall, engines at the base (Y ~0–6). After <Center>
// the stack spans Y ≈ -45.5 → +45.5, so the F-1 engines sit near Y ≈ -42.
// These are estimates — tuned live (press 'p' to capture).
export const HOME_CAMERA = {
  position: [50, 8, 130] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
}

// Wide framing for the exploded stack (it grows ~70 units taller when apart).
// Estimate — tuned live.
export const EXPLODE_CAMERA = {
  position: [90, 58, 235] as [number, number, number],
  lookAt: [0, 33, 0] as [number, number, number],
}

export const hotspots: Hotspot[] = [
  {
    id: 'f1-engines',
    order: 1,
    tag: '01',
    title: 'The engine that ate itself',
    subtitle: 'Placeholder hook — five F-1 engines, one very hard problem.',
    target: [0, -42, 6],
    anchor: 'F1', // the 5 F-1 engine nodes (F1, F1.001–004) — leader line hits their real center
    camera: {
      position: [14, -34, 34],
      lookAt: [0, -42, 0],
    },
    body: [
      'PLACEHOLDER. This is mock copy so the card has something to show. The presenter replaces every paragraph here with the real F-1 combustion-instability story.',
      'PLACEHOLDER. A second paragraph to prove multi-paragraph layout, spacing, and 18px legibility from across a room hold up on the projector.',
      'PLACEHOLDER. A short third beat to land the story before the presenter advances to the next hotspot.',
    ],
    specs: [
      { label: 'Thrust, each', value: '1.5M lbf' },
      { label: 'Engines', value: '5 × F-1' },
      { label: 'Propellant flow', value: '~3 t/s' },
    ],
    // Stage node names in the model: keep the whole first stage (incl. its F-1
    // engines) lit, dim the rest. Others: S-II, S-IVB, Interstage, Instrument_Unit.
    isolate: ['S-IC'],
  },
]

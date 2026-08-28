export type Hotspot = {
  id: string
  order: number // 1-indexed, drives keyboard nav
  tag: string // "01" — shown in the callout marker
  title: string
  subtitle: string // one-line hook
  target: [number, number, number] // point on the model the leader line hits
  camera: {
    position: [number, number, number]
    lookAt: [number, number, number]
  }
  body: string[] // paragraphs
  specs?: { label: string; value: string }[]
  image?: { src: string; alt: string; credit: string }
  isolate?: string[] // mesh names to keep lit (future; spatial for now)
}

// Wide "home" shot the presenter returns to (Esc / left-arrow past the first hotspot).
export const HOME_CAMERA = {
  position: [12, 3, 24] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
}

export const hotspots: Hotspot[] = [
  {
    id: 'f1-engines',
    order: 1,
    tag: '01',
    title: 'The engine that ate itself',
    subtitle: 'Placeholder hook — five F-1 engines, one very hard problem.',
    target: [0, -6, 1],
    camera: {
      position: [3.5, -4.5, 6],
      lookAt: [0, -6, 0],
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
    isolate: ['S-IC', 'F1_engines'],
  },
]

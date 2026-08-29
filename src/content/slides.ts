// Intro slide deck. Like hotspots, this is decoupled content — add/reorder slides
// here, no code change. Advancing past the last slide hands off into the 3D
// walkthrough (App starts hotspot 1). All copy here is PLACEHOLDER filler.
export type Slide = {
  id: string
  kind?: 'cover' | 'content'
  eyebrow?: string // small mono label above the title
  title: string
  subtitle?: string
  body?: string[]
}

export const slides: Slide[] = [
  {
    id: 'cover',
    kind: 'cover',
    eyebrow: 'Apollo · Saturn V',
    title: 'Saturn V',
    subtitle: 'Placeholder cover slide — the machine that took three people to the Moon.',
  },
  {
    id: 'slide-2',
    title: 'Filler slide two',
    body: [
      'PLACEHOLDER. Room to set up the story before we touch the vehicle.',
      'Add or edit slides in src/content/slides.ts — no code change needed.',
    ],
  },
  {
    id: 'slide-3',
    title: 'Filler slide three',
    subtitle: 'Placeholder — advance to step into the vehicle.',
    body: ['PLACEHOLDER. Advancing past this slide drops into the 3D walkthrough at the F-1 engines.'],
  },
]

// Intro slide deck. Like hotspots, this is decoupled content — add/reorder slides
// here, no code change. Advancing past the last slide hands off into the 3D
// walkthrough (App lands on the wide HOME shot).
export type TimelineStop = {
  year: string;
  label: string;
};

// A sound cue on a bullet. `src` is an asset path relative to BASE_URL (never a
// leading slash — Pages serves from /saturn-v/). Cues on one bullet play together, so
// a bed track wants a lower `volume` than what sits on top of it.
export type Cue = {
  src: string;
  volume?: number; // 0–1, default 1
  delay?: number; // ms after the bullet appears, default 0
};

// One reveal beat on a bulleted slide. The presenter steps through these with → /
// click before the deck advances to the next slide. `sounds` fire as the bullet
// appears — and stop if the presenter steps back off it — and `confetti` / `flyby`
// fire on the same beat.
export type Bullet = {
  text: string;
  sounds?: Cue[];
  confetti?: boolean;
  flyby?: string; // image path (relative to BASE_URL) sent across the top of the screen
};

// A second vehicle parked beside the Saturn V on this slide, scaled by its real
// height so the size comparison is honest. `model` is relative to BASE_URL.
export type Compare = {
  model: string;
  heightM: number;
  x?: number; // offset from the Saturn V's axis, in scene units (default: left of it)
};

export type Slide = {
  id: string;
  kind?: "cover" | "content" | "hero"; // 'hero' = last slide: a tiny spinning live model
  eyebrow?: string; // small mono label above the title
  title: string;
  subtitle?: string;
  body?: string[];
  bullets?: Bullet[]; // revealed one at a time by the presenter
  compare?: Compare; // a second vehicle beside the Saturn V, to scale
  timeline?: TimelineStop[]; // horizontal milestone axis; dots grow left → right
  span?: string; // label for the bracket drawn under the whole timeline
  kicker?: string; // one payoff line under the timeline
};

export const slides: Slide[] = [
  {
    id: "cover",
    kind: "cover",
    eyebrow: "Apollo · Saturn V",
    title: "Saturn V",
    subtitle:
      "Placeholder cover slide — the machine that took three people to the Moon.",
  },
  {
    id: "sixty-six-years",
    eyebrow: "1903 → 1969",
    title: "Sixty-six years",
    subtitle:
      "A child who stood on the sand at Kitty Hawk and watched the first powered flight was sixty-six years old when three men rode a controlled explosion to another world — and came home.",
    timeline: [
      { year: "1903", label: "Kitty Hawk. 12 seconds, 120 feet." },
      { year: "1927", label: "Lindbergh crosses the Atlantic, alone." },
      { year: "1947", label: "The X-1 breaks the sound barrier." },
      { year: "1957", label: "Sputnik. A beep from orbit." },
      { year: "1961", label: "Gagarin. 108 minutes, one lap of Earth." },
      { year: "1969", label: "Saturn V. Apollo 11 lands on the Moon." },
    ],
    span: "One human lifetime",
    kicker: "120 feet of powered flight → 240,000 miles, and back again.",
  },
  {
    id: "why-saturn-v",
    eyebrow: "The case",
    title: "Why the Saturn V",
    subtitle:
      "Three reasons this machine is still worth half an hour of your afternoon.",
    // DRAFT COPY — rewrite these two; the third is the payoff and carries the cue.
    bullets: [
      { text: "It flew thirteen times and never lost a crew." },
      {
        text: "Four hundred thousand people built it, and not one of them saw the whole thing.",
      },
      {
        text: "America.",
        sounds: [
          { src: "audio/eagle-noise.mp3" },
          // the anthem is 16.5s and runs as a bed under the eagle — ← stops it
          { src: "audio/the-star-spangled-banner.mp3", volume: 0.55 },
        ],
        confetti: true,
        flyby: "img/eagle-flying.gif",
      },
    ],
  },
  {
    id: "saturn-v-vs-russian-rocket",
    kind: "hero",
    title: "Russia 🇷🇺",
    subtitle: "What was Russia up to while America was building the Saturn V? ",
    body: [
      "PLACEHOLDER. Advancing past this slide grows the model into the full 3D walkthrough.",
    ],
    compare: { model: "models/n1.glb", heightM: 105.3 },
    bullets: [
      {
        text: "The N1 rocket was the Soviet Union's answer to the Saturn V.",
      },
    ],
  },
];

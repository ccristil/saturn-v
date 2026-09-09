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

// Two programs' elapsed times drawn as bars on ONE shared day-scale, so "they took the
// same amount of time" is something the room sees before the presenter says it. Lanes
// are revealed one per presenter step (the same → / ← mechanism `bullets` uses), so
// the second bar lands against the first; the `kicker`, if there is one, gets the
// final beat. `days` is the elapsed count — it drives the bar length, so the bars
// stay honest against each other and nothing is eyeballed.
export type RaceLane = {
  name: string;
  from: { date: string; note: string };
  to: { date: string; note: string };
  days: number;
  accent?: boolean; // draw in accent blue — the lane the slide is arguing about
};

export type Race = {
  lanes: RaceLane[];
};

// A to-scale height comparison drawn beside the slide's main column. The silhouettes
// are drawn in a viewBox measured in METRES and the label for each vehicle is placed
// by its own height, so the drawing is derived from `heightM` rather than eyeballed —
// change a number and the picture changes with it. The payload/height multiples under
// it are computed from the first two vehicles, so they can't drift either.
// `shape` selects a hand-authored silhouette path; those live in the UI, next to the
// rest of the geometry, and the numbers stay here with the rest of the content.
export type ScaleVehicle = {
  shape: "saturn-v" | "falcon-1";
  name: string;
  heightM: number;
  payloadKg: number; // to low Earth orbit
  accent?: boolean; // drawn in accent blue — matches its lane in the race above
};

export type Scale = {
  eyebrow?: string;
  vehicles: ScaleVehicle[]; // tallest first
};

// A full-bleed interactive page embedded as the slide. `src` is relative to BASE_URL.
// The page is self-contained and works opened on its own; the slide's own eyebrow /
// title / subtitle are handed to it on the query string, so this slide's copy still
// lives here with every other slide's rather than inside the embedded file.
export type EmbeddedMap = {
  src: string;
};

// A set of photos shown one at a time on a single slide. The presenter steps through
// them with → / ← without leaving the slide; each crossfades into the last. The
// first photo is already up when the slide arrives, so a gallery costs one presenter
// beat fewer than it has images. `src` is relative to BASE_URL.
export type Gallery = {
  images: { src: string; alt: string; caption?: string }[];
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
  image?: { src: string; alt: string; caption?: string }; // photo alongside the slide text; `src` is relative to BASE_URL
  body?: string[];
  bullets?: Bullet[]; // revealed one at a time by the presenter
  // A trailing presenter beat that changes nothing on screen: its only job is to
  // take any sound still playing down to silence over this many ms. Lets the
  // presenter keep talking over the slide instead of having to leave it to stop the
  // music. (\u2190 off the beat still cuts the sound dead \u2014 that stays the kill switch.)
  fadeCues?: number;
  race?: Race; // two elapsed-time bars on a shared scale, revealed one per step
  scale?: Scale; // to-scale silhouettes in a right-hand column beside the main content
  compare?: Compare; // a second vehicle beside the Saturn V, to scale
  gallery?: Gallery; // photos stepped one at a time on this slide, crossfading
  map?: EmbeddedMap; // full-bleed embedded page; suppresses this slide's own text
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
    subtitle: "The craziest thing humans ever built.",
    image: {
      src: "img/saturn-v-apollo-4-the-night-before-launch-november-8-1967-v0-9hN-jgxuNa2UWHKDnry8iSaSl65IEKYD0e-TwlTjchI.webp",
      alt: "Apollo 4, the night before launch — November 8, 1967",
      caption:
        "Saturn V, the night before the Apollo 4 launch — November 8, 1967",
    },
  },
  {
    id: "sixty-six-years",
    eyebrow: "1903 → 1969",
    title: "Sixty-six years",
    subtitle:
      "If you were 9 years old when the Wright brothers flew, you were 75 when Apollo 11 landed on the Moon.",
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
    id: "same-six-and-a-half-years",
    eyebrow: "1961 \u2192 1967  \u00b7  2002 \u2192 2008",
    title: "The same six and a half years",
    // DRAFT COPY \u2014 the subtitle + kicker are the presenter's to rewrite. The dates and
    // day counts are load-bearing, though: the bars are drawn from `days`.
    subtitle:
      "SpaceX had CAD, laptops, simulation, Slack, and fifty years of hindsight. It still took thirty-one days longer.",
    race: {
      lanes: [
        {
          name: "NASA",
          from: { date: "May 25, 1961", note: "JFK commits to the Moon" },
          to: {
            date: "Nov 9, 1967",
            note: "Apollo 4 \u2014 first Saturn V flies",
          },
          days: 2359,
          accent: true,
        },
        {
          name: "SpaceX",
          from: { date: "Mar 14, 2002", note: "Incorporated" },
          to: { date: "Sep 28, 2008", note: "RatSat reaches orbit" },
          days: 2390,
        },
      ],
    },
    kicker:
      "And NASA's was the first Saturn V ever flown \u2014 all-up, first try. RatSat was Falcon 1's fourth attempt; the first three fell in the ocean.",
    // Same six and a half years \u2014 but not the same machine at the end of them.
    scale: {
      eyebrow: "What each one built",
      vehicles: [
        {
          shape: "saturn-v",
          name: "Saturn V",
          heightM: 110.6,
          payloadKg: 140000,
          accent: true,
        },
        { shape: "falcon-1", name: "Falcon 1", heightM: 22.25, payloadKg: 670 },
      ],
    },
  },
  {
    id: "why-saturn-v",
    eyebrow: "The case",
    title: "Why the Saturn V",
    subtitle:
      "Three reasons this machine is still worth half an hour of your afternoon.",
    image: {
      src: "img/saturn-v-in-flight.jpg",
      alt: "A Saturn V climbing away from the pad, first stage burning",
    },
    // DRAFT COPY — rewrite these two; the third is the payoff and carries the cue.
    bullets: [
      { text: "It was built in the 60s." },
      {
        text: "~400,000 people built it, and not one of them saw the whole thing.",
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
    // One more \u2192 tapers the anthem out over 4.5s, so the presenter can talk through
    // the slide's points without the music under them and without a hard cut.
    fadeCues: 4500,
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
  {
    id: "made-in-the-usa",
    title: "Made in the USA 🇺🇸",
    // DRAFT COPY — presenter rewrites. The map's data (sites, contractors, routes)
    // lives in public/map/assembly-map.html, which is a standalone page in its own
    // right; only these three lines are passed in from here.
    subtitle:
      "Stages were built across the country and then trucked, floated, and flown to the Kennedy Space Center for assembly.",
    map: { src: "map/assembly-map.html" },
  },
  {
    id: "moving-the-stages",
    eyebrow: "Getting it to the Cape",
    // DRAFT COPY — presenter rewrites the title/subtitle. The captions are factual and
    // belong to their photos.
    title: "You can't ship it in a box",
    subtitle:
      "Every stage was too big for a road and too big for a runway. So they went by water — and when they couldn't wait for the water, they built an aeroplane around them.",
    gallery: {
      images: [
        {
          src: "img/saturn-v-seal-beach-tranport.webp",
          alt: "An S-II second stage moved out of the North American Aviation plant at Seal Beach, California",
          caption:
            "Seal Beach, California — an S-II second stage leaves the plant on its way to the water.",
        },
        {
          src: "img/saturn-v-from-ca-to-fl.jpg",
          alt: "A Saturn V stage on a barge, travelling from California to Florida",
          caption:
            "California to Florida the long way: down the Baja coast, through the Panama Canal, up into the Gulf.",
        },
        {
          src: "img/guppy-transport.jpeg",
          alt: "The Pregnant Guppy transport aircraft on the ground",
          caption:
            "The Pregnant Guppy — a Boeing Stratocruiser cut open and rebuilt around its cargo.",
        },
        {
          src: "img/pregant-guppy-in-flight.jpeg",
          alt: "The Pregnant Guppy in flight",
          caption: "And then it flies. Somehow.",
        },
      ],
    },
  },
];

// The presenter-stepped beats on a slide, in the order they land. A bulleted slide
// steps its bullets. A race slide steps each lane, then the kicker, then the to-scale
// drawing — so the payoff line and the exhibit each get a beat of their own instead
// of arriving with the last bar. App drives `revealed` from `count`; Presentation
// decides what to show from the same beats, so the two can't fall out of step.
export function slideSteps(slide?: Slide) {
  const lanes = slide?.race?.lanes.length ?? 0;
  const kicker = slide?.race && slide.kicker ? 1 : 0;
  const scale = slide?.race && slide.scale ? 1 : 0;
  const fade = slide?.fadeCues ? 1 : 0; // the silent tail beat, always last
  // A gallery steps photo-to-photo. The first one is already on screen when the slide
  // arrives, so the set costs one beat fewer than it has images.
  const gallery = slide?.gallery ? slide.gallery.images.length - 1 : 0;
  const shown = slide?.bullets
    ? slide.bullets.length
    : slide?.gallery
      ? gallery
      : lanes + kicker + scale;
  return {
    kickerBeat: lanes + 1,
    scaleBeat: lanes + kicker + 1,
    fadeBeat: shown + 1,
    count: shown + fade,
  };
}

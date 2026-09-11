export type Hotspot = {
  id: string;
  order: number; // 1-indexed, drives keyboard nav
  tag: string; // "01" — shown in the callout marker
  title: string;
  subtitle: string; // one-line hook
  bracket: string[]; // model nodes the stage's bracket spans — it covers the union of their bounds
  span: [number, number]; // fallback [bottom, top] y for the bracket, if those nodes aren't in the scene
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
  };
  body: string[]; // paragraphs
  specs?: { label: string; value: string }[];
  images?: { src: string; alt: string; credit: string }[]; // cycled in the card, one at a time
  clips?: Clip[]; // YouTube snippets — same gallery, after any images; each plays on click
  isolate?: string[]; // stage node names to keep lit; everything else dims
};

// A snippet of a YouTube video, played in the card when clicked (muted — the footage is
// silent). `from`/`to` are timestamps in the video, written the way YouTube shows them.
export type Clip = {
  youtube: string; // the video id: youtu.be/<id> or youtube.com/watch?v=<id>
  from: string; // "m:ss"
  to: string; // "m:ss"
  label: string; // on the poster
  credit: string;
};

// Model credit — CC BY requires attribution.
export const MODEL_CREDIT =
  "“Apollo Saturn V Launch Vehicle” by devPilot · CC BY";
// Shown only while that vehicle is on screen (its slide's `compare`). CC BY 4.0, from
// the glb's own asset.extras — attribution is required, same as the Saturn V.
export const COMPARE_CREDIT = "“N1 rocket” by Scilence · CC BY 4.0";

// Model renders in its own space (no <Center>): engines at the base (Y ~0–6), the
// instrument unit at ~Y 83, and the rebuilt spacecraft + escape tower on top of it
// reach ~Y 115 (see nosecone.ts). The assembled center is therefore ~Y 57. Orbit +
// all cameras target that center. Tuned live via headless screenshots.
export const ORBIT_TARGET = [0, 57, 0] as [number, number, number];

export const HOME_CAMERA = {
  position: [56, 57, 176] as [number, number, number],
  lookAt: ORBIT_TARGET,
};

// Wide framing for the exploded stack (it grows ~70 units taller when apart, so the
// tower-topped stack reaches ~Y 185).
export const EXPLODE_CAMERA = {
  position: [104, 100, 292] as [number, number, number],
  lookAt: [0, 90, 0] as [number, number, number],
};

// Hero preview for the last ("hero") slide: the whole rocket framed small and pushed
// to the RIGHT of screen so the deck text sits on the left. The target is offset left
// of the vehicle axis (x=0), so the on-axis rocket renders right of center; the far
// distance shrinks it. On "next" the camera eases from here to HOME — the tiny spinning
// model grows into the real thing. Tuned live via screenshots.
export const HERO_CAMERA = {
  position: [26, 60, 344] as [number, number, number],
  lookAt: [-54, 50, 0] as [number, number, number],
};

// Same idea as HERO_CAMERA, but framing two vehicles parked side by side (a slide
// with `compare` set): pulled back and targeted further left, so the pair sits in the
// right half of the screen with the deck text clear of it.
export const COMPARE_CAMERA = {
  position: [22, 62, 300] as [number, number, number],
  lookAt: [-58, 56, 0] as [number, number, number],
};

// The HUD's "Compare" button (or `C`): the Statue of Liberty slides in from the right
// and parks beside the Saturn V, scaled by real height (Compare.tsx measures the live
// stack, so nothing here is a size guess), with both heights marked in feet.
// `heightM` is the copper statue alone, heel to torch — the model has no pedestal.
export const LIBERTY_COMPARE = {
  model: "models/liberty.glb",
  heightM: 46.05,
  x: 30, // where it parks: right of the Saturn V's axis, scene units
  enterFrom: 150, // starts this far further right — off screen — and slides in
  names: { saturn: "Saturn V", guest: "Statue of Liberty" },
  credit: "“Statue of Liberty” by Maurice Svay · CC BY 4.0",
  camera: {
    position: [60, 64, 205] as [number, number, number],
    lookAt: [12, 62, 0] as [number, number, number],
  },
};

// The HUD's "Spacecraft" button (or `S`): Apollo 11's transposition, docking and
// extraction, played out of the Saturn V's own nose (Spacecraft.tsx), then a skip ahead to
// lunar orbit where the LM's legs come down. It plays straight through; Esc or S rewinds it.
// One entry per beat, in order. The moves themselves are fixed in Spacecraft.tsx, so there
// are always seven: stacked, tower off, separate, turn around, dock, extract, lunar orbit.
// `seconds` is how long the move takes, `hold` the pause after it; the camera eases (1 s)
// to the beat's pose as its move starts.
export type SpacecraftBeat = {
  name: string; // which move — for whoever re-times it, never shown
  seconds: number;
  hold: number;
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
  };
};
export const SPACECRAFT_VIEW: {
  model: string;
  credit: string;
  rollSpeed: number;
  beats: SpacecraftBeat[];
} = {
  model: "models/lunar-module.glb",
  credit: "“Apollo 11 Lunar Module” by CMFDesign · CC BY 4.0",
  rollSpeed: 0.1, // radians per second, once in lunar orbit — about a turn a minute
  beats: [
    {
      name: "stacked",
      seconds: 0,
      hold: 1.2,
      camera: { position: [16, 103, 45], lookAt: [0, 101, 0] },
    },
    {
      name: "tower off",
      seconds: 2.2,
      hold: 0.4,
      camera: { position: [16, 103, 45], lookAt: [0, 101, 0] },
    },
    {
      name: "separate",
      seconds: 4,
      hold: 0.4,
      camera: { position: [17, 100.5, 44], lookAt: [0, 98, 0] },
    },
    {
      name: "turn around",
      seconds: 4,
      hold: 0.3,
      camera: { position: [13, 108, 34], lookAt: [0, 106, 0] },
    },
    {
      name: "dock",
      seconds: 4,
      hold: 0.6,
      camera: { position: [14, 98, 36], lookAt: [0, 95, 0] },
    },
    {
      name: "extract",
      seconds: 3.5,
      hold: 0.4,
      camera: { position: [16, 104, 42], lookAt: [0, 101, 0] },
    },
    {
      name: "lunar orbit",
      seconds: 3.5,
      hold: 0,
      camera: { position: [19, 115, 32], lookAt: [5, 112.5, 0] },
    },
  ],
};

export const hotspots: Hotspot[] = [
  {
    id: "f1-engines",
    order: 1,
    tag: "01",
    title: "First Stage (S-IC)",
    subtitle: "Five F-1 engines, one very hard problem.",
    bracket: ["S-IC"], // the whole first stage, engine bells to forward skirt
    span: [0, 42],
    // The whole stage, F-1 bells to forward skirt (y 0→42). The target sits off
    // the axis toward camera-right, so the stage lands in the open area left of
    // the card instead of behind it.
    camera: {
      position: [51, 24, 74],
      lookAt: [17, 21, -7],
    },
    body: [
      "HUGE FORCE. Each F-1 generates ~1.5 million pounds of thrust, and they burn through 3 tons of propellant every second. So all 5 engines could suspend 1,000 African elephants or 25 blue whales in the air at once. ",
      "THEY MOVED. The 4 outer engines gimbal (swivel) to steer the rocket, while the center engine is fixed. The gimbaling engines move the whole 6.5 million pound rocket by just a few degrees, but that’s enough to keep it on course.",
      "TIME. The F-1s burn for 2 minutes and 41 seconds, then the stage separates and falls into the Atlantic. The next stage takes over, and the Saturn V keeps climbing.",
    ],
    specs: [
      { label: "Thrust, each", value: "1.5M lbf" },
      { label: "Engines", value: "5 × F-1" },
      { label: "Propellant flow", value: "~3 t/s" },
    ],
    images: [
      {
        src: "img/F1-Firing-Test.gif",
        alt: "F-1 engine static test firing",
        credit: "NASA",
      },
      {
        src: "img/F1-Firing-Test2.gif",
        alt: "F-1 engines mounted in the test stand",
        credit: "NASA",
      },
    ],
    // Stage node names in the model: keep the whole first stage (incl. its F-1
    // engines) lit, dim the rest. Others: S-II, S-IVB, Interstage, Instrument_Unit.
    isolate: ["S-IC"],
  },

  // ---------------------------------------------------------------------------
  // 01–03 are the three stages, bottom → top, so the camera physically climbs
  // the stack as the talk progresses.
  // Camera poses are derived from the measured node extents and then verified on
  // screen — they are NOT hand-guessed. At fov 40 the visible height at distance
  // d is 0.728·d, so a feature H units tall fills ~65% of the frame at d ≈ 2.1·H.
  //
  // The catch: frame a stage's EXPOSED extent, not its node bbox. Each stage's
  // ends are swallowed by the shroud above/below it — S-II measures 41→65.9 but
  // only 47.3→65.9 is visible, and S-IVB measures 63.9→81.8 with only 71.4→81.8
  // showing. Framing the bbox leaves the lit stage a sliver in the middle.
  // Re-capture with PoseLogger (`p`) if these are retuned.
  //
  // BODY COPY IS PLACEHOLDER and SPECS ARE DRAFT — presenter writes/verifies.
  // ---------------------------------------------------------------------------

  {
    id: "s2-hydrogen",
    order: 2,
    tag: "02",
    title: "Second Stage (S-II)",
    subtitle: "Placeholder hook — every kilogram was a negotiation.",
    // The interstage below it (dropped ~30 s into the S-II burn) and the one above
    // it (left behind at S-IVB separation) both fly with the S-II, so its bracket
    // takes them too.
    bracket: ["Interstage", "S-II", "S-II_Top"],
    span: [42, 71.4],
    // Centred on the exposed 47.3→65.9, not the 41→65.9 bbox.
    camera: {
      position: [15, 58, 36],
      lookAt: [0, 57, 0],
    },
    body: [
      "FUEL. The second stage flew on liquid hydrogen, which is light but took up tons of space. It boils around -420°F and it's bulky, so the tank has to be huge and it has to be insulated.",
      "ENGINES. This stage had 5 J-2 engines, which were smaller than the F-1s but still produced 230,000 pounds of thrust each. The J-2s burned LH2 and LOX, and they could be restarted in space. ",
    ],
    specs: [
      { label: "Engines", value: "5 × J-2" },
      { label: "Propellant", value: "LH2 / LOX" },
      { label: "Burn time", value: "~6 min" },
    ],
    // "Saturn 5 Launch HD" (NasaHD on YouTube) — NASA's onboard staging film.
    clips: [
      {
        youtube: "pLVavhJwKwk",
        from: "0:00",
        to: "0:25",
        label: "Stage 1 separation",
        credit: "NASA · via NasaHD on YouTube",
      },
      {
        youtube: "pLVavhJwKwk",
        from: "1:35",
        to: "1:55",
        label: "Interstage ring separation",
        credit: "NASA · via NasaHD on YouTube",
      },
    ],
    isolate: ["S-II"],
  },

  {
    id: "s4b-restart",
    order: 3,
    tag: "03",
    title: "Stage 3 (S-IVB)",
    subtitle: "Placeholder hook — one engine has to light twice.",
    // The stage plus the Instrument Unit ring that rides on top of it. Name the
    // IU's leaf mesh, not "Instrument_Unit": nosecone.ts parents the rebuilt
    // spacecraft to that node, so its bounds would run up to the escape tower.
    bracket: ["S-IVB", "Instrument_Unit_Metal_0"],
    span: [71.4, 83.1],
    // Centred on the exposed 71.4→81.8, not the 63.9→81.8 bbox.
    camera: {
      position: [13, 78, 33],
      lookAt: [0, 76, 0],
    },
    body: [
      "PLACEHOLDER. Everything below this fires once, on a pad, with the whole world watching. This stage has to burn to reach orbit, shut down, coast, and then relight — cold, hours later, on the far side of a checklist.",
      "PLACEHOLDER. That second burn is translunar injection. There is no second attempt. Presenter writes the real story here.",
    ],
    specs: [
      { label: "Engines", value: "1 × J-2" },
      { label: "Burns", value: "2 (orbit, then TLI)" },
      { label: "Restart", value: "In vacuum" },
    ],
    // Same staging film: the S-II drops away and the S-IVB flies off on its J-2.
    clips: [
      {
        youtube: "pLVavhJwKwk",
        from: "2:06",
        to: "2:30",
        label: "Stage 2 separation",
        credit: "NASA · via NasaHD on YouTube",
      },
    ],
    isolate: ["S-IVB"],
  },
];

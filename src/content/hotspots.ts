export type Hotspot = {
  id: string;
  order: number; // 1-indexed, drives keyboard nav
  tag: string; // "01" — shown in the callout marker
  title: string;
  subtitle: string; // one-line hook
  target: [number, number, number]; // fallback point the leader line hits
  anchor?: string; // model node name to anchor the leader line to (overrides target at runtime)
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
  };
  body: string[]; // paragraphs
  specs?: { label: string; value: string }[];
  images?: { src: string; alt: string; credit: string }[]; // cycled in the card, one at a time
  isolate?: string[]; // stage node names to keep lit; everything else dims
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

// The HUD's "Spacecraft" button (or `S`): the CSM docked to the Lunar Module, floating
// beside the Saturn V's nose at true scale (Spacecraft.tsx measures the live stack), in
// the configuration it flew in lunar orbit — the LM model's legs are deployed.
export const SPACECRAFT_VIEW = {
  model: "models/lunar-module.glb",
  credit: "“Apollo 11 Lunar Module” by CMFDesign · CC BY 4.0",
  position: [26, 100, 0] as [number, number, number], // middle of the docked stack
  rotation: [0, -0.45, 1.35] as [number, number, number], // lays the long axis near-horizontal
  rollSpeed: 0.1, // radians per second — about a turn a minute
  camera: {
    position: [34, 106, 46] as [number, number, number],
    lookAt: [18, 100, 0] as [number, number, number],
  },
};

export const hotspots: Hotspot[] = [
  {
    id: "f1-engines",
    order: 1,
    tag: "01",
    title: "The engine that ate itself",
    subtitle: "Placeholder hook — five F-1 engines, one very hard problem.",
    target: [0, 3, 6],
    anchor: "F1", // the 5 F-1 engine nodes (F1, F1.001–004) — leader line hits their real center
    camera: {
      position: [13, 10, 32],
      lookAt: [0, 3, 0],
    },
    body: [
      "HUGE FORCE. These engines each generate 1.5 million pounds of thrust, and they burn through 3 tons of propellant every second. So all 5 engines could suspend 1,000 African elephants or 25 blue whales in the air at once. ",
      "THEY MOVED. The 4 outer engines gimbal (swivel) to steer the rocket, while the center engine is fixed. The gimbaling engines move the whole 6.5 million pound rocket by just a few degrees, but that’s enough to keep it on course.",
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
  // 02–05 walk the vehicle bottom → top, so the camera physically climbs the
  // stack as the talk progresses: power → mass → precision → the humans.
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
    title: "PLACEHOLDER — the mass problem",
    subtitle: "Placeholder hook — every kilogram was a negotiation.",
    target: [0, 53, 0],
    anchor: "S-II", // second-stage body, measured center y ≈ 53.4
    // Centred on the exposed 47.3→65.9, not the 41→65.9 bbox.
    camera: {
      position: [15, 58, 36],
      lookAt: [0, 57, 0],
    },
    body: [
      "PLACEHOLDER. The second stage flew on liquid hydrogen, which is light on paper and miserable in practice — it boils at 20 K and it is bulky, so the tank has to be huge and it has to be insulated.",
      "PLACEHOLDER. The common bulkhead: one shared wall between the LOX and LH2 tanks instead of two walls and the gap between them. Presenter writes the real story here.",
    ],
    specs: [
      { label: "Engines", value: "5 × J-2" },
      { label: "Propellant", value: "LH2 / LOX" },
      { label: "Burn time", value: "~6 min" },
    ],
    isolate: ["S-II"],
  },

  {
    id: "s4b-restart",
    order: 3,
    tag: "03",
    title: "PLACEHOLDER — the restart",
    subtitle: "Placeholder hook — one engine has to light twice.",
    target: [0, 73, 0],
    // The S-IVB's own engine (J2005) sits at y 63.9–67.2, tucked under the
    // S-II_Top shroud — a leader line there points at a covered region. Anchor
    // the stage body instead.
    anchor: "S-IVB",
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
    isolate: ["S-IVB"],
  },

  {
    id: "instrument-unit",
    order: 4,
    tag: "04",
    title: "PLACEHOLDER — the computer",
    subtitle: "Placeholder hook — the whole brain is a three-foot hoop.",
    target: [0, 83, 0],
    // NOT "Instrument_Unit": nosecone.ts parents the rebuilt Spacecraft_Top to
    // that node, so a Box3 over it swallows the whole spacecraft and the anchor
    // lands at y ≈ 100 — right on top of hotspot 05's tag. The IU's own leaf
    // mesh has no children, so it resolves to the real ring at y ≈ 82.5.
    anchor: "Instrument_Unit_Metal_0",
    camera: {
      position: [25, 85, 61],
      lookAt: [0, 83, 0],
    },
    body: [
      "PLACEHOLDER. The guidance ring that flew the vehicle: IBM built it, it is about three feet tall, and it wraps the top of the third stage.",
      "PLACEHOLDER. Triple-redundant, and with less memory than the tab you have open. Presenter writes the real story here.",
    ],
    specs: [
      { label: "Built by", value: "IBM" },
      { label: "Height", value: "~3 ft" },
      { label: "Diameter", value: "~21.7 ft" },
    ],
    // Same reason: isolating "Instrument_Unit" keeps its whole subtree lit,
    // which now includes the spacecraft. Naming the mesh lights the ring alone.
    isolate: ["Instrument_Unit_Metal_0"],
  },

  {
    id: "escape-tower",
    order: 5,
    tag: "05",
    title: "PLACEHOLDER — the part you hope never fires",
    subtitle: "Placeholder hook — thrown away on every good flight.",
    target: [0, 102, 0],
    // The rebuilt spacecraft + launch escape system (nosecone.ts), y ≈ 83 → 117.
    anchor: "Spacecraft_Top",
    camera: {
      position: [30, 104, 73],
      lookAt: [0, 102, 0],
    },
    body: [
      "PLACEHOLDER. The lattice tower at the very top is a solid rocket whose only job is to rip the crew capsule off the stack if the vehicle below it fails.",
      "PLACEHOLDER. On every successful flight it is jettisoned unused. Insurance as a design discipline. Presenter writes the real story here.",
    ],
    specs: [
      { label: "Tower height", value: "~33 ft" },
      { label: "Escape motor", value: "Solid, ~147k lbf" },
      { label: "Used in flight", value: "Never" },
    ],
    isolate: ["Spacecraft_Top"],
  },
];

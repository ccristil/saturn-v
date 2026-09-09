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
      "PLACEHOLDER. A second paragraph to prove multi-paragraph layout, spacing, and 18px legibility from across a room hold up on the projector.",
      "PLACEHOLDER. A short third beat to land the story before the presenter advances to the next hotspot.",
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
];

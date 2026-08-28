# CLAUDE.md

## What this is

An interactive 3D walkthrough of the Saturn V / Apollo 11 stack, built to be **presented live** to a product team for 30 minutes.

It is not a website. It is a presentation instrument. Every decision should be judged against one question: *does this work when a person is standing in front of a room, talking, driving it from a laptop?*

- **Presented:** ~September 11, 2026. Hard deadline, no slip.
- **Audience:** product engineers and PMs. Technical, but not aerospace people.
- **Runtime:** localhost only. `npm run dev`, full screen browser, external display.
- **Shape:** 5 hotspots on the vehicle. Presenter steps through them. Each opens a card with the engineering story.

The 3D model is the vehicle for the content, not the point of the project. If time gets tight, the model gets simpler and the content stays.

---

## Stack

Pinned. Do not swap these out.

- **Vite** + **React** + **TypeScript**
- **three.js** via **@react-three/fiber**
- **@react-three/drei** — `OrbitControls`, `Html`, `useGLTF`, `Bounds`, `Line`
- Plain CSS modules or a single stylesheet. No Tailwind, no component library.

Ask before adding any dependency. This project should stay small enough to reason about in one sitting.

---

## Non-goals

Explicitly out of scope. Do not build these, do not suggest them.

- Deployment, hosting, CI, Docker
- Backend, database, API, auth
- Mobile or responsive layouts — this runs on one laptop at one resolution
- Tests beyond "it renders and doesn't throw"
- Physics, particle effects, launch animation, sound
- Any runtime CDN dependency. **It must work with the wifi off.** Self-host fonts, images, and the model.

---

## Architecture — the one rule

**Content is decoupled from geometry.**

All presentation content lives in `src/content/hotspots.ts` as a plain array. The 3D scene reads that array and renders markers at the given positions. Components contain zero copy.

This means:
- Adding, reordering, or rewriting a hotspot is a data edit, never a code change.
- The scene works with placeholder geometry before the real model is wired up.
- The model can be swapped without touching content.

If you ever find yourself hardcoding a title, a paragraph, or a camera position inside a component, stop — it belongs in the content file.

---

## Content schema

```ts
export type Hotspot = {
  id: string;
  order: number;                 // 1-indexed, drives keyboard nav
  tag: string;                   // "01" — shown in the callout marker
  title: string;
  subtitle: string;              // one-line hook, read aloud-able
  target: [number, number, number];        // point on the model the leader line hits
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
  };
  body: string[];                // paragraphs, ~500-600 words total
  specs?: { label: string; value: string }[];
  image?: { src: string; alt: string; credit: string };
  isolate?: string[];            // mesh names to keep lit; everything else dims
};
```

Example:

```ts
{
  id: "f1-instability",
  order: 1,
  tag: "01",
  title: "The engine that ate itself",
  subtitle: "Four years to stop five engines from tearing themselves apart.",
  target: [0, -18.2, 1.4],
  camera: { position: [8, -16, 12], lookAt: [0, -18, 0] },
  body: [
    "...",
  ],
  specs: [
    { label: "Thrust, each", value: "1.5M lbf" },
    { label: "Propellant flow", value: "~3 t/s" },
  ],
  image: { src: "/img/f1-injector.jpg", alt: "F-1 injector plate", credit: "NASA" },
  isolate: ["S-IC", "F1_engines"],
}
```

---

## File structure

```
public/
  models/saturn-v.glb          # NASA, public domain
  img/                         # NASA photos, self-hosted
  fonts/                       # self-hosted woff2
src/
  content/hotspots.ts          # ALL copy lives here
  scene/
    Stack.tsx                  # loads the glb (or builds primitives)
    Callout.tsx                # marker + leader line
    CameraRig.tsx              # animates between hotspot camera positions
  ui/
    Card.tsx                   # the popup panel
    Progress.tsx               # 01 · 02 · 03 · 04 · 05 indicator
  App.tsx                      # owns activeIndex, keyboard handling
```

---

## Presentation-safety rules

Non-negotiable. These are what separate a demo from a presentation.

1. **Keyboard navigation is the primary interface.** `←` / `→` step through hotspots in `order`. `Esc` closes the card and returns to the wide shot. `1`–`5` jump directly. Clicking a marker is a secondary convenience for answering audience questions. Never ship a change that breaks arrow-key nav.
2. **Never trap focus or require a precise click.** No small hit targets, no drag-to-open, no hover-only affordances.
3. **Camera transitions are ~800ms and always land in the same place for a given hotspot.** Deterministic. The presenter has rehearsed this.
4. **Legible from 20 feet.** Body text no smaller than 18px. Card max-width ~520px. High contrast. Assume a washed-out projector — never rely on subtle value differences.
5. **60fps on integrated graphics.** If the frame rate drops, reduce poly count or lighting complexity, not the interaction.
6. **Fails visibly, not silently.** If the model 404s, render the primitive fallback stack and log it. The talk must survive a missing asset.

---

## Design direction

The reference is **Apollo-era engineering documentation**, not sci-fi and not a modern SaaS dashboard. Technical drawings, dimension callouts, part-number tags, checklist typography.

**Palette**

```
--void   #0B0E14   backdrop (graphite-blue, not pure black)
--panel  #141924   card surface
--rule   #2A3444   hairlines, leader lines, inactive markers
--ink    #E8EDF5   primary text
--muted  #8494AB   labels, captions, credits
--foil   #D4A24C   THE accent — active callout only
```

`--foil` is the burnished gold of the lunar module's thermal blankets. It appears on exactly one thing at a time: the active hotspot. Nothing else in the interface is gold. That restraint is what makes it read as "this is where you're looking" from the back of the room.

**Type**

- **IBM Plex Sans** — body. Chosen deliberately: IBM built the Saturn V's Instrument Unit, the guidance ring that sat between the third stage and the spacecraft. If anyone asks, that's a real answer.
- **IBM Plex Mono** — specs, numbers, part designations, credits.
- **Barlow Condensed**, 600 weight — callout tags and the hotspot title. Condensed technical lettering, close to what NASA drafters used.

Self-host all three as woff2.

**Signature element**

The callout markers are drawn as **engineering-drawing leader lines**: a hairline from the point on the vehicle out to a small numbered tag, with a 90° elbow. Inactive markers are `--rule` and thin. The active one goes `--foil` and its line draws in over ~300ms. That's the whole visual idea — don't add glows, pulses, or floating labels on top of it.

**Restraint**

One accent, one motion idea, one structural device. The numbered tags earn their numbering because the walkthrough genuinely is a sequence. Resist adding anything else — every extra effect makes it read as generated rather than designed.

---

## Commands

```bash
npm run dev              # localhost:5173
npx @gltf-transform/cli inspect public/models/saturn-v.glb
```

Model source: `github.com/nasa/NASA-3D-Resources` → `3D Models/Saturn V/Saturn V.glb`. Public domain, ~905 KB, roughly 35k polys.

---

## Working agreements

- **Vertical slice first.** Placeholder geometry, one hotspot, one card, camera flies to it. Prove the loop end to end before touching the real model or writing real copy.
- **Small diffs.** One concern per change. This is being built in evenings around a day job.
- Don't refactor for elegance. It ships in two weeks and then it's over.
- Don't write copy. The presenter writes the content; you build the machine that displays it.
- If the `.glb` turns out to be one fused mesh, say so and switch to primitives rather than trying to split it. Cylinders and cones for the stages will look cleaner on a projector anyway.

---

## Status

_Update this as you go — it's what a fresh session reads first._

- [ ] Inspected the `.glb` scene graph. Stages separable? → **unknown**
- [ ] Vertical slice running
- [ ] Real model loaded and oriented
- [ ] Camera positions captured for all 5 hotspots
- [ ] Exploded stage view (only if meshes are separable)
- [ ] Content written
- [ ] Dry run on presentation hardware
- [ ] Fallback screen recording saved to desktop

**Next up:** run `inspect` on the model, then scaffold the vertical slice.

# CLAUDE.md

## What this is

An interactive 3D walkthrough of the Saturn V / Apollo 11 stack, built to be **presented live** to a product team for 30 minutes.

It is not a website. It is a presentation instrument. Every decision should be judged against one question: *does this work when a person is standing in front of a room, talking, driving it from a laptop?*

- **Presented:** ~September 11, 2026. Hard deadline, no slip.
- **Audience:** product engineers and PMs. Technical, but not aerospace people.
- **Runtime:** localhost for the live talk — `npm run dev`, full screen browser, external display. Also **deployed to GitHub Pages** (`https://ccristil.github.io/saturn-v/`) for a shareable link. The model and all assets are self-hosted, so localhost still works wifi-off.
- **Shape:** 5 hotspots on the vehicle. Presenter steps through them. Each opens a card with the engineering story.

The 3D model is the vehicle for the content, not the point of the project. If time gets tight, the model gets simpler and the content stays.

---

## Stack

Pinned. Do not swap these out.

- **Vite** + **React** + **TypeScript**
- **three.js** via **@react-three/fiber**
- **@react-three/drei** — `OrbitControls`, `Html`, `useGLTF`, `Line`, `Environment`, `Lightformer`. (No `Bounds`/`Center` — framing is explicit; see **Model & coordinate system** below.)
- **@react-three/postprocessing** (+ `postprocessing`) — one `EffectComposer` in `App.tsx`: ACES filmic tone mapping (final pass) + a restrained `Bloom` (threshold 0.9, so only bright metal specular highlights lift — the gold callout stays un-glowed). Renderer AA/tone-mapping are off (`gl={{ antialias:false, toneMapping: NoToneMapping }}`); the composer does both.
- Plain CSS modules or a single stylesheet. No Tailwind, no component library.

Ask before adding any dependency. This project should stay small enough to reason about in one sitting.

---

## Non-goals

Explicitly out of scope. Do not build these, do not suggest them.

- ~~Deployment, hosting, CI, Docker~~ → **deployment is now in scope:** a GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes to GitHub Pages on push to `main`. Still no Docker, no backend CI. Because of the Pages subpath, `vite.config.ts` sets `base: '/saturn-v/'` and **all asset paths must resolve through `import.meta.env.BASE_URL`** — never hardcode a leading-slash path.
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
  target: [number, number, number];        // fallback point the leader line hits
  anchor?: string;               // model node name to anchor the leader line to (overrides target at runtime)
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
  };
  body: string[];                // paragraphs, ~500-600 words total
  specs?: { label: string; value: string }[];
  image?: { src: string; alt: string; credit: string };
  isolate?: string[];            // stage node names to keep lit; everything else dims
};
```

Example (real coords are in the model's own space — see **Model & coordinate system**):

```ts
{
  id: "f1-engines",
  order: 1,
  tag: "01",
  title: "The engine that ate itself",
  subtitle: "Five F-1 engines, one very hard problem.",
  target: [0, 3, 6],             // fallback; `anchor` supersedes it
  anchor: "F1",                  // leader line hits the real F-1 engine cluster (F1, F1.001–004)
  camera: { position: [13, 10, 32], lookAt: [0, 3, 0] },
  body: [ "..." ],
  specs: [
    { label: "Thrust, each", value: "1.5M lbf" },
    { label: "Propellant flow", value: "~3 t/s" },
  ],
  isolate: ["S-IC"],             // keep the whole first stage (incl. its engines) lit
}
```

**`anchor` is the reliable way to place a leader line** — it finds the named node(s) in the live model and points at their true center, so it can't drift the way a hand-typed `target` can. Match by exact name or `<anchor>.NNN` (e.g. `"F1"` catches `F1`, `F1.001`…). `target` is only the fallback if the node isn't found.

---

## File structure

```
public/
  models/saturn-v.glb          # devPilot "Apollo Saturn V", CC BY (see Model & coordinate system)
  img/                         # NASA photos, self-hosted
  fonts/                       # self-hosted woff2 (Plex Sans/Mono, Barlow Condensed)
src/
  content/hotspots.ts          # ALL copy + camera poses + HOME/EXPLODE/ORBIT_TARGET + MODEL_CREDIT
  scene/
    Stack.tsx                  # loads the glb; assembles it (fix displaced parts, close gaps); drives explode + isolate
    isolate.ts                 # dim all meshes except the named stage(s) (per-mesh cloned materials)
    explode.ts                 # precompute each stage's upward move; Stack animates it
    nosecone.ts                # rebuilds the missing spacecraft top (SLA/CSM/escape tower) from primitives, sized to the measured IU
    markings.ts                # canvas decals: S-IC flag + red "USA"; S-II vertical "UNITED STATES". Parented per-stage so they ride explode/isolate
    weathering.ts              # launch-day grime: bolder base scorch (flame licks) + vertical body grime streaks on S-IC/S-II. Full-360 overlays, parented per-stage (rides explode/isolate)
    Ground.tsx                 # grounds the rocket: drei ContactShadows (one-frame bake — S-IC base is the fixed explode reference) + a faint radial studio-floor glow that fades to transparent. Mounted inside <Suspense>
    materials.ts               # metallic look: engines/metal rings reflect the <Environment>, painted body kept satin (not glossy)
    enginedetail.ts            # corrugated tube-wall ribs on the F-1 nozzles (rings hugging each engine's measured bell profile)
    Callout.tsx                # one billboarded leader line + numbered tag (always faces camera)
    Callouts.tsx               # resolves each hotspot's `anchor` to a real node position; renders Callouts
    CameraRig.tsx              # eased arc between camera poses (home / hotspot / explode)
  ui/
    Card.tsx                   # the popup panel (DOM overlay)
    Progress.tsx               # 01 · 02 · 03 · 04 · 05 indicator
  App.tsx                      # owns activeIndex + exploded; keyboard; explode button; credit; lights + procedural <Environment> (Lightformers, no HDR file)
```

---

## Model & coordinate system

**The model.** `public/models/saturn-v.glb` is *"Apollo Saturn V Launch Vehicle"* by **devPilot** (Sketchfab), **CC BY** — so attribution is required (shown bottom-left via `MODEL_CREDIT`; keep it). ~8.8 MB, ~106k triangles. It replaced the original fused NASA model because its stages are separate, properly-named nodes:

- **Stage groups:** `S-IC`, `Interstage`, `S-II`, `S-II_Top`, `S-IVB`, `Instrument_Unit` (bottom → top).
- **Engines** (nested under their stage): `F1`, `F1.001–004` (5× F-1 under S-IC); `J2`, `J2.001–004` (5× J-2 under S-II); `J2.005` (1× J-2 under S-IVB).
- **No interior geometry** — exterior shells + engines only (no tanks/LM). "Go inside" = the explode revealing engine clusters, not a cutaway.
- **No spacecraft in the GLB** — the raw model is launch-vehicle-only; its topmost node is the `Instrument_Unit` ring, so the stack shipped flat-topped. `nosecone.ts` rebuilds the missing top (Spacecraft-LM Adapter taper → Command/Service Module → Launch Escape System tower) from primitives, sized to the IU's *measured* radius and attached as a child of the `Instrument_Unit` node — so it rides explode and dims with isolate automatically, no changes to `explode.ts`/`isolate.ts`.

**Assembly (in `Stack.tsx`, runs once on load).** The raw file has quirks that `fixDisplacedParts` corrects: three connector rings (`Interstage`, `S-II_Top`, `Instrument_Unit`) ship ~20 units off-axis in −Z → pulled to z=0; and the upper stages sit with small gaps → nudged down (cumulative) so the stack reads as one flush body. Tuned constants live in the `ASSEMBLE` table.

**No `<Center>`.** Auto-centering was removed (its bbox measurement got corrupted by the callout). The model renders in its **own coordinate space**: engines at the base ~**Y 0–6**, the Instrument Unit at ~**Y 83**, and the rebuilt spacecraft + escape tower (see `nosecone.ts`) reaching ~**Y 115**, so the assembled center is ~**Y 57**. Everything is authored against that:

- `ORBIT_TARGET = [0, 57, 0]` — OrbitControls target + home `lookAt`.
- `HOME_CAMERA`, `EXPLODE_CAMERA`, and each hotspot `camera` are all in this space, in `hotspots.ts`.
- **Adding a hotspot:** give it an `anchor` (a node name above), a `camera` pose looking at that region, and an `isolate` stage. Capture the pose live: the temp `PoseLogger` in `App.tsx` logs `position`/`lookAt` to the console on **`p`** — paste those in. (Then remove `PoseLogger` before ship.)

**Explode.** Toggle with **`X`** or the on-screen button. `explode.ts` moves each stage group up (cumulative), revealing the engine clusters in the gaps; `CameraRig` pulls back to `EXPLODE_CAMERA`. Reassembles on repeat. Mutually exclusive with hotspots.

**Callouts billboard.** Each callout copies the camera orientation every frame, so the leader line + tag always read straight-on regardless of how the rocket is rotated (no twisting to see a label).

---

## Presentation-safety rules

Non-negotiable. These are what separate a demo from a presentation.

1. **Keyboard navigation is the primary interface.** `←` / `→` step through hotspots in `order`. `Esc` closes the card and returns to the wide shot. `1`–`5` jump directly. Clicking a marker is a secondary convenience for answering audience questions. Never ship a change that breaks arrow-key nav.
2. **Never trap focus or require a precise click.** No small hit targets, no drag-to-open, no hover-only affordances.
3. **Camera transitions are eased (~1s; explode ~1.2s) and always land in the same place for a given hotspot.** Deterministic — fixed duration, snaps to the exact pose. The presenter has rehearsed this.
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
npm run dev              # localhost:5173/saturn-v/
npm run build            # tsc + vite build (this is the "does it still work" check)
npx @gltf-transform/cli inspect public/models/saturn-v.glb
```

**Model source:** *Apollo Saturn V Launch Vehicle* by **devPilot** on Sketchfab, **CC BY** (attribution required). ~8.8 MB, ~106k tris. (Replaced the original NASA `.glb`, which was one fused mesh — see git history.)

**Seeing the render.** There's no display in the agent sandbox, so visual checks use headless Chromium via Playwright, installed **outside the repo** at `~/.claude/pw/` (`node ~/.claude/pw/shot.cjs <url> <out.png> [waitMs] [clickSel] [clip] [dragXY]`, viewport via `PW_VIEWPORT=1512x900`). Screenshot localhost, then read the PNG. This is how framing/gaps/labels get tuned — measure and look, don't guess.

---

## Working agreements

- **Vertical slice first.** Placeholder geometry, one hotspot, one card, camera flies to it. Prove the loop end to end before touching the real model or writing real copy.
- **Small diffs.** One concern per change. This is being built in evenings around a day job.
- Don't refactor for elegance. It ships in two weeks and then it's over.
- Don't write copy. The presenter writes the content; you build the machine that displays it. (Hotspot 1 has clearly-marked PLACEHOLDER copy so the card renders — not real content.)
- The model question is settled: we use the devPilot model with separable, named stages (see **Model & coordinate system**). The old "if it's one fused mesh, switch to primitives" concern no longer applies.

---

## Status

_Update this as you go — it's what a fresh session reads first._

- [x] Scaffold + deploy — Vite + React + TS + R3F; self-hosted model/fonts; base `/saturn-v/`; GitHub Actions → **Pages live** at https://ccristil.github.io/saturn-v/ (auto-deploys on push to `main`).
- [x] Model chosen & wired — swapped to the devPilot CC-BY model (named separable stages + engines; see **Model & coordinate system**). Assembled (displaced parts recentered, inter-stage gaps closed), rendered in real coords (no `<Center>`).
- [x] Hotspot 1 (F-1 engines) dive-in — full loop end-to-end: arc-in `CameraRig`, isolate-by-stage-name dim, `anchor`-resolved + camera-billboarded leader line, DOM card, progress strip. Keyboard →/←/Esc/1–5; marker click; touch via tag.
- [x] Camera framing tuned (via Playwright) — home (centered whole rocket), hotspot 1 dive-in, and explode all frame correctly at landscape aspect.
- [x] **Stage explode** — toggle (`X` / button) separates the six stages to reveal the engine clusters; camera pulls back; reassembles. (This is an added feature beyond the original 5-hotspot brief, at the user's request.)
- [x] **Spacecraft top rebuilt** — the GLB is launch-vehicle-only (topmost node = `Instrument_Unit`), so the stack was flat-topped. `nosecone.ts` adds the SLA taper → CSM → Launch Escape tower from primitives, sized to the measured IU and parented to the IU node so it rides explode + isolate. Cameras re-framed for the taller stack (center Y 40→57).
- [x] **First-stage markings** — `markings.ts` adds the US flag + red "USA" (Barlow Condensed, drawn to a canvas and repainted once the woff2 loads) as curved decals hugging the S-IC skin, matched to the on-pad reference photo (flag mid-lower, "USA" below it). Each decal's arc width is derived from its texture aspect ratio so nothing stretches, and the radius is sampled from the real S-IC geometry (median vertex radius) so they sit flush. On one face (photo-accurate), parented to `S-IC` so they ride explode + isolate. (The vertical "UNITED STATES" that belongs on the S-II second stage isn't added yet.)
- [x] **Metallic + weathering (subtle)** — `materials.ts` retunes the GLB's shared materials so the "Metal" family (engines, interstage rings, skirts) reflects a new procedural `<Environment>` (drei Lightformers in App.tsx — no HDR file, `frames={1}`, low-res for perf), while the "Non_Metal" painted body stays satin. Ambient dropped to 0.25 to compensate. Plus a faint full-circle **engine-soot** gradient at the base (in `markings.ts`). Best seen exploded (gold metal ring rims). "Subtle" level per the user; can dial up to grime/streaks if wanted.
- [x] **S-II "UNITED STATES" + F-1 nozzle detail** — added vertical "UNITED STATES" (black, Barlow Condensed) on the second stage in `markings.ts`; and `enginedetail.ts` wraps each F-1 nozzle in corrugated tube-wall ribs (torus rings hugging the engine's measured bell profile — sampled per Y-slice, gap-filled + smoothed, ribbed from exit up to the throat). Both ride explode + isolate.
- [x] **Cinematic post-processing** — `EffectComposer` in `App.tsx`: ACES filmic tone mapping + restrained bloom on metal highlights (see **Stack**). The `--void` background input was brightened to `#161d29` so it lands back at the intended graphite-blue *after* ACES (which otherwise crushes it to pure black). Best seen exploded (gold ring rims catch a warm glow).
- [x] **Grounding + bolder weathering** — `Ground.tsx` anchors the rocket with a contact shadow + faint studio-floor glow (sits correctly under the base in home/explode; grounds the engine cluster in the dive-in). `weathering.ts` replaces the old faint soot with a bolder flame-licked base scorch + vertical body grime streaks on the S-IC/S-II (full-360, ride explode/isolate). Both tuned via Playwright across home/base/body/explode/dive-in.
- [x] **Roll pattern — confirmed baked in, no work needed.** The devPilot GLB's texture already carries the black roll pattern (black interstage, S-IC forward-skirt band, S-II bands, engine fairings) and it's photo-accurate. `markings.ts` only adds what's genuinely missing (flag + red "USA" + vertical "UNITED STATES"). Do **not** rebuild the roll pattern from decals — it would fight the baked texture.
- [ ] **Hotspots 2–5** — not built. Add entries to `hotspots.ts` (anchor + camera pose + isolate stage); capture poses with `PoseLogger` (`p`).
- [ ] Real copy — hotspot 1 is PLACEHOLDER; presenter writes the actual stories.
- [ ] Remove the temp `PoseLogger` from `App.tsx` before ship.
- [ ] Optional polish — in the dive-in the `01` tag overlaps the card slightly (hide-when-open or extend-left); optional stage labels on the exploded view.
- [ ] Dry run on presentation hardware; fallback screen recording saved to desktop.

**Next up:** build hotspots 2–5 (replicate the hotspot-1 pattern), then swap in real copy. Use `PoseLogger` (`p`) + Playwright screenshots to place/verify each.

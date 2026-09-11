# CLAUDE.md

## What this is

An interactive 3D walkthrough of the Saturn V / Apollo 11 stack, built to be **presented live** to a product team for 30 minutes.

It is not a website. It is a presentation instrument. Every decision should be judged against one question: _does this work when a person is standing in front of a room, talking, driving it from a laptop?_

- **Presented:** ~September 11, 2026. Hard deadline, no slip.
- **Audience:** product engineers and PMs. Technical, but not aerospace people.
- **Runtime:** localhost for the live talk — `npm run dev`, full screen browser, external display. Also **deployed to GitHub Pages** (`https://ccristil.github.io/saturn-v/`) for a shareable link. The model and all assets are self-hosted, so localhost still works wifi-off.
- **Shape:** 4 hotspots — one per stage (S-IC, S-II, S-IVB), plus the spacecraft on top (adapter with the LM inside, SM, CM, escape tower) — each marked by a bracket spanning it: orange for the three stages, blue for the spacecraft. Presenter steps through them. Each opens a card with the engineering story.

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
- Any runtime CDN dependency. ~~**It must work with the wifi off.**~~ → **relaxed by the user** (the talk will have wifi). The LeaderFactor rebrand loads **Fustat + Spectral from Google Fonts via CDN** (`@import` in `index.css`). Images and the model stay self-hosted. If wifi-off ever matters again, self-host these two woff2.

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
  order: number; // 1-indexed, drives keyboard nav
  tag: string; // "01" — shown in the callout marker
  kind: "stage" | "spacecraft"; // bracket colour: orange for a stage, blue for the spacecraft
  title: string;
  subtitle: string; // one-line hook, read aloud-able
  bracket: string[]; // model nodes the stage's bracket spans (union of their bounds)
  span: [number, number]; // fallback [bottom, top] y if those nodes aren't in the scene
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
  };
  body: string[]; // paragraphs, ~500-600 words total
  specs?: { label: string; value: string }[];
  images?: { src: string; alt: string; credit: string }[]; // cycled in the card's gallery
  clips?: Clip[]; // YouTube snippets, same gallery after the images; each plays on click
  isolate?: string[]; // stage node names to keep lit; everything else dims
};

export type Clip = {
  youtube: string; // video id (youtu.be/<id>)
  from: string; // "m:ss", as YouTube shows it
  to: string;
  label: string; // on the poster
  credit: string;
};
```

Example (real coords are in the model's own space — see **Model & coordinate system**):

```ts
{
  id: "f1-engines",
  order: 1,
  tag: "01",
  kind: "stage",
  title: "The engine that ate itself",
  subtitle: "Five F-1 engines, one very hard problem.",
  bracket: ["S-IC"],             // the whole first stage, engine bells to forward skirt
  span: [0, 42],                 // fallback, used only if the node isn't found
  camera: { position: [13, 10, 32], lookAt: [0, 3, 0] },
  body: [ "..." ],
  specs: [
    { label: "Thrust, each", value: "1.5M lbf" },
    { label: "Propellant flow", value: "~3 t/s" },
  ],
  isolate: ["S-IC"],             // keep the whole first stage (incl. its engines) lit
}
```

**`bracket` is measured, not typed** — `Brackets.tsx` finds the named nodes in the live model and re-measures their union box every frame, so each bracket spans its stage's true height and rides explode/reassemble. Names match exactly (the engine nodes are `F1001`/`J2005` — the FBX conversion stripped the dots). `span` is the fallback if none of the nodes are found; a missing name is warned in the console.

Two things to know when choosing `bracket` nodes:

- The box is taken over each node **and its children**. `Spacecraft_Top` is parented to `Instrument_Unit` (see `nosecone.ts`), so naming the IU would stretch the S-IVB bracket up to the escape tower. Name its leaf mesh `Instrument_Unit_Metal_0` instead. `isolate` walks subtrees the same way, so it needs the same treatment.
- Each stage's lower end hides inside the shroud below it, so the raw boxes overlap. `Brackets` starts each bracket where the one below it ends (sorted by height, 1.6-unit gap), so they chain into one column and can't overlap — list every node that belongs to the stage and let that clipping deal with the overlap.

---

## File structure

```
public/
  models/saturn-v.glb          # devPilot "Apollo Saturn V", CC BY (see Model & coordinate system)
  img/                         # NASA photos, self-hosted
  audio/                       # sound cues (eagle-noise.mp3 — the "America" bullet)
  fonts/                       # self-hosted woff2 (Plex Sans/Mono, Barlow Condensed)
src/
  content/hotspots.ts          # ALL copy + camera poses + HOME/EXPLODE/ORBIT_TARGET + MODEL_CREDIT
  scene/
    Stack.tsx                  # loads the glb; assembles it (fix displaced parts, close gaps); drives explode + isolate
    isolate.ts                 # dim all meshes except the named stage(s) (per-mesh cloned materials)
    explode.ts                 # precompute each stage's upward move; Stack animates it
    nosecone.ts                # rebuilds the missing spacecraft top (SLA/CSM/escape tower) from primitives, sized to the measured IU. Built to come apart for the Spacecraft sequence: the SLA is a fixed lower ring + four panels hinged at their base (`SLA_Panel_k` / `SLA_Panel_k_Open`), the SM is `Nose_CSM`, the cover + tower + escape motor are `LES` (origin at its foot). From the SM up it's real size, in metres from `csm.ts` × (R / 3.302), so the SM matches the detailed one the Spacecraft button swaps in and the boost protective cover is the CM's own outline stood 3 cm off it; rest poses in each group's `userData.rest`, the layout (R, band top) in `Spacecraft_Top.userData.tde`
    markings.ts                # canvas decals: S-IC flag + red "USA"; S-II vertical "UNITED STATES". Parented per-stage so they ride explode/isolate
    weathering.ts              # launch-day grime: vertical body grime streaks on S-IC/S-II (full-360 overlay, parented per-stage, rides explode/isolate). (Base scorch was removed — read as a hard shadow above the engines from low angles.)
    Ground.tsx                 # grounds the rocket: drei ContactShadows (one-frame bake — S-IC base is the fixed explode reference) + a faint radial studio-floor glow that fades to transparent. Mounted inside <Suspense>. Takes `bakeKey`: a parked guest (see Compare.tsx) grows the bake box so its shadow isn't clipped at the edge, and forces a re-bake when it arrives or leaves — a one-frame bake otherwise keeps the departed vehicle's shadow burned into the floor. The box stays **centred on the origin — never shift it**: drei's blur plane sits at the world origin, not under the shadow camera, so an offset box slides every shadow sideways on each of its four blur passes (a guest on the right got its shadow on the far left). `live` keeps it re-rendering while a guest slides. It also turns `gl.autoClear` back on for the shadow pass only — the EffectComposer switches it off, and uncleared ContactShadows renders pile up (trails, spreading pools)
    materials.ts               # metallic look: engines/metal rings reflect the <Environment>, painted body kept satin (not glossy)
    enginedetail.ts            # corrugated tube-wall ribs on the F-1 nozzles (rings hugging each engine's measured bell profile)
    Bracket.tsx                # one stage's ] bracket + numbered tag, orange for a stage / blue for the spacecraft (the hotspot's `kind`); drawn one unit tall and stretched into place by Brackets; lines on layer 1 (out of the contact-shadow pass). Each tag takes the colour its line lands at after the ACES pass, so the two match
    Brackets.tsx               # measures each hotspot's `bracket` nodes every frame (brackets mount the instant a reassemble starts, stages still exploded, so they must follow), chains them into one column, turns them to the camera about the vertical only (upright, always screen-right). Wide shot only
    Compare.tsx                # parks a second vehicle beside the Saturn V, scaled by real height (measures the stack *as assembled* — Stack stores `userData.assembledBox` — so opening it mid-reassembly can't mis-scale). Optional slide in/out (`enterFrom` / `present` / `onSettled`) and height `labels` in feet
    Dimension.tsx              # engineering-drawing height line + "363 ft" label; its lines sit on layer 1 so the contact-shadow pass never draws them
    livery.ts                  # repaints a guest into its real colours (the N1 ships all-white; olive below the shroud line, white above). Also fixes the LM's colours (its exporter wrote sRGB values where glTF expects linear, so they rendered washed out: black panels grey, flag pink) and gives its gold foil a metallic sheen
    Spacecraft.tsx             # Apollo 11's transposition, docking and extraction, played out of the rocket's nose (see Status). A pure function of one timeline number `u`; portals the detailed CSM + the LM into `Spacecraft_Top`. LM from the glb — scaled by its body width (`LM_M_PER_UNIT`; the model's legs splay too wide to scale by), clocked 60° from the CM hatch (`LM_ROLL`), its surface-deployed roof antennas squashed (`trimDockingAntennas`) so they can't spear the CM — docked at its overhead hatch (`LM_HATCH`, glb scene space)
    csm.ts                     # Apollo 11's CSM "Columbia" from primitives, in metres (AOH station numbers + flight photos): SPS bell, SM (ECS radiators, RCS quads, scimitars, high-gain antenna, "UNITED STATES" + flag), EPS fairing, umbilical, the foil-wrapped CM (hatch, windows, RCS ports, docking ring + probe). Merged into one mesh per material, ~20 draw calls; the high-gain antenna and EVA floodlight merge onto their own pivots (`CSM_HGA_Pivot` / `CSM_Floodlight_Pivot`, stowed at `HGA_STOWED` / `FLOOD_STOWED`) so they can ride folded and swing out. `buildLMTunnel` is the LM's docking tunnel — it travels with the LM. Built once and cached
    lmgear.ts                  # folds the LM's fused-in landing gear for the ride inside the adapter and deploys it again: `gearFold(scene).set(g)` — 0 stowed, 1 = the model exactly as shipped — a per-leg hinge rotation of the leg vertices
    GuestBoundary.tsx          # Suspense + error boundary that every guest model (compare vehicles, spacecraft) mounts inside — a model that fails to load drops out and logs, instead of unmounting the whole app
    spin.ts                    # the slow hero turn + ease-back-to-front, shared so every vehicle on screen turns together
    CameraRig.tsx              # eased arc between camera poses (home / hotspot / explode)
  map/
    assembly-map.html          # (in public/) standalone OpenLayers map of where each stage was built + how it reached KSC; embedded as a slide via `map: { src }`
  ui/
    Card.tsx                   # the popup panel (DOM overlay); one gallery for `images` + `clips`
    Clip.tsx                   # a YouTube snippet in that gallery: poster until clicked, then plays muted `from` → `to` and returns to the poster; a Full screen pill puts the clip element itself in full screen (Esc backs out of full screen only)
    LaunchVideo.tsx            # the HUD's "Launch video": one whole YouTube video, full screen, with sound; owns the keyboard while it's up (Esc closes, Space pauses); closes itself at the end
    youtube.ts                 # YouTube's IFrame Player API loader + types, shared by Clip and LaunchVideo
    Progress.tsx               # 01 · 02 · 03 indicator
    confetti.ts                # dependency-free canvas burst (side cannons) for a slide payoff beat
    flyby.ts                   # sends an image across the top of the frame (the eagle gif) — CSS-animated
  App.tsx                      # owns activeIndex + exploded; keyboard; explode button; credit; lights + procedural <Environment> (Lightformers, no HDR file)
```

---

## Model & coordinate system

**The model.** `public/models/saturn-v.glb` is _"Apollo Saturn V Launch Vehicle"_ by **devPilot** (Sketchfab), **CC BY** — so attribution is required (shown bottom-left via `MODEL_CREDIT`; keep it). ~8.8 MB, ~106k triangles. It replaced the original fused NASA model because its stages are separate, properly-named nodes:

- **Stage groups:** `S-IC`, `Interstage`, `S-II`, `S-II_Top`, `S-IVB`, `Instrument_Unit` (bottom → top).
- **Engines** (nested under their stage): `F1`, `F1001–F1004` (5× F-1 under S-IC); `J2`, `J2001–J2004` (5× J-2 under S-II); `J2005` (1× J-2 under S-IVB). **No dots** — the FBX→glTF conversion stripped them.
- **Measured extents** (assembled, model space): `S-IC` y 0→42 (r 9.9) · `Interstage` 42→47.3 · `S-II` 41→65.9 (r 5.5) · `S-II_Top` 65.9→71.4 · `S-IVB` 63.9→81.8 (r 4.2) · `Instrument_Unit` 81.8→83.1 (r 3.6) · `Spacecraft_Top` 83.1→~110.4. Note each stage's ends are hidden inside the shroud above/below it, so the _exposed_ run is shorter than the bbox — that's what to frame.
- **No interior geometry** — exterior shells + engines only (no tanks/LM). "Go inside" = the explode revealing engine clusters, not a cutaway.
- **No spacecraft in the GLB** — the raw model is launch-vehicle-only; its topmost node is the `Instrument_Unit` ring, so the stack shipped flat-topped. `nosecone.ts` rebuilds the missing top (Spacecraft-LM Adapter taper → Command/Service Module → Launch Escape System tower) from primitives, sized to the IU's _measured_ radius and attached as a child of the `Instrument_Unit` node — so it rides explode and dims with isolate automatically, no changes to `explode.ts`/`isolate.ts`.

**Assembly (in `Stack.tsx`, runs once on load).** The raw file has quirks that `fixDisplacedParts` corrects: three connector rings (`Interstage`, `S-II_Top`, `Instrument_Unit`) ship ~20 units off-axis in −Z → pulled to z=0; and the upper stages sit with small gaps → nudged down (cumulative) so the stack reads as one flush body. Tuned constants live in the `ASSEMBLE` table.

**No `<Center>`.** Auto-centering was removed (its bbox measurement got corrupted by the callout). The model renders in its **own coordinate space**: engines at the base ~**Y 0–6**, the Instrument Unit at ~**Y 83**, and the rebuilt spacecraft + escape tower (see `nosecone.ts`) reaching ~**Y 110**, so the assembled center is ~**Y 55** (the cameras still target ~Y 57 — tuned when the top ran to ~117, and they still frame it). Everything is authored against that:

- `ORBIT_TARGET = [0, 57, 0]` — OrbitControls target + home `lookAt`.
- `HOME_CAMERA`, `EXPLODE_CAMERA`, and each hotspot `camera` are all in this space, in `hotspots.ts`.
- **Adding a hotspot:** give it `bracket` nodes (names above) plus a fallback `span`, a `camera` pose looking at that region, and an `isolate` stage. Capture the pose live: the temp `PoseLogger` in `App.tsx` logs `position`/`lookAt` to the console on **`p`** — paste those in. (Then remove `PoseLogger` before ship.)

**Explode.** Toggle with **`X`** or the on-screen button. `explode.ts` moves each stage group up (cumulative), revealing the engine clusters in the gaps; `CameraRig` pulls back to `EXPLODE_CAMERA`. Reassembles on repeat. Mutually exclusive with hotspots.

**Brackets stay upright.** Each bracket turns to face the camera about the vertical axis only, so it stays vertical beside its stage and always on the right of the rocket, however it's orbited. They show on the wide shot only — hidden while exploded, comparing, on slides, and while a hotspot is open (the card + dimming take over).

---

## Presentation-safety rules

Non-negotiable. These are what separate a demo from a presentation.

1. **Keyboard navigation is the primary interface.** `←` / `→` step through hotspots in `order`. `Esc` closes the card and returns to the wide shot. `1`–`4` jump directly (the keys follow the hotspot count). Clicking a marker is a secondary convenience for answering audience questions. Never ship a change that breaks arrow-key nav.
2. **Never trap focus or require a precise click.** No small hit targets, no drag-to-open, no hover-only affordances.
3. **Camera transitions are eased (~1s; explode ~1.2s) and always land in the same place for a given hotspot.** Deterministic — fixed duration, snaps to the exact pose. The presenter has rehearsed this.
4. **Legible from 20 feet.** Body text no smaller than 18px. Card max-width ~520px. High contrast. Assume a washed-out projector — never rely on subtle value differences.
5. **60fps on integrated graphics.** If the frame rate drops, reduce poly count or lighting complexity, not the interaction.
6. **Fails visibly, not silently.** If the model 404s, render the primitive fallback stack and log it. The talk must survive a missing asset.

---

## Design direction

> **⚠️ SUPERSEDED — rebranded to LeaderFactor (company presentation).** The whole interface now follows LeaderFactor's brand (scraped from `leaderfactor.com/styles/lf-tokens.css`), not the Apollo-doc aesthetic below. The tokens live in `src/index.css` `:root`. Current brand: **navy backdrop** (`--void #111a35`, matched to the ACES-rendered 3D scene bg `#17203f`); **Fustat** (sans, all UI/titles) + **Spectral italic** (the reserved serif accent — slide + card subtitles, in warm sand `#af8f6b`); **accent-blue** (`--accent #0c81cf`, fill `#066db1`) replaces the gold foil as the single accent (active callout, tags, primary buttons); **fully-pill buttons** with light-glass fill on dark, accent-filled for the primary CTA (deck "Next", active Explode toggle); flat, `0.18s ease` motion. The section below is the _original_ vision, kept for history.

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

**Model sources:** _Apollo Saturn V Launch Vehicle_ by **devPilot** on Sketchfab, **CC BY** (attribution required). ~8.8 MB, ~106k tris. Plus _N1 rocket_ by **Scilence**, **CC BY 4.0** (~6 MB) for the side-by-side comparison, and _Statue of Liberty_ by **Maurice Svay**, **CC BY 4.0** (decimated to ~4 MB) for the Compare button, and _Apollo 11 Lunar Module_ by **CMFDesign**, **CC BY 4.0** (decimated to ~1.8 MB) for the Spacecraft button — every credit renders bottom-left while its model is up. (Replaced the original NASA `.glb`, which was one fused mesh — see git history.)

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
- [x] **Cinematic post-processing** — `EffectComposer` in `App.tsx`: ACES filmic tone mapping + restrained bloom on metal highlights (see **Stack**). The `--void` background input was brightened to `#161d29` so it lands back at the intended graphite-blue _after_ ACES (which otherwise crushes it to pure black). Best seen exploded (gold ring rims catch a warm glow).
- [x] **Grounding + bolder weathering** — `Ground.tsx` anchors the rocket with a contact shadow + faint studio-floor glow (sits correctly under the base in home/explode; grounds the engine cluster in the dive-in). `weathering.ts` adds vertical body grime streaks on the S-IC/S-II (full-360, ride explode/isolate), tuned via Playwright across home/base/body/explode/dive-in. (An earlier base-scorch band was removed — it read as a hard shadow above the engines from low angles.)
- [x] **Roll pattern — confirmed baked in, no work needed.** The devPilot GLB's texture already carries the black roll pattern (black interstage, S-IC forward-skirt band, S-II bands, engine fairings) and it's photo-accurate. `markings.ts` only adds what's genuinely missing (flag + red "USA" + vertical "UNITED STATES"). Do **not** rebuild the roll pattern from decals — it would fight the baked texture.
- [x] **Hero-slide reveal** — the last deck slide (`kind: 'hero'` in `slides.ts`) goes transparent (`.deck--hero`) so the _live_ 3D model shows as a tiny, subtly-spinning rocket on the right (camera `HERO_CAMERA` — far back + target offset left of the axis; spin via a wrapper group in `Stack.tsx` behind a `spin` prop). On 'next' the pose eases `HERO → HOME` (grow + center), the spin eases back to front so markings/callouts realign, and the deck text dissolves — selling that the tiny model _is_ the real one. The old handoff dove to hotspot 1; it now lands on the wide HOME shot (presenter drives hotspots from there). Camera state lives in `App.tsx` (`onHeroSlide` / `heroPreview`).
- [x] **LeaderFactor rebrand (whole interface)** — retokenized `index.css` to LeaderFactor's brand (see the superseded **Design direction** note): Fustat + Spectral italic via Google Fonts CDN, navy palette, accent-blue, fully-pill buttons. Touches deck (slides/nav/eyebrow/subtitle), HUD buttons, in-scene `Card`, `Callout` (leader-line colors in `Callout.tsx`), `Progress`, credit; scene bg → navy in `App.tsx`. Verified via Playwright across cover/hero/home/dive-in. (Barlow Condensed kept — it's the rocket's painted markings, not UI.)
- [x] **"Why the Saturn V" slide** — a bulleted slide with presenter-stepped reveals: `bullets: Bullet[]` in `slides.ts`, one revealed per → / click before the deck advances (← walks them back; stepping back into a slide shows it complete). Reveal count lives in `App.tsx` (`revealed`), rendering + cues in `Presentation.tsx`. A bullet carries `sounds: Cue[]` (each `{ src, volume?, delay? }`, `src` relative to `BASE_URL`) and/or `confetti: true`; both fire only on a forward step, and **stepping back or leaving the slide stops them** — the presenter's kill switch, since the anthem runs 16.5s. Autoplay refusals are swallowed. The "America." bullet plays `audio/eagle-noise.mp3` over `audio/the-star-spangled-banner.mp3` (bed at 0.55), fires a hand-rolled canvas confetti burst (`ui/confetti.ts`, no dependency — side cannons firing inward, wide velocity spread so coverage stays even edge-to-edge), and sends the eagle gif across the top via `flyby: 'img/eagle-flying.gif'` (`ui/flyby.ts`, CSS-animated, right → left because the artwork faces left — never mirror it). All three self-remove and are cancelled together on a back-step or when the deck closes. A slide can also carry **`fadeCues: <ms>`** — a trailing presenter beat that changes nothing on screen and just tapers whatever is still playing down to silence (raised-cosine ramp), so the presenter can keep talking through the slide's points instead of leaving the slide to stop the music. This one is set to 4500 ms. `\u2190` off the beat still cuts the sound dead \u2014 that stays the kill switch. The ramp runs on a **`setInterval`, deliberately not `requestAnimationFrame`**: rAF only fires while the compositor is producing frames, and a stalled rAF would make the fade jump mid-talk. Bullet copy is DRAFT — presenter rewrites.
- [x] **Saturn V vs N1 (to scale)** — a slide can carry `compare: { model, heightM, x? }` (`slides.ts`) and the scene parks that vehicle beside the Saturn V. `Compare.tsx` measures the assembled Saturn V live (finds `S-IC`, walks to its mounted group, `Box3`) and scales the guest by the ratio of real heights (Saturn V 110.6 m), so the comparison stays honest if the assembly is ever re-tuned; it warns and falls back to a fixed scale rather than silently rendering a wrong-size rocket. Framed by `COMPARE_CAMERA`; both vehicles do the slow hero turn together (`spin.ts`, shared by `Stack` and `Compare` — same speed, same start, so they stay in step); the guest is preloaded at startup and sits behind its own `<Suspense fallback={null}>`, so mounting it mid-talk can't blank the scene. Currently on the last slide (`n1.glb`, 105.3 m — **“N1 rocket” by Scilence, CC BY 4.0**, credited on screen only while it's up). The N1 ships in an all-white studio livery, which made it read as a second Saturn V — `livery.ts` repaints it into the real olive-green-over-white scheme (green up to the payload shroud at model-space y 76.2, white above; the lattice interstages stay dark). It clones the shared materials per mesh, so the white payload stack is untouched.
- [x] **Compare button (Saturn V vs Statue of Liberty)** — third HUD button (and `C`), under Explode. The statue slides in from off-screen right over a fixed 1.2 s and parks beside the Saturn V, scaled by real height through `Compare.tsx`, while the camera eases to its pose. Both heights are drawn as engineering dimension lines (`Dimension.tsx`), in feet computed from the metres — 363 ft / 151 ft — so the labels can't drift from the scale. Everything tunable is `LIBERTY_COMPARE` in `hotspots.ts`; `heightM` is 46.05 = the copper statue heel to torch, because the model has no pedestal. Mutually exclusive with explode and hotspots: Esc, X, ←/→ and 1–5 all close it (arrows still step to their hotspot). The scan ships 0.9-metallic and grey, which rendered black — `livery.ts` dulls it and tints it verdigris. Model: "Statue of Liberty" by Maurice Svay, CC BY 4.0, credited while it's up; `public/models/liberty.glb` is a `gltf-transform optimize` of the 31 MB / 700k-tri Sketchfab download (84k tris, 2K texture, 4 MB).
- [x] **Spacecraft button (transposition, docking and extraction)** — fourth HUD button (and `S`). Plays Apollo 11's TD&E out of the Saturn V's own nose, straight through in ~25 s (`Spacecraft.tsx`). The escape tower and boost cover jettison (really 3 minutes after launch). The CSM separates while the adapter's four panels swing open and fly off. The CSM backs out 12 m and turns end over end, with the high-gain antenna and floodlight swinging out. It docks with the LM still sitting on the S-IVB and pulls it out. A last beat skips ahead to lunar orbit, where the LM's legs come down (Apollo 11: "Landing Gear Deploy, Fire", 098:14:35 GET, two hours before undocking) and the pair rolls slowly. **The roll is presentation licence:** the barbecue roll was only flown with the gear stowed. **The LM never flew itself out** — the CSM did all the flying.
      **Keys:** Esc or S rewinds it (fast, backwards) while the camera flies home. X, C, ←/→ and the number keys drop it at once — a hotspot's isolate must not catch its meshes mid-rewind. Mutually exclusive with explode/compare/hotspots/deck.
      **Content vs code:** timing and one camera per beat are content — `SPACECRAFT_VIEW.beats` in `hotspots.ts`, always seven (stacked + six moves). The moves themselves are constants in `Spacecraft.tsx`.
      **How it works:** a pure function of one timeline number `u` (0 = stacked, beat k runs u from k−1 to k), so it rewinds exactly and the lab can pin any moment. The spacecraft is mounted with `createPortal` into the rocket's own `Spacecraft_Top` group (nosecone.ts). It shares the adapter's frame, rides an explode reassembling under it, and is sized from the adapter (`R / 3.302 m`), so it fits the rocket it comes out of. The LM rides folded (`lmgear.ts`), hidden inside the closed adapter until the panels open. The docking tunnel is the LM's (`buildLMTunnel`), so it travels with the LM. No contact-shadow re-bake: it all happens ~100 units up, outside the shadow pass.
      **Detail pass:** the CSM (`csm.ts`) is rebuilt from the Apollo Operations Handbook's station numbers and the Apollo 11 photos (AS11-37-5443/5444/5446; S69-32370 is this exact vehicle): 33° CM cone, 3.9 m SM + fairing, satin blue-grey SPS bell, RCS quads on the axes −7¼°, ~120° ECS radiators, D-fin scimitars, the high-gain antenna, "UNITED STATES" + flag twice, umbilical, hatch, windows, figure-eight roll ports, copper docking ring and probe. The LM docks at real geometry — its 0.41 m tunnel against the CM's ring — clocked 60° from the CM hatch, legs 22.75° off the RCS quads. Critiqued for accuracy, projector legibility and robustness, each finding checked by a second agent before it went in. Came with it:
        - every guest model mounts inside `GuestBoundary` — a 404 used to blank the whole app on S/C;
        - keys with Cmd/Ctrl/Alt held are ignored — a Cmd+S reflex toggled the spacecraft under the Save dialog;
        - the app camera's near plane is 1, not 0.1 — ten times the depth precision, so millimetre-thin overlays stop flickering when zoomed out.
      **Pre-talk:** after loading, press S then Esc once. The first press compiles the spacecraft's shaders — better before the audience than during.
      **Model:** `public/models/lunar-module.glb` is `gltf-transform optimize --compress false --palette false --simplify-ratio 0.15 --simplify-error 0.002` of the 13 MB / 450k-tri download (`apollo_11_lunar_module.glb`) → ~70k tris, 1.8 MB. `--palette false` matters: the default palette step merges all ten colours into one texture, and the gold foil can no longer be found by material name.
      **Real-size cover + escape tower:** the rocket's own top (`nosecone.ts`) used to carry a 5 m pointed cover and an 8.6 m tower, so the command module that came out from under it looked tiny and the stack ran tall. From the service module up it's now built from `csm.ts`'s dimensions: the SM matches the detailed one; the boost protective cover is the CM's outline (toroidal shoulder, 33° cone) stood 3 cm off, with a rounded cap over the probe; the tower is a 10 ft square X-braced truss on the CM's tower wells; then the 26 in escape motor + tower jettison motor, nose cone and Q-ball — 33 ft from the tower's foot to the tip. The stack top dropped ~117.5 → ~110.4; Compare re-scales itself from the measured height. Verified headless: the tower pop, home, compare, explode, fly-in/out; build clean.
- [x] **HUD menu** — Start Presentation / Explode / Compare sit behind one **Menu** pill (top-left) and roll down under it, staggered, when it's clicked. Collapsed they're `visibility: hidden` (flipped only after the roll-up plays), so they can't be clicked or tabbed to by accident. Keyboard shortcuts (X, C, arrows, Esc) work whether it's open or not; toggling Explode/Compare leaves it open so they can be switched back off; Start Presentation collapses it.
- [x] **"The same six and a half years" slide** — a timeline comparison after "Sixty-six years": NASA (JFK commits May 25 1961 → Apollo 4 flies Nov 9 1967, **2,359 days**) against SpaceX (incorporated Mar 14 2002 → RatSat reaches orbit Sep 28 2008, **2,390 days**). SpaceX, with CAD/laptops/simulation/Slack and fifty years of hindsight, took **31 days longer**. A slide can now carry `race: { lanes: RaceLane[] }` (`slides.ts`); `Presentation.tsx` draws each lane as a bar whose width is `days / (longest lane)`, so both bars sit on **one shared scale** and the near-identical lengths are measured, not eyeballed — re-time the dates and the bars re-draw themselves. The slide's beats run **lane, lane, kicker, then the to-scale panel** — one per → , ← walks each back; `slideSteps()` in `slides.ts` owns that sequence so `App.tsx` (which counts the steps) and `Presentation.tsx` (which decides what shows) can't drift apart. Hidden lanes keep their space (opacity only), so nothing reflows mid-sentence. Subtitle + kicker copy is DRAFT — presenter rewrites; the dates and day counts are load-bearing.
      Beside it, a `scale: { vehicles: ScaleVehicle[] }` panel (`ui/ScaleCompare.tsx`) draws **Saturn V vs Falcon 1 to scale** — 110.6 m / 140 t to orbit against 22.25 m / 670 kg, plus the computed multiples (**5× taller, 209× the payload**). The whole drawing is authored in **metres**: each silhouette is a hand-drawn profile declared at a known height, redrawn at the content's `heightM`; lane positions and the viewBox are packed from the scaled half-widths; each label is placed by its own height; and both multiples are computed — so nothing in the picture can drift from the numbers printed beside it. It arrives as the slide's **last presenter beat**: the panel fades up, the silhouettes grow off the ground line, then the labels land (the transform sits on the `<svg>` — the `<g>`s already carry one, in metres). A slide carrying `scale` renders through `.deck__split` (argument left, drawing right), and the column holds its width while hidden so revealing it never reflows the bars; `.scale__stage` needs its **explicit height** — the svg takes its width from the viewBox, so leaving height to the flex row is circular and blows the layout open.
- [x] **Manufacturing & assembly map** — a slide can carry `map: { src }` (`slides.ts`) and the deck renders that page full-bleed in an iframe (`.deck__slide--map`). The page is `public/map/assembly-map.html`: standalone, no build step, OpenLayers 10 + a keyless Esri dark basemap from CDN, all sites/routes inline. Ten sites coloured by category with click-for-detail popups; barge routes traced as **multi-point paths along actual navigable water** (Intracoastal → Mississippi Sound; around the Keys and up the Atlantic; Baja → Panama Canal → Gulf), drawn as fluid curves through their waypoints via **centripetal** Catmull-Rom (`smoothPath`) — centripetal, not uniform, because uniform parameterisation overshoots at tight corners and a corner here is a headland, so an overshoot runs the ship through land; air routes as dashed arcs; legend + five show/hide toggles; clicking a route draws it in with a travelling marker, and "Trace every journey" runs them all. A leg can carry **`continuesTo`**: the stages fired at the Mississippi Test Facility went on to the Cape from there, and both took the same barge run, so that leg is drawn once and shared — `continuesTo` stitches it back onto each stage's journey, and the tracer runs the whole chain as one motion (one marker, finished legs left drawn, a beat at the stop) rather than a line that ends in Mississippi and an unrelated line that starts there. Leg duration is derived from length against the longest route of that mode, so speed is constant across a journey instead of lurching at the junction. "Trace every journey" walks journey _starts_ only, so a shared leg isn't animated twice — and paces each journey `GATHER` (0.72) of the way toward the slowest, so they land within ~2s of each other instead of the flights finishing while the S-II is still off Mexico. The flights still arrive first; a route traced on its own keeps its natural pace. The home framing (`HOME_EXTENT`) is **measured from the features themselves** — every site and every route, Panama detour included — so the whole picture is on screen at open and adding a site or re-routing a barge re-frames the map rather than quietly cropping it. It's measured from _all_ features, not the visible ones, so a legend toggle can't shift the framing under the presenter; `r` resets the view. Copy is **not** in the HTML: the slide's eyebrow/title/subtitle are passed on the query string, so this slide's words live in `slides.ts` with every other slide's, and the file still reads correctly opened on its own. **Keyboard nav across the iframe:** clicking into an iframe moves focus out of the parent document, which would kill `←`/`→`; the page forwards those keys back via `postMessage` and `App` replays them (verified). `heroPreview` in `App.tsx` now holds from the hero slide _onward_ rather than only on it — the map sits after the hero slide, is opaque, and the grow-into-HOME reveal is saved for the real handoff instead of being spent behind it.
      Three gotchas worth keeping: giving the basemap its own `className` splits OL's single composited canvas into one per layer, so an opaque `background` on `canvas` makes the vector layer paint over the tiles (it belongs on `.ol-viewport`); a custom `className` _replaces_ `ol-layer`, which carries the container's sizing; and OL writes `z-index: 0` **inline** on `.ol-overlaycontainer-stopevent`, which starts a stacking context — so a popup can't clear the title/legend from inside it however high its own z-index. The container is raised instead (`!important`, to beat the inline style), and popups are opaque (`--panel-solid`) rather than 92% so the title underneath can't ghost through them. Coordinates were refined from the supplied set but stay approximate — and the Huntington Beach → SACTO leg is flagged `unverified: true` in the data (renders dimmed, says so in its popup): confirm or delete that one line.
- [x] **Hotspots 2–5 — machine built, copy PLACEHOLDER.** Bottom → top, so the camera climbs the stack: **02** S-II (the mass problem, `anchor: "S-II"`), **03** S-IVB (the restart in space, `anchor: "S-IVB"` — its own engine `J2005` is hidden under the S-II_Top shroud, so the stage body is the anchor), **04** Instrument Unit (the computer, `anchor: "Instrument_Unit_Metal_0"` — see the two anchor traps above), **05** Spacecraft_Top (the escape tower). Poses derived from the measured extents, then verified headless: all five tags separate at home, arrow nav steps 1→5, ← walks back, Esc closes, build clean.
- [x] **Three stage hotspots, marked by brackets** — cut to one hotspot per stage: **01** S-IC (keeps the F-1 copy; the camera frames the whole stage, F-1 bells to forward skirt, in the open area left of the card), **02** S-II, **03** S-IVB; the Instrument Unit and escape-tower hotspots are gone (placeholder copy, still in git history). The leader lines are replaced by engineering-drawing ] brackets (`Bracket.tsx` / `Brackets.tsx`): each spans its stage's measured height, the three chain into one column right of the rocket, and all of them hide while a hotspot is open (the card + dimming take over). Verified headless: 3 tags right of the axis at home and after an orbit, 0 px drift after explode → reassemble, → stops at 03, Esc brings them back, build clean.
- [x] **Fourth bracket: the spacecraft** — **04** covers everything above the third stage (`bracket: ["Spacecraft_Top"]`: the adapter with the LM folded inside, the SM, the CM under its boost cover, the escape tower), isolates `Spacecraft_Top`, and frames 83.1→110.4. Brackets are coloured by the hotspot's `kind`: the three stages orange, the spacecraft blue. The lines go through the ACES pass and the DOM tags don't, so each tag is given the colour its line lands at (`#ff6f10` → `#f28523`, `#1f80ea` → `#298ddb`, from three's ACES curve, matched to the pixel in a render). Body copy is PLACEHOLDER, one line per topic (SM, LM, CM, escape system). Verified headless: four brackets chained at home, `4` and → open it (→ stops there), brackets come back after S→Esc and explode→reassemble, build clean.
- [x] **YouTube clips in the card** — a hotspot can carry `clips: Clip[]`, shown in the same gallery as `images` (after them; a clips-only gallery goes 16:9). S-II carries two from NasaHD's "Saturn 5 Launch HD" (`pLVavhJwKwk`): 0:00–0:25 stage 1 separation, 1:35–1:55 interstage ring separation. `ui/Clip.tsx` shows YouTube's thumbnail until clicked, then plays through the IFrame Player API (YouTube's own script, loaded on demand), muted — the footage is silent. The iframe is `pointer-events: none` + `tabIndex -1`, so a click never pulls focus out of the app and ←/→/Esc keep working mid-clip (verified); paging, changing hotspot or closing the card destroys the player; a second click while it's starting is ignored; offline, the poster says "Couldn't load the clip — click to retry". **YouTube's chrome** (title bar, centre pause icon, "More videos", logo) shows for ~4 s after _any_ playback start, seek, pause or resume — measured headless. So the player starts up to 4 s early under the poster and the poster lifts at `from` (no seek: a seek brings the chrome back), and the poster fades back in 0.5 s before `to`, so the end screen never shows. A clip starting before 0:04 has no room before it: **the 0:00 clip shows YouTube's chrome for its first ~4 s.** Needs wifi.
- [x] **S-IVB clip + full screen** — **03** S-IVB carries the same film's 2:06–2:30 (the S-II falls away and the S-IVB flies off; there's room for the 4 s pre-roll, so it comes up clean). Every clip has a **Full screen** pill in its top-right corner: `requestFullscreen()` on the `.clip` element itself — the top layer, so it escapes the card's transform and clipping, and the player is never re-mounted, paused or seeked (each would bring YouTube's chrome back). The same click starts an idle clip. **Esc while full screen leaves full screen only** — it's caught in the window's capture phase, before App's Esc would close the card; ←/→ still step hotspots and tear it down. Also fixed: after a hot reload of `Clip.tsx`, YouTube's loader never calls `onYouTubeIframeAPIReady` a second time, so every click spun forever until a page refresh — `loadYouTube` now resolves through `YT.ready()` when the API is already on the page. Verified in real Chrome (Playwright `channel: 'chrome'`): full screen → live, Esc keeps the card and the same player, re-entering and the Exit button don't restart it, ← tears it down, build clean. A clip takes ~5–10 s to appear (embed load + the 4 s pre-roll).
- [x] **Launch video button** — fifth HUD button, under Spacecraft. Plays one whole YouTube video full screen **with sound**: "Saturn V Launch. With enhanced audio… turn your speakers up!" (Hornet Museum, `CcXap3qet3g`, 2:34). The id, label and credit are `LAUNCH_VIDEO` in `hotspots.ts`; the player is `ui/LaunchVideo.tsx`. The click on the button is the user gesture that lets it go full screen and play unmuted (verified under desktop Chrome's `document-user-activation-required` policy). While it's up it **owns the keyboard** (capture phase): Esc closes, Space pauses, every other key is swallowed, so nothing in the scene changes unseen behind it and closing it leaves you exactly where you were (verified: a hotspot card open underneath survives → and X presses, then Esc). A click on the video pauses and resumes; the pointer and the Close pill hide after 2.5 s of a still mouse. It fades to black 0.5 s before the end and closes itself, so YouTube's end screen never shows. The video carries YouTube's auto-generated English captions, which the player turned on by default over the footage; they're switched off by selecting no track (`setOption('captions', 'track', {})`) as the captions module loads (`onApiChange`) and again on every playback start. `unloadModule('captions')` at load time does **not** hold: the module comes back as the video starts (measured headless, five strategies side by side). Leaving full screen any other way (the browser's own Esc) closes it too; if full screen is refused, it still fills the window. It stays mounted and opens on `open` rather than mounting on open, so StrictMode's double mount can't request full screen twice. **YouTube's chrome (title bar, pause icon, "More videos") shows for the first ~4 s**: it starts at 0:00, so there's no pre-roll room, same as the 0:00 S-II clip. No keyboard shortcut, on purpose: a stray keypress would blast launch audio mid-talk. Needs wifi. The YouTube API loader moved from `Clip.tsx` to `ui/youtube.ts`, shared by both.
- [ ] Real copy — **03 and 04** are PLACEHOLDER body text; 02 has real body copy under a placeholder subtitle; specs on 02–04 are DRAFT; 01 has real body copy but a placeholder subtitle. Presenter writes the actual stories and verifies the numbers.
- [ ] Remove the temp `PoseLogger` from `App.tsx` before ship.
- [ ] Optional polish — optional stage labels on the exploded view. (The dive-in tag/card overlap is gone: brackets hide while a hotspot is open.)
- [ ] Dry run on presentation hardware; fallback screen recording saved to desktop.

**Next up:** swap in real copy for the four hotspots. The machine is done — it's a data edit in `hotspots.ts`.

## Personal Note

- ~~add this youtube video at some point~~ → done: it's the HUD's **Launch video** button (`LAUNCH_VIDEO` in `hotspots.ts`, id `CcXap3qet3g`).

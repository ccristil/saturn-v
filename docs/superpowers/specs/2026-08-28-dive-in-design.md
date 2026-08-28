# Feature dive-in — design

- **Date:** 2026-08-28
- **Status:** Approved, ready for implementation plan
- **Scope:** One hotspot end-to-end — the F-1 engine cluster at the base of the Saturn V.

## Goal

Build the first real walkthrough loop on top of the rendered NASA `.glb`: a presenter
triggers a "dive-in" to the rocket's engines — the camera arcs down and in, the engines
light up while the rest of the vehicle dims, a leader-line callout draws in, and a card
slides in with the engineering story. This proves the whole interaction loop
(marker → zoom → isolate → callout → card → back to wide) on a single hotspot so the feel
can be judged before replicating to the other four.

This is the vertical slice CLAUDE.md asks for, now against the real model.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope of this pass | **One hotspot, end-to-end.** Not all 5. |
| What "the rockets" targets | **F-1 engine cluster** at the base of the first stage (S-IC). CLAUDE.md hotspot #1. |
| Zoom feel | **Cinematic arc-in, ~1s, ease-in-out**, engines light up (isolate-dim) on arrival, leader line draws in. Restrained, not a screensaver. |
| Mini presentation | **Single rich card** (title, one-line hook, 2–3 body paragraphs, spec table). No stepped beats. |
| Copy | **Placeholder/mock**, clearly marked. Presenter writes real copy later in `hotspots.ts`. |
| Camera implementation | **Hand-rolled `CameraRig`** easing in `useFrame`. No new dependency. Deterministic fixed duration. |

## Architecture

Follows CLAUDE.md's prescribed file structure. **Content is decoupled from geometry** —
all copy and coordinates live in `hotspots.ts`; components hold zero copy.

**New / changed files:**

- `src/content/hotspots.ts` — the `Hotspot[]` array. One entry now (F-1 engines) with
  placeholder copy and captured camera/target coordinates. Also exports the wide-shot
  "home" camera. Uses CLAUDE.md's `Hotspot` type verbatim.
- `src/scene/CameraRig.tsx` — eases `camera.position` and the `OrbitControls` target from
  their current values toward the active hotspot's `camera` values (or the home shot when
  none is active).
- `src/scene/Callout.tsx` — the leader line + numbered tag for a hotspot.
- `src/scene/isolate.ts` — a helper (not a component) that dims all meshes except the
  target region and restores them on exit.
- `src/ui/Card.tsx` — the DOM overlay panel with the story.
- `src/ui/Progress.tsx` — the `01 · 02 …` step indicator, rendered from the array.
- `src/App.tsx` — owns `activeIndex` and keyboard handling; wires the pieces together.
- `public/fonts/` — self-hosted IBM Plex Sans, IBM Plex Mono, Barlow Condensed (woff2).
- `src/index.css` (or a fonts stylesheet) — `@font-face` declarations + palette CSS vars.

## Data flow

`App` holds `activeIndex: number | null` (`null` = wide shot). Both keyboard input and
clicking a marker just set `activeIndex`. Everything else derives from
`hotspots[activeIndex]`:

- `CameraRig` reads the active hotspot's `camera` (or the home shot) and eases toward it.
- `isolate` reads the active hotspot's `isolate`/target region and dims the rest.
- `Callout` renders active (foil, drawn-in) vs inactive (rule, thin).
- `Card` renders the active hotspot's `title` / `subtitle` / `body` / `specs`.
- `Progress` highlights the active `tag`.

## The dive-in sequence (trigger → ~1s)

1. **Arc-in.** `CameraRig` interpolates from the current camera to the hotspot's stored
   `camera.position` / `lookAt` over ~1s using a `smootherstep` easing curve. The path is
   bent along a slight arc via a mid control-point offset outward (quadratic interpolation)
   so it curves in rather than sliding in a straight line. User orbit is locked (`enabled =
   false`) during the flight and released once it settles, so the presenter can still nudge
   the view at rest.
2. **Isolate / light-up.** On arrival, `isolate` dims every mesh except the base/engine
   region to `--rule`, leaving the engines lit. Reversed on exit.
3. **Callout.** The `Callout` leader line draws from the engine target point out to the
   `01` tag over ~300ms, in `--foil` with a 90° elbow.
4. **Card.** The `Card` slides in from the side: title (Barlow Condensed 600), one-line
   hook, 2–3 placeholder paragraphs (IBM Plex Sans), and a spec table — thrust, propellant
   flow (IBM Plex Mono). `Esc` reverses the whole sequence back to the wide shot.

## Component details

### CameraRig
- Runs in `useFrame`. Holds a normalized progress `t` (0→1) advanced by `delta / duration`.
- Eases position along a quadratic curve: `p = lerp(lerp(from, mid, e), lerp(mid, to, e), e)`
  where `mid` is the midpoint pushed outward for the arc, `e = smootherstep(t)`.
- Eases the `OrbitControls` target from current lookAt to the hotspot's `lookAt` in parallel.
- On `activeIndex` change, captures `from` = current, `to` = target, resets `t`, locks orbit.
- At `t >= 1`, snaps to exact target (determinism) and re-enables orbit.
- Home shot (when `activeIndex` is null) is a stored wide-camera in `hotspots.ts`.

### isolate (`src/scene/isolate.ts`)
- `applyIsolate(root, keepPredicate)` traverses the loaded scene, and for each mesh **not**
  kept, clones its material once (cached, to restore later) and dims it (drop toward
  `--rule`: reduce color/emissive, optionally `transparent` + lower opacity). Kept meshes
  are untouched.
- `clearIsolate(root)` restores every mesh's original material.
- **Mesh selection for this pass:** the glb's meshes have generic Maya names
  (`pCylinder1`, `group3`…), not stage labels. So the "keep" set is chosen **spatially** —
  meshes whose bounds sit in the lower/base region of the vehicle. A `TODO` notes the real
  `name → stage` mapping that a later pass needs for `Hotspot.isolate` to work by name.
- Per-mesh material cloning is required because the glb shares materials across meshes
  (`KHR_materials_specular`); mutating a shared material would dim unrelated meshes.

### Callout (`src/scene/Callout.tsx`)
- drei `<Line>` from the hotspot `target` point to a tag anchor, with a 90° elbow.
- Inactive: `--rule`, thin. Active: `--foil`, and the line draws in over ~300ms
  (animate the drawn fraction of the points).
- The numbered tag (`01`) is a drei `<Html>` label anchored at the line's outer end.
- Clicking the marker/tag sets `activeIndex` (secondary to keyboard).

### Card (`src/ui/Card.tsx`)
- Plain absolutely-positioned DOM overlay over the canvas (not in-canvas `<Html>`) — crisper
  text on a washed-out projector, and matches CLAUDE.md's `ui/` separation.
- Max-width ~520px, body text ≥18px, high contrast, `--panel` surface, `--foil` accent on
  the active tag/title rule. Slides/fades in on activate, out on `Esc`.
- Renders `title`, `subtitle`, `body[]`, `specs[]` from the active hotspot. Zero hardcoded copy.

### Progress (`src/ui/Progress.tsx`)
- Renders `01 · 02 · 03 · 04 · 05` from the hotspots array length (just `01` for now).
- Active tag is `--foil`; the rest `--muted`. Bottom-of-screen strip.

### App (`src/App.tsx`)
- `activeIndex` state, default `null` (wide shot).
- Keyboard: `→` next, `←` prev, `Esc` → wide shot, `1`–`5` jump to that hotspot (only `1`
  active now). Listener added/removed in `useEffect`. Arrow-key nav must never break.
- Renders `Canvas` (model, lights, `CameraRig`, `Callout`s) + DOM overlay (`Card`, `Progress`).

## Coordinates & camera capture

The model is centered at the origin (via `<Center>` or an explicit equivalent). Hotspot
`target` and `camera` coordinates are **captured live** — point `OrbitControls` at the
engines, read the resulting camera position + target, and paste the numbers into
`hotspots.ts`. This satisfies CLAUDE.md's "camera positions captured" and keeps transitions
deterministic. The engines sit at the low-Y end of the centered model (~y = −6).

## Fonts

Self-host all three as woff2 in `public/fonts/`, referenced through `@font-face`. Downloaded
at build/setup time — **no runtime CDN** (must work wifi-off). IBM Plex Sans (body),
IBM Plex Mono (specs/numbers), Barlow Condensed 600 (tags/titles).

## Presentation-safety checklist (must hold)

- Keyboard is primary; clicking a marker is secondary. Arrow-key nav never breaks.
- Camera transition is deterministic and lands identically every time.
- Body text ≥18px, card ≤~520px, high contrast, legible from 20 ft.
- `--foil` appears on exactly one thing at a time (the active hotspot).
- Fails visibly: if the model is missing, the app still runs (existing fallback behavior).

## Out of scope (this pass)

- The other four hotspots.
- Real presenter copy (placeholder only, clearly marked).
- Exploded-stage view.
- Real `name → stage` mesh mapping (spatial selection stands in for now).
- Any new runtime dependency.

## Open items / TODOs carried forward

- **Mesh → stage name map.** Needed before `Hotspot.isolate` can select by mesh name and
  before the exploded-stage view. Spatial region selection is the stopgap.
- Camera/target numbers get finalized during implementation by live capture.

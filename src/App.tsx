import { Suspense, useEffect, useState } from 'react'
import { NoToneMapping } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Stack } from './scene/Stack'
import { Ground } from './scene/Ground'
import { Callouts } from './scene/Callouts'
import { Compare, preloadCompare } from './scene/Compare'
import { Spacecraft, preloadSpacecraft } from './scene/Spacecraft'
import { GuestBoundary } from './scene/GuestBoundary'
import { CameraRig, type CamPose } from './scene/CameraRig'
import { Card } from './ui/Card'
import { Progress } from './ui/Progress'
import { Presentation } from './ui/Presentation'
import {
  hotspots,
  HOME_CAMERA,
  EXPLODE_CAMERA,
  HERO_CAMERA,
  COMPARE_CAMERA,
  MODEL_CREDIT,
  COMPARE_CREDIT,
  LIBERTY_COMPARE,
  SPACECRAFT_VIEW,
} from './content/hotspots'
import { slides, slideSteps } from './content/slides'

// TEMP (Task 8): press 'p' to log the current camera pose for hotspots.ts. Removed after tuning.
function PoseLogger() {
  const { camera, controls } = useThree()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'p') return
      const c = controls as unknown as { target?: { x: number; y: number; z: number } }
      // eslint-disable-next-line no-console
      console.log(
        'position:',
        [+camera.position.x.toFixed(2), +camera.position.y.toFixed(2), +camera.position.z.toFixed(2)],
        'lookAt:',
        c.target ? [+c.target.x.toFixed(2), +c.target.y.toFixed(2), +c.target.z.toFixed(2)] : null,
      )
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [camera, controls])
  return null
}

export default function App() {
  // null = wide shot; otherwise index into hotspots
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [exploded, setExploded] = useState(false)
  // null = not presenting; otherwise index into slides (deck covers the 3D)
  const [slideIndex, setSlideIndex] = useState<number | null>(null)
  const [deckExiting, setDeckExiting] = useState(false) // dissolve deck → 3D handoff
  // How many reveal beats of the current slide the presenter has stepped through. On
  // a slide that has them, 'next' walks these first; only then does it advance the
  // slide. Bullets are one beat each; a race is one beat per lane plus a final beat
  // for the kicker, so the payoff line lands on its own step.
  const [revealed, setRevealed] = useState(0)
  const stepCount = (i: number) => slideSteps(slides[i]).count

  // The HUD's "Compare": the Statue of Liberty slides in beside the Saturn V, to scale.
  // `comparing` is what the presenter asked for; the statue stays mounted (`libertyUp`)
  // until it has slid back out, and `libertyMoving` covers the slide in either direction.
  const [comparing, setComparing] = useState(false)
  const [libertyUp, setLibertyUp] = useState(false)
  const [libertyMoving, setLibertyMoving] = useState(false)
  // The HUD controls stay tucked behind one Menu pill until it's clicked. Keyboard
  // shortcuts (X, C, arrows) work either way — the menu only hides the buttons.
  const [menuOpen, setMenuOpen] = useState(false)
  // The HUD's "Spacecraft": the docked CSM + LM floating beside the Saturn V's nose.
  const [spacecraft, setSpacecraft] = useState(false)

  // Warm every comparison model at startup: mounting one cold, mid-talk, would suspend
  // and blank the scene for as long as the download takes.
  useEffect(() => {
    for (const s of slides) if (s.compare) preloadCompare(s.compare.model)
    preloadCompare(LIBERTY_COMPARE.model)
    preloadSpacecraft(SPACECRAFT_VIEW.model)
  }, [])

  const closeCompare = () => {
    if (!comparing) return
    setComparing(false)
    setLibertyMoving(true) // Compare reports back once it has slid out (onLibertySettled)
  }
  const toggleCompare = () => {
    if (comparing) return closeCompare()
    setExploded(false) // compare, explode, spacecraft and hotspots are mutually exclusive
    setActiveIndex(null)
    setSpacecraft(false)
    setComparing(true)
    setLibertyUp(true)
    setLibertyMoving(true)
  }
  const onLibertySettled = (parked: boolean) => {
    setLibertyMoving(false)
    if (!parked) setLibertyUp(false)
  }

  const toggleExplode = () => {
    setExploded((v) => !v)
    setActiveIndex(null) // explode and hotspots are mutually exclusive
    setSpacecraft(false)
    closeCompare()
  }

  const toggleSpacecraft = () => {
    if (!spacecraft) {
      setExploded(false)
      setActiveIndex(null)
      closeCompare()
    }
    setSpacecraft(!spacecraft)
  }

  const startPresentation = () => {
    setExploded(false)
    setActiveIndex(null)
    // the deck covers the scene at once, so the statue goes now rather than sliding out
    setComparing(false)
    setLibertyUp(false)
    setLibertyMoving(false)
    setSpacecraft(false)
    setMenuOpen(false) // the deck comes back to a tidy HUD
    setSlideIndex(0)
    setRevealed(0)
  }
  const exitPresentation = () => {
    setDeckExiting(false)
    setSlideIndex(null)
  }
  const prevSlide = () => {
    if (deckExiting || slideIndex === null) return
    if (revealed > 0) {
      setRevealed(revealed - 1) // walk the reveals back before leaving the slide
      return
    }
    if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1)
      setRevealed(stepCount(slideIndex - 1)) // stepping back into a slide shows it complete
    }
  }
  const nextSlide = () => {
    if (slideIndex === null || deckExiting) return
    if (revealed < stepCount(slideIndex)) {
      setRevealed(revealed + 1)
      return
    }
    if (slideIndex < slides.length - 1) {
      setSlideIndex(slideIndex + 1)
      setRevealed(0)
    } else {
      // Past the last (hero) slide → the reveal: the tiny spinning model grows into the
      // real thing. Switch the camera pose to HOME (grow + center) and stop the spin,
      // then dissolve the deck text over it. Lands on the wide shot; presenter drives
      // hotspots from there.
      setActiveIndex(null)
      setDeckExiting(true)
      window.setTimeout(() => {
        setSlideIndex(null)
        setDeckExiting(false)
      }, 1100)
    }
  }

  // An embedded slide (the assembly map) is an iframe: once the presenter clicks into
  // it, focus is inside that document and this window stops hearing keys. The embedded
  // page posts its navigation keys back out, and they're replayed here as if they'd
  // been pressed on the deck — so arrow-key nav survives someone driving the map.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== 'assembly-map') return
      if (slideIndex === null || deckExiting) return
      const key = e.data?.key
      if (key === 'ArrowRight' || key === ' ') nextSlide()
      else if (key === 'ArrowLeft') prevSlide()
      else if (key === 'Escape') exitPresentation()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, deckExiting, revealed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave browser shortcuts alone: a Cmd+S or Cmd+C reflex mustn't flip the scene
      // underneath the browser's own dialog.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Presentation deck owns the keyboard while it's up.
      if (slideIndex !== null) {
        if (e.key === 'Escape') exitPresentation()
        else if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault()
          nextSlide()
        } else if (e.key === 'ArrowLeft') prevSlide()
        return
      }
      if (e.key === 'Escape') {
        setExploded(false)
        setActiveIndex(null)
        setSpacecraft(false)
        closeCompare()
        return
      }
      if (e.key === 'x' || e.key === 'X') {
        toggleExplode()
        return
      }
      if (e.key === 'c' || e.key === 'C') {
        toggleCompare()
        return
      }
      if (e.key === 's' || e.key === 'S') {
        toggleSpacecraft()
        return
      }
      if (exploded) return // stage nav is disabled while exploded
      // Stepping to a stage ends the comparison (or the spacecraft view) rather than
      // being ignored — arrow nav always does something.
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || (e.key >= '1' && e.key <= '9')) {
        setSpacecraft(false)
        closeCompare()
      }
      if (e.key === 'ArrowRight')
        setActiveIndex((i) => Math.min((i ?? -1) + 1, hotspots.length - 1))
      else if (e.key === 'ArrowLeft')
        setActiveIndex((i) => (i === null || i - 1 < 0 ? null : i - 1))
      else if (e.key >= '1' && e.key <= '9') {
        const n = parseInt(e.key, 10) - 1
        if (n < hotspots.length) setActiveIndex(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded, slideIndex, deckExiting, revealed, comparing, spacecraft])

  const activeHotspot = activeIndex === null ? null : hotspots[activeIndex]

  // The 'hero' slide shows the live model, tiny + spinning, on the right.
  // onHeroSlide keeps the deck transparent through the exit dissolve; heroPreview drives
  // the small-right camera + spin, and drops on the final 'next' so the model grows
  // into HOME.
  //
  // heroPreview deliberately stays on for every slide from the hero slide onward, not
  // just the hero slide itself: any slide after it is opaque, so the model is parked
  // out of sight, and holding the pose means the grow-into-HOME reveal still plays on
  // the real handoff instead of being spent behind an opaque slide.
  const heroIndex = slides.findIndex((s) => s.kind === 'hero')
  const onHeroSlide = slideIndex !== null && slides[slideIndex]?.kind === 'hero'
  const heroPreview =
    slideIndex !== null && heroIndex >= 0 && slideIndex >= heroIndex && !deckExiting

  // A slide can park a second vehicle beside the Saturn V, to scale. It's mounted only
  // while that slide is up — the handoff drops it as the deck dissolves, so the wide
  // shot the presenter lands on is the Saturn V alone.
  const compare = slideIndex !== null && !deckExiting ? slides[slideIndex]?.compare : undefined
  const deckGuestX = compare?.x ?? -26

  const pose: CamPose = exploded
    ? EXPLODE_CAMERA
    : compare
      ? COMPARE_CAMERA
      : comparing
        ? LIBERTY_COMPARE.camera
        : spacecraft
          ? SPACECRAFT_VIEW.camera
          : heroPreview
          ? HERO_CAMERA
          : activeHotspot === null
            ? HOME_CAMERA
            : { position: activeHotspot.camera.position, lookAt: activeHotspot.camera.lookAt }

  return (
    <>
      <Canvas
        // near 1, not the default 0.1: ten times the depth precision for the millimetre
        // overlays (decals, radiator skins) — no scripted pose comes within 20 units
        camera={{ position: HOME_CAMERA.position, fov: 40, near: 1 }}
        dpr={[1, 2]}
        // AA + tone mapping are handled by the EffectComposer below, so turn the
        // renderer's own off (otherwise ACES would be applied twice).
        gl={{ antialias: false, toneMapping: NoToneMapping }}
      >
        {/* LeaderFactor navy backdrop. Brighter than the DOM --void token because ACES
            (below) darkens the whole frame — this input lands near the deck's navy. */}
        <color attach="background" args={['#17203f']} />

        <ambientLight intensity={0.25} />
        <directionalLight position={[12, 18, 10]} intensity={1.4} />
        <directionalLight position={[-10, 6, -12]} intensity={0.45} />

        {/* Procedural studio environment — built from light panels, no HDR file.
            Gives the metal reflections; rendered once (frames={1}), low-res for perf.
            background stays off so the void backdrop is untouched. */}
        <Environment resolution={256} frames={1}>
          {/* broad key + sky fill */}
          <Lightformer intensity={3.6} position={[14, 22, 10]} scale={[16, 16, 1]} color="#ffffff" />
          <Lightformer intensity={1.0} position={[-16, 10, -8]} scale={[12, 10, 1]} color="#adbdd4" />
          {/* tall narrow strips — reflect as vertical highlights down the metal cylinders */}
          <Lightformer intensity={2.4} position={[9, 2, 14]} scale={[2.5, 22, 1]} color="#ffffff" />
          <Lightformer intensity={1.5} position={[-7, -2, 13]} scale={[2, 18, 1]} color="#dfe6f0" />
          <Lightformer intensity={0.6} form="ring" position={[0, 34, 4]} scale={[10, 10, 1]} color="#ffffff" />
        </Environment>

        <Suspense
          fallback={
            <Html center style={{ color: '#8494ab', font: '14px monospace' }}>
              Loading model…
            </Html>
          }
        >
          <Stack isolateStages={activeHotspot?.isolate} exploded={exploded} spin={heroPreview} />
          {compare && (
            /* its own boundary: if the model is somehow not warm yet, or fails to
               load, it must not take the Saturn V down with it */
            <GuestBoundary name="Compare">
              <Compare
                model={compare.model}
                heightM={compare.heightM}
                x={deckGuestX}
                spin={heroPreview}
              />
            </GuestBoundary>
          )}
          {libertyUp && (
            <GuestBoundary name="Liberty">
              <Compare
                model={LIBERTY_COMPARE.model}
                heightM={LIBERTY_COMPARE.heightM}
                x={LIBERTY_COMPARE.x}
                enterFrom={LIBERTY_COMPARE.enterFrom}
                present={comparing}
                onSettled={onLibertySettled}
                labels={LIBERTY_COMPARE.names}
              />
            </GuestBoundary>
          )}
          {spacecraft && (
            /* floats ~100 units up, far out of the contact-shadow pass, so no re-bake */
            <GuestBoundary name="Spacecraft">
              <Spacecraft
                model={SPACECRAFT_VIEW.model}
                position={SPACECRAFT_VIEW.position}
                rotation={SPACECRAFT_VIEW.rotation}
                rollSpeed={SPACECRAFT_VIEW.rollSpeed}
              />
            </GuestBoundary>
          )}
          <Ground
            bakeKey={compare?.model ?? (libertyUp ? LIBERTY_COMPARE.model : '')}
            guestX={compare ? deckGuestX : LIBERTY_COMPARE.x}
            live={libertyMoving}
          />
          {!exploded && !comparing && !spacecraft && slideIndex === null && (
            <Callouts
              activeIndex={activeIndex}
              flip={activeIndex !== null}
              onSelect={setActiveIndex}
            />
          )}
        </Suspense>

        <OrbitControls makeDefault enableDamping target={HOME_CAMERA.lookAt} />
        <CameraRig pose={pose} />
        <PoseLogger />

        {/* Cinematic pass: filmic tone mapping (turns the linear render into a
            photographic curve) + a restrained bloom. The bloom threshold is high so
            only the bright metal specular highlights lift — the gold callout accent
            and painted body stay as-is. multisampling handles edge AA (renderer AA
            is off above). Kept cheap for the 60fps-on-integrated-graphics budget. */}
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <Bloom
            mipmapBlur
            intensity={0.5}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.3}
            radius={0.7}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>

      <Card hotspot={activeHotspot} />
      {/* hotspot progress belongs to the walkthrough — the deck's own counter owns
          that corner while a slide is up */}
      {slideIndex === null && <Progress hotspots={hotspots} activeIndex={activeIndex} />}

      {slideIndex === null && (
        <nav className={menuOpen ? 'hud hud--open' : 'hud'}>
          <button
            className="hud-btn hud-toggle"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="hud-toggle__icon" aria-hidden="true" />
            Menu
          </button>
          <div className="hud__items">
            <button className="hud-btn present-btn" onClick={startPresentation}>
              Start Presentation
            </button>
            <button
              className={exploded ? 'hud-btn explode-btn is-active' : 'hud-btn explode-btn'}
              onClick={toggleExplode}
            >
              {exploded ? 'Reassemble' : 'Explode stages'}
            </button>
            <button
              className={comparing ? 'hud-btn compare-btn is-active' : 'hud-btn compare-btn'}
              onClick={toggleCompare}
            >
              Compare
            </button>
            <button
              className={spacecraft ? 'hud-btn spacecraft-btn is-active' : 'hud-btn spacecraft-btn'}
              onClick={toggleSpacecraft}
            >
              Spacecraft
            </button>
          </div>
        </nav>
      )}

      <div className={slideIndex !== null ? 'credit credit--deck' : 'credit'}>
        {MODEL_CREDIT}
        {compare && <span className="credit__line">{COMPARE_CREDIT}</span>}
        {libertyUp && <span className="credit__line">{LIBERTY_COMPARE.credit}</span>}
        {spacecraft && <span className="credit__line">{SPACECRAFT_VIEW.credit}</span>}
      </div>

      {slideIndex !== null && (
        <Presentation
          slides={slides}
          index={slideIndex}
          revealed={revealed}
          exiting={deckExiting}
          hero={onHeroSlide}
          onNext={nextSlide}
          onPrev={prevSlide}
          onExit={exitPresentation}
        />
      )}
    </>
  )
}

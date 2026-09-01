import { Suspense, useEffect, useState } from 'react'
import { NoToneMapping } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Stack } from './scene/Stack'
import { Ground } from './scene/Ground'
import { Callouts } from './scene/Callouts'
import { CameraRig, type CamPose } from './scene/CameraRig'
import { Card } from './ui/Card'
import { Progress } from './ui/Progress'
import { Presentation } from './ui/Presentation'
import { hotspots, HOME_CAMERA, EXPLODE_CAMERA, HERO_CAMERA, MODEL_CREDIT } from './content/hotspots'
import { slides } from './content/slides'

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

  const toggleExplode = () => {
    setExploded((v) => !v)
    setActiveIndex(null) // explode and hotspots are mutually exclusive
  }

  const startPresentation = () => {
    setExploded(false)
    setActiveIndex(null)
    setSlideIndex(0)
  }
  const exitPresentation = () => {
    setDeckExiting(false)
    setSlideIndex(null)
  }
  const prevSlide = () => {
    if (deckExiting) return
    if (slideIndex !== null && slideIndex > 0) setSlideIndex(slideIndex - 1)
  }
  const nextSlide = () => {
    if (slideIndex === null || deckExiting) return
    if (slideIndex < slides.length - 1) setSlideIndex(slideIndex + 1)
    else {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        return
      }
      if (e.key === 'x' || e.key === 'X') {
        setExploded((v) => !v)
        setActiveIndex(null)
        return
      }
      if (exploded) return // stage nav is disabled while exploded
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
  }, [exploded, slideIndex, deckExiting])

  const activeHotspot = activeIndex === null ? null : hotspots[activeIndex]

  // The last slide (kind 'hero') shows the live model, tiny + spinning, on the right.
  // onHeroSlide keeps the deck transparent through the exit dissolve; heroPreview drives
  // the small-right camera + spin, and drops on 'next' so the model grows into HOME.
  const onHeroSlide = slideIndex !== null && slides[slideIndex]?.kind === 'hero'
  const heroPreview = onHeroSlide && !deckExiting

  const pose: CamPose = exploded
    ? EXPLODE_CAMERA
    : heroPreview
      ? HERO_CAMERA
      : activeHotspot === null
        ? HOME_CAMERA
        : { position: activeHotspot.camera.position, lookAt: activeHotspot.camera.lookAt }

  return (
    <>
      <Canvas
        camera={{ position: HOME_CAMERA.position, fov: 40 }}
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
          <Ground />
          {!exploded && slideIndex === null && (
            <Callouts activeIndex={activeIndex} onSelect={setActiveIndex} />
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
      <Progress hotspots={hotspots} activeIndex={activeIndex} />

      {slideIndex === null && (
        <>
          <button className="hud-btn present-btn" onClick={startPresentation}>
            Start Presentation
          </button>
          <button
            className={exploded ? 'hud-btn explode-btn is-active' : 'hud-btn explode-btn'}
            onClick={toggleExplode}
          >
            {exploded ? 'Reassemble' : 'Explode stages'}
          </button>
        </>
      )}

      <div className="credit">{MODEL_CREDIT}</div>

      {slideIndex !== null && (
        <Presentation
          slides={slides}
          index={slideIndex}
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

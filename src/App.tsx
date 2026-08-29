import { Suspense, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Stack } from './scene/Stack'
import { Callouts } from './scene/Callouts'
import { CameraRig, type CamPose } from './scene/CameraRig'
import { Card } from './ui/Card'
import { Progress } from './ui/Progress'
import { Presentation } from './ui/Presentation'
import { hotspots, HOME_CAMERA, EXPLODE_CAMERA, MODEL_CREDIT } from './content/hotspots'
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
      // Past the last slide → hand off into the 3D. Start the camera dive behind
      // the deck, then dissolve the deck over it (see .deck--exiting, ~820ms).
      setActiveIndex(0)
      setDeckExiting(true)
      window.setTimeout(() => {
        setSlideIndex(null)
        setDeckExiting(false)
      }, 820)
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

  const pose: CamPose = exploded
    ? EXPLODE_CAMERA
    : activeHotspot === null
      ? HOME_CAMERA
      : { position: activeHotspot.camera.position, lookAt: activeHotspot.camera.lookAt }

  return (
    <>
      <Canvas camera={{ position: HOME_CAMERA.position, fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={['#0b0e14']} />

        <ambientLight intensity={0.6} />
        <directionalLight position={[12, 18, 10]} intensity={1.6} />
        <directionalLight position={[-10, 6, -12]} intensity={0.5} />

        <Suspense
          fallback={
            <Html center style={{ color: '#8494ab', font: '14px monospace' }}>
              Loading model…
            </Html>
          }
        >
          <Stack isolateStages={activeHotspot?.isolate} exploded={exploded} />
          {!exploded && slideIndex === null && (
            <Callouts activeIndex={activeIndex} onSelect={setActiveIndex} />
          )}
        </Suspense>

        <OrbitControls makeDefault enableDamping target={HOME_CAMERA.lookAt} />
        <CameraRig pose={pose} />
        <PoseLogger />
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
          onNext={nextSlide}
          onPrev={prevSlide}
          onExit={exitPresentation}
        />
      )}
    </>
  )
}

import { Suspense, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Center, Html } from '@react-three/drei'
import { Stack } from './scene/Stack'
import { Callout } from './scene/Callout'
import { CameraRig, type CamPose } from './scene/CameraRig'
import { Card } from './ui/Card'
import { Progress } from './ui/Progress'
import { hotspots, HOME_CAMERA, EXPLODE_CAMERA, MODEL_CREDIT } from './content/hotspots'

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

  const toggleExplode = () => {
    setExploded((v) => !v)
    setActiveIndex(null) // explode and hotspots are mutually exclusive
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, [exploded])

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
          <Center>
            <Stack isolateStages={activeHotspot?.isolate} exploded={exploded} />
            {!exploded &&
              hotspots.map((h, i) => (
                <Callout
                  key={h.id}
                  target={h.target}
                  tag={h.tag}
                  active={i === activeIndex}
                  onSelect={() => setActiveIndex(i)}
                />
              ))}
          </Center>
        </Suspense>

        <OrbitControls makeDefault enableDamping target={HOME_CAMERA.lookAt} />
        <CameraRig pose={pose} />
        <PoseLogger />
      </Canvas>

      <Card hotspot={activeHotspot} />
      <Progress hotspots={hotspots} activeIndex={activeIndex} />
      <button
        className={exploded ? 'explode-btn is-active' : 'explode-btn'}
        onClick={toggleExplode}
      >
        {exploded ? 'Reassemble' : 'Explode stages'}
      </button>
      <div className="credit">{MODEL_CREDIT}</div>
    </>
  )
}

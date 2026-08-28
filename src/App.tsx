import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Bounds, Center, Html } from '@react-three/drei'
import { Stack } from './scene/Stack'

// MVP: load the real NASA glb, auto-frame it, and let the presenter orbit it.
// Hotspots / cards / camera rig come next — this proves the model renders.
export default function App() {
  return (
    <Canvas camera={{ position: [18, 8, 18], fov: 40 }} dpr={[1, 2]}>
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
        <Bounds fit clip observe margin={1.2}>
          <Center>
            <Stack />
          </Center>
        </Bounds>
      </Suspense>

      <OrbitControls makeDefault enableDamping />
    </Canvas>
  )
}

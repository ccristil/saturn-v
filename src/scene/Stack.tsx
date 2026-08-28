import { useGLTF } from '@react-three/drei'

const MODEL_URL = `${import.meta.env.BASE_URL}models/saturn-v.glb`

export function Stack({ isolateEngines = false }: { isolateEngines?: boolean }) {
  const { scene } = useGLTF(MODEL_URL)
  // isolate wiring added in Task 5
  void isolateEngines
  return <primitive object={scene} />
}

useGLTF.preload(MODEL_URL)

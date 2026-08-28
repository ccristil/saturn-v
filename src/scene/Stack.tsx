import { useGLTF } from '@react-three/drei'

// Resolve through BASE_URL so the model loads both on localhost ('/') and under the
// GitHub Pages subpath ('/saturn-v/'). Never hardcode a leading-slash asset path.
const MODEL_URL = `${import.meta.env.BASE_URL}models/saturn-v.glb`

export function Stack() {
  const { scene } = useGLTF(MODEL_URL)
  return <primitive object={scene} />
}

useGLTF.preload(MODEL_URL)

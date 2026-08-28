import { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { applyEngineIsolate, clearEngineIsolate } from './isolate'

const MODEL_URL = `${import.meta.env.BASE_URL}models/saturn-v.glb`

export function Stack({ isolateEngines = false }: { isolateEngines?: boolean }) {
  const { scene } = useGLTF(MODEL_URL)

  useEffect(() => {
    if (isolateEngines) applyEngineIsolate(scene)
    else clearEngineIsolate(scene)
    return () => clearEngineIsolate(scene)
  }, [isolateEngines, scene])

  return <primitive object={scene} />
}

useGLTF.preload(MODEL_URL)

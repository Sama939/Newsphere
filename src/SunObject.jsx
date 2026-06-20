import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSunDirection } from './sun'

// How far out to place the sun. Far enough to read as a distant light source,
// near enough (< stars at 50) to feel present. It sits along the exact same
// vector the day/night shader uses, so it always aligns with the lit side and
// the terminator, and moves correctly as the user spins the globe.
const SUN_DISTANCE = 8

// Build a soft radial-gradient sprite used for the glow/corona.
function makeGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0.0, 'rgba(255, 255, 255, 1)')
  g.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)')
  g.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)')
  g.addColorStop(1.0, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

export default function Sun() {
  const groupRef = useRef()
  const glowTex = useMemo(() => makeGlowTexture(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!groupRef.current) return
    tmp.copy(getSunDirection(new Date())).multiplyScalar(SUN_DISTANCE)
    groupRef.current.position.copy(tmp)
  })

  return (
    <group ref={groupRef}>
      {/* Bright solid core */}
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshBasicMaterial color="#fff6e0" toneMapped={false} />
      </mesh>
      {/* Inner glow */}
      <sprite scale={[1.9, 1.9, 1]}>
        <spriteMaterial
          map={glowTex}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      {/* Outer corona — occluded by the globe's depth, so it peeks softly
          around the rim when the sun passes behind the planet. */}
      <sprite scale={[4.6, 4.6, 1]}>
        <spriteMaterial
          map={glowTex}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.4}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSunDirection } from './sun'

const SUN_DISTANCE = 8

// Billboard quad that always faces the camera, drawn in clip space so it
// never distorts. The fragment shader computes a smooth radial falloff in
// high precision — no canvas dithering, no mobile artifacts.
const glowVert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  // Place the quad in view space (always faces camera) then project.
  vec4 mvPos = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float scale = 1.8;
  mvPos.xy += (position.xy * scale);
  gl_Position = projectionMatrix * mvPos;
}
`

const glowFrag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float d = length(vUv - 0.5) * 2.0; // 0 at center, 1 at edge
  if (d > 1.0) discard;
  // Smooth power falloff: bright core fades to transparent edge
  float alpha = pow(1.0 - d, 2.5) * uOpacity;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`

export default function Sun() {
  const groupRef = useRef()
  const tmp = useMemo(() => new THREE.Vector3(), [])

  const innerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: glowVert,
    fragmentShader: glowFrag,
    uniforms: {
      uColor: { value: new THREE.Color(1.0, 0.97, 0.88) },
      uOpacity: { value: 0.85 },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [])

  const outerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float scale = 4.2;
        mvPos.xy += (position.xy * scale);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: glowFrag,
    uniforms: {
      uColor: { value: new THREE.Color(1.0, 0.92, 0.75) },
      uOpacity: { value: 0.28 },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [])

  useFrame(() => {
    if (!groupRef.current) return
    tmp.copy(getSunDirection(new Date())).multiplyScalar(SUN_DISTANCE)
    groupRef.current.position.copy(tmp)
  })

  return (
    <group ref={groupRef}>
      {/* Outer corona billboard */}
      <mesh material={outerMat}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* Inner glow billboard */}
      <mesh material={innerMat}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* Solid core sphere */}
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshBasicMaterial color="#fff6e0" toneMapped={false} />
      </mesh>
    </group>
  )
}

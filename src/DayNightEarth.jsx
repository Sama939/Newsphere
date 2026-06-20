import { forwardRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { getSunDirection } from './sun'

const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDirection;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  float intensity = dot(normalize(vNormal), normalize(sunDirection));
  // Smooth, gradual terminator transition.
  float blend = smoothstep(-0.25, 0.25, intensity);

  vec3 dayColor = texture2D(dayMap, vUv).rgb;
  vec3 nightLights = texture2D(nightMap, vUv).rgb;
  // Crush the night side toward black, letting only bright city lights pop.
  vec3 nightColor = pow(nightLights, vec3(2.0)) * 2.2;

  vec3 color = mix(nightColor, dayColor, blend);

  // Faint warm glow along the terminator, fading quickly either side.
  float edge = 1.0 - smoothstep(0.0, 0.35, abs(intensity));
  color += vec3(1.0, 0.55, 0.25) * edge * 0.08;

  gl_FragColor = vec4(color, 1.0);
}
`

const Earth = forwardRef(function Earth(_props, ref) {
  const [dayMap, nightMap] = useTexture([
    '/textures/earth-day.jpg',
    '/textures/earth-night.jpg',
  ])

  const uniforms = useMemo(
    () => ({
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      sunDirection: { value: getSunDirection(new Date()) },
    }),
    [dayMap, nightMap]
  )

  useFrame(() => {
    uniforms.sunDirection.value.copy(getSunDirection(new Date()))
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
})

export default Earth

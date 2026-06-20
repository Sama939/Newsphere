import { useRef } from 'react'
import { OrbitControls, Stars } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import DayNightEarth from './DayNightEarth'
import LabelProjector from './LabelProjector'
import Sun from './SunObject'
import { latLngToVector3 } from './geo'

// Smoothly slides the camera along the sphere so a target lat/lng faces the
// viewer. App sets focusRef.current = { lat, lng } (e.g. from the news panel);
// this lerps the camera there and clears the target when it arrives.
function GlobeFocus({ focusRef, controlsRef }) {
  const { camera } = useThree()
  const target = useRef(null)

  useFrame(() => {
    if (focusRef.current) {
      // New focus request — convert to a camera position at current zoom.
      const dir = latLngToVector3(focusRef.current.lat, focusRef.current.lng, 1).normalize()
      target.current = { dir, dist: camera.position.length() }
      focusRef.current = null
    }
    if (!target.current) return

    const { dir, dist } = target.current
    const desired = dir.clone().multiplyScalar(dist)
    camera.position.lerp(desired, 0.12)
    camera.position.setLength(dist) // keep constant radius → slide, don't zoom
    if (controlsRef.current) controlsRef.current.update()

    if (camera.position.angleTo(desired) < 0.01) target.current = null
  })

  return null
}

export default function Earth({
  labelRefs,
  connectorRefs,
  pinRefs,
  tooltipRef,
  hoveredRef,
  newsEvents,
  newsRefs,
  newsPopupRef,
  hoveredNewsRef,
  clusterMapRef,
  langRef,
  focusRef,
}) {
  const earthRef = useRef()
  const controlsRef = useRef()

  return (
    <>
      <ambientLight intensity={0.15} />
      <Stars radius={50} depth={20} count={2500} factor={2} saturation={0} fade speed={0} />
      <Sun />
      <DayNightEarth ref={earthRef} />
      <LabelProjector
        labelRefs={labelRefs}
        connectorRefs={connectorRefs}
        pinRefs={pinRefs}
        tooltipRef={tooltipRef}
        hoveredRef={hoveredRef}
        newsEvents={newsEvents}
        newsRefs={newsRefs}
        newsPopupRef={newsPopupRef}
        hoveredNewsRef={hoveredNewsRef}
        clusterMapRef={clusterMapRef}
        langRef={langRef}
      />
      <GlobeFocus focusRef={focusRef} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={1.5}
        maxDistance={4}
        rotateSpeed={0.5}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}

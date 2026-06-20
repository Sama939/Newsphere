import * as THREE from 'three'

export function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

export function vector3ToLatLng(point, radius) {
  const normalized = point.clone().normalize().multiplyScalar(radius)
  const lat = 90 - (Math.acos(normalized.y / radius) * 180) / Math.PI
  let lng = (Math.atan2(normalized.z, -normalized.x) * 180) / Math.PI - 180
  if (lng < -180) lng += 360
  if (lng > 180) lng -= 360
  return { lat, lng }
}

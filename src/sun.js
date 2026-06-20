import * as THREE from 'three'

// Approximate sub-solar point (lat/lng where the sun is directly overhead) for a given Date.
export function getSubsolarPoint(date) {
  const dayMs = 24 * 60 * 60 * 1000
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const dayOfYear = (date - start) / dayMs

  const declination = 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365)

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  let lng = 180 - utcHours * 15
  if (lng > 180) lng -= 360
  if (lng < -180) lng += 360

  return { lat: declination, lng }
}

export function getSunDirection(date) {
  const { lat, lng } = getSubsolarPoint(date)
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ).normalize()
}

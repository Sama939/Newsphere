import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DateTime } from 'luxon'
import { CITIES } from './cities'
import { latLngToVector3 } from './geo'
import { translateLocation } from './geoTranslate'

function timeAgo(isoDate, lang = 'zh') {
  if (!isoDate) return ''
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (lang === 'en') {
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

const LABEL_HEIGHT = 22
const GAP = 4

export default function LabelProjector({
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
}) {
  const { camera, size } = useThree()
  const offsets = useRef({})
  // Tracks which event's sources are currently rendered, so we only rebuild
  // the source <a> elements when the selection/language changes — not every
  // frame (rebuilding every frame destroys links mid-click).
  const sourcesKeyRef = useRef(null)

  useFrame(() => {
    if (!labelRefs.current) return
    const cameraDir = camera.position.clone().normalize()
    const items = []

    CITIES.forEach((city) => {
      const pos = latLngToVector3(city.lat, city.lng, 1.01)
      const normal = pos.clone().normalize()
      const facing = normal.dot(cameraDir)
      const visible = facing > 0.1

      const projected = pos.clone().project(camera)
      const x = ((projected.x + 1) / 2) * size.width
      const y = ((1 - projected.y) / 2) * size.height

      items.push({ city, x, y, visible, depth: projected.z })
    })

    // Greedy vertical declutter: push overlapping labels apart.
    // Fixed CITIES order keeps priority stable across frames (no flicker).
    const placed = []
    items
      .filter((i) => i.visible)
      .forEach((item) => {
        let y = item.y
        let moved = true
        let guard = 0
        while (moved && guard < 20) {
          moved = false
          guard += 1
          for (const p of placed) {
            if (Math.abs(p.x - item.x) < 70 && Math.abs(p.y - y) < LABEL_HEIGHT) {
              y = p.y + LABEL_HEIGHT + GAP
              moved = true
            }
          }
        }
        const target = y - item.y
        const prev = offsets.current[item.city.name] ?? target
        const smoothed = prev + (target - prev) * 0.15
        offsets.current[item.city.name] = smoothed
        item.finalY = item.y + smoothed
        placed.push({ x: item.x, y })
      })

    items.forEach((item) => {
      const pin = pinRefs.current[item.city.name]
      if (pin) {
        pin.classList.toggle('is-visible', item.visible)
        if (item.visible) {
          pin.style.transform = `translate(${item.x}px, ${item.y}px) translate(-50%, -50%)`
        }
      }

      const el = labelRefs.current[item.city.name]
      if (!el) return
      el.classList.toggle('is-visible', item.visible)
      if (!item.visible) return
      el.style.transform = `translate(${item.x}px, ${item.finalY ?? item.y}px) translate(-50%, 0)`

      const connector = connectorRefs.current[item.city.name]
      if (connector) {
        const dy = item.finalY - item.y
        const show = Math.abs(dy) >= 2
        connector.classList.toggle('is-visible', show)
        if (show) {
          const length = Math.abs(dy) + 4
          connector.style.height = `${length}px`
          connector.style.transform = `translate(${item.x}px, ${Math.min(item.y, item.finalY)}px) translate(-50%, 0)`
        }
      }
    })

    // Tooltip for hovered/selected city.
    const lang = langRef?.current ?? 'zh'
    const hoveredName = hoveredRef.current
    if (tooltipRef.current) {
      const item = hoveredName && items.find((i) => i.city.name === hoveredName)
      const city = item?.city
      if (item && city && item.visible) {
        const time = DateTime.now().setZone(city.tz)
        tooltipRef.current.classList.add('is-visible')
        tooltipRef.current.style.transform = `translate(${item.x}px, ${(item.finalY ?? item.y) - 14}px) translate(-50%, -100%)`

        const timeEl = tooltipRef.current.querySelector('.city-time')
        timeEl.textContent = time.toFormat('HH:mm:ss')
        tooltipRef.current.querySelector('.city-date').textContent =
          time.toFormat(lang === 'zh' ? 'MM月dd日 EEE' : 'MMM d, EEE')
        tooltipRef.current.querySelector('.tooltip-city-name').textContent =
          lang === 'zh' ? city.name : (city.nameEn || city.name)
      } else {
        tooltipRef.current.classList.remove('is-visible')
      }
    }

    // News star markers.
    if (newsEvents && newsRefs?.current) {
      const newsItems = []
      newsEvents.forEach((evt, idx) => {
        const pos = latLngToVector3(evt.lat, evt.lng, 1.01)
        const normal = pos.clone().normalize()
        const facing = normal.dot(cameraDir)
        const visible = facing > 0.1

        const projected = pos.clone().project(camera)
        let x = ((projected.x + 1) / 2) * size.width
        let y = ((1 - projected.y) / 2) * size.height

        // Nudge away from city pins/labels so the two layers don't overlap.
        if (visible) {
          const fixedAngle = (idx * 2.399963) % (Math.PI * 2) // golden-angle spread
          for (const p of placed) {
            const dx = x - p.x
            const dy = y - p.y
            const dist = Math.hypot(dx, dy)
            if (dist < 26) {
              const angle = dist < 2 ? fixedAngle : Math.atan2(dy, dx)
              x = p.x + Math.cos(angle) * 26
              y = p.y + Math.sin(angle) * 26
            }
          }
        }

        const marker = newsRefs.current[evt.id]
        if (marker) {
          marker.classList.toggle('is-visible', visible)
          if (visible) {
            marker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
          }
        }
        newsItems.push({ evt, x, y, visible })
      })

      // Build a map of which markers currently sit close together on screen,
      // so a click can cycle through all of them via prev/next. Groups are
      // connected components (not per-item neighborhoods) so every member
      // of a cluster agrees on the same membership and order.
      if (clusterMapRef) {
        const map = {}
        const visibleItems = newsItems.filter((i) => i.visible)
        const visited = new Set()
        visibleItems.forEach((seed) => {
          if (visited.has(seed.evt.id)) return
          const group = []
          const queue = [seed]
          visited.add(seed.evt.id)
          while (queue.length) {
            const a = queue.pop()
            group.push(a)
            visibleItems.forEach((b) => {
              if (visited.has(b.evt.id)) return
              if (Math.hypot(a.x - b.x, a.y - b.y) < 18) {
                visited.add(b.evt.id)
                queue.push(b)
              }
            })
          }
          const ids = group
            .slice()
            .sort((m, n) => n.evt.level - m.evt.level || n.evt.score - m.evt.score)
            .map((b) => b.evt.id)
          group.forEach((b) => {
            map[b.evt.id] = ids
          })
        })
        clusterMapRef.current = map
      }

      const sel = hoveredNewsRef?.current
      const activeId = sel && sel.ids[sel.index]
      newsItems.forEach((i) => {
        const marker = newsRefs.current[i.evt.id]
        if (marker) marker.classList.toggle('is-active', i.evt.id === activeId)
      })

      if (newsPopupRef?.current) {
        const selId = sel && sel.ids[sel.index]
        const item = selId != null && newsItems.find((i) => i.evt.id === selId)
        if (item && item.visible) {
          newsPopupRef.current.classList.add('is-visible')
          newsPopupRef.current.style.transform = `translate(${item.x}px, ${item.y - 16}px) translate(-50%, -100%)`
          const locStr = item.evt.location || ''
          newsPopupRef.current.querySelector('.news-popup-location').textContent =
            lang === 'zh' ? translateLocation(locStr) : locStr
          newsPopupRef.current.querySelector('.news-popup-meta').textContent = timeAgo(item.evt.date, lang)
          const summaryEl = newsPopupRef.current.querySelector('.news-popup-summary')
          summaryEl.textContent = (lang === 'zh' ? item.evt.summaryZh || item.evt.summary : item.evt.summary) || ''

          // Merged sources section. Only rebuild the DOM when the selected
          // event or language actually changes — otherwise the every-frame
          // innerHTML reset would destroy the <a> elements mid-click, making
          // the links unclickable.
          const sourcesEl = newsPopupRef.current.querySelector('.news-popup-sources')
          if (sourcesEl) {
            const sources = item.evt.sources || []
            const renderKey = `${selId}|${lang}|${sources.length}`
            if (sourcesKeyRef.current !== renderKey) {
              sourcesKeyRef.current = renderKey
              sourcesEl.innerHTML = ''
              if (sources.length > 0) {
                const label = document.createElement('div')
                label.className = 'news-popup-sources-label'
                label.textContent = lang === 'zh' ? `类似来源 (${sources.length})` : `Similar (${sources.length})`
                sourcesEl.appendChild(label)
                sources.forEach((s) => {
                  const a = document.createElement('a')
                  a.href = s.url
                  a.target = '_blank'
                  a.rel = 'noopener noreferrer'
                  a.className = 'news-source-link'
                  a.title = s.url
                  a.textContent = (lang === 'zh' ? s.summaryZh || s.summary : s.summary) || s.url
                  sourcesEl.appendChild(a)
                })
                sourcesEl.classList.add('is-visible')
              } else {
                sourcesEl.classList.remove('is-visible')
              }
            }
          }
          newsPopupRef.current.querySelector('.news-popup-link').href = item.evt.url

          const nav = newsPopupRef.current.querySelector('.news-popup-nav')
          if (nav) {
            nav.classList.toggle('is-visible', sel.ids.length > 1)
            nav.querySelector('.news-popup-counter').textContent = `${sel.index + 1} / ${sel.ids.length}`
          }
        } else {
          newsPopupRef.current.classList.remove('is-visible')
          sourcesKeyRef.current = null
        }
      }
    }
  })

  return null
}

import { useState, useCallback } from 'react'
import { CITIES, DEFAULT_CITY_NAMES } from './cities'

export default function CitySelector({ selected, onChange, lang }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedSet = new Set(selected)

  const filtered = CITIES.filter((c) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      c.name.includes(query) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.tz.toLowerCase().includes(q)
    )
  })

  const toggle = useCallback(
    (name) => {
      const s = new Set(selected)
      if (s.has(name)) s.delete(name)
      else s.add(name)
      onChange([...s])
    },
    [selected, onChange],
  )

  const zh = lang === 'zh'

  return (
    <div className="city-selector-wrap">
      <button
        className={`city-selector-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={zh ? '选择城市时钟' : 'City clocks'}
      >
        🕐
      </button>

      {open && (
        <div className="city-selector-panel" onClick={(e) => e.stopPropagation()}>
          <div className="city-selector-header">
            <span>{zh ? '城市时钟' : 'City Clocks'}</span>
            <button className="city-selector-close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <div className="city-selector-presets">
            <button onClick={() => onChange([...DEFAULT_CITY_NAMES])}>
              {zh ? '主要城市' : 'Major'}
            </button>
            <button onClick={() => onChange(CITIES.map((c) => c.name))}>
              {zh ? '全部' : 'All'}
            </button>
            <button onClick={() => onChange([])}>
              {zh ? '清空' : 'Clear'}
            </button>
          </div>

          <input
            className="city-selector-search"
            placeholder={zh ? '搜索城市…' : 'Search…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="city-selector-list">
            {filtered.map((city) => {
              const active = selectedSet.has(city.name)
              return (
                <div
                  key={city.name}
                  className={`city-selector-item${active ? ' is-active' : ''}`}
                  onClick={() => toggle(city.name)}
                >
                  <span className="city-star">{active ? '★' : '☆'}</span>
                  <span className="city-selector-name">
                    {zh ? city.name : city.nameEn}
                  </span>
                  <span className="city-selector-tz">
                    UTC{getOffset(city.tz)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Returns a short UTC offset string like "+8" or "-5:30" for display.
function getOffset(tz) {
  try {
    const fmt = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    })
    const parts = fmt.formatToParts(new Date())
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    // "GMT+8" → "+8", "GMT-5" → "-5", "GMT+5:30" → "+5:30"
    return raw.replace('GMT', '') || ''
  } catch {
    return ''
  }
}

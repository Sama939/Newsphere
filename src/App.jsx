import { Suspense, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import { DateTime } from 'luxon'
import Earth from './Earth'
import { CITIES, DEFAULT_CITY_NAMES } from './cities'
import CitySelector from './CitySelector'
import NewsPanel from './NewsPanel'
import CookieConsent from './CookieConsent'
import PrivacyPolicy from './PrivacyPolicy'
import './App.css'

const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

const NEWS_ICONS = {
  statement: '🗣️',
  appeal: '🤝',
  'intent-cooperate': '🤝',
  consult: '💬',
  diplomacy: '🤝',
  cooperate: '🤝',
  aid: '🎁',
  yield: '🏳️',
  investigate: '🔍',
  demand: '📣',
  disapprove: '👎',
  reject: '❌',
  threaten: '⚠️',
  protest: '📢',
  'force-threat': '🛡️',
  'reduce-relations': '🔻',
  coerce: '⛔',
  assault: '💥',
  fight: '⚔️',
  'mass-violence': '🔥',
  other: '📰',
  // Soft-news topics from the DOC API
  sports: '⚽',
  entertainment: '🎬',
  tech: '💻',
}

const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const localPlace = localZone.split('/').pop().replace(/_/g, ' ')

// --- Site config -------------------------------------------------------------
// Sam: SUPPORT_URL — create a personal Buy Me a Coffee account at
//   https://buymeacoffee.com, then paste your handle below (replace
//   <your-handle>). A personal handle works across all your projects.
// FEEDBACK_EMAIL — set up a free catch-all forward for your domain (Cloudflare
//   Email Routing) so anything @newsphere.live lands in your Gmail.
const SUPPORT_URL = 'https://buymeacoffee.com/samlabs'
const FEEDBACK_EMAIL = 'support@newsphere.live'
// Where the front-end fetches news data. In dev (and local builds) it reads the
// bundled file; in production set VITE_NEWS_URL (e.g. the VPS data subdomain
// https://data.newsphere.live/news.json) as a Cloudflare Pages build variable.
const NEWS_URL = import.meta.env.VITE_NEWS_URL || '/data/news.json'

function App() {
  const [now, setNow] = useState(() => DateTime.now())
  const [lang, setLang] = useState('zh')
  const langRef = useRef('zh')
  langRef.current = lang
  const [showPrivacy, setShowPrivacy] = useState(false)

  const [selectedCities, setSelectedCities] = useState(() => {
    try {
      const saved = localStorage.getItem('gt-cities')
      return saved ? JSON.parse(saved) : [...DEFAULT_CITY_NAMES]
    } catch {
      return [...DEFAULT_CITY_NAMES]
    }
  })
  const handleCitiesChange = useCallback((next) => {
    setSelectedCities(next)
    try { localStorage.setItem('gt-cities', JSON.stringify(next)) } catch {}
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(DateTime.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const labelRefs = useRef({})
  const connectorRefs = useRef({})
  const pinRefs = useRef({})
  const tooltipRef = useRef(null)
  const hoveredRef = useRef(null)

  const [newsEvents, setNewsEvents] = useState([])
  const [timeFilter, setTimeFilter] = useState(null) // hours; null = all
  const [topic, setTopic] = useState('all') // 'all' | 'conflict' | 'sports' | 'entertainment' | 'tech'
  const [lastUpdated, setLastUpdated] = useState(null)
  const newsRefs = useRef({})
  const newsPopupRef = useRef(null)
  const hoveredNewsRef = useRef(null)
  const clusterMapRef = useRef({})
  const newsEtagRef = useRef(null)
  const focusRef = useRef(null)

  const filteredEvents = useMemo(() => {
    let list = newsEvents
    if (topic !== 'all') {
      // Treat events with no topic field (older data) as 'conflict'.
      list = list.filter((e) => (e.topic || 'conflict') === topic)
    }
    if (timeFilter) {
      const cutoff = Date.now() - timeFilter * 3600 * 1000
      list = list.filter((e) => e.date && new Date(e.date).getTime() >= cutoff)
    }
    return list
  }, [newsEvents, timeFilter, topic])

  const fetchNews = useCallback(async () => {
    try {
      const headers = {}
      if (newsEtagRef.current) headers['If-None-Match'] = newsEtagRef.current
      const res = await fetch(NEWS_URL, { headers, cache: 'no-store' })
      if (res.status === 304) return // not modified
      const etag = res.headers.get('etag')
      if (etag) newsEtagRef.current = etag
      const data = await res.json()
      setNewsEvents(data.events || [])
      setLastUpdated(new Date())
    } catch {
      // silently ignore network errors during background refresh
    }
  }, [])

  useEffect(() => {
    fetchNews()
    const FIFTEEN_MIN = 15 * 60 * 1000
    const timer = setInterval(fetchNews, FIFTEEN_MIN)
    return () => clearInterval(timer)
  }, [fetchNews])

  const handleNewsClick = (id) => () => {
    const cluster = clusterMapRef.current[id] || [id]
    const cur = hoveredNewsRef.current
    if (cur && cur.ids.join(',') === cluster.join(',')) {
      hoveredNewsRef.current = null
    } else {
      hoveredNewsRef.current = { ids: cluster, index: cluster.indexOf(id) }
    }
  }

  const handleNewsNav = (dir) => () => {
    const sel = hoveredNewsRef.current
    if (!sel) return
    const len = sel.ids.length
    sel.index = (sel.index + dir + len) % len
  }

  const handleEnter = (name) => () => {
    if (isTouch) return
    hoveredRef.current = name
  }
  const handleLeave = (name) => () => {
    if (isTouch) return
    if (hoveredRef.current === name) hoveredRef.current = null
  }
  const handleClick = (name) => () => {
    if (!isTouch) return
    hoveredRef.current = hoveredRef.current === name ? null : name
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1><span className="brand-emoji">🌍</span><span className="brand-name">Newsphere</span></h1>
        <p>
          {lang === 'zh'
            ? '实时世界新闻 · 拖动地球，点击光点查看'
            : 'The world’s news in real time · drag to explore'}
        </p>
        <button
          className="lang-btn"
          onClick={() => setLang((l) => l === 'zh' ? 'en' : 'zh')}
          aria-label="Switch language"
        >
          {lang === 'zh' ? 'EN' : '中'}
        </button>
      </header>

      <div className="globe-container">
        <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }}>
          <Suspense fallback={null}>
            <Earth
              labelRefs={labelRefs}
              connectorRefs={connectorRefs}
              pinRefs={pinRefs}
              tooltipRef={tooltipRef}
              hoveredRef={hoveredRef}
              newsEvents={filteredEvents}
              newsRefs={newsRefs}
              newsPopupRef={newsPopupRef}
              hoveredNewsRef={hoveredNewsRef}
              clusterMapRef={clusterMapRef}
              langRef={langRef}
              focusRef={focusRef}
            />
          </Suspense>
        </Canvas>
        <Loader />

        <NewsPanel
            events={filteredEvents}
            lang={lang}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            topic={topic}
            setTopic={setTopic}
            hoveredNewsRef={hoveredNewsRef}
            focusRef={focusRef}
          />
        <CitySelector selected={selectedCities} onChange={handleCitiesChange} lang={lang} />

        <div className="label-layer">
          {CITIES.filter((c) => selectedCities.includes(c.name)).map((city, index) => (
            <div key={city.name}>
              <div
                ref={(el) => (connectorRefs.current[city.name] = el)}
                className="city-connector"
              />
              <div
                ref={(el) => (pinRefs.current[city.name] = el)}
                className="city-pin"
                style={{ pointerEvents: 'auto' }}
                onMouseEnter={handleEnter(city.name)}
                onMouseLeave={handleLeave(city.name)}
                onClick={handleClick(city.name)}
              >
                <span className="pin-ping" style={{ animationDelay: `${(index / CITIES.length) * 2.4}s` }} />
                <span className="pin-core" />
              </div>
              <div
                ref={(el) => (labelRefs.current[city.name] = el)}
                className="city-label"
              >
                {lang === 'zh' ? city.name : (city.nameEn || city.name)}
              </div>
            </div>
          ))}
          <div ref={tooltipRef} className="city-tooltip">
            <div className="tooltip-inner">
              <div className="city-name tooltip-city-name" />
              <div className="city-time" />
              <div className="city-date" />
            </div>
          </div>

          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              ref={(el) => (newsRefs.current[evt.id] = el)}
              className={`news-marker level-${evt.level}${evt.topic && evt.topic !== 'conflict' ? ` topic-${evt.topic}` : ''}`}
              style={{ pointerEvents: 'auto' }}
              onClick={handleNewsClick(evt.id)}
            >
              <span className="news-marker-core">{NEWS_ICONS[evt.category] || NEWS_ICONS.other}</span>
            </div>
          ))}

          <div ref={newsPopupRef} className="news-popup">
            <div className="news-popup-inner">
              <button
                className="news-popup-close"
                onClick={() => (hoveredNewsRef.current = null)}
                aria-label="关闭"
              >
                ×
              </button>
              <div className="news-popup-location" />
              <div className="news-popup-meta" />
              <div className="news-popup-summary" />
              <div className="news-popup-sources" />
              <div className="news-popup-nav">
                <button className="news-popup-nav-btn" onClick={handleNewsNav(-1)} aria-label="上一条">‹</button>
                <span className="news-popup-counter" />
                <button className="news-popup-nav-btn" onClick={handleNewsNav(1)} aria-label="下一条">›</button>
              </div>
              <a className="news-popup-link" target="_blank" rel="noopener noreferrer">
                {lang === 'zh' ? '查看新闻 →' : 'Read more →'}
              </a>
            </div>
          </div>
        </div>
      </div>

      <footer className="local-panel">
        <div className="local-time">{now.toFormat('HH:mm:ss')}</div>
        <div className="local-place">
          {localPlace} · {now.toFormat(lang === 'zh' ? 'MM月dd日 EEE' : 'MMM d, EEE')}
        </div>
        <div className="news-update-row">
          {lastUpdated && (
            <span className="news-update-time">
              {lang === 'zh' ? '新闻更新：' : 'News: '}
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="news-refresh-btn" onClick={fetchNews} title={lang === 'zh' ? '立即刷新' : 'Refresh now'}>
            ↺
          </button>
        </div>
        <div className="footer-links">
          <a
            className="support-link"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            ☕ {lang === 'zh' ? '请我喝杯咖啡' : 'Support'}
          </a>
          <a
            className="footer-link-btn"
            href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Newsphere feedback')}`}
          >
            {lang === 'zh' ? '反馈' : 'Feedback'}
          </a>
          <button className="footer-link-btn" onClick={() => setShowPrivacy(true)}>
            {lang === 'zh' ? '隐私政策' : 'Privacy'}
          </button>
        </div>
      </footer>

      <CookieConsent lang={lang} onOpenPrivacy={() => setShowPrivacy(true)} />
      {showPrivacy && <PrivacyPolicy lang={lang} onClose={() => setShowPrivacy(false)} />}
    </div>
  )
}

export default App

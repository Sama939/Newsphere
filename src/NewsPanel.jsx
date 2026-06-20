import { useState, useMemo } from 'react'

const LEVEL_COLOR = { 1: '#3ddbd9', 2: '#f9c74f', 3: '#f77f00', 4: '#e63946' }
const TIME_OPTIONS = [1, 3, 6, 12, null] // hours; null = all

const TOPIC_OPTIONS = [
  { key: 'all',           zh: '全部', en: 'All',     icon: '🌐' },
  { key: 'conflict',      zh: '要闻', en: 'World',   icon: '🔥' },
  { key: 'sports',        zh: '体育', en: 'Sports',  icon: '⚽' },
  { key: 'entertainment', zh: '娱乐', en: 'Culture', icon: '🎬' },
  { key: 'tech',          zh: '科技', en: 'Tech',    icon: '💻' },
]

// For soft-news topics, colour the dot by topic rather than severity level.
const TOPIC_COLOR = { sports: '#4cc9f0', entertainment: '#c77dff', tech: '#80ed99' }

function timeAgo(isoDate, lang) {
  if (!isoDate) return ''
  const mins = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000)
  if (lang === 'en') {
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const h = Math.floor(mins / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

export default function NewsPanel({ events, lang, timeFilter, setTimeFilter, topic, setTopic, hoveredNewsRef, focusRef }) {
  // Start collapsed on small screens so the panel doesn't cover the globe.
  const [open, setOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth > 600,
  )
  const zh = lang === 'zh'

  const top5 = useMemo(() => {
    return [...events]
      .sort((a, b) => b.level - a.level || b.score - a.score)
      .slice(0, 5)
  }, [events])

  const dotColor = (evt) =>
    TOPIC_COLOR[evt.topic] || LEVEL_COLOR[evt.level] || '#888'

  const handleItemClick = (evt) => {
    const cur = hoveredNewsRef.current
    const isSame = cur && cur.ids[0] === evt.id && cur.ids.length === 1
    hoveredNewsRef.current = isSame ? null : { ids: [evt.id], index: 0 }
    // Rotate the globe to bring this event's region into view.
    if (!isSame && focusRef && evt.lat != null && evt.lng != null) {
      focusRef.current = { lat: evt.lat, lng: evt.lng }
    }
  }

  return (
    <div className="news-panel-wrap">
      <button
        className={`news-panel-toggle${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={zh ? '重大新闻' : 'Breaking news'}
      >
        🔥 <span>{zh ? '要闻' : 'Top'}</span>
        <span className="news-panel-toggle-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="news-panel">
          {/* Topic filter */}
          <div className="news-topic-filter">
            {TOPIC_OPTIONS.map((t) => (
              <button
                key={t.key}
                className={`news-topic-btn${topic === t.key ? ' is-active' : ''}`}
                onClick={() => setTopic(t.key)}
                title={zh ? t.zh : t.en}
              >
                <span className="news-topic-icon">{t.icon}</span>
                <span>{zh ? t.zh : t.en}</span>
              </button>
            ))}
          </div>

          {/* Time filter */}
          <div className="news-time-filter">
            {TIME_OPTIONS.map((h) => (
              <button
                key={String(h)}
                className={`news-time-btn${timeFilter === h ? ' is-active' : ''}`}
                onClick={() => setTimeFilter(h)}
              >
                {h === null ? (zh ? '全部' : 'All') : `${h}h`}
              </button>
            ))}
          </div>

          {/* Top 5 list */}
          <div className="news-panel-list">
            {top5.length === 0 ? (
              <div className="news-panel-empty">
                {zh ? '当前时段暂无新闻' : 'No events in this period'}
              </div>
            ) : (
              top5.map((evt) => (
                <div
                  key={evt.id}
                  className="news-panel-item"
                  onClick={() => handleItemClick(evt)}
                >
                  <span
                    className="news-panel-dot"
                    style={{ background: dotColor(evt) }}
                  />
                  <div className="news-panel-content">
                    <div className="news-panel-loc">
                      {evt.location || '—'}
                    </div>
                    <div className="news-panel-sum">
                      {(zh ? evt.summaryZh || evt.summary : evt.summary) || '—'}
                    </div>
                    <div className="news-panel-time">{timeAgo(evt.date, lang)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

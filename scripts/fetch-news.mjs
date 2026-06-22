import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { COUNTRY_CENTROIDS } from './countryCentroids.mjs'

// How many 15-minute GDELT export files to pull (96 = last 24 hours). A wide
// window so the day's major events surface; users narrow via the time filter.
const LOOKBACK_FILES = 96
const TOP_N = 50

// Per-country quota so the feed isn't monopolised by whichever country has the
// most English-language coverage (usually the US). Major countries get a
// higher cap (they genuinely generate more news); everyone else a smaller one,
// which lets smaller regions surface instead of being buried.
const MAJOR_COUNTRIES = new Set([
  'United States', 'China', 'Russia', 'United Kingdom', 'India', 'Israel',
  'Ukraine', 'Iran', 'Germany', 'France', 'Japan',
])
const MAJOR_COUNTRY_CAP = 6
const OTHER_COUNTRY_CAP = 3

// Soft/lifestyle news topics pulled from the GDELT DOC 2.0 full-text API,
// which (unlike the CAMEO Events dataset) covers sports / entertainment /
// tech. Each topic gets its own marker icon + colour on the globe.
// Query syntax: GDELT DOC operators — uppercase OR, quoted phrases,
// `sourcelang:english` restricts to English-language articles so the
// downstream translator (sl=en) behaves.
const TOPIC_QUERIES = {
  sports:        '("world cup" OR olympics OR "champions league" OR "premier league" OR "formula 1" OR nba) sourcelang:english',
  entertainment: '("box office" OR "new movie" OR "music album" OR "film festival" OR celebrity OR concert) sourcelang:english',
  tech:          '("artificial intelligence" OR smartphone OR "tech startup" OR semiconductor OR spacex OR "video game") sourcelang:english',
}
const TOPIC_MAX = 12 // max articles to keep per topic

// CAMEO event root codes that indicate higher-severity events, with a
// score multiplier. Anything not listed gets the default weight.
const ROOT_CODE_INFO = {
  '01': { category: 'statement', weight: 0.8 },
  '02': { category: 'appeal', weight: 0.9 },
  '03': { category: 'intent-cooperate', weight: 0.9 },
  '04': { category: 'consult', weight: 1.0 },
  '05': { category: 'diplomacy', weight: 1.0 },
  '06': { category: 'cooperate', weight: 1.0 },
  '07': { category: 'aid', weight: 1.0 },
  '08': { category: 'yield', weight: 1.1 },
  '09': { category: 'investigate', weight: 1.1 },
  '10': { category: 'demand', weight: 1.2 },
  '11': { category: 'disapprove', weight: 1.2 },
  '12': { category: 'reject', weight: 1.2 },
  '13': { category: 'threaten', weight: 1.6 },
  '14': { category: 'protest', weight: 1.4 },
  '15': { category: 'force-threat', weight: 1.8 },
  '16': { category: 'reduce-relations', weight: 1.5 },
  '17': { category: 'coerce', weight: 2.0 },
  '18': { category: 'assault', weight: 2.6 },
  '19': { category: 'fight', weight: 3.2 },
  '20': { category: 'mass-violence', weight: 4.0 },
}
const DEFAULT_CATEGORY = 'other'
const DEFAULT_WEIGHT = 1.0

// Used to give the fallback summary ("来源: host") more context when the
// URL itself has no readable title — e.g. "外交事件 · 来源: host".
const CATEGORY_LABELS_ZH = {
  statement: '声明',
  appeal: '呼吁',
  'intent-cooperate': '合作意向',
  consult: '会谈',
  diplomacy: '外交',
  cooperate: '合作',
  aid: '援助',
  yield: '让步',
  investigate: '调查',
  demand: '要求',
  disapprove: '谴责',
  reject: '拒绝',
  threaten: '威胁',
  protest: '抗议',
  'force-threat': '军事威胁',
  'reduce-relations': '关系降级',
  coerce: '强制行动',
  assault: '袭击',
  fight: '武装冲突',
  'mass-violence': '大规模暴力',
  other: '事件',
}

// English verb phrases used to construct actor-based synthetic summaries when
// a URL slug gives no useful title. Keeps the text translation-friendly.
const CATEGORY_VERBS_EN = {
  statement:            'makes a statement on',
  appeal:               'appeals to',
  'intent-cooperate':   'plans cooperation with',
  consult:              'consults with',
  diplomacy:            'holds diplomatic talks with',
  cooperate:            'cooperates with',
  aid:                  'provides aid to',
  yield:                'concedes to',
  investigate:          'investigates',
  demand:               'demands action from',
  disapprove:           'condemns',
  reject:               'rejects',
  threaten:             'threatens',
  protest:              'protests against',
  'force-threat':       'threatens military action against',
  'reduce-relations':   'reduces relations with',
  coerce:               'takes coercive action against',
  assault:              'attacks',
  fight:                'clashes with',
  'mass-violence':      'commits mass violence against',
  other:                'event involving',
}

function toTitleCase(s) {
  if (!s) return ''
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase())
}

// Small words that stay lowercase in a headline (unless first word).
const HEADLINE_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'in', 'on', 'at',
  'to', 'by', 'as', 'is', 'vs', 'with', 'from', 'over', 'into',
])
// Common acronyms that URL slugs split into single letters ("u-s" -> "u s").
const ACRONYM_FIXES = [
  [/\bu s a\b/gi, 'USA'],
  [/\bu s\b/gi, 'US'],
  [/\bu k\b/gi, 'UK'],
  [/\bu n\b/gi, 'UN'],
  [/\bu a e\b/gi, 'UAE'],
  [/\be u\b/gi, 'EU'],
]
// Acronyms that arrive as a single slug token ("us-iran" -> "us") and should
// be uppercased rather than title-cased ("Us" -> "US").
const SINGLE_ACRONYMS = new Set([
  'us', 'uk', 'un', 'eu', 'uae', 'usa', 'nato', 'ai', 'fbi', 'cia', 'nasa',
  'gdp', 'nhs', 'pm', 'ceo', 'gop', 'ev',
])

// Turn a slug-derived string ("israeli strikes in lebanon as u s talks stall")
// into a presentable headline ("Israeli Strikes in Lebanon as US Talks Stall").
function toHeadline(s) {
  if (!s) return ''
  let t = ` ${s.toLowerCase()} `
  for (const [re, rep] of ACRONYM_FIXES) t = t.replace(re, ` ${rep} `)
  t = t.replace(/\s+/g, ' ').trim()
  return t
    .split(' ')
    .map((w, i) => {
      if (/^[A-Z]{2,}$/.test(w)) return w // already a fixed acronym
      if (SINGLE_ACRONYMS.has(w)) return w.toUpperCase()
      if (i !== 0 && HEADLINE_STOPWORDS.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

// Build a plain-English synthetic summary from GDELT actor names + category.
// Returns '' if not enough info.
function actorSummary(actor1, actor2, category) {
  const a1 = toTitleCase(actor1 || '').trim()
  const a2 = toTitleCase(actor2 || '').trim()
  const verb = CATEGORY_VERBS_EN[category] || 'event involving'
  if (a1 && a2) return `${a1} ${verb} ${a2}`
  if (a1)       return `${a1} ${verb.replace(/ (to|from|against|with)$/, '')}`
  if (a2)       return `${toTitleCase(category)} involving ${a2}`
  return ''
}

// Tokens that are almost certainly an opaque id (hex hash / UUID chunk),
// not a real word: long, hex-only, and contains at least one digit.
function isIdToken(token) {
  return token.length >= 4 && /\d/.test(token) && /^[a-f0-9]+$/i.test(token)
}

// Generic CMS path prefixes that aren't part of the headline itself.
const FILLER_WORDS = new Set(['article', 'story', 'news', 'post', 'watch', 'video', 'gallery', 'live'])

function slugToWords(slug) {
  let tokens = slug
    .replace(/\.\w+$/, '')
    .replace(/[-_.]+/g, ' ')
    .split(' ')
    // Strip a long trailing digit run glued to a word, e.g. "technology20260615161701".
    .map((token) => token.replace(/[0-9]{6,}$/, ''))
    .filter((token) => token && !/^[0-9]+$/.test(token) && !isIdToken(token))

  // Drop a leading generic filler word ("article-...", "story-...") as long
  // as real words remain.
  if (tokens.length > 2 && FILLER_WORDS.has(tokens[0].toLowerCase())) {
    tokens = tokens.slice(1)
  }

  const words = tokens.join(' ').replace(/\s+/g, ' ').trim()
  if (!words || words.replace(/\s/g, '').length < 4) return ''
  // Need at least two real words to count as a title, not a single token.
  if (words.split(' ').length < 2) return ''
  // Format like a headline (Title Case, fixed acronyms) so the lowercase
  // slug doesn't read like a stray sentence.
  return toHeadline(words)
}

function urlToSummary(url, category) {
  try {
    const { pathname, hostname } = new URL(url)
    const segments = pathname.split('/').filter(Boolean)
    // Try the last path segment, then earlier ones, since some sites
    // put the readable title before a trailing numeric id.
    for (let i = segments.length - 1; i >= 0; i--) {
      const words = slugToWords(segments[i])
      if (words) return words
    }
    const label = CATEGORY_LABELS_ZH[category] || CATEGORY_LABELS_ZH.other
    return `${label} · 来源: ${hostname.replace(/^www\./, '')}`
  } catch {
    return ''
  }
}

// GDELT DATEADDED is YYYYMMDDHHMMSS in UTC.
// Manual overrides for GDELT location strings that are politically inaccurate.
const LOCATION_OVERRIDES = {
  'gaza, israel': 'Gaza, Palestine',
  'gaza strip, israel': 'Gaza, Palestine',
  'gaza strip': 'Gaza, Palestine',
  'west bank, israel': 'West Bank, Palestine',
  'west bank': 'West Bank, Palestine',
}

// Clean a single GDELT location string ("City, District, Country"):
// strip "(general)" suffix, trailing GDELT admin asterisks, and collapse
// duplicate segments within one location.
function cleanSingleLocation(loc) {
  if (!loc) return ''
  const override = LOCATION_OVERRIDES[loc.toLowerCase().trim()]
  if (override) return override
  const seen = new Set()
  const parts = []
  for (const raw of loc.split(',')) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const display = trimmed
      .replace(/\s*\(general\)\s*$/i, '') // "(general)" suffix
      .replace(/\*+$/, '')                // GDELT admin-level asterisk
      .trim()
    if (!display) continue
    const key = display.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(display)
  }
  const result = parts.join(', ')
  // Catch any Gaza/West Bank variant GDELT uses — regardless of exact format.
  const resultLow = result.toLowerCase()
  if (resultLow.includes('gaza')) return 'Gaza, Palestine'
  if (resultLow.includes('west bank')) return 'West Bank, Palestine'
  // Strip non-ASCII characters that render as ? on some devices.
  return result.replace(/[^\x00-\x7F一-鿿㐀-䶿]/g, '')
}

// Merge several distinct GDELT location strings into one display string.
// Two-pass approach:
//   1. Drop locations that are a geographic suffix of a more specific entry
//      (e.g. "Texas, United States" is dropped when
//       "Odessa, Texas, United States" is already present).
//   2. Among locations sharing the same last segment (country), keep only
//      the most specific (most comma-parts) to avoid near-duplicate entries
//      like "Odessa, Texas, US" and "West Odessa Fire Dept, Texas, US".
function mergeLocations(rawList) {
  const seen = new Set()
  const parts = []
  for (const raw of rawList) {
    const cleaned = cleanSingleLocation(raw)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(cleaned)
  }

  if (parts.length <= 1) return parts.join(' · ')

  // Pass 1 – suffix domination.
  const segs = parts.map((p) => p.toLowerCase().split(/,\s*/))
  const dominated = new Set()
  for (let i = 0; i < parts.length; i++) {
    if (dominated.has(i)) continue
    for (let j = 0; j < parts.length; j++) {
      if (i === j || dominated.has(j)) continue
      const a = segs[i], b = segs[j]
      if (b.length > a.length) {
        const offset = b.length - a.length
        if (a.every((seg, k) => seg === b[offset + k])) {
          dominated.add(i)
          break
        }
      }
    }
  }
  const filtered = parts.filter((_, i) => !dominated.has(i))

  // Pass 2 – same country → keep most specific.
  const byCountry = new Map()
  for (const p of filtered) {
    const s = p.split(/,\s*/)
    const country = s[s.length - 1].toLowerCase()
    const prev = byCountry.get(country)
    if (!prev || s.length > prev.split(/,\s*/).length) {
      byCountry.set(country, p)
    }
  }

  return [...byCountry.values()].join(' · ')
}

function gdeltDateToISO(dateAdded) {
  if (!dateAdded || dateAdded.length !== 14) return null
  const iso = `${dateAdded.slice(0, 4)}-${dateAdded.slice(4, 6)}-${dateAdded.slice(6, 8)}T${dateAdded.slice(8, 10)}:${dateAdded.slice(10, 12)}:${dateAdded.slice(12, 14)}Z`
  return iso
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  )
}

function getRecentTimestamps() {
  const lastUpdate = execSync('curl -sk https://data.gdeltproject.org/gdeltv2/lastupdate.txt').toString()
  const match = lastUpdate.match(/(\d{14})\.export\.CSV\.zip/)
  if (!match) throw new Error('Could not parse lastupdate.txt')

  const ts = match[1]
  const latest = new Date(Date.UTC(
    +ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8),
    +ts.slice(8, 10), +ts.slice(10, 12), +ts.slice(12, 14)
  ))

  const stamps = []
  for (let i = 0; i < LOOKBACK_FILES; i++) {
    stamps.push(formatTimestamp(new Date(latest.getTime() - i * 15 * 60 * 1000)))
  }
  return stamps
}

const IS_WINDOWS = process.platform === 'win32'
// Windows ships `python`; Linux/macOS (and the VPS) use `python3`.
const PY = IS_WINDOWS ? 'python' : 'python3'

function downloadAndExtract(stamp, workDir) {
  const url = `https://data.gdeltproject.org/gdeltv2/${stamp}.export.CSV.zip`
  const zipPath = path.join(workDir, `${stamp}.zip`)
  try {
    execSync(`curl -sk --fail -o "${zipPath}" "${url}"`)
    if (IS_WINDOWS) {
      execSync(`powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${workDir}'"`)
    } else {
      execSync(`unzip -o -qq "${zipPath}" -d "${workDir}"`)
    }
    const csvPath = path.join(workDir, `${stamp}.export.CSV`)
    if (!fs.existsSync(csvPath)) return null
    return csvPath
  } catch {
    return null // some 15-min slots may not exist yet, skip silently
  }
}

function bestSummary(url, actor1Raw, actor2Raw, category) {
  const fromSlug = urlToSummary(url, category)
  if (!fromSlug.includes('来源:')) return fromSlug  // readable slug title
  // URL gave no title — try constructing one from GDELT actor data.
  const synthetic = actorSummary(actor1Raw, actor2Raw, category)
  if (synthetic) return synthetic
  return fromSlug  // final fallback: "category · 来源: hostname"
}

function processRow(cols, buckets) {
  const isRoot = cols[25]
  const actor1Raw = cols[6]  // Actor1Name (UPPERCASE)
  const actor2Raw = cols[16] // Actor2Name (UPPERCASE) — col 15 is Actor2Code!
  const eventRootCode = cols[28]
  const numSources = Number(cols[32])
  const lat = Number(cols[56])
  const lng = Number(cols[57])
  const fullName = cols[52]
  const countryCode = cols[53]
  const dateAdded = cols[59]
  const url = cols[60]

  if (isRoot !== '1') return
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
  if (lat === 0 && lng === 0) return
  if (!Number.isFinite(numSources) || numSources <= 0) return
  if (!url) return

  const info = ROOT_CODE_INFO[eventRootCode]
  const category = info ? info.category : DEFAULT_CATEGORY
  const weight = info ? info.weight : DEFAULT_WEIGHT

  // Bucket nearby events of the same category together so repeated
  // reporting of one real-world event accumulates into one marker.
  const key = `${Math.round(lat * 2) / 2}|${Math.round(lng * 2) / 2}|${category}`

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = {
      lat, lng,
      location: cleanSingleLocation(fullName || countryCode || ''),
      category, score: 0, url, date: dateAdded,
      summary: bestSummary(url, actor1Raw, actor2Raw, category),
      actor1: actor1Raw, actor2: actor2Raw,
    }
    buckets.set(key, bucket)
  }
  bucket.score += numSources * weight
  if (!bucket.date || dateAdded > bucket.date) bucket.date = dateAdded
  if (numSources > (bucket.bestSources || 0)) {
    bucket.bestSources = numSources
    bucket.url = url
    bucket.actor1 = actor1Raw
    bucket.actor2 = actor2Raw
    bucket.summary = bestSummary(url, actor1Raw, actor2Raw, category)
    bucket.location = fullName ? cleanSingleLocation(fullName) : bucket.location
  }
}

// GDELT's CAMEO auto-coder frequently tags metaphorical conflict language
// ("the US fought with the UK to remove a tax") as literal fighting, giving a
// peaceful political/legal/economic story a war icon. When a violence-coded
// event's text clearly belongs to a non-violent domain AND contains no real
// markers of violence, demote it to a neutral "disapprove" category so it
// shows a dispute icon instead of crossed swords.
// Only the categories most often produced by METAPHORICAL conflict language
// ("the US fought with the UK over a tax", "lawmakers clash") are eligible for
// demotion. We deliberately leave GDELT's stronger codes — assault,
// force-threat, mass-violence — untouched: GDELT coded those from the full
// article (which we never see), so overriding them risks downplaying a real
// threat (e.g. an explosive at an airport whose slug headline never says so).
const DEMOTABLE_CATS = new Set(['fight', 'coerce'])
// Real markers of violence/threat — if present, keep the violent category.
// Checked first so e.g. "police opened fire, two killed" stays a fight.
const REAL_VIOLENCE = /\b(kill|killed|dead|death|casualt|troops?|soldiers?|militar|missile|airstrike|air ?strike|drone|bombing|bombed|\bbomb\b|explos|blast|detonat|shelling|gunmen|gunfire|opened fire|exchanged fire|massacre|wounded|injured|militant|insurgent|offensive|invasion|raid|warplane|rocket|artillery|hostage|hijack|siege|evacuat|terror|stabb|shooting)\b/i
// Political / legal / economic disputes — show contention (👎), not war.
const DISPUTE_HINTS = /\b(tax|taxes|tariff|trade|lawmaker|senate|congress|parliament|court|lawsuit|ruling|bill|legislation|regulation|election|vote|ballot|budget|economy|economic|policy|patent|copyright|antitrust|subsidy|sanction|talks?|summit|treaty|hearing|envoy|diplomat)\b/i
// Travel / infrastructure / weather / accidents / civic life — neutral news (📰).
const NEUTRAL_HINTS = /\b(airport|airline|flight|passenger|travel|transport|train|railway|road|traffic|highway|weather|storm|flood|rain|snow|heatwave|wildfire|blaze|fire|inferno|earthquake|hurricane|tornado|festival|concert|championship|tournament|match|hospital|health|disease|outbreak|vaccine|school|university|company|earnings|recall|power|outage)\b/i

// Returns { category, demoted } — demoted=true when a miscoded violence
// category was softened, so the caller can also cap its severity level.
function refineCategory(category, summary) {
  if (!DEMOTABLE_CATS.has(category) || !summary) return { category, demoted: false }
  if (REAL_VIOLENCE.test(summary)) return { category, demoted: false }
  if (DISPUTE_HINTS.test(summary)) return { category: 'disapprove', demoted: true }
  if (NEUTRAL_HINTS.test(summary)) return { category: 'other', demoted: true }
  return { category, demoted: false }
}

// Classify by percentile rank so all 4 levels always appear regardless
// of absolute score values in the current batch.
// rank = 0-indexed position in score-descending array (0 = highest score).
function classifyLevel(rank, total) {
  const p = rank / total
  if (p < 0.12) return 4 // top 12 % — critical
  if (p < 0.35) return 3 // next 23 % — serious
  if (p < 0.65) return 2 // next 30 % — moderate
  return 1               // bottom 35 % — minor
}

// GDELT DOC seendate is "YYYYMMDDTHHMMSSZ".
function docDateToISO(d) {
  if (!d || d.length < 15) return new Date().toISOString()
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`
}

// Strip a trailing " | Site Name" / " - Site Name" suffix from a headline.
function cleanHeadline(title) {
  return title
    .trim()
    .replace(/\s*[|\-–—]\s*[^|\-–—]{1,40}$/, '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .slice(0, 140)
    .trim()
}

// Fetch soft-news topics from the GDELT DOC 2.0 API and turn each article
// into a globe event placed at its source country's centroid (with a small
// random jitter so multiple articles from one country don't fully overlap).
function sleepSync(ms) {
  // GDELT DOC API rate-limits rapid queries; block briefly between calls.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// Load topic events from the previously generated news.json so that, when a
// DOC query is rate-limited this run, we can keep showing the last good
// articles for that topic instead of wiping it to empty.
function loadPreviousTopicEvents() {
  const byTopic = {}
  try {
    const prevPath = path.join(process.cwd(), 'public', 'data', 'news.json')
    const prev = JSON.parse(fs.readFileSync(prevPath, 'utf-8'))
    const maxAge = 6 * 3600 * 1000 // ignore stale (>6h) cached topic items
    for (const e of prev.events || []) {
      if (!e.topic || e.topic === 'conflict') continue
      if (e.date && Date.now() - new Date(e.date).getTime() > maxAge) continue
      ;(byTopic[e.topic] = byTopic[e.topic] || []).push(e)
    }
  } catch { /* no previous file — fine */ }
  return byTopic
}

function fetchTopicNews() {
  const events = []
  const previous = loadPreviousTopicEvents()
  let first = true
  for (const [topic, query] of Object.entries(TOPIC_QUERIES)) {
    if (!first) sleepSync(10000) // ~10s between queries to avoid rate limit
    first = false
    const url =
      'https://api.gdeltproject.org/api/v2/doc/doc?' +
      `query=${encodeURIComponent(query)}` +
      '&mode=ArtList&format=json&timespan=24h&sort=hybridrel' +
      `&maxrecords=${TOPIC_MAX * 3}`
    let articles = []
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const raw = execSync(`curl -sk --max-time 20 "${url}"`, {
          encoding: 'utf-8',
          timeout: 25_000,
        })
        // GDELT returns a plain-text "Please limit your queries..." message
        // (not JSON) when rate-limited; back off and retry.
        if (!raw.trimStart().startsWith('{')) {
          if (attempt < 2) { sleepSync(15000); continue }
          console.warn(`DOC topic "${topic}" rate-limited, skipping`)
          break
        }
        articles = (JSON.parse(raw).articles) || []
        break
      } catch (err) {
        if (attempt < 2) { sleepSync(15000); continue }
        console.warn(`DOC topic "${topic}" fetch failed:`, err.message)
      }
    }

    const seenTitles = new Set()
    let kept = 0
    for (const a of articles) {
      if (kept >= TOPIC_MAX) break
      const centroid = COUNTRY_CENTROIDS[a.sourcecountry]
      if (!centroid) continue // can't place without coordinates
      const title = cleanHeadline(a.title || '')
      if (title.length < 8) continue
      const titleKey = title.toLowerCase().slice(0, 40)
      if (seenTitles.has(titleKey)) continue
      seenTitles.add(titleKey)

      // Place exactly at the country's land centroid. We deliberately do NOT
      // add geographic jitter: the DOC API gives no per-article coordinates,
      // and jitter (a few degrees ≈ hundreds of km) easily pushes markers off
      // an island nation into open sea. Instead the front-end's screen-space
      // collision nudge fans same-point markers apart tightly around the
      // projected centroid, keeping them over land.
      events.push({
        lat: centroid[0],
        lng: centroid[1],
        location: a.sourcecountry,
        category: topic,
        topic,
        level: 2, // fixed visibility tier; soft news has no severity ranking
        score: 0,
        url: a.url,
        summary: title,
        date: docDateToISO(a.seendate),
      })
      kept++
    }

    // Rate-limited / empty this run — fall back to last run's articles so the
    // topic doesn't blink out. Strip stale ids; they get re-assigned later.
    if (kept === 0 && previous[topic]?.length) {
      for (const e of previous[topic]) {
        const { id, sources, summaryZh, ...rest } = e
        events.push(rest)
      }
      console.log(`DOC topic "${topic}": 0 new, reused ${previous[topic].length} from previous`)
    } else {
      console.log(`DOC topic "${topic}": ${kept} articles`)
    }
  }
  return events
}

function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdelt-'))
  const buckets = new Map()
  const stamps = getRecentTimestamps()

  let filesProcessed = 0
  for (const stamp of stamps) {
    const csvPath = downloadAndExtract(stamp, workDir)
    if (!csvPath) continue
    filesProcessed++

    const content = fs.readFileSync(csvPath, 'utf-8')
    for (const line of content.split('\n')) {
      if (!line) continue
      const cols = line.split('\t')
      if (cols.length < 61) continue
      processRow(cols, buckets)
    }
  }

  fs.rmSync(workDir, { recursive: true, force: true })

  // Multiple buckets (different locations) can point at the same underlying
  // article. Keep only the highest-scoring bucket per article so the same
  // story doesn't appear twice in one cluster's left/right navigation,
  // merging all of that article's locations into one cleaned-up list.
  const sorted = [...buckets.values()].sort((a, b) => b.score - a.score)
  const locationsByUrl = new Map()
  for (const b of sorted) {
    const list = locationsByUrl.get(b.url) || []
    if (b.location) list.push(b.location)
    locationsByUrl.set(b.url, list)
  }
  // Word-set similarity (Jaccard) between two summaries — catches
  // near-duplicate headlines from different outlets covering the same
  // story without needing semantic/LLM analysis.
  function wordSet(summary) {
    return new Set(summary.toLowerCase().split(/\s+/).filter((w) => w.length > 2))
  }
  function similarity(a, b) {
    let shared = 0
    for (const w of a) if (b.has(w)) shared++
    return shared / (a.size + b.size - shared)
  }

  const seenUrls = new Set()
  // Same wire story syndicated under different URLs often produces the
  // exact same (or near-identical) derived headline — dedupe those too,
  // keeping the highest-scoring instance.
  const keptSummaries = []
  const all = sorted.filter((b) => {
    if (seenUrls.has(b.url)) return false
    seenUrls.add(b.url)
    if (b.summary && !b.summary.includes('来源:')) {
      const words = wordSet(b.summary)
      if (keptSummaries.some((kept) => similarity(words, kept) >= 0.6)) return false
      keptSummaries.push(words)
    }
    const locations = locationsByUrl.get(b.url)
    if (locations && locations.length > 1) {
      b.location = mergeLocations(locations)
    }
    return true
  })
  // Apply the per-country quota. `all` is already sorted by score, so we keep
  // the highest-scoring events within each country's cap; the rest become
  // overflow used only to backfill if quotas leave us short of TOP_N.
  const countryOf = (loc) => (loc ? loc.split(/ · |,\s*/).pop().trim() : '')
  const countryCounts = new Map()
  const picked = []
  const overflow = []
  for (const b of all) {
    const country = countryOf(b.location)
    const cap = MAJOR_COUNTRIES.has(country) ? MAJOR_COUNTRY_CAP : OTHER_COUNTRY_CAP
    const n = countryCounts.get(country) || 0
    if (country && n >= cap) { overflow.push(b); continue }
    countryCounts.set(country, n + 1)
    picked.push(b)
  }
  const top = picked.slice(0, TOP_N)
  for (const b of overflow) {
    if (top.length >= TOP_N) break
    top.push(b)
  }

  const candidates = top.map((b, i) => ({
    id: i,
    lat: b.lat,
    lng: b.lng,
    location: b.location,
    category: b.category,
    topic: 'conflict',
    level: classifyLevel(i, top.length),
    score: Math.round(b.score * 10) / 10,
    url: b.url,
    summary: b.summary,
    date: gdeltDateToISO(b.date),
  }))

  // For events where URL slug gave no readable title, try fetching the
  // article's <title> / og:title from HTML (2-second timeout, best-effort).
  for (const c of candidates) {
    if (!c.summary.includes('来源:')) continue
    try {
      const html = execSync(
        `curl -sL --max-time 2 --user-agent "Mozilla/5.0" "${c.url}"`,
        { encoding: 'utf-8', timeout: 5_000 },
      )
      const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{4,120})["']/i)
      const title = og
        ? og[1]
        : (html.match(/<title[^>]*>([^<]{4,120})<\/title>/i) || [])[1]
      if (title) {
        const clean = title
          .trim()
          .replace(/\s*[|\-–]\s*.{1,40}$/, '') // strip " | Site Name" suffix
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&#039;/g, "'").replace(/&quot;/g, '"')
          .slice(0, 120)
        if (clean.length >= 6) c.summary = clean
      }
    } catch { /* skip silently */ }
  }

  // Pull soft-news topics (sports / entertainment / tech) from the DOC API
  // and append them. Re-assign sequential ids across the combined set.
  const topicEvents = fetchTopicNews()
  const combined = candidates.concat(topicEvents).map((e, i) => ({ ...e, id: i }))

  // Correct miscoded "violence" categories (metaphorical fight/clash language)
  // so policy/legal/economic/travel stories don't show a war icon — and cap
  // their severity so benign news can't pulse as critical red.
  for (const e of combined) {
    const { category, demoted } = refineCategory(e.category, e.summary)
    e.category = category
    if (demoted && e.level > 2) e.level = 2
  }

  // Semantic dedup via all-MiniLM-L6-v2 — removes near-duplicate headlines
  // from different outlets covering the same event.
  let events = combined
  const scriptPath = path.join(process.cwd(), 'scripts', 'dedup-semantic.py')
  if (fs.existsSync(scriptPath)) {
    try {
      const result = execSync(`${PY} "${scriptPath}"`, {
        input: JSON.stringify(combined),
        encoding: 'utf-8',
        timeout: 120_000,
      })
      const deduped = JSON.parse(result)
      // Re-assign sequential ids after dedup.
      events = deduped.map((e, i) => ({ ...e, id: i }))
      console.log(`Semantic dedup: ${combined.length} → ${events.length} events`)
    } catch (err) {
      console.warn('Semantic dedup skipped:', err.message)
    }
  }

  // Translate English summaries to Chinese via Helsinki opus-mt-en-zh.
  let translatedEvents = events
  const translateScript = path.join(process.cwd(), 'scripts', 'translate.py')
  if (fs.existsSync(translateScript)) {
    try {
      const result = execSync(`${PY} "${translateScript}"`, {
        input: JSON.stringify(events),
        encoding: 'utf-8',
        timeout: 180_000,
      })
      translatedEvents = JSON.parse(result)
      console.log(`Translation done: ${translatedEvents.filter(e => e.summaryZh).length} summaries translated`)
    } catch (err) {
      console.warn('Translation skipped:', err.message)
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    filesProcessed,
    events: translatedEvents,
  }

  const json = JSON.stringify(output, null, 2)

  // Always write the source copy under public/. Also write into dist/ when a
  // production build exists, so the served static bundle and the dev server
  // never show mismatched data.
  const targets = [path.join(process.cwd(), 'public', 'data')]
  const distData = path.join(process.cwd(), 'dist', 'data')
  if (fs.existsSync(path.join(process.cwd(), 'dist'))) targets.push(distData)

  const written = []
  for (const dir of targets) {
    fs.mkdirSync(dir, { recursive: true })
    const outPath = path.join(dir, 'news.json')
    fs.writeFileSync(outPath, json)
    written.push(outPath)
  }

  console.log(`Processed ${filesProcessed}/${stamps.length} files, ${buckets.size} buckets, wrote ${events.length} events to:`)
  for (const p of written) console.log(`  - ${p}`)
}

main()

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ns-cookie-consent'

// Reads the stored consent decision: 'accepted' | 'declined' | null.
export function getConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Bottom cookie-consent banner. Only shown until the user makes a choice.
 *
 * IMPORTANT for ads: do NOT load Google AdSense (or any tracking script)
 * until getConsent() === 'accepted'. This component just records the choice;
 * gate your ad <script> on it. `onChange(decision)` fires on each click so a
 * parent can react (e.g. inject/remove ad scripts).
 */
export default function CookieConsent({ lang, onChange, onOpenPrivacy }) {
  const [decided, setDecided] = useState(true)
  const zh = lang === 'zh'

  useEffect(() => {
    setDecided(getConsent() !== null)
  }, [])

  const choose = (decision) => {
    try { localStorage.setItem(STORAGE_KEY, decision) } catch {}
    setDecided(true)
    onChange?.(decision)
  }

  if (decided) return null

  return (
    <div className="cookie-banner" role="dialog" aria-label={zh ? 'Cookie 同意' : 'Cookie consent'}>
      <p className="cookie-banner-text">
        {zh
          ? '本站使用必要的本地存储来记住你的偏好。若你同意，我们也会启用广告相关 cookie 以支持网站运营。'
          : 'We use essential local storage to remember your preferences. With your consent we also enable advertising cookies to help fund the site.'}
        <button className="cookie-banner-more" onClick={onOpenPrivacy}>
          {zh ? '隐私政策' : 'Privacy Policy'}
        </button>
      </p>
      <div className="cookie-banner-actions">
        <button className="cookie-btn cookie-btn-decline" onClick={() => choose('declined')}>
          {zh ? '仅必要' : 'Essential only'}
        </button>
        <button className="cookie-btn cookie-btn-accept" onClick={() => choose('accepted')}>
          {zh ? '全部接受' : 'Accept all'}
        </button>
      </div>
    </div>
  )
}

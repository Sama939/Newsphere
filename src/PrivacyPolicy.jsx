// Privacy policy shown in a modal. Bilingual. This is a practical starting
// template — have a lawyer review before relying on it commercially, and
// fill in the support@newsphere.live / effective date placeholders.
export default function PrivacyPolicy({ lang, onClose }) {
  const zh = lang === 'zh'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={zh ? '关闭' : 'Close'}>×</button>
        <h2>{zh ? '隐私政策' : 'Privacy Policy'}</h2>
        <p className="modal-meta">{zh ? '最后更新：2026 年 6 月' : 'Last updated: June 2026'}</p>

        {zh ? (
          <div className="modal-body">
            <h3>1. 我们收集什么</h3>
            <p>Newsphere 不要求注册，也不收集你的姓名、邮箱等个人身份信息。我们仅在你的浏览器本地（localStorage）保存偏好设置，例如收藏的城市、语言选择和 Cookie 同意状态。这些数据不会离开你的设备。</p>
            <h3>2. 新闻数据来源</h3>
            <p>地图上的新闻事件来自公开的 <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer">GDELT Project</a> 开放数据，以及各新闻机构公开发布的标题。点击事件会跳转至原始新闻来源。</p>
            <h3>3. 广告与第三方 Cookie</h3>
            <p>若你选择"全部接受"，我们可能展示第三方广告（如 Google AdSense）。这些广告商可能使用 Cookie 以投放相关广告。你可以随时在底部重新选择"仅必要"来拒绝。若你选择"仅必要"，我们不会加载任何广告或跟踪脚本。</p>
            <h3>4. 你的权利</h3>
            <p>你可以随时清除浏览器存储以删除所有本地数据。我们不出售、不交易你的任何数据。</p>
            <h3>5. 联系方式</h3>
            <p>如有疑问，请联系：<a href="mailto:support@newsphere.live">support@newsphere.live</a></p>
          </div>
        ) : (
          <div className="modal-body">
            <h3>1. What we collect</h3>
            <p>Newsphere requires no account and collects no personally identifiable information such as your name or email. We store preferences (starred cities, language, cookie choice) only in your browser's localStorage. This data never leaves your device.</p>
            <h3>2. News data source</h3>
            <p>News events shown on the globe come from the public <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer">GDELT Project</a> open dataset and publicly published headlines. Clicking an event links to its original source.</p>
            <h3>3. Advertising &amp; third-party cookies</h3>
            <p>If you choose "Accept all", we may display third-party ads (e.g. Google AdSense). Those providers may use cookies to serve relevant ads. You can withdraw consent anytime by choosing "Essential only" at the bottom. With "Essential only" no ad or tracking scripts are loaded.</p>
            <h3>4. Your rights</h3>
            <p>You can clear your browser storage at any time to delete all local data. We never sell or trade your data.</p>
            <h3>5. Contact</h3>
            <p>Questions? Contact: <a href="mailto:support@newsphere.live">support@newsphere.live</a></p>
          </div>
        )}
      </div>
    </div>
  )
}

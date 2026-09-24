import { Share } from 'lucide-react'
import { isStandaloneDisplayMode } from '@/lib/pwa'

/** 设置页：iPad「添加到主屏幕」说明（standalone 下不显示）。 */
export function InstallStarDeskSection() {
  if (isStandaloneDisplayMode()) return null

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
        <Share className="h-4 w-4 text-accent" aria-hidden />
        安装 StarDesk（iPad / iPhone）
      </h2>
      <p className="mb-3 text-sm text-foreground-secondary">
        在 Safari 中可将 StarDesk 添加到主屏幕，像独立 App 一样打开。数据仍保存在当前浏览器 / Web App 的本地存储中，不会自动同步到 iCloud。
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground-secondary">
        <li>在 iPad Safari 中打开 StarDesk（需 HTTPS 或本机已信任的安全上下文）。</li>
        <li>点击 Safari 底部分享按钮。</li>
        <li>选择「添加到主屏幕」。</li>
        <li>从主屏幕图标启动 StarDesk。</li>
      </ol>
      <p className="mt-3 text-xs text-foreground-muted">
        删除 Web App、清除网站数据或系统清理存储可能导致本地数据丢失，请定期使用下方 JSON 导出备份。
      </p>
    </section>
  )
}

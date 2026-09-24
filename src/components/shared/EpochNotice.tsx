import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useEpoch } from '@/app/epoch-context'

/**
 * 数据被其他标签页完整替换后的提示。
 *
 * 行为：
 * - 首次发现时弹出阻断式弹窗，明确告知本页面显示的是旧数据、保存已被暂停；
 * - 用户可以「暂时关闭」弹窗，但会保留常驻横幅，写入仍被数据层拒绝；
 * - 页面内容不被卸载，用户尚未提交的输入留在原处，可自行复制后再重新加载。
 */
export function EpochNotice() {
  const { isStale } = useEpoch()
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStale) {
      setModalOpen(true)
      setDismissed(false)
    }
  }, [isStale])

  if (!isStale) return null

  return (
    <>
      {/* 常驻横幅 */}
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 border-b border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          数据已在其他标签页被完整替换，本页面的保存操作已暂停。请重新加载后再继续编辑。
        </span>
        <Button size="sm" variant="danger" onClick={() => window.location.reload()}>
          <RefreshCw className="h-3.5 w-3.5" />
          重新加载
        </Button>
      </div>

      {/* 阻断式说明弹窗 */}
      {modalOpen && !dismissed && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="epoch-notice-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-danger/40 bg-surface-raised p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <div>
                <h2 id="epoch-notice-title" className="text-base font-semibold text-foreground">
                  数据已被替换
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                  其他标签页执行了「完整替换恢复」，当前页面显示的是替换前的旧数据。
                  为避免覆盖新数据，本页面的保存操作已暂停，你输入的专注计时也已经停止。
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                  页面上尚未提交的内容仍然保留，可以先复制备份，然后重新加载查看恢复后的数据。
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDismissed(true)}>
                暂时关闭
              </Button>
              <Button variant="primary" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4" />
                重新加载页面
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

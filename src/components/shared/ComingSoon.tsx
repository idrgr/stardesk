import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

/** 未实现模块的诚实占位：明确标注尚未提供，不制造可用假象。 */
export function ComingSoon({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <EmptyState
        icon={Construction}
        title="该模块将在后续阶段实现"
        description={description}
      />
    </div>
  )
}

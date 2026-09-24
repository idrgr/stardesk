import type { ReactNode } from 'react'
import { getColor, getIcon } from '@/modules/registry'
import type { ModuleConfig } from '@/domain/entities'

export function DomainHeader({
  module,
  action,
}: {
  module: ModuleConfig
  action?: ReactNode
}) {
  const Icon = getIcon(module.iconKey)
  const color = getColor(module.colorKey)
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{module.name}</h1>
          {module.description && <p className="text-sm text-foreground-muted">{module.description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function DomainSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground-secondary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

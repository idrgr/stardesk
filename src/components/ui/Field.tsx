import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

/**
 * 带真实 label 的表单字段容器，支持错误提示与说明。
 *
 * 未显式传入 htmlFor 时自动生成 id 并绑定到单个表单控件子元素，
 * 保证每个输入框都有真实可访问的 label（而不是只有视觉上的文字）。
 * 自定义组合控件（如单选按钮组）不会被注入 id，由调用方自行处理。
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  const autoId = useId()
  const targetId = htmlFor ?? autoId

  let content = children
  if (
    htmlFor == null &&
    isValidElement(children) &&
    (children.type === Input || children.type === Textarea || children.type === Select)
  ) {
    const el = children as ReactElement<{ id?: string }>
    if (el.props.id == null) {
      content = cloneElement(el, { id: targetId })
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={targetId} className="text-xs font-medium text-foreground-secondary">
        {label}
      </label>
      {content}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL_CLASS =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted transition-colors duration-150 focus:border-accent focus:outline-none disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL_CLASS, className)} {...props} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL_CLASS, 'min-h-20 resize-y leading-relaxed', className)}
      {...props}
    />
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL_CLASS, 'appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
})

/** 自动生成 id 的字段组合，简化表单。 */
export function FieldId(props: { label: string; error?: string; hint?: string; className?: string; children: ReactNode }) {
  const id = useId()
  return (
    <Field label={props.label} htmlFor={id} error={props.error} hint={props.hint} className={props.className}>
      {props.children}
    </Field>
  )
}

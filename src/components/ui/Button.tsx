import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-foreground hover:brightness-110 active:brightness-95 shadow-[0_0_0_1px_rgba(93,228,245,0.15)]',
  secondary:
    'bg-surface-raised text-foreground border border-border hover:border-foreground-secondary/60',
  ghost:
    'text-foreground-secondary hover:bg-surface hover:text-foreground',
  danger:
    'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
  outline: 'border border-border text-foreground hover:bg-surface',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
  icon: 'h-9 w-9 p-0 justify-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = 'secondary', size = 'md', type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex select-none items-center justify-center rounded-lg font-medium transition-[background-color,color,border-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50',
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className,
        )}
        {...props}
      />
    )
  },
)

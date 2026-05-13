import { ReactNode } from 'react'
import { clsx } from 'clsx'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-900/40 text-green-400 border border-green-800',
  warning: 'bg-amber-900/40 text-amber-400 border border-amber-800',
  error: 'bg-red-900/40 text-red-400 border border-red-800',
  info: 'bg-blue-900/40 text-blue-400 border border-blue-800',
  default: 'bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

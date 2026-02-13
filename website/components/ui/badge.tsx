import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'primary' | 'outline'
  className?: string
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-success-light text-green-700',
  warning: 'bg-accent-light text-yellow-700',
  primary: 'bg-primary-light text-primary',
  outline: 'border border-gray-200 text-gray-600',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

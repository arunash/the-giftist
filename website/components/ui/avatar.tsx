'use client'

import { cn } from '@/lib/utils'

interface AvatarProps {
  name?: string | null
  image?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({ name, image, size = 'md', className }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  if (image) {
    return (
      <img
        src={image}
        alt={name || 'User'}
        className={cn(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  )
}

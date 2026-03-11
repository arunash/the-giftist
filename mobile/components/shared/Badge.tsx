import { View, Text } from 'react-native'
import { clsx } from 'clsx'

type Variant = 'primary' | 'success' | 'warning' | 'destructive' | 'info' | 'muted'

interface Props {
  label: string
  variant?: Variant
  small?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success-light',
  warning: 'bg-warning/10',
  destructive: 'bg-destructive/10',
  info: 'bg-info/10',
  muted: 'bg-surface-raised',
}

const textClasses: Record<Variant, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
  muted: 'text-muted',
}

export function Badge({ label, variant = 'primary', small }: Props) {
  return (
    <View
      className={clsx(
        'self-start rounded-full',
        variantClasses[variant],
        small ? 'px-2 py-0.5' : 'px-3 py-1'
      )}
    >
      <Text
        className={clsx(
          'font-sans-semibold',
          textClasses[variant],
          small ? 'text-[10px]' : 'text-xs'
        )}
      >
        {label}
      </Text>
    </View>
  )
}

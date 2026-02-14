import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function daysUntil(date: Date | string): number {
  const target = new Date(date)
  const now = new Date()
  const diffTime = target.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getProgressPercentage(funded: number, goal: number): number {
  if (!goal || goal === 0) return 0
  return Math.min(100, Math.round((funded / goal) * 100))
}

export function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10)
}

/** Build the standard Giftist share message with the owner's name. */
export function giftistShareText(ownerName: string): string {
  return `Hi! Your friend ${ownerName} is sharing their gift wishlist with you for their special moment! Checkout what they have in mind on the Giftist.`
}

/** Open native share sheet if available, fall back to clipboard copy. Returns true if shared/copied. */
export async function shareOrCopy(url: string, title?: string, text?: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ url, title, text })
      return true
    } catch (e: any) {
      // User cancelled the share sheet — not an error
      if (e?.name === 'AbortError') return false
    }
  }
  // Fallback: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url)
    return true
  }
  return false
}

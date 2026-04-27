// Site-wide urgency banner. Shows days until Mother's Day + last order date.
// Auto-hides after the holiday.
//
// Server component — re-evaluates on each ISR rebuild (hourly), so the day
// count stays fresh without client JS.

import Link from 'next/link'

const MOTHERS_DAY_2026 = new Date('2026-05-10T07:00:00Z') // 2nd Sunday of May, midnight PT
const ORDER_BY = new Date('2026-05-06T07:00:00Z')         // 4-day shipping buffer

export function CountdownStrip({ href }: { href?: string }) {
  const now = new Date()
  if (now >= MOTHERS_DAY_2026) return null

  const msPerDay = 1000 * 60 * 60 * 24
  const daysToMD = Math.max(0, Math.ceil((MOTHERS_DAY_2026.getTime() - now.getTime()) / msPerDay))
  const daysToOrder = Math.ceil((ORDER_BY.getTime() - now.getTime()) / msPerDay)

  const orderMessage = daysToOrder > 0
    ? `Order by May 6 to arrive in time`
    : daysToOrder >= -1
      ? `Last call — order today for express shipping`
      : `Last-minute? Send a digital gift card`

  const inner = (
    <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-[11px] sm:text-sm font-semibold text-center">
      <span className="text-base">🌸</span>
      <span>
        Mother&apos;s Day in <span className="tabular-nums">{daysToMD}</span> day{daysToMD === 1 ? '' : 's'}
      </span>
      <span className="opacity-70 hidden sm:inline">·</span>
      <span className="opacity-95 hidden sm:inline">{orderMessage}</span>
      {href && <span aria-hidden="true" className="opacity-90">→</span>}
    </div>
  )

  const className = 'bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white'

  if (href) {
    return (
      <Link href={href} className={`block ${className} hover:from-pink-600 hover:to-pink-700 transition`}>
        {inner}
      </Link>
    )
  }
  return <div className={className}>{inner}</div>
}

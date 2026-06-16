import { NextRequest, NextResponse } from 'next/server'
import { recordConversion } from '@/lib/affiliate-conversion'

/**
 * Pull-based Awin conversion ingestion. Awin (covers Etsy + Bookshop here) has
 * NO usable push postback for our setup, but it DOES expose a Publisher API.
 * We pull recent transactions and join each back to its originating click via
 * `clickRef` — the sub-id we stamped into the outbound link in lib/affiliate.ts.
 *
 * This makes Awin fully autonomous: no affiliate-dashboard configuration, just
 * one secret. The day AWIN_API_TOKEN is set, conversions start flowing into the
 * EPC dashboard on the cron schedule (and it backfills the last `days` on each
 * run, so status changes pending->approved are picked up automatically).
 *
 * Token: Awin UI -> Account -> API credentials -> create OAuth2 token (read).
 * Auth: Bearer CRON_SECRET (Vercel cron) like every other /api/cron route.
 *   ?days=N (default 30, max 31 — Awin's per-call window)
 */

const AWIN_PUBLISHER_ID = (process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID || '2774156').trim()
const AWIN_API_TOKEN = process.env.AWIN_API_TOKEN?.trim()

interface AwinTxn {
  id: number | string
  transactionDate?: string
  commissionStatus?: string            // pending | approved | declined | deleted
  clickRef?: string | null
  saleAmount?: { amount?: number | string; currency?: string }
  commissionAmount?: { amount?: number | string; currency?: string }
}

function isoDate(d: Date): string {
  // Awin wants YYYY-MM-DDTHH:mm:ss
  return d.toISOString().slice(0, 19)
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Not an error — the system is built and waiting on the one human-supplied
  // value. Report it clearly so the cron log shows exactly what's missing.
  if (!AWIN_API_TOKEN) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'AWIN_API_TOKEN not set. Generate it in Awin UI > Account > API credentials and add it to the Vercel env. Everything else is wired.',
    })
  }

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 31)
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)

  const url = `https://api.awin.com/publishers/${AWIN_PUBLISHER_ID}/transactions/` +
    `?startDate=${encodeURIComponent(isoDate(start))}` +
    `&endDate=${encodeURIComponent(isoDate(end))}` +
    `&timezone=UTC&dateType=transaction`

  let txns: AwinTxn[] = []
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AWIN_API_TOKEN}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json({ ok: false, configured: true, error: `Awin API ${res.status}`, detail: body.slice(0, 300) }, { status: 502 })
    }
    txns = await res.json()
    if (!Array.isArray(txns)) txns = []
  } catch (err: any) {
    return NextResponse.json({ ok: false, configured: true, error: 'fetch failed', detail: String(err?.message || err) }, { status: 502 })
  }

  let created = 0, updated = 0, skipped = 0
  for (const t of txns) {
    if (t.id == null) { skipped++; continue }
    const commission = Number(t.commissionAmount?.amount)
    const sale = Number(t.saleAmount?.amount)
    const r = await recordConversion({
      network: 'awin',
      orderId: String(t.id),
      clickId: t.clickRef || null,
      commission: Number.isFinite(commission) ? commission : 0,
      saleAmount: Number.isFinite(sale) ? sale : null,
      currency: t.commissionAmount?.currency || t.saleAmount?.currency || 'USD',
      status: t.commissionStatus,
      rawPayload: JSON.stringify(t),
    }).catch(() => ({ ok: false, created: false }))
    if (!r.ok) skipped++
    else if (r.created) created++
    else updated++
  }

  return NextResponse.json({ ok: true, configured: true, window: { days, start: isoDate(start), end: isoDate(end) }, fetched: txns.length, created, updated, skipped })
}

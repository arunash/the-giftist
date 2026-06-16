import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { recordConversion } from '@/lib/affiliate-conversion'
import { createHash } from 'crypto'

const ADMIN_USER_IDS = new Set(['cmliwct6c00009zxu0g7rns32'])

/**
 * Amazon Associates conversion import. Amazon has NO postback and NO earnings
 * API, so its commission can only enter EPC via a report upload. This is the
 * one network that cannot be fully autonomous — but it's a single paste.
 *
 * POST raw CSV text (Amazon "Earnings"/"Fee-Orders"/"Orders" report). We fuzzy-
 * match the columns we need:
 *   commission  <- "ad fees" | "commission" | "earnings"
 *   sale        <- "revenue" | "price"
 *   clickId     <- "sub tag" | "subtag" | "ascsubtag"   (our stamped ascsubtag!)
 *   orderId     <- explicit order/tracking id, else a stable hash of the row
 * Rows with a Sub Tag attribute back to the originating click; the rest land as
 * unattributed Amazon commission. Idempotent: re-uploading the same report
 * updates, never duplicates.
 */

// Minimal RFC-4180-ish CSV parser (handles quoted fields + embedded commas).
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(f => f.trim() !== '')) rows.push(row) }
  return rows
}

const num = (s: string | undefined) => {
  const n = Number(String(s ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const findCol = (headers: string[], ...needles: string[]) =>
  headers.findIndex(h => needles.some(n => h.toLowerCase().includes(n)))

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId || !ADMIN_USER_IDS.has(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const csv = await req.text()
  if (!csv.trim()) return NextResponse.json({ error: 'Empty body — paste the Amazon report CSV' }, { status: 400 })

  const rows = parseCsv(csv)
  if (rows.length < 2) return NextResponse.json({ error: 'No data rows found' }, { status: 400 })

  const headers = rows[0].map(h => h.trim())
  const ci = {
    commission: findCol(headers, 'ad fees', 'commission', 'earnings', 'fee'),
    sale: findCol(headers, 'revenue', 'price', 'sale'),
    subtag: findCol(headers, 'sub tag', 'subtag', 'ascsubtag', 'sub_tag'),
    order: findCol(headers, 'order id', 'orderid', 'tracking id', 'transaction'),
    asin: findCol(headers, 'asin'),
    date: findCol(headers, 'date'),
    status: findCol(headers, 'status'),
  }
  if (ci.commission < 0) {
    return NextResponse.json({ error: 'Could not find a commission/ad-fees column', detectedHeaders: headers }, { status: 422 })
  }

  let created = 0, updated = 0, attributed = 0, skipped = 0
  for (const r of rows.slice(1)) {
    const commission = num(r[ci.commission])
    if (commission === 0 && ci.sale >= 0 && num(r[ci.sale]) === 0) { skipped++; continue }
    const clickId = ci.subtag >= 0 ? (r[ci.subtag]?.trim() || null) : null
    if (clickId) attributed++

    // Stable id: explicit order id if present, else hash the row's identifying
    // fields so re-imports of the same report dedup instead of duplicating.
    const orderId = (ci.order >= 0 && r[ci.order]?.trim())
      ? r[ci.order].trim()
      : createHash('sha1').update([clickId, r[ci.asin], r[ci.date], r[ci.sale], r[ci.commission]].join('|')).digest('hex').slice(0, 16)

    const res = await recordConversion({
      network: 'amazon',
      orderId,
      clickId,
      commission,
      saleAmount: ci.sale >= 0 ? num(r[ci.sale]) : null,
      currency: 'USD',
      status: ci.status >= 0 ? r[ci.status] : 'approved', // earnings reports = realized fees
      rawPayload: JSON.stringify(Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
    }).catch(() => ({ ok: false, created: false }))
    if (!res.ok) skipped++
    else if (res.created) created++
    else updated++
  }

  return NextResponse.json({ ok: true, rows: rows.length - 1, created, updated, attributed, skipped })
}

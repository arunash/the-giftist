import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const ADMIN_EMAIL = 'arunash@norbea.ch'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get all errors from last 24 hours
    const errors = await prisma.errorLog.findMany({
      where: { createdAt: { gte: oneDayAgo } },
      orderBy: { createdAt: 'desc' },
    })

    if (errors.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'No errors in last 24h' })
    }

    // Group by source
    const bySource: Record<string, typeof errors> = {}
    for (const err of errors) {
      if (!bySource[err.source]) bySource[err.source] = []
      bySource[err.source].push(err)
    }

    // Group by unique message (dedup)
    const uniqueErrors: { source: string; message: string; count: number; latest: Date; stack?: string | null; metadata?: string | null }[] = []
    for (const [source, errs] of Object.entries(bySource)) {
      const msgMap = new Map<string, { count: number; latest: Date; stack?: string | null; metadata?: string | null }>()
      for (const err of errs) {
        // Normalize message for dedup (strip IDs and timestamps)
        const normalized = err.message.replace(/[a-z0-9]{20,}/gi, '[ID]').replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '[TIME]').slice(0, 200)
        const existing = msgMap.get(normalized)
        if (existing) {
          existing.count++
          if (err.createdAt > existing.latest) {
            existing.latest = err.createdAt
            existing.stack = err.stack
            existing.metadata = err.metadata
          }
        } else {
          msgMap.set(normalized, { count: 1, latest: err.createdAt, stack: err.stack, metadata: err.metadata })
        }
      }
      for (const [msg, data] of msgMap) {
        uniqueErrors.push({ source, message: msg, ...data })
      }
    }

    // Sort by count descending
    uniqueErrors.sort((a, b) => b.count - a.count)

    const dateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric' })

    // Build source summary
    const sourceSummary = Object.entries(bySource)
      .map(([source, errs]) => `<td style="padding:12px;background:#fff5f5;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:700;color:#e53e3e">${errs.length}</div><div style="font-size:11px;color:#666">${source}</div></td>`)
      .join('<td style="width:4px"></td>')

    // Build error details
    const errorRows = uniqueErrors.slice(0, 20).map(err => {
      const timeStr = err.latest.toLocaleString('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit', hour12: true })
      const countBadge = err.count > 1 ? `<span style="background:#e53e3e;color:white;padding:1px 6px;border-radius:4px;font-size:10px;margin-left:4px">×${err.count}</span>` : ''
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;vertical-align:top">
          <span style="background:#3B82F6;color:white;padding:2px 8px;border-radius:4px;font-size:11px">${err.source}</span>${countBadge}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#333;word-break:break-all">${escapeHtml(err.message.slice(0, 300))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#999;white-space:nowrap">${timeStr}</td>
      </tr>`
    }).join('')

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a">
  <div style="background:#e53e3e;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:18px">Giftist Error Digest</h1>
    <p style="margin:4px 0 0;color:#ffcaca;font-size:13px">${dateStr} — ${errors.length} errors in last 24h</p>
  </div>

  <div style="border:1px solid #e5e5e5;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px">

    <h2 style="font-size:14px;color:#666;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">By Source</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tr>${sourceSummary}</tr></table>

    <h2 style="font-size:14px;color:#666;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">Top Errors (deduped)</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <tr style="background:#f9f9f9">
        <th style="padding:6px 12px;text-align:left;font-size:11px;color:#666">Source</th>
        <th style="padding:6px 12px;text-align:left;font-size:11px;color:#666">Message</th>
        <th style="padding:6px 12px;text-align:left;font-size:11px;color:#666">Latest</th>
      </tr>
      ${errorRows}
    </table>

    <p style="font-size:11px;color:#bbb;text-align:center;margin:16px 0 0">
      <a href="https://giftist.ai/admin/errors" style="color:#3B82F6">View all errors →</a>
    </p>
  </div>
</div>`

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Giftist Errors: ${errors.length} in last 24h (${Object.keys(bySource).join(', ')})`,
      html,
    })

    return NextResponse.json({ success: true, errorCount: errors.length, sources: Object.keys(bySource) })
  } catch (error) {
    console.error('[Cron] Error digest failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

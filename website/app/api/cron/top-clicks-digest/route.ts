import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { emailWrapper } from '@/lib/notifications'

// Hourly email digest of the top 10 retailer clicks in the last hour.
// Each row links to the product name + retailer host + click count.

const RECIPIENT = 'arunash@norbea.ch'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 60 * 60 * 1000)

  type Row = { name: string; host: string; targetUrl: string; clicks: bigint }
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT pc."productName" AS name,
           lower(split_part(regexp_replace(pc."targetUrl", '^https?://(www\.)?', ''), '/', 1)) AS host,
           pc."targetUrl",
           COUNT(*) AS clicks
    FROM "ClickEvent" ce
    JOIN "ProductClick" pc ON ce.slug = pc.slug
    WHERE ce."createdAt" >= ${since}
      AND ce.event = 'RETAILER_CLICK'
    GROUP BY pc."productName", pc."targetUrl"
    ORDER BY clicks DESC
    LIMIT 10
  `

  const total = Number(rows.reduce((s, r) => s + Number(r.clicks), 0n))

  if (total === 0) {
    return NextResponse.json({ sent: false, reason: 'no clicks in last hour' })
  }

  const html = emailWrapper(`
    <p style="margin: 0 0 12px; font-size: 17px; font-weight: 600; color: #111;">
      Top ${rows.length} retailer clicks · last hour
    </p>
    <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">
      ${total} total real-user retailer clicks (bot-filtered) · sent hourly
    </p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <th style="text-align: left; padding: 6px 8px; color: #6b7280; font-weight: 600;">Product</th>
          <th style="text-align: left; padding: 6px 8px; color: #6b7280; font-weight: 600;">Retailer</th>
          <th style="text-align: right; padding: 6px 8px; color: #6b7280; font-weight: 600;">Clicks</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 8px; color: #111;">
              <a href="${r.targetUrl}" style="color: #7c3aed; text-decoration: none;">${r.name.slice(0, 70)}</a>
            </td>
            <td style="padding: 8px; color: #6b7280; font-size: 12px;">${r.host}</td>
            <td style="padding: 8px; text-align: right; font-weight: 600; color: #111;">${r.clicks}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `)

  await sendEmail({
    to: RECIPIENT,
    subject: `Giftist hourly: ${total} retailer clicks · top: ${rows[0].name.slice(0, 40)}`,
    html,
  })

  return NextResponse.json({
    sent: true,
    rows_returned: rows.length,
    total_clicks: total,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

// Daily admin digest: every gift action in the last 24h.
//   - New gifts purchased (sender → recipient → item)
//   - Gifts redeemed (method, shipping address or payout details)
//   - Older gifts that changed status
//
// Sent every morning to arunash@norbea.ch.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000)

  // Gifts CREATED in the last 24h
  const newGifts = await prisma.giftSend.findMany({
    where: { createdAt: { gte: since } },
    include: { sender: { select: { name: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Gifts REDEEMED in the last 24h (regardless of when created)
  const redeemedToday = await prisma.giftSend.findMany({
    where: { redeemedAt: { gte: since } },
    include: { sender: { select: { name: true } } },
    orderBy: { redeemedAt: 'desc' },
  })

  // Gifts STILL PENDING (paid but not redeemed, created >24h ago)
  const stillPending = await prisma.giftSend.findMany({
    where: {
      status: { in: ['PAID', 'NOTIFIED'] },
      redeemedAt: null,
      createdAt: { lt: since, gte: new Date(Date.now() - 7 * 86400 * 1000) },
    },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Totals
  const totalRevenue = newGifts.reduce((s, g) => s + (g.totalCharged || 0), 0)
  const totalShipped = redeemedToday.filter(g => g.redemptionMethod === 'SHIP').length
  const totalCashed = redeemedToday.filter(g => ['VENMO', 'PAYPAL', 'WALLET'].includes(g.redemptionMethod || '')).length

  // Render HTML
  function row(g: any, cols: string[]) {
    return `<tr>${cols.map(c => `<td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top;">${c}</td>`).join('')}</tr>`
  }
  function table(headers: string[], rows: string[]) {
    return `<table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <thead><tr style="background:#f9fafb;">${headers.map(h => `<th style="padding:8px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
  }

  const newGiftsRows = newGifts.map(g =>
    row(g, [
      `<strong>${g.sender?.name || 'Unknown'}</strong><br><span style="color:#999;font-size:11px;">${g.sender?.email || g.sender?.phone || ''}</span>`,
      `${g.recipientName || '—'}<br><span style="color:#999;font-size:11px;">${g.recipientPhone || ''}</span>`,
      `${g.itemName}<br><span style="color:#999;font-size:11px;">$${g.amount.toFixed(2)} · fee $${g.platformFee.toFixed(2)} · ship $${g.shippingFee.toFixed(2)}</span>`,
      `<strong>$${g.totalCharged.toFixed(2)}</strong><br><span style="color:#666;font-size:11px;">${g.status}</span>`,
      `${g.createdAt.toISOString().slice(11, 16)} UTC`,
    ])
  )

  const redemptionRows = redeemedToday.map(g => {
    let details = `<strong>${g.redemptionMethod}</strong>`
    if (g.redemptionMethod === 'SHIP') {
      details += `<br><span style="color:#666;font-size:11px;">${g.shippingName}<br>${g.shippingAddress}<br>${g.shippingCity}, ${g.shippingState} ${g.shippingZip}</span>`
    } else if (g.redemptionMethod === 'WALLET') {
      const walletAmt = g.amount + (g.shippingFee || 0)
      details += `<br><span style="color:#666;font-size:11px;">$${walletAmt.toFixed(2)} to wallet (incl. shipping refund)</span>`
    } else if (g.redemptionMethod === 'VENMO' || g.redemptionMethod === 'PAYPAL') {
      const payoutAmt = g.amount + (g.shippingFee || 0) - 0.25
      details += `<br><span style="color:#666;font-size:11px;">$${payoutAmt.toFixed(2)} sent</span>`
    } else if (g.redemptionMethod === 'ITEM_CLICK') {
      details += `<br><span style="color:#666;font-size:11px;">Redirected to retailer</span>`
    }
    return row(g, [
      `${g.recipientName || '—'}<br><span style="color:#999;font-size:11px;">from ${g.sender?.name || '?'}</span>`,
      g.itemName,
      details,
      `${g.redeemedAt!.toISOString().slice(11, 16)} UTC`,
    ])
  })

  const pendingRows = stillPending.map(g => {
    const daysAgo = Math.floor((Date.now() - g.createdAt.getTime()) / 86400000)
    return row(g, [
      `${g.recipientName || '—'}<br><span style="color:#999;font-size:11px;">from ${g.sender?.name || '?'}</span>`,
      g.itemName,
      `$${g.totalCharged.toFixed(2)}`,
      `<span style="color:#dc2626;">${daysAgo}d unredeemed</span>`,
    ])
  })

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:760px;margin:auto;padding:24px;">
      <h1 style="font-size:22px;margin:0 0 4px;">Giftist daily report</h1>
      <p style="color:#666;font-size:13px;margin:0 0 24px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>

      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;padding:12px 16px;background:#fef3c7;border-radius:8px;">
          <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">New gifts</div>
          <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${newGifts.length}</div>
          <div style="font-size:11px;color:#666;margin-top:2px;">$${totalRevenue.toFixed(2)} gross</div>
        </div>
        <div style="flex:1;min-width:120px;padding:12px 16px;background:#dbeafe;border-radius:8px;">
          <div style="font-size:11px;color:#1e40af;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Redeemed</div>
          <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${redeemedToday.length}</div>
          <div style="font-size:11px;color:#666;margin-top:2px;">${totalShipped} ship · ${totalCashed} cash</div>
        </div>
        <div style="flex:1;min-width:120px;padding:12px 16px;background:#fee2e2;border-radius:8px;">
          <div style="font-size:11px;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Unredeemed (≥1d)</div>
          <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${stillPending.length}</div>
        </div>
      </div>

      <h2 style="font-size:16px;margin:24px 0 8px;">📦 New gifts purchased (last 24h)</h2>
      ${newGifts.length > 0
        ? table(['Sender', 'Recipient', 'Item', 'Charged', 'Time'], newGiftsRows)
        : '<p style="color:#999;font-size:13px;">No new gifts purchased.</p>'}

      <h2 style="font-size:16px;margin:24px 0 8px;">🎉 Redemptions (last 24h)</h2>
      ${redeemedToday.length > 0
        ? table(['Recipient', 'Item', 'Method', 'Time'], redemptionRows)
        : '<p style="color:#999;font-size:13px;">No redemptions yet.</p>'}

      ${stillPending.length > 0 ? `
        <h2 style="font-size:16px;margin:24px 0 8px;">⏳ Stuck — paid but unredeemed (oldest 10)</h2>
        ${table(['Recipient', 'Item', 'Charged', 'Age'], pendingRows)}
      ` : ''}

      <p style="color:#999;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
        Sent daily at 09:00 UTC. Admin tools: <a href="https://giftist.ai/admin" style="color:#7c3aed;">/admin</a>
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: 'arunash@norbea.ch',
      subject: `Giftist daily: ${newGifts.length} new · ${redeemedToday.length} redeemed${totalRevenue > 0 ? ` · $${totalRevenue.toFixed(0)}` : ''}`,
      html,
    })
  } catch (e) {
    console.error('[daily-gift-report] email failed', e)
    return NextResponse.json({ error: 'Email failed' }, { status: 500 })
  }

  return NextResponse.json({
    sent: true,
    newGifts: newGifts.length,
    redemptions: redeemedToday.length,
    pending: stillPending.length,
    revenue: totalRevenue,
  })
}

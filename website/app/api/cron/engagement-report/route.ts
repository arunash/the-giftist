import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const ADMIN_EMAIL = 'arunash@gmail.com'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [
      // Last hour
      newUsersHour,
      newItemsHour,
      waMessagesHour,
      chatMessagesHour,
      contributionsHour,
      // Today totals
      newUsersToday,
      newItemsToday,
      waMessagesToday,
      chatMessagesToday,
      contributionsToday,
      // Overall
      totalUsers,
      totalItems,
      activeSubscriptions,
      // Recent signups (last hour)
      recentUsers,
      // Recent items (last hour)
      recentItems,
      // Recent WA conversations (last hour)
      recentWaMessages,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: oneHourAgo } } }),
      prisma.item.count({ where: { addedAt: { gte: oneHourAgo } } }),
      prisma.whatsAppMessage.count({ where: { createdAt: { gte: oneHourAgo } } }),
      prisma.chatMessage.count({ where: { createdAt: { gte: oneHourAgo } } }),
      prisma.contribution.count({ where: { createdAt: { gte: oneHourAgo }, status: 'COMPLETED' } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.item.count({ where: { addedAt: { gte: todayStart } } }),
      prisma.whatsAppMessage.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.chatMessage.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.contribution.count({ where: { createdAt: { gte: todayStart }, status: 'COMPLETED' } }),
      prisma.user.count(),
      prisma.item.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.user.findMany({
        where: { createdAt: { gte: oneHourAgo } },
        select: { name: true, phone: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.item.findMany({
        where: { addedAt: { gte: oneHourAgo } },
        select: { name: true, source: true, addedAt: true, user: { select: { name: true } } },
        orderBy: { addedAt: 'desc' },
        take: 20,
      }),
      prisma.whatsAppMessage.findMany({
        where: { createdAt: { gte: oneHourAgo }, status: 'PROCESSED' },
        select: { phone: true, content: true, type: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    // Skip sending if zero activity in the last hour
    const hourlyActivity = newUsersHour + newItemsHour + waMessagesHour + chatMessagesHour + contributionsHour
    if (hourlyActivity === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'No activity in the last hour' })
    }

    const timeStr = now.toLocaleString('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit', hour12: true })
    const dateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric' })

    // Build new signups section
    const signupsHtml = recentUsers.length > 0
      ? recentUsers.map(u => {
          const name = u.name || 'Anonymous'
          const contact = u.phone || u.email || '—'
          return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#666">${contact}</td></tr>`
        }).join('')
      : '<tr><td colspan="2" style="padding:6px 12px;color:#999">None</td></tr>'

    // Build recent items section
    const itemsHtml = recentItems.length > 0
      ? recentItems.map(i => {
          return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#666">${i.user.name || '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #eee"><span style="background:#${i.source === 'WHATSAPP' ? '25D366' : i.source === 'CHAT' ? '8B5CF6' : '3B82F6'};color:white;padding:2px 8px;border-radius:4px;font-size:11px">${i.source}</span></td></tr>`
        }).join('')
      : '<tr><td colspan="3" style="padding:6px 12px;color:#999">None</td></tr>'

    // Build WA conversations snippet
    const waHtml = recentWaMessages.length > 0
      ? recentWaMessages.slice(0, 10).map(m => {
          const masked = m.phone ? `***${m.phone.slice(-4)}` : '—'
          const snippet = m.content ? m.content.slice(0, 80) + (m.content.length > 80 ? '...' : '') : `[${m.type}]`
          return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px">${masked}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px">${snippet}</td></tr>`
        }).join('')
      : '<tr><td colspan="2" style="padding:6px 12px;color:#999">None</td></tr>'

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#000;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:18px">Giftist Engagement Report</h1>
    <p style="margin:4px 0 0;color:#aaa;font-size:13px">${dateStr} at ${timeStr} MT</p>
  </div>

  <div style="border:1px solid #e5e5e5;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px">

    <h2 style="font-size:14px;color:#666;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">Last Hour</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${newUsersHour}</div>
          <div style="font-size:11px;color:#666">New Users</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${newItemsHour}</div>
          <div style="font-size:11px;color:#666">Items</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${waMessagesHour}</div>
          <div style="font-size:11px;color:#666">WA Msgs</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${chatMessagesHour}</div>
          <div style="font-size:11px;color:#666">Web Chat</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${contributionsHour}</div>
          <div style="font-size:11px;color:#666">$$</div>
        </td>
      </tr>
    </table>

    <h2 style="font-size:14px;color:#666;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">Today</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td style="padding:12px;background:#f0f7ff;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${newUsersToday}</div>
          <div style="font-size:11px;color:#666">New Users</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f0f7ff;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${newItemsToday}</div>
          <div style="font-size:11px;color:#666">Items</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f0f7ff;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${waMessagesToday}</div>
          <div style="font-size:11px;color:#666">WA Msgs</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f0f7ff;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${chatMessagesToday}</div>
          <div style="font-size:11px;color:#666">Web Chat</div>
        </td>
        <td style="width:4px"></td>
        <td style="padding:12px;background:#f0f7ff;border-radius:8px;text-align:center;width:20%">
          <div style="font-size:24px;font-weight:700">${contributionsToday}</div>
          <div style="font-size:11px;color:#666">$$</div>
        </td>
      </tr>
    </table>

    <p style="font-size:12px;color:#999;margin-bottom:20px">Lifetime: ${totalUsers} users &middot; ${totalItems} items &middot; ${activeSubscriptions} Gold subs</p>

    ${recentUsers.length > 0 ? `
    <h2 style="font-size:14px;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">New Signups</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      ${signupsHtml}
    </table>` : ''}

    ${recentItems.length > 0 ? `
    <h2 style="font-size:14px;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Items Added</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      ${itemsHtml}
    </table>` : ''}

    ${recentWaMessages.length > 0 ? `
    <h2 style="font-size:14px;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">WhatsApp Activity</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      ${waHtml}
    </table>` : ''}

    <p style="font-size:11px;color:#bbb;text-align:center;margin:16px 0 0">Giftist Engagement Report &middot; Hourly</p>
  </div>
</div>`

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Giftist: ${newUsersHour} new users, ${newItemsHour} items, ${waMessagesHour + chatMessagesHour} messages (${timeStr})`,
      html,
    })

    return NextResponse.json({ success: true, hourlyActivity, sent: true })
  } catch (error) {
    console.error('[Cron] Engagement report failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { sendSmsReengagement, sendEmailReengagement } from '@/lib/whatsapp-funnel'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const channel = body.channel || 'all' // 'sms', 'email', or 'all'

    const results: Record<string, any> = {}

    if (channel === 'sms' || channel === 'all') {
      results.sms = await sendSmsReengagement()
    }
    if (channel === 'email' || channel === 'all') {
      results.email = await sendEmailReengagement()
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('[Admin] Reengagement failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

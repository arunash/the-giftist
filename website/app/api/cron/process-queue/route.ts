import { NextRequest, NextResponse } from 'next/server'
import { processMessageQueue } from '@/lib/whatsapp-funnel'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await processMessageQueue()
    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('[Cron] Process queue failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

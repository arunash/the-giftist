import { NextRequest, NextResponse } from 'next/server'
import { runGroupExtraction } from '@/lib/group-monitor'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runGroupExtraction()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Group extraction cron error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

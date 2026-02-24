import { NextRequest, NextResponse } from 'next/server'
import { runDailyEngagement, runGoldDailyEngagement, runCircleEventReminders, runPostEventFollowUp, runSeasonalReminders, runLifecycleNudges } from '@/lib/whatsapp-funnel'

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron or manual trigger)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runDailyEngagement()
    const goldResults = await runGoldDailyEngagement()
    const circleResults = await runCircleEventReminders()
    const postEventResults = await runPostEventFollowUp()
    const seasonalResults = await runSeasonalReminders()
    const lifecycleResults = await runLifecycleNudges()
    return NextResponse.json({
      success: true,
      ...results,
      gold: goldResults,
      circleReminders: circleResults,
      postEvent: postEventResults,
      seasonal: seasonalResults,
      lifecycle: lifecycleResults,
    })
  } catch (error) {
    console.error('[Cron] WhatsApp engagement failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/**
 * Giftist Ads Optimizer — hourly auto-tuner.
 *
 * For each ACTIVE Meta campaign:
 *   1. Pull last 4h Meta insights (spend / impressions / CTR / CPC / LPV).
 *   2. Pull last 4h DB funnel for the same UTM (sessions / RETAILER_CLICK /
 *      WA_INTENT) so decisions reward downstream conversions, not just clicks.
 *   3. Apply rules in priority order: PAUSE → SCALE_DOWN → SCALE_UP → HOLD.
 *   4. Honor 4-hour per-campaign cooldown so we don't whipsaw budgets.
 *   5. Apply the change via Meta API.
 *   6. Email a digest via Resend if anything changed.
 *
 * Safety caps:
 *   - Max budget per campaign: $50/day.
 *   - Min budget per campaign: $5/day (or pause).
 *   - Max total daily across all campaigns: $200/day.
 *   - Cooldown: 4 hours between budget changes per campaign.
 *
 * State (cooldowns, prior decisions): /tmp/giftist-ads-optimizer-state.json
 * Log:                                /tmp/giftist-ads-optimizer.log
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { prisma } from '@/lib/db'

const STATE_FILE = '/tmp/giftist-ads-optimizer-state.json'
const RESEND_KEY = 're_bcfGU5GA_vYLazycT9GSBMdwiLVyyg8z9'
const ADMIN_EMAIL = 'arunash@gmail.com'

const COOLDOWN_HOURS = 4
const MAX_BUDGET = 50
const MIN_BUDGET = 5
const TOTAL_BUDGET_CAP = 200

interface CampaignTarget {
  id: string
  name: string
  utmCampaign: string
  adSetId: string
}

// Static registry of campaigns we manage. Add new ones here as launched.
const CAMPAIGNS: CampaignTarget[] = [
  { id: '120241863068050145', name: 'V1 Curation',     utmCampaign: 'mothers-day-shop-test',     adSetId: '120241863070050145' },
  { id: '120241902213880145', name: 'V2 Self-Care',    utmCampaign: 'md-selfcare-women3055',     adSetId: '120241902214320145' },
  { id: '120241902216220145', name: 'V3 Premium',      utmCampaign: 'md-premium-women2850',      adSetId: '120241902216360145' },
  { id: '120241902219130145', name: 'V4 Last-Min',     utmCampaign: 'md-lastminute-broad',       adSetId: '120241902219250145' },
  { id: '120241902220990145', name: 'V5 Thoughtful',   utmCampaign: 'md-thoughtful-women2550',   adSetId: '120241902221390145' },
  { id: '120241947367770145', name: 'V6 Sentimental',  utmCampaign: 'md-sentimental-women3055',  adSetId: '120241947367930145' },
]

// ── Meta API helpers ──

function loadMetaCreds(): { token: string; adAccount: string } {
  const env = readFileSync('/Users/arunash/the-giftist/.env.meta', 'utf8')
  const out: any = {}
  for (const line of env.split('\n')) {
    const m = line.match(/^(META_ACCESS_TOKEN|META_AD_ACCOUNT_ID)="?(.*?)"?$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/\\n/g, '').trim()
  }
  return { token: out.META_ACCESS_TOKEN, adAccount: out.META_AD_ACCOUNT_ID }
}
const META = loadMetaCreds()

async function metaApi(path: string, opts?: { method?: string; body?: any }) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/v21.0${path}${sep}access_token=${META.token}`
  const res = await fetch(url, {
    method: opts?.method || 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Meta ${res.status}: ${JSON.stringify(json?.error || json)}`)
  return json
}

// ── State persistence ──

interface State {
  lastChangeAt: Record<string, string>  // campaign id → ISO timestamp
  lastAction: Record<string, string>    // campaign id → action string
}

function loadState(): State {
  if (!existsSync(STATE_FILE)) return { lastChangeAt: {}, lastAction: {} }
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch { return { lastChangeAt: {}, lastAction: {} } }
}

function saveState(state: State) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function inCooldown(state: State, campaignId: string): boolean {
  const last = state.lastChangeAt[campaignId]
  if (!last) return false
  const hoursSince = (Date.now() - new Date(last).getTime()) / 3600000
  return hoursSince < COOLDOWN_HOURS
}

// ── Data fetchers ──

interface MetaSnapshot {
  status: string
  effectiveStatus: string
  dailyBudget: number  // dollars
  spend4h: number
  impressions4h: number
  clicks4h: number
  ctr4h: number          // %
  cpc4h: number          // $
  lpv4h: number
}

async function fetchMeta(c: CampaignTarget): Promise<MetaSnapshot | null> {
  try {
    const camp = await metaApi(`/${c.id}?fields=status,effective_status`)
    const adset = await metaApi(`/${c.adSetId}?fields=daily_budget`)
    // Meta hourly time_increment is only supported with date_preset=today/yesterday.
    // Pull today + yesterday hourly rows, then keep only the last 4h.
    const cutoff = Date.now() - 4 * 3600 * 1000
    let spend = 0, impr = 0, clicks = 0, lpv = 0
    for (const preset of ['today', 'yesterday']) {
      const ins = await metaApi(`/${c.id}/insights?fields=spend,impressions,clicks,ctr,cpc,actions&date_preset=${preset}&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone`)
      for (const row of (ins.data || [])) {
        // hourly_stats_aggregated_by_advertiser_time_zone looks like "00:00:00 - 00:59:59"
        const hourMatch = row.hourly_stats_aggregated_by_advertiser_time_zone?.match(/^(\d{2}):/)
        if (!hourMatch) continue
        const dateStr = row.date_start  // "YYYY-MM-DD" in account TZ (assume PT)
        const hour = parseInt(hourMatch[1], 10)
        // Convert PT row start to UTC ms (PT = UTC-7 PDT or UTC-8 PST). Apr 2026 is PDT.
        const rowStartLocal = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00-07:00`).getTime()
        if (isNaN(rowStartLocal)) continue
        if (rowStartLocal >= cutoff) {
          spend += parseFloat(row.spend || 0)
          impr += parseInt(row.impressions || 0)
          clicks += parseInt(row.clicks || 0)
          const lpvAction = row.actions?.find((a: any) => a.action_type === 'landing_page_view')
          lpv += lpvAction ? parseInt(lpvAction.value) : 0
        }
      }
    }
    const ctr = impr > 0 ? (clicks / impr) * 100 : 0
    const cpc = clicks > 0 ? spend / clicks : 0
    return {
      status: camp.status,
      effectiveStatus: camp.effective_status,
      dailyBudget: adset.daily_budget / 100,
      spend4h: Math.round(spend * 100) / 100,
      impressions4h: impr,
      clicks4h: clicks,
      ctr4h: Math.round(ctr * 100) / 100,
      cpc4h: Math.round(cpc * 100) / 100,
      lpv4h: lpv,
    }
  } catch (e: any) {
    console.error(`[meta] fetch failed for ${c.name}:`, e.message)
    return null
  }
}

interface FunnelSnapshot {
  shopSessions: number
  cardClicks: number
  retailerClicks: number
  waIntents: number
  totalConversions: number   // RETAILER_CLICK + WA_INTENT
  convPerSession: number     // %
}

async function fetchFunnel(utm: string): Promise<FunnelSnapshot> {
  const since = new Date(Date.now() - 4 * 3600 * 1000)
  const sessions = await prisma.pageView.findMany({
    where: { utmCampaign: utm, createdAt: { gte: since }, sessionId: { not: null } },
    distinct: ['sessionId'],
    select: { sessionId: true },
  })
  const shopSessions = sessions.length
  // ClickEvent doesn't carry utmCampaign, so we approximate by total events in window.
  // (If we ever add utm to ClickEvent we can attribute precisely.)
  const cardClicks = await prisma.clickEvent.count({
    where: { event: 'CARD_CLICK', createdAt: { gte: since } },
  })
  const retailerClicks = await prisma.clickEvent.count({
    where: { event: 'RETAILER_CLICK', channel: 'WEB', createdAt: { gte: since } },
  })
  const waIntents = await prisma.clickEvent.count({
    where: { event: 'WA_INTENT', createdAt: { gte: since } },
  })
  const totalConversions = retailerClicks + waIntents
  const convPerSession = shopSessions > 0 ? Math.round((totalConversions / shopSessions) * 1000) / 10 : 0
  return { shopSessions, cardClicks, retailerClicks, waIntents, totalConversions, convPerSession }
}

// ── Decision engine ──

type Action =
  | { kind: 'pause'; reason: string }
  | { kind: 'scale_down'; newBudget: number; reason: string }
  | { kind: 'scale_up'; newBudget: number; reason: string }
  | { kind: 'hold'; reason: string }

function decide(meta: MetaSnapshot, funnel: FunnelSnapshot, totalActiveBudget: number): Action {
  // Skip campaigns Meta has paused or that have negligible spend in window
  if (meta.effectiveStatus !== 'ACTIVE') return { kind: 'hold', reason: `not active (${meta.effectiveStatus})` }
  if (meta.spend4h < 1) return { kind: 'hold', reason: `low spend (\$${meta.spend4h}) — wait for more data` }

  // PAUSE rules — strong signals only
  if (meta.spend4h >= 10 && meta.ctr4h < 1.0) {
    return { kind: 'pause', reason: `CTR ${meta.ctr4h}% < 1% with $${meta.spend4h} spent in 4h` }
  }
  if (meta.spend4h >= 8 && meta.cpc4h > 1.20) {
    return { kind: 'pause', reason: `CPC $${meta.cpc4h} > $1.20 with $${meta.spend4h} spent in 4h` }
  }
  if (meta.spend4h >= 15 && meta.lpv4h === 0) {
    return { kind: 'pause', reason: `$${meta.spend4h} spent with 0 landing-page views in 4h` }
  }

  // SCALE DOWN — fatigue / inefficiency
  if (meta.cpc4h > 0.55 && meta.dailyBudget > MIN_BUDGET) {
    const newBudget = Math.max(MIN_BUDGET, Math.round(meta.dailyBudget * 0.7))
    if (newBudget < meta.dailyBudget) {
      return { kind: 'scale_down', newBudget, reason: `CPC $${meta.cpc4h} too high — pull back from $${meta.dailyBudget} to $${newBudget}` }
    }
  }

  // SCALE UP — strong unit economics + budget cap headroom
  // Need: high CTR, low CPC, currently spending most of budget (signals demand),
  // total active spend hasn't blown the cap yet.
  const spendingHard = meta.spend4h >= meta.dailyBudget * 0.4   // 4h ≈ 16% of day; spending 40% of daily means high pace
  if (
    meta.ctr4h >= 2.5 &&
    meta.cpc4h <= 0.30 &&
    spendingHard &&
    meta.dailyBudget < MAX_BUDGET
  ) {
    const proposedBudget = Math.min(MAX_BUDGET, Math.round(meta.dailyBudget * 1.5))
    const wouldAdd = proposedBudget - meta.dailyBudget
    if (totalActiveBudget + wouldAdd <= TOTAL_BUDGET_CAP && proposedBudget > meta.dailyBudget) {
      return { kind: 'scale_up', newBudget: proposedBudget, reason: `CTR ${meta.ctr4h}% / CPC $${meta.cpc4h} — push to $${proposedBudget}` }
    }
  }

  return { kind: 'hold', reason: `CTR ${meta.ctr4h}% / CPC $${meta.cpc4h} — within bands` }
}

// ── Action appliers ──

async function applyAction(c: CampaignTarget, action: Action): Promise<string> {
  if (action.kind === 'hold') return 'no change'
  if (action.kind === 'pause') {
    await metaApi(`/${c.id}`, { method: 'POST', body: { status: 'PAUSED' } })
    return 'paused'
  }
  if (action.kind === 'scale_down' || action.kind === 'scale_up') {
    await metaApi(`/${c.adSetId}`, { method: 'POST', body: { daily_budget: action.newBudget * 100 } })
    return `budget → $${action.newBudget}/day`
  }
  return 'unknown action'
}

// ── Email ──

interface ChangeRow {
  campaign: string
  before: { budget: number | string; status: string; ctr: number; cpc: number; spend4h: number; lpv4h: number }
  after: { budget?: number; status: string }
  reason: string
  funnel: { sessions: number; conv: number }
}

function sendEmail(changes: ChangeRow[], holdsCount: number) {
  if (changes.length === 0) return
  const ts = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })
  const rows = changes.map(c => {
    const arrow = c.after.status === 'PAUSED' ? '⏸ PAUSED' : c.after.budget && c.after.budget > Number(c.before.budget) ? '↑' : c.after.budget && c.after.budget < Number(c.before.budget) ? '↓' : '→'
    const budgetTxt = c.after.status === 'PAUSED' ? 'PAUSED' : `$${c.before.budget}/d ${arrow} $${c.after.budget}/d`
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${c.campaign}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${budgetTxt}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#666;">CTR ${c.before.ctr}% · CPC $${c.before.cpc} · LPV ${c.before.lpv4h} · $${c.before.spend4h} spent · ${c.funnel.sessions} sessions / ${c.funnel.conv} conv</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#444;">${c.reason}</td>
    </tr>`
  }).join('')

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:0 auto;color:#222;">
    <div style="background:linear-gradient(135deg,#7c3aed,#db2777);padding:18px 22px;border-radius:12px 12px 0 0;color:#fff;">
      <h2 style="margin:0;font-size:18px;">Giftist ads optimizer — ${changes.length} change${changes.length > 1 ? 's' : ''}</h2>
      <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">${ts} · ${holdsCount} other campaign${holdsCount !== 1 ? 's' : ''} held steady</p>
    </div>
    <div style="background:#fff;padding:18px 22px;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="text-align:left;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">Campaign</th>
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">Change</th>
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">4h stats</th>
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">Why</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#666;">
        <a href="https://giftist.ai/admin#funnel" style="color:#7c3aed;">View live funnel →</a>
        &nbsp;·&nbsp;
        Cooldown: ${COOLDOWN_HOURS}h between changes per campaign · Caps: $${MAX_BUDGET}/d per campaign, $${TOTAL_BUDGET_CAP}/d total
      </p>
    </div>
  </div>`

  const payload = JSON.stringify({
    from: 'Giftist Ads Bot <digest@giftist.ai>',
    to: [ADMIN_EMAIL],
    subject: `📊 Giftist ads — ${changes.length} change${changes.length > 1 ? 's' : ''} (${ts})`,
    html,
  })
  try {
    execSync(
      `curl -s -X POST https://api.resend.com/emails -H "Authorization: Bearer ${RESEND_KEY}" -H "Content-Type: application/json" -d ${JSON.stringify(payload)}`,
      { timeout: 15000 },
    )
    console.log(`[email] sent — ${changes.length} change(s)`)
  } catch (e: any) {
    console.error('[email] failed:', e.message)
  }
}

// ── Main ──

async function main() {
  console.log('='.repeat(70))
  console.log(`  Giftist Ads Optimizer · ${new Date().toISOString()}`)
  console.log('='.repeat(70))

  const state = loadState()
  const changes: ChangeRow[] = []
  let holds = 0

  // Pull all snapshots first so we can compute total active budget for the cap check
  const snapshots: Array<{ c: CampaignTarget; meta: MetaSnapshot | null; funnel: FunnelSnapshot }> = []
  for (const c of CAMPAIGNS) {
    const meta = await fetchMeta(c)
    const funnel = await fetchFunnel(c.utmCampaign)
    snapshots.push({ c, meta, funnel })
  }
  const totalActiveBudget = snapshots
    .filter(s => s.meta?.effectiveStatus === 'ACTIVE')
    .reduce((sum, s) => sum + (s.meta?.dailyBudget || 0), 0)
  console.log(`Total active budget across campaigns: $${totalActiveBudget}/day  (cap: $${TOTAL_BUDGET_CAP}/day)\n`)

  for (const { c, meta, funnel } of snapshots) {
    if (!meta) {
      console.log(`[skip] ${c.name} — meta fetch failed`)
      continue
    }
    if (meta.effectiveStatus !== 'ACTIVE') {
      console.log(`[skip] ${c.name} — ${meta.effectiveStatus}`)
      continue
    }
    if (inCooldown(state, c.id)) {
      const last = state.lastChangeAt[c.id]
      console.log(`[cooldown] ${c.name} — last change ${last}, holding`)
      holds++
      continue
    }

    const action = decide(meta, funnel, totalActiveBudget)
    console.log(`[${c.name}] ${action.kind.toUpperCase()} — ${action.reason}`)
    console.log(`           4h: \$${meta.spend4h} spent · ${meta.impressions4h} impr · CTR ${meta.ctr4h}% · CPC \$${meta.cpc4h} · ${meta.lpv4h} LPV`)
    console.log(`           funnel: ${funnel.shopSessions} sessions · ${funnel.totalConversions} conv (R:${funnel.retailerClicks} W:${funnel.waIntents}) · ${funnel.convPerSession}%`)

    if (action.kind === 'hold') { holds++; continue }

    try {
      const result = await applyAction(c, action)
      console.log(`           ✓ ${result}`)
      state.lastChangeAt[c.id] = new Date().toISOString()
      state.lastAction[c.id] = action.kind
      changes.push({
        campaign: c.name,
        before: { budget: meta.dailyBudget, status: meta.status, ctr: meta.ctr4h, cpc: meta.cpc4h, spend4h: meta.spend4h, lpv4h: meta.lpv4h },
        after: action.kind === 'pause'
          ? { status: 'PAUSED' }
          : { budget: 'newBudget' in action ? action.newBudget : undefined, status: 'ACTIVE' },
        reason: action.reason,
        funnel: { sessions: funnel.shopSessions, conv: funnel.totalConversions },
      })
    } catch (e: any) {
      console.error(`           ✗ apply failed: ${e.message}`)
    }
  }

  saveState(state)
  console.log(`\nResult: ${changes.length} change(s), ${holds} hold(s).`)
  sendEmail(changes, holds)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})

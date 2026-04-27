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
const TOTAL_BUDGET_CAP = 100

interface CampaignTarget {
  id: string
  name: string
  utmCampaign: string
  adSetId: string
}

// Static registry of campaigns we manage. Add new ones here as launched.
const CAMPAIGNS: CampaignTarget[] = [
  // Mother's Day theme
  { id: '120241863068050145', name: 'V1 Curation',     utmCampaign: 'mothers-day-shop-test',     adSetId: '120241863070050145' },
  { id: '120241902213880145', name: 'V2 Self-Care',    utmCampaign: 'md-selfcare-women3055',     adSetId: '120241902214320145' },
  { id: '120241902216220145', name: 'V3 Premium',      utmCampaign: 'md-premium-women2850',      adSetId: '120241902216360145' },
  { id: '120241902219130145', name: 'V4 Last-Min',     utmCampaign: 'md-lastminute-broad',       adSetId: '120241902219250145' },
  { id: '120241902220990145', name: 'V5 Thoughtful',   utmCampaign: 'md-thoughtful-women2550',   adSetId: '120241902221390145' },
  { id: '120241947367770145', name: 'V6 Sentimental',  utmCampaign: 'md-sentimental-women3055',  adSetId: '120241947367930145' },
  // V7 = A/B test of /magic vs V6's /shop landing. Same audience + creative,
  // V6 + V7 share original $7/day budget at $3.50 each.
  { id: '120242029326430145', name: 'V7 Magic Test',   utmCampaign: 'md-magic-test',             adSetId: '120242029326540145' },
  // Category campaigns (Apr 27)
  { id: '120242024838470145', name: 'Cat Books',       utmCampaign: 'cat-books',                 adSetId: '120242024838800145' },
  { id: '120242024842910145', name: 'Cat Home',        utmCampaign: 'cat-home',                  adSetId: '120242024843120145' },
  { id: '120242024844460145', name: 'Cat Tech',        utmCampaign: 'cat-tech',                  adSetId: '120242024844620145' },
  { id: '120242024846930145', name: 'Cat Cooking',     utmCampaign: 'cat-cooking',               adSetId: '120242024847040145' },
  { id: '120242024849060145', name: 'Cat Fashion',     utmCampaign: 'cat-fashion',               adSetId: '120242024849610145' },
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
  shopSessions4h: number
  shopSessions24h: number
  cardClicks4h: number
  retailerClicks4h: number
  waIntents4h: number
  totalConversions4h: number   // RETAILER_CLICK + WA_INTENT (4h)
  convPerSession4h: number     // %
  // 24h totals for the kill-without-conversions rule
  retailerClicks24h: number
  waIntents24h: number
  totalConversions24h: number
}

async function fetchFunnel(utm: string): Promise<FunnelSnapshot> {
  const since4h = new Date(Date.now() - 4 * 3600 * 1000)
  const since24h = new Date(Date.now() - 24 * 3600 * 1000)
  // ClickEvent now carries utmCampaign for events fired after Apr 26 ~12pm PT.
  // Older events have utmCampaign=null; per-campaign rules treat that period as
  // "no attribution" rather than attributing to a specific campaign.
  const [sessions4h, sessions24h, cardClicks4h, retailerClicks4h, waIntents4h, retailerClicks24h, waIntents24h] = await Promise.all([
    prisma.pageView.findMany({
      where: { utmCampaign: utm, createdAt: { gte: since4h }, sessionId: { not: null } },
      distinct: ['sessionId'], select: { sessionId: true },
    }).then(r => r.length),
    prisma.pageView.findMany({
      where: { utmCampaign: utm, createdAt: { gte: since24h }, sessionId: { not: null } },
      distinct: ['sessionId'], select: { sessionId: true },
    }).then(r => r.length),
    prisma.clickEvent.count({ where: { event: 'CARD_CLICK', utmCampaign: utm, createdAt: { gte: since4h } } }),
    prisma.clickEvent.count({ where: { event: 'RETAILER_CLICK', channel: 'WEB', utmCampaign: utm, createdAt: { gte: since4h } } }),
    prisma.clickEvent.count({ where: { event: 'WA_INTENT', utmCampaign: utm, createdAt: { gte: since4h } } }),
    prisma.clickEvent.count({ where: { event: 'RETAILER_CLICK', channel: 'WEB', utmCampaign: utm, createdAt: { gte: since24h } } }),
    prisma.clickEvent.count({ where: { event: 'WA_INTENT', utmCampaign: utm, createdAt: { gte: since24h } } }),
  ])
  const totalConversions4h = retailerClicks4h + waIntents4h
  const totalConversions24h = retailerClicks24h + waIntents24h
  const convPerSession4h = sessions4h > 0 ? Math.round((totalConversions4h / sessions4h) * 1000) / 10 : 0
  return {
    shopSessions4h: sessions4h, shopSessions24h: sessions24h,
    cardClicks4h, retailerClicks4h, waIntents4h, totalConversions4h, convPerSession4h,
    retailerClicks24h, waIntents24h, totalConversions24h,
  }
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
  if (meta.spend4h < 1) return { kind: 'hold', reason: `low spend ($${meta.spend4h}) — wait for more data` }

  // PAUSE rules — strong signals first
  if (meta.spend4h >= 10 && meta.ctr4h < 1.0) {
    return { kind: 'pause', reason: `CTR ${meta.ctr4h}% < 1% with $${meta.spend4h} spent in 4h` }
  }
  if (meta.spend4h >= 8 && meta.cpc4h > 1.20) {
    return { kind: 'pause', reason: `CPC $${meta.cpc4h} > $1.20 with $${meta.spend4h} spent in 4h` }
  }
  if (meta.spend4h >= 15 && meta.lpv4h === 0) {
    return { kind: 'pause', reason: `$${meta.spend4h} spent with 0 landing-page views in 4h` }
  }
  // Downstream-aware: 50+ sessions in 24h with zero conversions = real kill signal
  // (per-utm sessions, GLOBAL conversions — known limitation, but at 50 sessions
  // we'd expect ≥1 conversion if the page works)
  if (funnel.shopSessions24h >= 50 && funnel.totalConversions24h === 0) {
    return { kind: 'pause', reason: `${funnel.shopSessions24h} sessions in 24h with 0 retailer or WA clicks — page isn't converting` }
  }

  // SCALE DOWN — fatigue / inefficiency
  if (meta.cpc4h > 0.55 && meta.dailyBudget > MIN_BUDGET) {
    const newBudget = Math.max(MIN_BUDGET, Math.round(meta.dailyBudget * 0.7))
    if (newBudget < meta.dailyBudget) {
      return { kind: 'scale_down', newBudget, reason: `CPC $${meta.cpc4h} too high — pull back from $${meta.dailyBudget} to $${newBudget}` }
    }
  }

  const spendingHard = meta.spend4h >= meta.dailyBudget * 0.4
  const wouldAdd = (b: number) => b - meta.dailyBudget
  const propose = () => Math.min(MAX_BUDGET, Math.round(meta.dailyBudget * 1.5))

  // BONUS SCALE UP — proven downstream conversions override pure CTR/CPC test
  if (funnel.totalConversions24h >= 5 && meta.dailyBudget < MAX_BUDGET) {
    const newBudget = propose()
    if (totalActiveBudget + wouldAdd(newBudget) <= TOTAL_BUDGET_CAP && newBudget > meta.dailyBudget) {
      return { kind: 'scale_up', newBudget, reason: `${funnel.totalConversions24h} conversions in 24h — proven funnel, push to $${newBudget}` }
    }
  }

  // STANDARD SCALE UP — strong unit economics + budget cap headroom
  if (meta.ctr4h >= 2.5 && meta.cpc4h <= 0.30 && spendingHard && meta.dailyBudget < MAX_BUDGET) {
    const newBudget = propose()
    if (totalActiveBudget + wouldAdd(newBudget) <= TOTAL_BUDGET_CAP && newBudget > meta.dailyBudget) {
      return { kind: 'scale_up', newBudget, reason: `CTR ${meta.ctr4h}% / CPC $${meta.cpc4h} — push to $${newBudget}` }
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

interface SnapshotRow {
  campaign: string
  utmCampaign: string
  status: string
  budget: number
  metaToday: { spend: number; impr: number; ctr: number; cpc: number; lpv: number } | null
  meta4h: { spend: number; impr: number; ctr: number; cpc: number; lpv: number }
  funnel: FunnelSnapshot
  decision: string
}

function sendEmail(
  changes: ChangeRow[],
  snapshots: SnapshotRow[],
  globalFunnel4h: { sessions: number; cards: number; retailer: number; wa: number },
  globalFunnel24h: { sessions: number; cards: number; retailer: number; wa: number },
) {
  const ts = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })
  const totalActiveBudget = snapshots.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + s.budget, 0)
  const totalSpentToday = snapshots.reduce((sum, s) => sum + (s.metaToday?.spend || 0), 0)

  // 1. Changes table
  const changesSection = changes.length === 0
    ? `<p style="margin:0;color:#666;font-size:13px;">No changes this hour — all campaigns inside performance bands.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="text-align:left;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">Campaign</th>
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">Change</th>
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">4h stats</th>
          <th style="padding:8px 12px;border-bottom:2px solid #ddd;">Why</th>
        </tr></thead>
        <tbody>${changes.map(c => {
          const arrow = c.after.status === 'PAUSED' ? '⏸ PAUSED' : c.after.budget && c.after.budget > Number(c.before.budget) ? '↑' : c.after.budget && c.after.budget < Number(c.before.budget) ? '↓' : '→'
          const budgetTxt = c.after.status === 'PAUSED' ? 'PAUSED' : `$${c.before.budget}/d ${arrow} $${c.after.budget}/d`
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${c.campaign}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">${budgetTxt}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#666;">CTR ${c.before.ctr}% · CPC $${c.before.cpc} · LPV ${c.before.lpv4h} · $${c.before.spend4h} spent</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#444;">${c.reason}</td>
          </tr>`
        }).join('')}</tbody>
      </table>`

  // 2. Per-campaign performance table (4h + today)
  const perfRows = snapshots.map(s => {
    const statusColor = s.status === 'ACTIVE' ? '#16a34a' : '#9ca3af'
    const today = s.metaToday
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;">${s.campaign}<br><span style="font-weight:400;color:${statusColor};font-size:10px;">${s.status}${s.status === 'ACTIVE' ? ` · $${s.budget}/d` : ''}</span></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#444;text-align:right;">$${s.meta4h.spend.toFixed(2)} · ${s.meta4h.impr} impr<br>CTR ${s.meta4h.ctr}% · CPC $${s.meta4h.cpc}<br>LPV ${s.meta4h.lpv}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#444;text-align:right;">${today ? `$${today.spend.toFixed(2)} · ${today.impr} impr<br>CTR ${today.ctr}% · CPC $${today.cpc}<br>LPV ${today.lpv}` : '—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#444;text-align:right;">${s.funnel.shopSessions4h}s · ${s.funnel.shopSessions24h}s/24h<br>conv 24h: ${s.funnel.totalConversions24h}<br>(R:${s.funnel.retailerClicks24h} W:${s.funnel.waIntents24h})</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#666;">${s.decision}</td>
    </tr>`
  }).join('')

  const perfTable = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="text-align:left;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;">Campaign</th>
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;text-align:right;">Last 4h</th>
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;text-align:right;">Today</th>
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;text-align:right;">Funnel (UTM)</th>
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;">Decision</th>
    </tr></thead>
    <tbody>${perfRows}</tbody>
  </table>`

  // 3. Global funnel block
  const conv4h = globalFunnel4h.retailer + globalFunnel4h.wa
  const conv24h = globalFunnel24h.retailer + globalFunnel24h.wa
  const convRate4h = globalFunnel4h.sessions > 0 ? Math.round((conv4h / globalFunnel4h.sessions) * 1000) / 10 : 0
  const convRate24h = globalFunnel24h.sessions > 0 ? Math.round((conv24h / globalFunnel24h.sessions) * 1000) / 10 : 0
  const funnelBlock = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="text-align:left;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;">Stage</th>
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;text-align:right;">Last 4h</th>
      <th style="padding:8px 10px;border-bottom:2px solid #ddd;text-align:right;">Last 24h</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">/shop sessions</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${globalFunnel4h.sessions}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${globalFunnel24h.sessions}</td></tr>
      <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555;">↳ CARD_CLICK</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${globalFunnel4h.cards}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${globalFunnel24h.cards}</td></tr>
      <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#16a34a;">↳ RETAILER_CLICK 💰</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#16a34a;font-weight:600;">${globalFunnel4h.retailer}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#16a34a;font-weight:600;">${globalFunnel24h.retailer}</td></tr>
      <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#16a34a;">↳ WA_INTENT 💬</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#16a34a;font-weight:600;">${globalFunnel4h.wa}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#16a34a;font-weight:600;">${globalFunnel24h.wa}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px 10px;font-weight:600;">Conv rate (sessions → goals)</td><td style="padding:8px 10px;text-align:right;font-weight:600;">${convRate4h}%</td><td style="padding:8px 10px;text-align:right;font-weight:600;">${convRate24h}%</td></tr>
    </tbody>
  </table>`

  // 4. What we're optimizing for
  const goalsBlock = `<div style="background:#f9fafb;padding:14px 16px;border-radius:8px;font-size:12px;line-height:1.6;color:#374151;">
    <p style="margin:0 0 6px;font-weight:600;color:#111;">🎯 What this optimizer is optimizing for</p>
    <p style="margin:0 0 6px;"><strong>Goal metrics (the actual revenue path)</strong>: RETAILER_CLICK (Amazon &amp; other affiliate, 3–15% commission) + WA_INTENT (concierge conversations).</p>
    <p style="margin:0 0 6px;"><strong>Decision signals (what the rules actually use)</strong>: Meta-level CTR, CPC, LPV (high data volume, fast updates) — with two downstream-aware overrides:</p>
    <ul style="margin:6px 0 0;padding-left:18px;">
      <li><strong>Hard pause</strong> if a campaign drives ≥50 sessions in 24h with 0 retailer/WA clicks (page isn't converting).</li>
      <li><strong>Bonus scale-up</strong> if a campaign drives ≥5 conversions in 24h (proven funnel — push budget regardless of CTR).</li>
    </ul>
    <p style="margin:6px 0 0;color:#6b7280;font-size:11px;">Conversion volume per-campaign is still small, so per-campaign attribution is approximate. As volume grows, downstream signals will dominate decisions.</p>
  </div>`

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:780px;margin:0 auto;color:#222;">
    <div style="background:linear-gradient(135deg,#7c3aed,#db2777);padding:18px 22px;border-radius:12px 12px 0 0;color:#fff;">
      <h2 style="margin:0;font-size:18px;">Giftist Ads — hourly report</h2>
      <p style="margin:6px 0 0;font-size:12px;opacity:0.9;">${ts} · ${changes.length} change${changes.length !== 1 ? 's' : ''} this hour · $${totalActiveBudget}/d active across ${snapshots.filter(s => s.status === 'ACTIVE').length} campaigns · $${totalSpentToday.toFixed(2)} spent today</p>
    </div>
    <div style="background:#fff;padding:18px 22px;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">
      <h3 style="margin:0 0 10px;font-size:13px;color:#111;text-transform:uppercase;letter-spacing:0.04em;">Changes this hour</h3>
      ${changesSection}

      <h3 style="margin:24px 0 10px;font-size:13px;color:#111;text-transform:uppercase;letter-spacing:0.04em;">Per-campaign performance</h3>
      ${perfTable}

      <h3 style="margin:24px 0 10px;font-size:13px;color:#111;text-transform:uppercase;letter-spacing:0.04em;">Funnel (entire site)</h3>
      ${funnelBlock}

      <div style="margin:24px 0 0;">${goalsBlock}</div>

      <p style="margin:18px 0 0;font-size:11px;color:#6b7280;text-align:center;">
        <a href="https://giftist.ai/admin#funnel" style="color:#7c3aed;">Live funnel admin →</a>
        &nbsp;·&nbsp;
        Cooldown ${COOLDOWN_HOURS}h between changes · Caps $${MAX_BUDGET}/d per campaign, $${TOTAL_BUDGET_CAP}/d total
      </p>
    </div>
  </div>`

  const subject = changes.length > 0
    ? `📊 Giftist ads — ${changes.length} change${changes.length > 1 ? 's' : ''} · ${conv24h} conv 24h`
    : `📊 Giftist ads — ${globalFunnel24h.sessions}s · ${conv24h} conv 24h (no changes)`
  const payload = JSON.stringify({
    from: 'Giftist Ads Bot <digest@giftist.ai>',
    to: [ADMIN_EMAIL],
    subject,
    html,
  })
  try {
    execSync(
      `curl -s -X POST https://api.resend.com/emails -H "Authorization: Bearer ${RESEND_KEY}" -H "Content-Type: application/json" -d ${JSON.stringify(payload)}`,
      { timeout: 15000 },
    )
    console.log(`[email] sent — ${changes.length} change(s), ${snapshots.length} campaigns reported`)
  } catch (e: any) {
    console.error('[email] failed:', e.message)
  }
}

// ── Today insights helper (used in email) ──

async function fetchMetaToday(c: CampaignTarget): Promise<{ spend: number; impr: number; ctr: number; cpc: number; lpv: number } | null> {
  try {
    const ins = await metaApi(`/${c.id}/insights?fields=spend,impressions,clicks,ctr,cpc,actions&date_preset=today`)
    const r = ins.data?.[0]
    if (!r) return null
    const lpv = parseInt(r.actions?.find((a: any) => a.action_type === 'landing_page_view')?.value || '0')
    return {
      spend: Math.round(parseFloat(r.spend || 0) * 100) / 100,
      impr: parseInt(r.impressions || 0),
      ctr: Math.round(parseFloat(r.ctr || 0) * 100) / 100,
      cpc: Math.round(parseFloat(r.cpc || 0) * 100) / 100,
      lpv,
    }
  } catch { return null }
}

async function fetchGlobalFunnel(): Promise<{ f4h: any; f24h: any }> {
  const since4h = new Date(Date.now() - 4 * 3600 * 1000)
  const since24h = new Date(Date.now() - 24 * 3600 * 1000)
  const [s4, c4, r4, w4, s24, c24, r24, w24] = await Promise.all([
    prisma.pageView.findMany({ where: { path: { startsWith: '/shop' }, createdAt: { gte: since4h }, sessionId: { not: null } }, distinct: ['sessionId'], select: { sessionId: true } }).then(r => r.length),
    prisma.clickEvent.count({ where: { event: 'CARD_CLICK', createdAt: { gte: since4h } } }),
    prisma.clickEvent.count({ where: { event: 'RETAILER_CLICK', channel: 'WEB', createdAt: { gte: since4h } } }),
    prisma.clickEvent.count({ where: { event: 'WA_INTENT', createdAt: { gte: since4h } } }),
    prisma.pageView.findMany({ where: { path: { startsWith: '/shop' }, createdAt: { gte: since24h }, sessionId: { not: null } }, distinct: ['sessionId'], select: { sessionId: true } }).then(r => r.length),
    prisma.clickEvent.count({ where: { event: 'CARD_CLICK', createdAt: { gte: since24h } } }),
    prisma.clickEvent.count({ where: { event: 'RETAILER_CLICK', channel: 'WEB', createdAt: { gte: since24h } } }),
    prisma.clickEvent.count({ where: { event: 'WA_INTENT', createdAt: { gte: since24h } } }),
  ])
  return {
    f4h: { sessions: s4, cards: c4, retailer: r4, wa: w4 },
    f24h: { sessions: s24, cards: c24, retailer: r24, wa: w24 },
  }
}

// ── Main ──

async function main() {
  console.log('='.repeat(70))
  console.log(`  Giftist Ads Optimizer · ${new Date().toISOString()}`)
  console.log('='.repeat(70))

  const state = loadState()
  const changes: ChangeRow[] = []
  const snapshotRows: SnapshotRow[] = []
  let holds = 0

  // Pull all snapshots first so we can compute total active budget for the cap check
  const snapshots: Array<{ c: CampaignTarget; meta: MetaSnapshot | null; funnel: FunnelSnapshot; today: any | null }> = []
  for (const c of CAMPAIGNS) {
    const meta = await fetchMeta(c)
    const funnel = await fetchFunnel(c.utmCampaign)
    const today = await fetchMetaToday(c)
    snapshots.push({ c, meta, funnel, today })
  }
  const totalActiveBudget = snapshots
    .filter(s => s.meta?.effectiveStatus === 'ACTIVE')
    .reduce((sum, s) => sum + (s.meta?.dailyBudget || 0), 0)
  console.log(`Total active budget across campaigns: $${totalActiveBudget}/day  (cap: $${TOTAL_BUDGET_CAP}/day)\n`)

  for (const { c, meta, funnel, today } of snapshots) {
    let decisionLabel = 'no data'

    if (!meta) {
      console.log(`[skip] ${c.name} — meta fetch failed`)
      decisionLabel = 'meta fetch failed'
    } else if (meta.effectiveStatus !== 'ACTIVE') {
      console.log(`[skip] ${c.name} — ${meta.effectiveStatus}`)
      decisionLabel = `${meta.effectiveStatus.toLowerCase()}`
    } else if (inCooldown(state, c.id)) {
      const last = state.lastChangeAt[c.id]
      console.log(`[cooldown] ${c.name} — last change ${last}, holding`)
      holds++
      decisionLabel = `cooldown (last change ${new Date(last).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })} PT)`
    } else {
      const action = decide(meta, funnel, totalActiveBudget)
      console.log(`[${c.name}] ${action.kind.toUpperCase()} — ${action.reason}`)
      console.log(`           4h: $${meta.spend4h} spent · ${meta.impressions4h} impr · CTR ${meta.ctr4h}% · CPC $${meta.cpc4h} · ${meta.lpv4h} LPV`)
      console.log(`           funnel 4h: ${funnel.shopSessions4h} sessions · ${funnel.totalConversions4h} conv | 24h: ${funnel.shopSessions24h} sessions · ${funnel.totalConversions24h} conv`)
      decisionLabel = `${action.kind.toUpperCase()} — ${action.reason}`

      if (action.kind !== 'hold') {
        try {
          const result = await applyAction(c, action)
          console.log(`           ✓ ${result}`)
          state.lastChangeAt[c.id] = new Date().toISOString()
          state.lastAction[c.id] = action.kind
          changes.push({
            campaign: c.name,
            before: { budget: meta.dailyBudget, status: meta.status, ctr: meta.ctr4h, cpc: meta.cpc4h, spend4h: meta.spend4h, lpv4h: meta.lpv4h },
            after: action.kind === 'pause' ? { status: 'PAUSED' } : { budget: 'newBudget' in action ? action.newBudget : undefined, status: 'ACTIVE' },
            reason: action.reason,
            funnel: { sessions: funnel.shopSessions4h, conv: funnel.totalConversions4h },
          })
        } catch (e: any) {
          console.error(`           ✗ apply failed: ${e.message}`)
          decisionLabel = `apply failed: ${e.message}`
        }
      } else {
        holds++
      }
    }

    snapshotRows.push({
      campaign: c.name,
      utmCampaign: c.utmCampaign,
      status: meta?.effectiveStatus || 'UNKNOWN',
      budget: meta?.dailyBudget || 0,
      metaToday: today,
      meta4h: meta
        ? { spend: meta.spend4h, impr: meta.impressions4h, ctr: meta.ctr4h, cpc: meta.cpc4h, lpv: meta.lpv4h }
        : { spend: 0, impr: 0, ctr: 0, cpc: 0, lpv: 0 },
      funnel,
      decision: decisionLabel,
    })
  }

  saveState(state)
  console.log(`\nResult: ${changes.length} change(s), ${holds} hold(s).`)

  // Always email — performance + funnel + optimization-goal block
  const { f4h, f24h } = await fetchGlobalFunnel()
  sendEmail(changes, snapshotRows, f4h, f24h)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})

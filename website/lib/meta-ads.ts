/**
 * Meta Marketing API client for Facebook/Instagram ad campaigns.
 * Used for automated click-to-WhatsApp ad creation and performance tracking.
 */

const META_API_VERSION = 'v21.0'
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

function getConfig() {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  const adAccountId = process.env.META_AD_ACCOUNT_ID?.trim()
  const pageId = process.env.META_PAGE_ID?.trim()
  const whatsappNumber = process.env.META_WHATSAPP_NUMBER || '+15014438478'

  if (!token || !adAccountId || !pageId) {
    throw new Error('Missing META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, or META_PAGE_ID env vars')
  }

  return { token, adAccountId, pageId, whatsappNumber }
}

async function metaApi(path: string, options?: { method?: string; body?: any }) {
  const { token } = getConfig()
  const method = options?.method || 'GET'
  const url = `${META_BASE_URL}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`

  const res = await fetch(url, {
    method,
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta API error ${res.status}: ${JSON.stringify(err?.error || err)}`)
  }

  return res.json()
}

// ── Campaign Creation ──

export async function createCampaign(params: {
  name: string
  dailyBudget: number // USD
  objective?: string
}): Promise<{ id: string }> {
  const { adAccountId } = getConfig()
  const data = await metaApi(`/act_${adAccountId}/campaigns`, {
    method: 'POST',
    body: {
      name: params.name,
      objective: params.objective || 'OUTCOME_TRAFFIC',
      status: 'PAUSED', // start paused, activate after ad set + ad
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    },
  })
  return data
}

export async function createAdSet(params: {
  campaignId: string
  name: string
  dailyBudget: number // USD
  startDate: Date
  endDate?: Date
  ageMin?: number
  ageMax?: number
  countries?: string[]
  interests?: Array<{ id: string; name: string }>
}): Promise<{ id: string }> {
  const { adAccountId, pageId } = getConfig()

  const targeting: any = {
    geo_locations: {
      countries: params.countries || ['US'],
    },
    age_min: params.ageMin || 25,
    age_max: params.ageMax || 54,
  }

  if (params.interests?.length) {
    targeting.flexible_spec = [{ interests: params.interests }]
  }

  targeting.targeting_automation = { advantage_audience: 0 }

  const data = await metaApi(`/act_${adAccountId}/adsets`, {
    method: 'POST',
    body: {
      campaign_id: params.campaignId,
      name: params.name,
      daily_budget: Math.round(params.dailyBudget * 100), // cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      start_time: params.startDate.toISOString(),
      end_time: params.endDate?.toISOString(),
      targeting,
      promoted_object: { page_id: pageId },
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      status: 'PAUSED',
    },
  })
  return data
}

export async function createAdCreative(params: {
  name: string
  pageId?: string
  text: string
  headline: string
  imageUrl?: string
  imageHash?: string
  link?: string
  ctaType?: string
}): Promise<{ id: string }> {
  const { adAccountId, pageId: defaultPageId } = getConfig()
  const pid = params.pageId || defaultPageId

  const objectStorySpec: any = {
    page_id: pid,
    link_data: {
      message: params.text,
      name: params.headline,
      link: params.link || 'https://giftist.ai',
      call_to_action: {
        type: params.ctaType || 'WHATSAPP_MESSAGE',
        value: {
          app_destination: 'WHATSAPP',
        },
      },
    },
  }

  if (params.imageHash) {
    objectStorySpec.link_data.image_hash = params.imageHash
  } else if (params.imageUrl) {
    objectStorySpec.link_data.picture = params.imageUrl
  }

  const data = await metaApi(`/act_${adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: params.name,
      object_story_spec: objectStorySpec,
    },
  })
  return data
}

export async function createAd(params: {
  adSetId: string
  creativeId: string
  name: string
}): Promise<{ id: string }> {
  const { adAccountId } = getConfig()
  const data = await metaApi(`/act_${adAccountId}/ads`, {
    method: 'POST',
    body: {
      adset_id: params.adSetId,
      creative: { creative_id: params.creativeId },
      name: params.name,
      status: 'ACTIVE',
    },
  })
  return data
}

export async function activateCampaign(campaignId: string) {
  return metaApi(`/${campaignId}`, {
    method: 'POST',
    body: { status: 'ACTIVE' },
  })
}

export async function activateAdSet(adSetId: string) {
  return metaApi(`/${adSetId}`, {
    method: 'POST',
    body: { status: 'ACTIVE' },
  })
}

export async function pauseCampaign(campaignId: string) {
  return metaApi(`/${campaignId}`, {
    method: 'POST',
    body: { status: 'PAUSED' },
  })
}

// ── Performance Insights ──

export interface CampaignInsights {
  impressions: number
  clicks: number
  spend: number
  cpc: number
  ctr: number
  cpm: number
  actions: Array<{ action_type: string; value: string }>
}

export async function getCampaignInsights(campaignId: string, dateRange?: { start: string; end: string }): Promise<CampaignInsights | null> {
  const fields = 'impressions,clicks,spend,cpc,ctr,cpm,actions'
  let path = `/${campaignId}/insights?fields=${fields}`
  if (dateRange) {
    path += `&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}`
  }

  try {
    const data = await metaApi(path)
    if (!data.data?.length) return null
    const row = data.data[0]
    return {
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      spend: parseFloat(row.spend || '0'),
      cpc: parseFloat(row.cpc || '0'),
      ctr: parseFloat(row.ctr || '0'),
      cpm: parseFloat(row.cpm || '0'),
      actions: row.actions || [],
    }
  } catch {
    return null
  }
}

export async function getAccountInsights(dateRange?: { start: string; end: string }): Promise<CampaignInsights | null> {
  const { adAccountId } = getConfig()
  const fields = 'impressions,clicks,spend,cpc,ctr,cpm,actions'
  let path = `/act_${adAccountId}/insights?fields=${fields}`
  if (dateRange) {
    path += `&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}`
  }

  try {
    const data = await metaApi(path)
    if (!data.data?.length) return null
    const row = data.data[0]
    return {
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      spend: parseFloat(row.spend || '0'),
      cpc: parseFloat(row.cpc || '0'),
      ctr: parseFloat(row.ctr || '0'),
      cpm: parseFloat(row.cpm || '0'),
      actions: row.actions || [],
    }
  } catch {
    return null
  }
}

export async function listCampaigns(): Promise<Array<{ id: string; name: string; status: string; daily_budget: string; objective: string; created_time?: string }>> {
  const { adAccountId } = getConfig()
  const data = await metaApi(`/act_${adAccountId}/campaigns?fields=id,name,status,daily_budget,objective,created_time&limit=50`)
  return data.data || []
}

// ── Full Campaign Creation Flow ──

export async function createFullCampaign(params: {
  name: string
  dailyBudget: number
  adText: string
  headline: string
  startDate: Date
  endDate?: Date
  imageUrl?: string
  imageHash?: string
  interests?: Array<{ id: string; name: string }>
}): Promise<{
  campaignId: string
  adSetId: string
  adId: string
  creativeId: string
}> {
  // 1. Create campaign
  const campaign = await createCampaign({
    name: params.name,
    dailyBudget: params.dailyBudget,
  })

  // 2. Create ad set with targeting
  const adSet = await createAdSet({
    campaignId: campaign.id,
    name: `${params.name} - Ad Set`,
    dailyBudget: params.dailyBudget,
    startDate: params.startDate,
    endDate: params.endDate,
    interests: params.interests,
  })

  // 3. Create ad creative
  const creative = await createAdCreative({
    name: `${params.name} - Creative`,
    text: params.adText,
    headline: params.headline,
    imageUrl: params.imageUrl,
    imageHash: params.imageHash,
  })

  // 4. Create ad
  const ad = await createAd({
    adSetId: adSet.id,
    creativeId: creative.id,
    name: `${params.name} - Ad`,
  })

  // 5. Activate ad set + campaign
  await activateAdSet(adSet.id)
  await activateCampaign(campaign.id)

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    adId: ad.id,
    creativeId: creative.id,
  }
}

// ── Shop-Lander Variant ──
// New acquisition strategy: send ad clicks to /shop instead of opening
// WhatsApp directly. Users browse the curated catalog and convert via
// the "Order via WhatsApp" CTA on the product page.

export async function createShopAdCreative(params: {
  name: string
  pageId?: string
  text: string
  headline: string
  imageUrl?: string
  imageHash?: string
  utmCampaign: string
  shopPath?: string  // defaults to /shop; can be /shop/mothers-day etc
}): Promise<{ id: string }> {
  const { adAccountId, pageId: defaultPageId } = getConfig()
  const pid = params.pageId || defaultPageId

  // Merge UTM params with any existing query string in shopPath so we don't
  // accidentally produce double-? URLs like /shop?occasion=foo?utm_source=...
  const rawPath = params.shopPath || '/shop'
  const [pathOnly, existingQs = ''] = rawPath.split('?')
  const merged = new URLSearchParams(existingQs)
  merged.set('utm_source', 'meta')
  merged.set('utm_medium', 'paid_social')
  merged.set('utm_campaign', params.utmCampaign)
  const link = `https://giftist.ai${pathOnly}?${merged.toString()}`

  const objectStorySpec: any = {
    page_id: pid,
    link_data: {
      message: params.text,
      name: params.headline,
      link,
      call_to_action: {
        type: 'SHOP_NOW',
      },
    },
  }
  if (params.imageHash) {
    objectStorySpec.link_data.image_hash = params.imageHash
  } else if (params.imageUrl) {
    objectStorySpec.link_data.picture = params.imageUrl
  }

  const data = await metaApi(`/act_${adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: params.name,
      object_story_spec: objectStorySpec,
    },
  })
  return data
}

export async function createShopFullCampaign(params: {
  name: string
  dailyBudget: number
  adText: string
  headline: string
  utmCampaign: string
  shopPath?: string
  startDate: Date
  endDate?: Date
  imageUrl?: string
  imageHash?: string
  interests?: Array<{ id: string; name: string }>
  ageMin?: number          // default 21
  ageMax?: number          // default 65
  genders?: Array<1 | 2>   // 1=male, 2=female; omit for all
  countries?: string[]     // default ['US']
}): Promise<{
  campaignId: string
  adSetId: string
  adId: string
  creativeId: string
  landingUrl: string
}> {
  // Use OUTCOME_TRAFFIC objective so Meta optimizes for clicks to /shop,
  // not for WhatsApp message starts.
  const { adAccountId } = getConfig()
  const campaign = await metaApi(`/act_${adAccountId}/campaigns`, {
    method: 'POST',
    body: {
      name: params.name,
      objective: 'OUTCOME_TRAFFIC',
      special_ad_categories: [],
      buying_type: 'AUCTION',
      // Each ad set sets its own budget; not sharing across ad sets.
      is_adset_budget_sharing_enabled: false,
      status: 'PAUSED',
    },
  })

  // Ad set targeting LINK_CLICKS instead of CONVERSATIONS
  const adSet = await metaApi(`/act_${adAccountId}/adsets`, {
    method: 'POST',
    body: {
      name: `${params.name} - Ad Set`,
      campaign_id: campaign.id,
      daily_budget: Math.round(params.dailyBudget * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      destination_type: 'WEBSITE',
      start_time: params.startDate.toISOString(),
      ...(params.endDate ? { end_time: params.endDate.toISOString() } : {}),
      targeting: {
        geo_locations: { countries: params.countries || ['US'] },
        age_min: params.ageMin ?? 21,
        age_max: params.ageMax ?? 65,
        ...(params.genders && params.genders.length > 0 ? { genders: params.genders } : {}),
        ...(params.interests ? { flexible_spec: [{ interests: params.interests }] } : {}),
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed', 'story'],
        instagram_positions: ['stream', 'story', 'reels'],
        // Meta requires this flag when targeting is narrowed (gender / age / interests).
        // 0 = honor exact targeting; 1 = let Meta expand to similar audiences.
        targeting_automation: { advantage_audience: 0 },
      },
      status: 'PAUSED',
    },
  })

  const creative = await createShopAdCreative({
    name: `${params.name} - Creative`,
    text: params.adText,
    headline: params.headline,
    imageUrl: params.imageUrl,
    imageHash: params.imageHash,
    utmCampaign: params.utmCampaign,
    shopPath: params.shopPath,
  })

  const ad = await createAd({
    adSetId: adSet.id,
    creativeId: creative.id,
    name: `${params.name} - Ad`,
  })

  await activateAdSet(adSet.id)
  await activateCampaign(campaign.id)

  // Build the same merged URL the creative uses so we can log/persist it.
  const rawPath = params.shopPath || '/shop'
  const [pathOnly, existingQs = ''] = rawPath.split('?')
  const merged = new URLSearchParams(existingQs)
  merged.set('utm_source', 'meta')
  merged.set('utm_medium', 'paid_social')
  merged.set('utm_campaign', params.utmCampaign)

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    adId: ad.id,
    creativeId: creative.id,
    landingUrl: `https://giftist.ai${pathOnly}?${merged.toString()}`,
  }
}

// ── Common Interest IDs for gift/shopping targeting ──
export const GIFT_INTERESTS = [
  { id: '6003263791114', name: 'Shopping' },
  { id: '6003346592981', name: 'Online shopping' },
  { id: '6003273071999', name: 'Unique Gifts' },
]

export const MOTHERS_DAY_INTERESTS = [
  { id: '6003395917803', name: "Mother's Day" },
  { id: '6003263791114', name: 'Shopping' },
  { id: '6003273071999', name: 'Unique Gifts' },
]

// ── Holiday ad copy generator ──
export function generateHolidayAdCopy(holidayName: string): { text: string; headline: string } {
  const copies: Record<string, { text: string; headline: string }> = {
    "Mother's Day": {
      text: "Still thinking about what to get Mom? Tell us about her and we'll find something she'll actually love. No endless scrolling required.",
      headline: "Find Mom's perfect gift",
    },
    "Father's Day": {
      text: "Dad says he doesn't want anything. We both know that's not true. Tell us about him and we'll find the right gift in seconds.",
      headline: "Find Dad's perfect gift",
    },
    "Valentine's Day": {
      text: "Skip the generic chocolates. Tell us about your person and we'll find a gift that actually means something.",
      headline: "Find a thoughtful gift",
    },
    "Christmas": {
      text: "Gift shopping doesn't have to be stressful. Tell us who you're buying for and we'll handle the rest.",
      headline: "Gifting, simplified",
    },
    "Thanksgiving": {
      text: "Show up with the perfect host gift. Tell us who you're visiting and we'll find something thoughtful.",
      headline: "Find the perfect host gift",
    },
    "Graduation": {
      text: "They worked hard for this. Find a gift that matches the milestone. Tell us about the grad and we'll handle the rest.",
      headline: "Gift the grad",
    },
    "Birthday": {
      text: "Another year, another last-minute scramble? Not this time. Tell us who's celebrating and we'll find something perfect.",
      headline: "Never miss a birthday",
    },
  }

  return copies[holidayName] || {
    text: `${holidayName} is coming up. Tell us who you're shopping for and we'll find the perfect gift in seconds. No browsing, no stress.`,
    headline: `${holidayName} gifts, sorted`,
  }
}

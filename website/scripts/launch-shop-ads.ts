/**
 * Launch a Meta ads campaign that drives clicks to /shop instead of WhatsApp.
 *
 * Usage:
 *   npx tsx scripts/launch-shop-ads.ts \
 *     --name "Shop - Mothers Day v1" \
 *     --budget 10 \
 *     --campaign mothers-day-shop \
 *     --shop "/shop?occasion=mothers-day" \
 *     --image "https://giftist.ai/.../hero.jpg" \
 *     --headline "Handpicked gifts for Mom" \
 *     --text "Curated by experts. 700+ verified picks. Free to browse."
 *
 * Or import and call createShopFullCampaign directly.
 */
import { createShopFullCampaign, MOTHERS_DAY_INTERESTS, GIFT_INTERESTS, generateHolidayAdCopy } from '@/lib/meta-ads'
import { prisma } from '@/lib/db'

interface Args {
  name: string
  budget: number
  campaign: string  // utm_campaign value
  shop?: string
  image?: string
  headline?: string
  text?: string
  interests?: 'mothers-day' | 'gift' | 'none'
  endDays?: number  // auto-end after N days
  ageMin?: number
  ageMax?: number
  gender?: 'male' | 'female' | 'all'
}

function parseArgs(): Args {
  const out: any = { interests: 'gift' }
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i].replace(/^--/, '')
    const v = process.argv[i + 1]
    if (k === 'budget' || k === 'endDays' || k === 'ageMin' || k === 'ageMax') out[k] = Number(v)
    else out[k] = v
  }
  if (!out.name || !out.budget || !out.campaign) {
    console.error('Required: --name <str> --budget <usd/day> --campaign <utm_campaign>')
    process.exit(1)
  }
  return out as Args
}

async function main() {
  const args = parseArgs()
  const interests =
    args.interests === 'mothers-day' ? MOTHERS_DAY_INTERESTS :
    args.interests === 'none' ? undefined :
    GIFT_INTERESTS

  const fallback = generateHolidayAdCopy("Mother's Day")
  const adText = args.text || fallback.text
  const headline = args.headline || fallback.headline

  console.log(`\nLaunching Meta campaign:`)
  console.log(`  Name:        ${args.name}`)
  console.log(`  Budget:      $${args.budget}/day`)
  console.log(`  Campaign:    ${args.campaign}`)
  console.log(`  Shop path:   ${args.shop || '/shop'}`)
  console.log(`  Headline:    ${headline}`)
  console.log(`  Text:        ${adText}`)
  console.log(`  Interests:   ${args.interests}`)
  console.log()

  const startDate = new Date()
  const endDate = args.endDays ? new Date(Date.now() + args.endDays * 86400000) : undefined

  const genders =
    args.gender === 'female' ? [2 as const] :
    args.gender === 'male' ? [1 as const] :
    undefined

  const result = await createShopFullCampaign({
    name: args.name,
    dailyBudget: args.budget,
    adText,
    headline,
    utmCampaign: args.campaign,
    shopPath: args.shop,
    startDate,
    endDate,
    imageUrl: args.image,
    interests,
    ageMin: args.ageMin,
    ageMax: args.ageMax,
    genders,
  })

  // Persist a MetaCampaign row so the admin dashboard can track it
  try {
    await prisma.metaCampaign.create({
      data: {
        metaCampaignId: result.campaignId,
        metaAdSetId: result.adSetId,
        metaAdId: result.adId,
        name: args.name,
        objective: 'OUTCOME_TRAFFIC',
        status: 'ACTIVE',
        dailyBudget: args.budget,
        adText,
        headline,
        startDate,
        endDate,
      },
    })
  } catch (e) {
    console.warn('Could not persist MetaCampaign row:', e)
  }

  console.log(`\n✓ Campaign live`)
  console.log(`  campaignId: ${result.campaignId}`)
  console.log(`  adSetId:    ${result.adSetId}`)
  console.log(`  adId:       ${result.adId}`)
  console.log(`  Landing URL: ${result.landingUrl}`)
  console.log()
  console.log(`Track conversions in admin → Funnel tab → "Shop → WhatsApp Funnel"`)
  console.log(`Filter by utm_campaign = "${args.campaign}"`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})

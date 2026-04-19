import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  // Get all cached products
  const cached = await prisma.productUrlCache.findMany({
    orderBy: { verifiedAt: 'desc' },
  })

  // Get impression and click counts per product slug
  const clickEvents = await prisma.clickEvent.groupBy({
    by: ['slug'],
    _count: { id: true },
    where: { event: 'IMPRESSION' },
  })
  const clickCounts = await prisma.clickEvent.groupBy({
    by: ['slug'],
    _count: { id: true },
    where: { event: 'CLICK' },
  })

  const impressionsBySlug = new Map(clickEvents.map(e => [e.slug, e._count.id]))
  const clicksBySlug = new Map(clickCounts.map(e => [e.slug, e._count.id]))

  // Get product categories from items
  const items = await prisma.item.findMany({
    where: { source: 'WHATSAPP' },
    select: { name: true, category: true },
  })
  const themesByName = new Map<string, Set<string>>()
  for (const item of items) {
    const nameLower = item.name.toLowerCase().trim()
    if (item.category) {
      const themes = themesByName.get(nameLower) || new Set()
      themes.add(item.category)
      themesByName.set(nameLower, themes)
    }
  }

  // Also extract themes from AI chat history
  const chatProducts = await prisma.chatMessage.findMany({
    where: { role: 'ASSISTANT', content: { contains: '[PRODUCT]' } },
    select: { content: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Extract product names and their contexts
  const productContexts = new Map<string, Set<string>>()
  for (const msg of chatProducts) {
    const productMatches = msg.content.matchAll(/\[PRODUCT\]\{"name":"([^"]+)"/g)
    // Try to infer theme from the intro line
    const introLine = msg.content.split('\n')[0].toLowerCase()
    let theme = 'general'
    if (introLine.includes('mother') || introLine.includes('mom')) theme = "Mother's Day"
    else if (introLine.includes('birthday')) theme = 'Birthday'
    else if (introLine.includes('anniversary')) theme = 'Anniversary'
    else if (introLine.includes('wedding')) theme = 'Wedding'
    else if (introLine.includes('baby')) theme = 'Baby'
    else if (introLine.includes('self') || introLine.includes('yourself') || introLine.includes('treat')) theme = 'Self-care'
    else if (introLine.includes('tablet') || introLine.includes('tech')) theme = 'Tech'
    else if (introLine.includes('fashion') || introLine.includes('style')) theme = 'Fashion'

    for (const match of productMatches) {
      const name = match[1].toLowerCase().trim()
      const themes = productContexts.get(name) || new Set()
      themes.add(theme)
      productContexts.set(name, themes)
    }
  }

  // Build product list — match impressions/clicks by iterating all slugs
  // (Simple approach since we don't have direct name→slug mapping)
  const allImpressions = clickEvents.reduce((s, e) => s + e._count.id, 0)
  const allClicks = clickCounts.reduce((s, e) => s + e._count.id, 0)

  const products = cached.map(p => {
    const nameLower = p.productName.toLowerCase().trim()
    const themes = Array.from(productContexts.get(nameLower) || themesByName.get(nameLower) || new Set())
    // Count how many times this product appears in AI messages as a rough impression count
    const aiMentions = chatProducts.filter(msg => msg.content.toLowerCase().includes(nameLower)).length
    const impressions = aiMentions
    const clicks = 0  // We can't match clicks by name — would need slug tracking

    return {
      productName: p.productName,
      url: p.url,
      domain: p.domain,
      price: p.price,
      priceValue: p.priceValue,
      image: p.image,
      verifiedAt: p.verifiedAt,
      impressions,
      clicks,
      themes,
    }
  })

  // Totals
  const withPrice = products.filter(p => p.priceValue && p.priceValue > 0)
  const allThemes = new Map<string, number>()
  for (const p of products) {
    for (const th of p.themes) {
      allThemes.set(th, (allThemes.get(th) || 0) + 1)
    }
  }

  const domainCounts = new Map<string, number>()
  for (const p of products) {
    if (p.domain) domainCounts.set(p.domain, (domainCounts.get(p.domain) || 0) + 1)
  }

  const totals = {
    totalProducts: products.length,
    withPrice: withPrice.length,
    withImage: products.filter(p => p.image).length,
    totalImpressions: products.reduce((s, p) => s + p.impressions, 0),
    totalClicks: products.reduce((s, p) => s + p.clicks, 0),
    avgPrice: withPrice.length > 0 ? withPrice.reduce((s, p) => s + (p.priceValue || 0), 0) / withPrice.length : 0,
    topDomains: Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count })),
    topThemes: Array.from(allThemes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([theme, count]) => ({ theme, count })),
  }

  return NextResponse.json({ products, totals })
}

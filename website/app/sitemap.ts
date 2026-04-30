import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { seoSlugs } from '@/lib/seo-holidays'
import { LISTICLES } from '@/lib/listicles'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://giftist.ai'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/magic`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guides`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]

  // SEO listicles — one per gift guide, high priority for indexing
  const listiclePages: MetadataRoute.Sitemap = LISTICLES.map((l) => ({
    url: `${baseUrl}/guides/${l.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  // SEO holiday landing pages
  const holidayPages: MetadataRoute.Sitemap = seoSlugs.map((slug) => ({
    url: `${baseUrl}/c/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // Dynamic: public events
  const events = await prisma.event.findMany({
    where: { isPublic: true },
    select: { shareUrl: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${baseUrl}/events/${event.shareUrl}`,
    lastModified: event.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...listiclePages, ...holidayPages, ...eventPages]
}

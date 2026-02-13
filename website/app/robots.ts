import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/feed', '/chat', '/wallet', '/settings'],
    },
    sitemap: 'https://giftist.arunash.com/sitemap.xml',
  }
}

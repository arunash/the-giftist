// Crawler / bot user-agent detection. Used by /go-r to skip logging
// RETAILER_CLICK events from automated traffic (Meta link-preview crawler,
// search-engine bots, social embed scrapers, etc.) — those polluted the
// real-user click counts by 10-100x on days where ads were updated.
//
// Strategy: substring-match against a list of well-known bot strings. We
// favor false negatives (let an unknown bot through, log one extra click)
// over false positives (drop a real click). The list below is the bots
// we've actually observed in production logs + the standard suspects.

const BOT_SUBSTRINGS = [
  // Meta / Facebook
  'meta-externalagent',
  'facebookexternalhit',
  'facebookcatalog',
  'facebot',
  // Other major social previewers — KEEP THESE TARGETED. Substrings like
  // bare "whatsapp" or "pinterest" match real users on those apps' in-app
  // browsers, which we want to count.
  'twitterbot',
  'slackbot',
  'discordbot',
  'linkedinbot',
  'whatsapp/',                 // WA link-preview crawler is "WhatsApp/2.x.x" without browser tokens
  'instagrambot',
  'pinterestbot',
  // Search engines
  'googlebot',
  'bingbot',
  'yandex',
  'baidu',
  'duckduckbot',
  'applebot',
  // Generic markers
  'bot/',
  'spider/',
  'crawler',
  'scraper',
  'headlesschrome',
  'phantomjs',
  'puppeteer',
  'playwright',
  'selenium',
  'curl/',
  'wget/',
  'python-requests',
  'go-http-client',
  'okhttp',
  // Monitoring / uptime
  'uptimerobot',
  'pingdom',
  'statuscake',
  // SEO crawlers
  'ahrefsbot',
  'semrushbot',
  'mj12bot',
  'dotbot',
]

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true  // missing UA is suspicious — treat as bot
  const lower = ua.toLowerCase()
  return BOT_SUBSTRINGS.some(s => lower.includes(s))
}

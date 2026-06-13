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
  // Search engines + Google crawler family (multiple variants beyond the
  // classic Googlebot — these all hit /go-r without warning)
  'googlebot',
  'googleother',
  'google-extended',
  'google-pagerenderer',
  'storebot-google',
  'mediapartners-google',
  'apis-google',
  'feedfetcher-google',
  'bingbot',
  'yandex',
  'baidu',
  'duckduckbot',
  'applebot',
  // AI training / LLM crawlers (newer, aggressive)
  'gptbot',
  'chatgpt-user',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'perplexitybot',
  'amazonbot',
  'cohere-ai',
  'bytespider',
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
  // Internal Giftist tooling — catalog-health sub-agent + manual audits.
  // These hit /go-r every hour to verify the funnel works; without this
  // exclusion they would dominate the RETAILER_CLICK count by 70%+.
  'giftistaudit',
  'giftistloop',
  // Known crawler fingerprints we observed in production:
  // - iOS 13.2.3 (Oct 2019, abandoned by Apple; lots of bots use this exact
  //   UA, identical repeats in our logs). Real iPhone users in 2026 are
  //   on iOS 17 / 18 / 19.
  'cpu iphone os 13_2_3',
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

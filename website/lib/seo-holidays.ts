// SEO content for holiday landing pages at /c/[slug]
// Each entry powers a full landing page with metadata, hero copy, and curated gift suggestions

export interface HolidaySeo {
  slug: string
  title: string            // H1 + OG title
  metaTitle: string        // <title> tag (with "| Giftist")
  description: string      // meta description (max ~155 chars)
  heroSubtitle: string     // below H1
  color: string            // tailwind accent color (pink, violet, emerald, etc.)
  emoji: string            // badge emoji
  date?: string            // e.g. "May 11, 2026"
  ctaText: string          // WhatsApp button text
  occasion: string         // maps to CatalogProduct occasions field
  recipients: string[]     // maps to CatalogProduct recipients field
  sampleGifts: Array<{ name: string; subtitle: string; price: string; tag: string }>
  faq: Array<{ q: string; a: string }>
}

export const seoHolidays: Record<string, HolidaySeo> = {
  'mothers-day': {
    slug: 'mothers-day',
    title: "Mother's Day Gifts\nFound in 30 Seconds",
    metaTitle: "Best Mother's Day Gifts 2026 — Personalized Ideas",
    description: "Find the perfect Mother's Day gift with AI-powered suggestions. Tell us about your mom and get personalized gift ideas with buy links instantly.",
    heroSubtitle: "Tell our AI concierge about your mom and get personalized gift suggestions with buy links — instantly.",
    color: 'pink',
    emoji: '💝',
    date: 'May 11, 2026',
    ctaText: "Find Mom's Gift",
    occasion: 'mothers_day',
    recipients: ['mom', 'wife', 'grandmother'],
    sampleGifts: [
      { name: 'Le Creuset Dutch Oven', subtitle: 'Marseille Blue, 5.5 Qt', price: '$350', tag: 'For the home chef' },
      { name: 'Dyson Airwrap', subtitle: 'Multi-Styler Complete', price: '$500', tag: 'For the style-conscious' },
      { name: 'Herbivore Botanicals Set', subtitle: 'Luxury Spa Gift Set', price: '$68', tag: 'For the self-care lover' },
    ],
    faq: [
      { q: 'How does Giftist find gifts for my mom?', a: 'Just tell us about your mom — her hobbies, style, or what she\'s mentioned wanting. Our AI concierge searches thousands of products and finds the best matches with buy links.' },
      { q: "When is Mother's Day 2026?", a: "Mother's Day is Sunday, May 11, 2026." },
      { q: 'Is Giftist free?', a: 'Yes! You get 10 free messages. Just text us on WhatsApp or use our web chat — no app download needed.' },
      { q: 'What price range do you cover?', a: 'We find gifts at every budget — from thoughtful $20 picks to luxury $500+ items. Just tell us your budget.' },
    ],
  },
  'fathers-day': {
    slug: 'fathers-day',
    title: "Father's Day Gifts\nHe'll Actually Use",
    metaTitle: "Best Father's Day Gifts 2026 — Personalized Ideas",
    description: "Find Father's Day gifts he'll actually love. Tell our AI concierge about your dad and get personalized suggestions with buy links in seconds.",
    heroSubtitle: "Dad says he doesn't want anything. We both know that's not true. Tell us about him and we'll find the right gift.",
    color: 'blue',
    emoji: '👔',
    date: 'June 15, 2026',
    ctaText: "Find Dad's Gift",
    occasion: 'fathers_day',
    recipients: ['dad', 'husband', 'grandfather'],
    sampleGifts: [
      { name: 'Yeti Rambler Tumbler', subtitle: '20oz Stainless Steel', price: '$35', tag: 'For the outdoors dad' },
      { name: 'Traeger Ironwood 650', subtitle: 'WiFi Pellet Grill', price: '$1,200', tag: 'For the grill master' },
      { name: 'Apple AirPods Pro', subtitle: '2nd Gen with USB-C', price: '$249', tag: 'For the tech dad' },
    ],
    faq: [
      { q: 'How do I find a gift for a dad who has everything?', a: 'Tell our concierge what he\'s into — even vague answers like "he likes his garage" work. We find unique, practical gifts he won\'t expect.' },
      { q: "When is Father's Day 2026?", a: "Father's Day is Sunday, June 15, 2026." },
      { q: 'Is Giftist free?', a: 'Yes! 10 free messages to find the perfect gift. No app, no sign-up.' },
      { q: 'What if I have no idea what to get?', a: 'That\'s exactly what we\'re for. Just tell us his age, a hobby or two, and your budget. We handle the rest.' },
    ],
  },
  'valentines': {
    slug: 'valentines',
    title: "Valentine's Day Gifts\nThat Actually Mean Something",
    metaTitle: "Best Valentine's Day Gifts 2026 — Personalized Ideas",
    description: "Skip the generic chocolates. Tell our AI concierge about your person and get personalized Valentine's Day gift ideas with buy links.",
    heroSubtitle: "Skip the generic chocolates. Tell us about your person and we'll find a gift that shows you actually pay attention.",
    color: 'rose',
    emoji: '💘',
    date: 'February 14',
    ctaText: "Find Their Gift",
    occasion: 'valentines_day',
    recipients: ['partner', 'wife', 'husband', 'girlfriend', 'boyfriend'],
    sampleGifts: [
      { name: 'Our Place Always Pan', subtitle: 'Steam, Blue Salt', price: '$150', tag: 'For the couple who cooks' },
      { name: 'Mejuri Bold Chain Necklace', subtitle: '14k Gold Vermeil', price: '$98', tag: 'For the minimalist' },
      { name: 'Aesop Reverence Duo', subtitle: 'Hand Wash + Balm', price: '$87', tag: 'For the design lover' },
    ],
    faq: [
      { q: 'How do I find a Valentine\'s gift that isn\'t cliché?', a: 'Tell us about your partner — what they\'re into, what makes them laugh, what they\'ve mentioned wanting. We find gifts that feel personal, not generic.' },
      { q: 'Is Giftist free?', a: 'Yes! 10 free messages. Works on WhatsApp or web chat.' },
      { q: 'Can you help with last-minute gifts?', a: 'Absolutely. We can find gifts available for next-day delivery or suggest local experiences.' },
    ],
  },
  'christmas': {
    slug: 'christmas',
    title: "Christmas Gifts\nWithout the Stress",
    metaTitle: "Best Christmas Gift Ideas 2026 — Personalized Picks",
    description: "Find the perfect Christmas gift for everyone on your list. Tell our AI concierge who you're shopping for and get personalized ideas instantly.",
    heroSubtitle: "Gift shopping doesn't have to be stressful. Tell us who you're buying for and we'll handle the rest.",
    color: 'emerald',
    emoji: '🎄',
    date: 'December 25',
    ctaText: "Start Shopping",
    occasion: 'christmas',
    recipients: ['mom', 'dad', 'friend', 'partner', 'coworker', 'sister', 'brother'],
    sampleGifts: [
      { name: 'Sony WH-1000XM5', subtitle: 'Wireless Noise Cancelling', price: '$348', tag: 'For the music lover' },
      { name: 'Ember Mug 2', subtitle: 'Temperature Control, 14oz', price: '$150', tag: 'For the coffee addict' },
      { name: 'Lego Botanicals Orchid', subtitle: 'Building Set for Adults', price: '$50', tag: 'For the creative one' },
    ],
    faq: [
      { q: 'Can Giftist help me shop for my whole list?', a: 'Yes! Tell us about each person one at a time. Our concierge remembers context and gets faster with each suggestion.' },
      { q: 'Is Giftist free?', a: 'Yes! 10 free messages. Upgrade to Gold ($4.99/mo) for unlimited.' },
      { q: 'Do you find gifts at every price point?', a: 'From $10 stocking stuffers to $500+ splurges — just tell us your budget per person.' },
    ],
  },
  'graduation': {
    slug: 'graduation',
    title: "Graduation Gifts\nWorth the Achievement",
    metaTitle: "Best Graduation Gift Ideas 2026 — Personalized Picks",
    description: "Find graduation gifts that match the milestone. Tell our AI concierge about the grad and get personalized suggestions with buy links.",
    heroSubtitle: "They worked hard for this. Find a gift that matches the milestone — not another gift card.",
    color: 'amber',
    emoji: '🎓',
    date: 'May–June 2026',
    ctaText: "Gift the Grad",
    occasion: 'graduation',
    recipients: ['friend', 'sister', 'brother', 'niece', 'nephew'],
    sampleGifts: [
      { name: 'Apple AirPods Pro', subtitle: '2nd Gen', price: '$249', tag: 'For everyday use' },
      { name: 'Herschel Supply Backpack', subtitle: 'Classic XL, Black', price: '$75', tag: 'For the next chapter' },
      { name: 'Moleskine Smart Notebook', subtitle: 'Large, Hard Cover', price: '$33', tag: 'For the ambitious one' },
    ],
    faq: [
      { q: 'What\'s a good graduation gift that isn\'t money?', a: 'Tell us about the grad — are they starting a job, traveling, moving? We find gifts that fit their next chapter.' },
      { q: 'Is Giftist free?', a: 'Yes! 10 free messages to find the perfect gift.' },
    ],
  },
  'thanksgiving': {
    slug: 'thanksgiving',
    title: "Thanksgiving Host Gifts\nThey'll Remember",
    metaTitle: "Best Thanksgiving Host Gift Ideas 2026",
    description: "Don't show up empty-handed. Find the perfect Thanksgiving host gift — tell our AI concierge who's hosting and get personalized ideas.",
    heroSubtitle: "Don't show up empty-handed. Tell us about your host and we'll find something better than a bottle of wine.",
    color: 'orange',
    emoji: '🍂',
    date: 'November 27, 2026',
    ctaText: "Find a Host Gift",
    occasion: 'thanksgiving',
    recipients: ['friend', 'mom', 'sister', 'coworker'],
    sampleGifts: [
      { name: 'Voluspa Candle Trio', subtitle: 'Japonica Collection', price: '$48', tag: 'Classic host gift' },
      { name: 'Williams Sonoma Cheese Board', subtitle: 'Olivewood, Handcrafted', price: '$60', tag: 'For the entertainer' },
      { name: 'Uncommon Goods Wine Decanter', subtitle: 'Aerating Pour-Over', price: '$38', tag: 'For the wine lover' },
    ],
    faq: [
      { q: 'What\'s a good Thanksgiving host gift?', a: 'Skip the flowers — tell us about your host\'s style and we\'ll find something they\'ll actually keep and use.' },
      { q: 'Is Giftist free?', a: 'Yes! Free to use on WhatsApp or web chat.' },
    ],
  },
  'birthday': {
    slug: 'birthday',
    title: "Birthday Gifts\nThey Won't Return",
    metaTitle: "Best Birthday Gift Ideas 2026 — AI-Powered Suggestions",
    description: "Find the perfect birthday gift in seconds. Tell our AI concierge about the birthday person and get personalized ideas with buy links.",
    heroSubtitle: "Another birthday, another last-minute scramble? Not this time. Tell us who's celebrating and we handle the rest.",
    color: 'violet',
    emoji: '🎂',
    ctaText: "Find Their Gift",
    occasion: 'birthday',
    recipients: ['friend', 'mom', 'dad', 'partner', 'sister', 'brother', 'coworker'],
    sampleGifts: [
      { name: 'Sonos Roam 2', subtitle: 'Portable Smart Speaker', price: '$179', tag: 'For the music lover' },
      { name: 'Aesop Resurrection Duo', subtitle: 'Hand Wash + Balm', price: '$87', tag: 'For the design lover' },
      { name: 'Stanley Adventure Quencher', subtitle: '40oz, Cream', price: '$45', tag: 'For the trending one' },
    ],
    faq: [
      { q: 'How do I find a birthday gift for someone who has everything?', a: 'Tell us what they\'re into — even "they like coffee" or "they just moved" gives us enough to find something great.' },
      { q: 'Is Giftist free?', a: 'Yes! 10 free messages. No app download, works on WhatsApp.' },
      { q: 'Can I set a budget?', a: 'Absolutely. We find gifts at $20, $50, $100, or any budget you specify.' },
    ],
  },
  'housewarming': {
    slug: 'housewarming',
    title: "Housewarming Gifts\nThey'll Actually Use",
    metaTitle: "Best Housewarming Gift Ideas 2026",
    description: "Find housewarming gifts they won't regift. Tell our AI concierge about the new homeowner and get personalized suggestions instantly.",
    heroSubtitle: "They just moved in. Bring something better than another candle.",
    color: 'teal',
    emoji: '🏡',
    ctaText: "Find a Gift",
    occasion: 'housewarming',
    recipients: ['friend', 'coworker', 'sister', 'brother'],
    sampleGifts: [
      { name: 'Our Place Always Pan', subtitle: 'Sage Green', price: '$150', tag: 'For the kitchen' },
      { name: 'Brooklinen Luxe Sheet Set', subtitle: 'King, Cream', price: '$179', tag: 'For the bedroom' },
      { name: 'Diptyque Baies Candle', subtitle: '190g', price: '$72', tag: 'For the vibe' },
    ],
    faq: [
      { q: 'What\'s a good housewarming gift?', a: 'It depends on the person. Tell us about them — minimalist or maximalist? Cook or order in? We match the gift to their style.' },
      { q: 'Is Giftist free?', a: 'Yes! Works on WhatsApp or web chat, no sign-up needed.' },
    ],
  },
  'secret-santa': {
    slug: 'secret-santa',
    title: "Secret Santa Gifts\nUnder $25",
    metaTitle: "Best Secret Santa Gift Ideas Under $25 — 2026",
    description: "Find Secret Santa gifts that aren't lame. Tell our AI concierge about the person and your budget — get personalized ideas in seconds.",
    heroSubtitle: "Pulled a name you barely know? Tell us what little you do know and we'll find something that lands.",
    color: 'red',
    emoji: '🎅',
    ctaText: "Find a Gift",
    occasion: 'secret_santa',
    recipients: ['coworker', 'friend'],
    sampleGifts: [
      { name: 'Wordle Board Game', subtitle: 'Hasbro', price: '$20', tag: 'Crowd pleaser' },
      { name: 'Burt\'s Bees Gift Set', subtitle: 'Tips and Toes Kit', price: '$13', tag: 'Safe bet' },
      { name: 'Uncommon Goods Scratch Map', subtitle: 'World Travel Tracker', price: '$24', tag: 'For the traveler' },
    ],
    faq: [
      { q: 'How do I find a good Secret Santa gift?', a: 'Tell us anything you know — "they drink coffee" or "they\'re into hiking." Even a little goes a long way.' },
      { q: 'Is Giftist free?', a: 'Yes! Free on WhatsApp or web chat.' },
    ],
  },
}

// All slugs that have SEO pages (for sitemap generation)
export const seoSlugs = Object.keys(seoHolidays)

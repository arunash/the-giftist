# The Giftist — Strategy & Planning Document

*Generated February 2026*

---

## Table of Contents
1. [Claude API Cost Estimate](#1-claude-api-cost-estimate)
2. [Growth & Adoption Strategy](#2-growth--adoption-strategy)
3. [Payment Provider Comparison](#3-payment-provider-comparison)
4. [Pricing Strategy](#4-pricing-strategy)
5. [Pending Tasks](#5-pending-tasks)

---

## 1. Claude API Cost Estimate

### Current Anthropic Pricing (per million tokens)

| Model | Input | Output | Best For |
|---|---|---|---|
| Haiku 4.5 | $1.00 | $5.00 | Fast extraction (images, links, voice) |
| Sonnet 4.5 | $3.00 | $15.00 | Chat bot conversations |
| Opus 4.6 | $5.00 | $25.00 | Complex reasoning (not needed here) |

### Prompt Caching (multipliers on base input price)

| Cache Type | Multiplier | Haiku | Sonnet |
|---|---|---|---|
| 5-min cache write | 1.25x | $1.25/MTok | $3.75/MTok |
| Cache read/hit | 0.1x | $0.10/MTok | $0.30/MTok |

### Batch API (50% discount for non-real-time)

| Model | Batch Input | Batch Output |
|---|---|---|
| Haiku 4.5 | $0.50/MTok | $2.50/MTok |
| Sonnet 4.5 | $1.50/MTok | $7.50/MTok |

### Vision / Image Token Costs

Images billed as input tokens: **tokens = (width x height) / 750**

| Image Type | Approx. Tokens | Cost (Haiku) | Cost (Sonnet) |
|---|---|---|---|
| Phone photo (resized) | ~2,459 | $0.0025 | $0.0074 |
| Screenshot | ~1,843 | $0.0018 | $0.0055 |
| Small product image | ~640 | $0.0006 | $0.0019 |

---

### Feature #1: AI Gift Recommendation Chat Bot

**Recommended Model: Claude Sonnet 4.5**

| Parameter | Estimate |
|---|---|
| System prompt | ~800 tokens |
| Avg user message | ~60 tokens |
| Avg assistant response | ~250 tokens |
| Avg turns per session | 6 (3 user + 3 assistant) |
| Sessions per user/month | 3 |
| **Total per session** | **~9,810 input + ~1,500 output tokens** |
| **Cost per session** | **$0.052 (standard) / $0.041 (cached)** |

### Feature #2: Multimodal WhatsApp Processing

**Recommended Model: Claude Haiku 4.5**

| Sub-feature | Cost per unit |
|---|---|
| Image analysis (product photos) | $0.0035/image |
| Voice note (Whisper + Haiku) | $0.0046/note |
| Link extraction | $0.0035/link |
| Per user/month (5 images, 3 voice, 4 links) | ~$0.045 |

### Combined Monthly Cost Summary

| Scale | Chat Bot (Cached) | WhatsApp | **Total** | **Per User** |
|---|---|---|---|---|
| **100 MAU** | $12 | $5 | **~$17/mo** | $0.17 |
| **1,000 MAU** | $123 | $45 | **~$168/mo** | $0.17 |
| **10,000 MAU** | $1,230 | $455 | **~$1,685/mo** | $0.17 |

### Cost Optimization Strategies (~35% savings achievable)

1. **Prompt caching** — cache system prompts across turns (10-20% savings on chat)
2. **Batch API** — 50% discount for WhatsApp processing (not real-time)
3. **Image preprocessing** — resize client-side to ~800x600 before API
4. **Model routing** — Haiku for simple chat turns, Sonnet for creative recs
5. **Conversation summarization** — summarize earlier turns after turn 3
6. **Response length control** — set appropriate max_tokens

| Scale | Standard | Optimized (~35% savings) |
|---|---|---|
| 100 MAU | $17/mo | ~$11/mo |
| 1,000 MAU | $168/mo | ~$110/mo |
| 10,000 MAU | $1,685/mo | ~$1,095/mo |

---

## 2. Growth & Adoption Strategy

### 2.1 Viral Loops

**Loop 1: The Wishlist Share Loop**
```
User creates wishlist --> Shares link on WhatsApp/social
--> Friends click link --> See items, contribute
--> Friends think "I want one too" --> Create own wishlist --> Share...
```

**Loop 2: The WhatsApp Forward Loop**
```
User sees product --> Forwards link/photo to Giftist WhatsApp bot
--> Item added to wishlist --> User shares wishlist
--> Friends see it --> Forward their own items to the bot
```

**Loop 3: The Contribution Notification Loop**
```
Friend contributes to User's item --> User notified ("60% funded!")
--> User shares wishlist to get remaining 40% --> More friends see it
```

**Loop 4: The Event/Occasion Loop**
```
User creates event (birthday) --> Attaches wishlist --> Invites friends
--> Friends RSVP + contribute --> After event: "Your birthday is coming, create your list?"
```

**Loop 5: The Activity Feed Loop**
```
User opens app --> Sees "Jake funded Lisa's Dyson Airwrap"
--> User thinks "I should add that" or "I should fund Jake's item"
```

**Target K-factor**: 0.7-0.8 initially, >1.0 during seasonal peaks.

### 2.2 SEO Content Strategy

**Pillar Pages (Evergreen)**
- "Universal Wishlist App" — targeting Amazon wishlist refugees
- "How Group Gifting Works"
- "Wedding Registry Alternative"
- "Birthday Wishlist Creator"

**Seasonal Landing Pages (build 6-8 weeks before peak)**

| Season | Page | Peak Window |
|--------|------|------------|
| Christmas | Christmas Gift Guide / Wishlist Maker | Oct 15 - Dec 24 |
| Valentine's | Valentine's Gift Ideas | Jan 15 - Feb 13 |
| Mother's Day | Mother's Day Gift Guide | Apr 1 - May 10 |
| Father's Day | Father's Day Gift Ideas | May 15 - Jun 14 |
| Wedding Season | Wedding Gift Registry Alternative | Mar 1 - Aug 31 |
| Graduation | Graduation Gift Ideas & Wishlist | Apr 1 - Jun 15 |

**Blog Content (Weekly)**
- Gift guides: "50 Best Birthday Gift Ideas for Your Best Friend"
- How-to: "How to Create the Perfect Birthday Wishlist"
- Cultural: "The Psychology of Gift Giving"

### 2.3 Social Media Strategy

| Platform | Priority | Content Type | Cadence |
|----------|----------|-------------|---------|
| TikTok + Reels | Tier 1 | POV reactions, tutorials, unboxings | 4-5/week |
| Twitter/X | Tier 2 | Hot takes, polls, threads | 1-2/day |
| Pinterest | Tier 3 | Gift guide pins, wishlist boards | 5-10/week |
| YouTube | Tier 4 | Gift guides, tutorials | 1-2/month |

### 2.4 Influencer Partnerships

**Micro-influencers (1K-50K)**: $50-200/creator, target 20-50 initially
- Lifestyle, couples, wedding planning, college life, parent creators
- Pitch: "Set up your Giftist wishlist, share with followers, earn per referral"

**Mid-tier (50K-500K)**: $500-2K/post, target 5-10
- Tech reviewers, gift guide YouTubers, wedding influencers

**Creator partnerships** (compete with Throne):
- Twitch streamers, YouTubers, newsletter writers
- Pitch: "Unlike Throne, works with ANY store, no markup fees"

### 2.5 Referral Program

**Referrer rewards:**
- 3 referrals → "Giftist Gold" badge
- 5 referrals → AI recommendation credits
- 10 referrals → Monthly $100 gift card drawing

**Referee incentive:**
- "$5 bonus contribution to your first item" on signup

### 2.6 Chrome Web Store Optimization

**Listing**: "The Giftist - Universal Wishlist & Gift Saver"
- Target keywords: "universal wishlist extension", "amazon wishlist alternative"
- 5 optimized screenshots
- Coordinated launch day for install velocity
- Aim 50+ reviews at 4.5+ stars in first 3 months

### 2.7 Seasonal Calendar

```
Jan  |===|     "New Year, New Wishlist"
Feb  |========|  Valentine's Day (MAJOR)
Mar  |====|    Wedding season begins
Apr  |=====|   Mother's Day prep
May  |========|  Mother's Day (MAJOR) + Graduation
Jun  |=======|  Father's Day + Wedding peak
Jul  |===|     Back-to-school prep
Aug  |=====|   College move-in wishlists
Sep  |====|    Fall wedding season
Oct  |=======|  Holiday prep begins (CRITICAL)
Nov  |=============|  Black Friday / Cyber Monday (PEAK)
Dec  |================|  Christmas (MAXIMUM EFFORT)
```

Budget allocation: Q4 50%, Q2 20%, Q1 15%, Q3 15%

### 2.8 Key Metrics

**North Star Metric: "Wishlist Items Funded"** (items receiving at least one contribution per week)

| Category | Metric | Month 6 Target | Month 12 Target |
|----------|--------|----------------|-----------------|
| Acquisition | Weekly new signups | 200 | 1,000 |
| Acquisition | Chrome extension installs | 500 total | 3,000 total |
| Activation | Create wishlist within 24hrs | 60% | 70% |
| Activation | Add 3+ items in first week | 40% | 50% |
| Activation | Share wishlist in first week | 25% | 35% |
| Retention | Day 7 | 20% | 30% |
| Retention | Day 30 | 8% | 15% |
| Virality | K-factor | 0.5 | 0.8 |
| Revenue | Contributions/week | $500 | $5,000 |

**The "Aha Moment"**: User receives their first contribution. Optimize everything to compress signup → first contribution window.

### 2.9 First 1,000 Users Playbook

1. **Users 1-100**: Personal network seeding. Create wishlists, share with friends/family. Seed $5-10 contributions on early wishlists ($200-500 total).
2. **Users 100-500**: Reddit (r/GiftIdeas, r/weddingplanning, r/BabyBumps) + WhatsApp group targeting + Product Hunt launch
3. **Users 500-1,000**: University campus push (3-5 student orgs, Secret Santa events) + SEO content blitz (5 gift guides)

**Estimated budget for first 1,000 users: $2,300-3,500**

### 2.10 Competitive Positioning

| Feature | The Giftist | Amazon | Elfster | Giftful | Throne |
|---------|------------|--------|---------|---------|--------|
| Universal (any store) | Yes | No (since 2023) | Limited | Limited | Partial (fees) |
| Group funding | Yes | No | No | No | Yes |
| WhatsApp integration | Yes | No | No | No | No |
| AI recommendations | Yes | Basic | No | No | No |
| Social activity feed | Yes | No | No | No | No |
| Chrome extension | Yes | Dead | No | No | No |
| Free to use | Yes | Yes | Yes | Yes | Fee on non-partners |

**Positioning**: "The social wishlist platform where friends fund your actual wants." Any store + group funding + WhatsApp-native.

**Key attack vector**: Amazon killed universal wishlists in 2023. The Giftist is the successor, but better.

---

## 3. Payment Provider Comparison

### Recommendation: Stripe (with Wallet Strategy)

Stripe is the clear winner for The Giftist due to Stripe Connect (marketplace splits), Customer Balance API (wallet system), and ACH support (0.8% fees on wallet loads).

### Fee Comparison Table

| Provider | Fee Structure | $10 Effective % | $25 Effective % | Wallet | Marketplace |
|---|---|---|---|---|---|
| **Stripe (ACH)** | 0.8% (cap $5) | **0.8%** | **0.8%** | Yes | Yes (Connect) |
| **Stripe (Card)** | 2.9% + $0.30 | 5.9% | 4.1% | Yes | Yes (Connect) |
| **Stripe (Balance)**** | Internal ledger | **~0%** | **~0%** | Yes | Yes |
| PayPal/Braintree | 2.59% + $0.49 | 7.5% | 4.6% | No | Limited |
| Venmo (Checkout) | 3.49% + $0.49 | 8.4% | 5.5% | No | No |
| Square (Free) | 3.3% + $0.30 | 6.3% | 4.5% | No | No |
| LemonSqueezy | 5% + $0.50 | 10.0% | 7.0% | No | No |
| Paddle | 5% + $0.50 | 10.0% | 7.0% | No | No |
| Razorpay (India) | 2% + GST | ~2.4% | ~2.4% | Yes | Yes |
| Cashfree (India) | 1.90% | ~1.9% | ~1.9% | Yes | Yes |

**** When users pre-load balance via ACH, individual contributions are free internal ledger moves.

### The Wallet Strategy (Key Insight)

The wallet-first approach absorbs the payment fee **once** on a larger load, then all micro-contributions are fee-free internal transfers:

| Scenario | Total Fees | Effective Rate |
|---|---|---|
| 5x $10 card charges | $2.95 | 5.9% per txn |
| 1x $50 ACH load + 5x $10 from balance | $0.40 | **0.8% overall** |
| 1x $50 card load + 5x $10 from balance | $1.75 | **3.5% overall** |

This is the same model used by Venmo, Cash App, and Steam Wallet.

### Architecture

1. **Stripe Connect (Custom Accounts)** — marketplace layer for splits and payouts
2. **Stripe Customer Balance** — wallet system (users load $25-50, contribute fee-free from balance)
3. **ACH Direct Debit** — wallet loading at 0.8% (encourage over card)
4. **Venmo as secondary** — via Braintree SDK for brand familiarity
5. **Apple Pay / Google Pay** — via Stripe for mobile
6. **Stripe Link** — 1-tap payments for returning users

### Why NOT Others

- **PayPal/Venmo**: $0.49 fixed fee destroys micro-transactions (13.2% on a $5 contribution). No wallet API for your platform.
- **Square**: No marketplace/multi-party payments. No wallet system.
- **LemonSqueezy/Paddle**: 10% on $10 transactions. Built for SaaS, not social payments.
- **Razorpay/Cashfree**: India-only. Relevant for future expansion, not US launch.

---

## 4. Pricing Strategy

### Unit Economics

| Cost Component | Per User / Month |
|---|---|
| Claude AI (chat + WhatsApp) | $0.17 |
| Stripe fees (wallet-optimized) | ~$0.10-0.30 |
| Infrastructure (hosting, DB) | ~$0.05-0.10 |
| **Total cost per active user** | **~$0.32-0.57** |

### Revenue Model: Freemium + Transaction Fee

**Free Tier (drive adoption):**
- Unlimited wishlist items
- Basic AI chat (5 sessions/month)
- WhatsApp item adding (text links only)
- Share wishlist
- Receive contributions

**Premium / "Giftist Pro" ($4.99/month or $39.99/year):**
- Unlimited AI chat with advanced recommendations
- Multimodal WhatsApp (photos, voice notes → items)
- Price drop alerts
- Priority item fulfillment tracking
- Custom wishlist themes/branding
- Advanced analytics (who viewed your list)

**Transaction Revenue:**
- **2-3% platform fee on contributions** — When friends fund wishlist items, The Giftist takes a small cut on top of Stripe's processing fee. At $25 avg contribution, this is $0.50-0.75 per transaction.
- This is how Throne, GoFundMe, and similar platforms monetize.
- First $50 in contributions are fee-free (onboarding incentive)

**Affiliate Revenue:**
- When users click through to buy items from their wishlist, use affiliate links (Amazon Associates 1-4%, other retailer programs)
- This is invisible to users and adds incremental revenue
- At scale, affiliate revenue can be significant on high-value items

### Revenue Projections

| Scale | Premium Subs (10%) | Transaction Fees (3%) | Affiliate Rev | **Monthly Revenue** | AI + Infra Costs | **Net** |
|---|---|---|---|---|---|---|
| 100 MAU | $50 | $75 | $20 | **$145** | $57 | **$88** |
| 1,000 MAU | $500 | $750 | $200 | **$1,450** | $570 | **$880** |
| 10,000 MAU | $5,000 | $7,500 | $2,000 | **$14,500** | $5,700 | **$8,800** |

Assumptions: 10% premium conversion, $25 avg contribution, 3 contributions per user/month, 1% affiliate click-through.

### Pricing Philosophy
- **Free tier must be genuinely useful** — don't paywall the core loop (add items → share → get funded)
- **Premium unlocks AI power** — the expensive features (multimodal, unlimited chat) behind paywall
- **Transaction fees are the long-term play** — as volume grows, 2-3% on all contributions scales massively
- **Never charge the contributor** — fees come from the wishlist owner's side to avoid friction on the giving side

---

## 5. Backlog (Pending Tasks)

### High Priority — Core Features
| # | Task | Notes |
|---|------|-------|
| 10 | Connect chat to real AI bot | Wire /chat to Claude Sonnet 4.5 API |
| 18 | Move AI chat to homepage (Gemini search style) | Search-first UX for product discovery on /feed |
| 12 | Enable WhatsApp sharing via real phone number | Core viral loop — WhatsApp Business API setup |
| 13 | Enable multimodal AI for WhatsApp inputs | Photos, voice notes → item extraction via Haiku 4.5 |
| 19 | Set up Stripe wallet | Stripe Connect + Customer Balance + ACH (researched, ready to implement) |

### Medium Priority — Growth & Polish
| # | Task | Notes |
|---|------|-------|
| 16 | Enable SEO | Meta tags, OG, structured data, sitemap, robots.txt |
| 11 | Add demographic info to profile/settings | Age, interests, budget for personalization |
| 15 | Design WhatsApp thumbnail logo | Square logo for WhatsApp Business profile pic |

### Completed Research
| # | Task | Output |
|---|------|--------|
| 14 | Claude API cost estimate | ~$0.17/user/month — see Section 1 |
| 17 | Growth & adoption strategy | See Section 2 |
| 19 | Payment provider comparison | Stripe wins — see Section 3 |
| 20 | Pricing strategy | Freemium + 2-3% txn fee — see Section 4 |

---

## Sources

- [Anthropic Official Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Amazon Wishlist Alternatives - Jake Lee](https://jakelee.co.uk/amazon-wishlist-alternatives/)
- [Throne Creator Wishlist - TechCrunch](https://techcrunch.com/2024/03/08/creator-wishlist-startup-throne-is-doing-so-well-that-it-returned-investor-money/)
- [Digital Wedding Registry Market](https://www.openpr.com/news/4192605/digital-wedding-registry-market-is-booming-worldwide-major)
- [How the biggest consumer apps got first 1000 users - Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-the-biggest-consumer-apps-got)
- [North Star Metrics Guide - Reforge](https://www.reforge.com/blog/north-star-metrics)
- [App Retention Benchmarks 2026](https://enable3.io/blog/app-retention-benchmarks-2025)
- [Chrome Web Store Ranking 2025 - ExtensionFast](https://www.extensionfast.com/blog/chrome-web-store-ranking-algorithm-how-extensions-get-ranked-in-2025)
- [Best Wishlist Sites 2025 - Listful](https://www.listful.com/blog/best-wishlist-sites-2025)
- [Best Universal Wishlist Apps - GiftList](https://giftlist.com/blog/10-best-universal-wishlist-apps-in-2025-ranked-and-reviewed)

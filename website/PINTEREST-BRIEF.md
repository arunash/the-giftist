# Pinterest Ads — Mother's Day campaign brief

Plug-and-play setup for launching Giftist on Pinterest Ads, mirroring the Meta strategy (curated catalog + Mother's Day urgency + WhatsApp/retailer dual conversion path).

## TL;DR

- **Why Pinterest**: Mother's Day search volume is ~3× higher than Meta's MD interest reach; 60/40 female; gift inspiration is a core use case. CPC typically $0.50–1.50 vs Meta's current $0.32.
- **Budget to test**: $20–30/day across 1 campaign × 3 ad variants for 7 days = ~$140–210.
- **Landing**: same as Meta — `/shop?occasion=mothers-day&recipient=mom&utm_source=pinterest&utm_medium=paid_social&utm_campaign=<variant>`. The shop page already pre-filters for MD and tracks UTMs in the funnel admin.

---

## Step 1 — Account setup (5 min, free)

1. Create a **Pinterest Business account** at https://business.pinterest.com/ (or convert your personal account).
2. Verify your domain `giftist.ai` — Pinterest Settings → Claim → enter the domain → install the meta tag in `app/layout.tsx` head (Pinterest will give you a `<meta name="p:domain_verify" content="...">` tag).
3. Open **Ads Manager**: https://ads.pinterest.com/

## Step 2 — Install the Pinterest Tag (5 min)

The Pinterest Tag is their tracking pixel. Install it once and you can attribute funnel events to Pinterest clicks the same way you do for Meta.

1. In Ads Manager → **Conversions → Pinterest tag → Create tag** → copy the tag ID.
2. Add to `app/layout.tsx` (or any client-only loaded component):
   ```html
   <script>
     !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
     pintrk('load', 'YOUR_TAG_ID_HERE');
     pintrk('page');
   </script>
   ```
3. Set up **Conversion Events** in Pinterest Ads Manager:
   - `pagevisit` — fired on every `/shop` load (already happens via PageView)
   - `lead` — fire on `WA_INTENT` (add `pintrk('track', 'lead')` to the WA CTAs)
   - `checkout` — fire on `RETAILER_CLICK` (add to the retailer CTA)
   - I can add these tracking calls to the existing CTAs once you give me the tag ID.

## Step 3 — Campaign structure

**Objective**: Conversions (Pinterest's "Consideration → Conversions"). Optimizes for clicks that lead to `pagevisit`.

**Audience for all 3 variants**:
- **Geo**: US
- **Gender**: Women
- **Age**: 30–55
- **Languages**: English
- **Interests**: Mother's Day, Gifts, Gift Ideas, Holiday Gifts, Wellness Gifts (search interest names in Pinterest's library — exact IDs vary)
- **Keywords** (this is Pinterest's secret weapon — keywords matter more than interests):
  - "mothers day gifts"
  - "gifts for mom"
  - "mothers day gift ideas"
  - "thoughtful mothers day gift"
  - "mothers day gift basket"
  - "mom gifts unique"
  - "mothers day gifts under 50"
- **Budget**: $7–10/day per variant ($21–30/day total)
- **Schedule**: Start now, end May 9 (2 days before MD — gives time for last-minute purchases to ship)

## Step 4 — Creative variants

Pinterest pin specs: **1000×1500 px** (2:3 ratio), JPEG/PNG. Mobile-first — 80% of Pinterest is mobile.

### Variant A — "Curated by experts" (mirror of Meta V1)
- **Image**: `https://giftist.ai/gift-perfume.jpg` (Le Labo perfume + box, looks luxury)
- **Title** (max 100 char): "700+ hand-picked Mother's Day gifts she'll actually love"
- **Description** (max 500 char): "Curated by Wirecutter, The Strategist & Oprah's editors. Free to browse. No filler, no generic candles. Order by May 8 to ship in time."
- **Destination URL**: `https://giftist.ai/shop?occasion=mothers-day&recipient=mom&utm_source=pinterest&utm_medium=paid_social&utm_campaign=md-curation-pin`

### Variant B — "Premium / elevated" (mirror of Meta V3 — your top performer)
- **Image**: `https://giftist.ai/gift-hoops.png` (gold hoops, jewelry vibe)
- **Title**: "Mother's Day, elevated — beyond chocolates and flowers"
- **Description**: "Curated by Wirecutter, The Strategist & Oprah's editors. 700+ vetted picks. Order by May 8 to ship."
- **Destination URL**: `https://giftist.ai/shop?occasion=mothers-day&recipient=mom&utm_source=pinterest&utm_medium=paid_social&utm_campaign=md-premium-pin`

### Variant C — "Sentimental" (mirror of new Meta V6)
- **Image**: `https://giftist.ai/gift-cream.jpg` (cream — self-care vibe)
- **Title**: "More than flowers. The Mother's Day gift she'll remember."
- **Description**: "700+ thoughtful gifts vetted by experts. Pick something she'd never buy herself. Ships in time for May 11."
- **Destination URL**: `https://giftist.ai/shop?occasion=mothers-day&recipient=mom&utm_source=pinterest&utm_medium=paid_social&utm_campaign=md-sentimental-pin`

## Step 5 — Watch the funnel

Once Pinterest starts driving traffic:
- `/admin` → Funnel tab → "Shop → WhatsApp Funnel"
- Each Pinterest variant shows up as a separate row in the **By UTM Campaign** table (`md-curation-pin`, `md-premium-pin`, `md-sentimental-pin`)
- Watch for the same metrics as Meta: shop sessions → CARD_CLICK → /p/SLUG views → WA_INTENT + RETAILER_CLICK
- If Pinterest CPC is < Meta CPC AND conversion rates are similar, scale Pinterest aggressively before Mother's Day.

## Step 6 — Budget rules

- **Day 1–2**: Let Pinterest's algorithm learn. Don't change anything.
- **Day 3**: Pause any variant with CTR < 0.30% (Pinterest CTR baseline is lower than Meta, ~0.20–0.50% is normal).
- **Day 4+**: 2× budget on the best variant if its CPC is < $1.00.
- **Hard cap**: $30/day total across all variants until you see verified retailer-click revenue (check Amazon Associates dashboard 24–48h after Pinterest spend).

## Step 7 — When you're ready

Send me the **Pinterest Tag ID** and I'll wire `pintrk('track', 'lead')` and `pintrk('track', 'checkout')` into the WA + retailer CTAs so we get end-to-end Pinterest attribution. Without it Pinterest will optimize on `pagevisit` only, which is fine but less precise.

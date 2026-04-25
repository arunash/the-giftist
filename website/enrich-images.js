/**
 * Image enrichment for TastemakerGift via Bing Image Search.
 *
 * For each approved product without a good image:
 *   1. If product has a real product-page URL → try og:image scrape (fast, exact match)
 *   2. Else / if scrape failed → Bing image search → take first result with valid image
 *
 * Generic share images and within-run dupes are rejected.
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "6", 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "12000", 10);
const FORCE_REFRESH = process.env.FORCE_REFRESH === "1";

const BAD_IMAGE_PATTERNS = [
  'images/frame/logo.png',
  'placeholder', 'no-image', 'default-image', '/default.',
  'favicon', '/logo.', '_logo.', 'og-image-default',
  'hm-share-image', 'down_for_maintenance', 'courtesypageimages',
  'share-default', 'social-share-default', 'og_image_default',
  'open-graph-default', 'social-image-default',
  '/share-image.', 'share_image.', 'social_image.',
  'brandsyoulove',
];

function isBadImage(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  if (url.length < 20) return true;
  return BAD_IMAGE_PATTERNS.some(b => lower.includes(b));
}

const CATEGORY_PATH_HINTS = [
  '/en_us/kids', '/en_us/men', '/en_us/women', '/en_us/home',
  '/en_us/sale', '/en_us/baby',
  '/c/', '/category/', '/categories/', '/collections/all',
  '/shop-all', '/all-products',
];

function isProductPageUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.pathname.length < 4) return false;
    if (u.pathname === '/s' || u.pathname.startsWith('/s/') || u.pathname === '/search') return false;
    const lower = u.pathname.toLowerCase();
    if (CATEGORY_PATH_HINTS.some(h => lower.includes(h))) {
      if (!/\/products?\/[a-z0-9-]+/i.test(u.pathname)) return false;
    }
    if (u.hostname.includes('hm.com') && !/productpage\.[^.]+\.html/i.test(u.pathname)) return false;
    if (u.hostname.includes('amazon.') && !/\/(dp|gp\/product)\//i.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function headOk(url) {
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    // Some servers don't allow HEAD; fall back to ranged GET
    if (!res.ok) {
      res = await fetch(url, {
        method: 'GET',
        headers: { "User-Agent": UA, Range: "bytes=0-1023" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
    }
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    return ct.startsWith('image/') || ct === '';
  } catch {
    return false;
  }
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/');
}

function extractImageFromHtml(html, url) {
  let img = null;

  const ogMatch = html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch && ogMatch[1] && !isBadImage(ogMatch[1])) img = ogMatch[1];

  if (!img) {
    const twMatch = html.match(/<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twMatch && twMatch[1] && !isBadImage(twMatch[1])) img = twMatch[1];
  }

  if (!img) {
    const ldMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of ldMatches) {
      try {
        const ld = JSON.parse(m[1]);
        const candidates = Array.isArray(ld) ? ld : [ld];
        for (const c of candidates) {
          const product = c['@type'] === 'Product' ? c
            : (c['@graph'] || []).find(g => g && (g['@type'] === 'Product' || (Array.isArray(g['@type']) && g['@type'].includes('Product'))));
          if (product && product.image) {
            const ldImg = Array.isArray(product.image) ? product.image[0] : product.image;
            const imgUrl = typeof ldImg === 'string' ? ldImg : ldImg?.url;
            if (imgUrl && !isBadImage(imgUrl)) { img = imgUrl; break; }
          }
        }
        if (img) break;
      } catch {}
    }
  }

  if (!img && (url.includes('amazon.') || url.includes('amzn.to'))) {
    const azMatch = html.match(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/[^"]+)"/i)
      || html.match(/"large":"(https:\/\/m\.media-amazon\.com\/images\/[^"]+)"/i)
      || html.match(/data-old-hires=["'](https:\/\/m\.media-amazon\.com\/images\/[^"']+)["']/i);
    if (azMatch && azMatch[1]) img = azMatch[1];
  }

  if (img) {
    img = decodeHtml(img);
    if (img.startsWith("//")) img = "https:" + img;
    else if (img.startsWith("/")) {
      try { img = new URL(url).origin + img; } catch {}
    }
    img = img.replace(/^http:\/\//, 'https://');
  }

  return img;
}

async function tryScrapeProductPage(url) {
  if (!isProductPageUrl(url)) return null;
  const html = await fetchHtml(url);
  if (!html) return null;
  const img = extractImageFromHtml(html, url);
  return img && !isBadImage(img) ? img : null;
}

async function bingImageSearch(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const items = [];
    const re = /m=["']({[^"']+})["']/g;
    let m;
    while ((m = re.exec(html)) !== null && items.length < 12) {
      try {
        const decoded = m[1]
          .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
        const j = JSON.parse(decoded);
        if (j.murl) {
          items.push({ murl: j.murl, turl: j.turl, purl: j.purl });
        }
      } catch {}
    }
    return items;
  } catch {
    return [];
  }
}

function preferredImageFromBingResult(item) {
  // Prefer the original image URL on the source. Bing CDN (turl) is fallback.
  const candidates = [item.murl, item.turl].filter(Boolean);
  for (const c of candidates) {
    if (!isBadImage(c)) return c;
  }
  return null;
}

async function discoverImageViaBing(name) {
  const cleanName = name.replace(/[\(\)\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const items = await bingImageSearch(cleanName);
  for (const item of items) {
    const img = preferredImageFromBingResult(item);
    if (!img) continue;
    if (await headOk(img)) {
      return { image: img, sourceUrl: item.purl };
    }
  }
  return null;
}

async function processOne(product, seenImages) {
  if (!FORCE_REFRESH && product.image && !isBadImage(product.image)) {
    return { name: product.name, status: "skip" };
  }

  let img = null;
  let usedUrl = product.url;

  // 1. Scrape the existing URL if it looks like a product page
  if (product.url && isProductPageUrl(product.url)) {
    img = await tryScrapeProductPage(product.url);
  }

  // 2. Fallback: Bing image search
  let bingPurl = null;
  if (!img) {
    const found = await discoverImageViaBing(product.name);
    if (found) {
      img = found.image;
      bingPurl = found.sourceUrl;
    }
  }

  if (!img || isBadImage(img)) return { name: product.name, status: "no_image" };

  // Normalize for dedupe (strip query string)
  const dedupKey = img.split('?')[0];
  if (seenImages.has(dedupKey)) return { name: product.name, status: "dupe_image", image: img };
  seenImages.add(dedupKey);

  const updateData = { image: img, lastScrapedAt: new Date() };
  if (!product.url && bingPurl) {
    updateData.url = bingPurl;
    try { updateData.domain = new URL(bingPurl).hostname; } catch {}
  }
  await p.tastemakerGift.update({
    where: { id: product.id },
    data: updateData,
  });
  return { name: product.name, status: "ok", image: img };
}

async function runBatch(items, fn, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (e) {
        results[idx] = { name: items[idx].name, status: "error", error: String(e) };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

(async () => {
  const cleared = await p.tastemakerGift.updateMany({
    where: {
      reviewStatus: "approved",
      OR: BAD_IMAGE_PATTERNS.map(b => ({ image: { contains: b } })),
    },
    data: { image: null },
  });
  if (cleared.count > 0) console.log(`Cleared ${cleared.count} known-bad images\n`);

  const existing = await p.tastemakerGift.findMany({
    where: { reviewStatus: "approved", image: { not: null }, NOT: { image: "" } },
    select: { image: true },
  });
  const seenImages = new Set(existing.map(e => e.image.split('?')[0]));

  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
  const products = await p.tastemakerGift.findMany({
    where: {
      reviewStatus: "approved",
      OR: [{ image: null }, { image: "" }],
    },
    orderBy: { totalScore: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Enriching ${products.length} products with concurrency=${CONCURRENCY}...\n`);

  let done = 0;
  const wrap = async (prod) => {
    const r = await processOne(prod, seenImages);
    done++;
    if (r.status === "ok") {
      console.log(`[${done}/${products.length}] + ${r.name.substring(0, 55)}`);
    } else if (r.status === "dupe_image") {
      console.log(`[${done}/${products.length}] = ${r.name.substring(0, 55)} (dupe)`);
    } else if (done % 20 === 0) {
      console.log(`[${done}/${products.length}] ...`);
    }
    return r;
  };

  const results = await runBatch(products, wrap, CONCURRENCY);

  const tally = {};
  for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
  console.log("\nResults:", tally);

  const total = await p.tastemakerGift.count({ where: { reviewStatus: "approved" } });
  const withImage = await p.tastemakerGift.count({
    where: { reviewStatus: "approved", image: { not: null }, NOT: { image: "" } }
  });
  console.log(`Coverage: ${withImage}/${total} (${Math.round(withImage/total*100)}%)`);

  await p.$disconnect();
})();

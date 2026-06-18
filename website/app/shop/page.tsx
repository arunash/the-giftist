import { ShopHero } from "./shop-hero";
import { CountdownStrip } from "./countdown-strip";
import { ShopPageViewTracker } from "./page-view-tracker";
import { ShowcaseLayout } from "./showcase-layout";
import { PersonaNav, personaEmoji } from "./persona-nav";
import { prisma } from "@/lib/db";
import { createTrackedLink } from "@/lib/product-link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Curated Gifts | Giftist",
  description:
    "Browse 573 curated gifts hand-picked by an AI concierge — find perfect picks for Father's Day, birthdays, anniversaries.",
};

// Server-render on every request — searchParams (variant / layout) drives content.
export const dynamic = "force-dynamic";

interface ShopPageProps {
  searchParams: {
    variant?: string;
    occasion?: string;
    utm_campaign?: string;
    name?: string;
    redeemed?: string;
    layout?: string;
    category?: string;
    price?: string;
    segment?: string;
  };
}

type Variant = "default" | "fathers-day" | "redeemed";
type Layout = "grid" | "carousel" | "story";

function pickVariant(sp: ShopPageProps["searchParams"]): Variant {
  // Accept variant=, occasion=, OR utm_campaign starting with "fd-" so any of
  // these URLs resolve to the FD experience:
  //   /shop?variant=fathers-day
  //   /shop?occasion=fathers-day
  //   /shop?utm_campaign=fd-magic (ad-driven)
  if (
    sp.variant === "fathers-day" ||
    sp.occasion === "fathers-day" ||
    (sp.utm_campaign || "").startsWith("fd-")
  ) {
    return "fathers-day";
  }
  if (sp.variant === "redeemed" || sp.redeemed === "1") return "redeemed";
  return "default";
}

function pickLayout(sp: ShopPageProps["searchParams"]): Layout {
  if (sp.layout === "carousel") return "carousel";
  if (sp.layout === "story") return "story";
  return "grid";
}

async function fetchGifts(variant: Variant, limit = 60) {
  const where: any = { reviewStatus: "approved" };
  if (variant === "fathers-day") {
    // FD-relevant: tagged for fathers-day occasion OR for dad/father recipient.
    where.OR = [
      { occasions: { has: "fathers-day" } },
      { recipientTypes: { has: "dad" } },
      { recipientTypes: { has: "father" } },
    ];
  }
  const rows = await prisma.tastemakerGift.findMany({
    where,
    orderBy: [{ totalScore: "desc" }, { trustScore: "desc" }],
    take: limit * 2, // pull extra so the Amazon-first re-rank below has headroom
  });

  // Amazon-first ranking — affiliate commission is fastest + most reliable
  // through Associates. Push amazon.com URLs to the top, preserve relative
  // order within each bucket.
  const amazon: typeof rows = [];
  const other: typeof rows = [];
  for (const r of rows) {
    const isAmazon = r.url?.toLowerCase().includes("amazon.com") ?? false;
    (isAmazon ? amazon : other).push(r);
  }
  const ranked = [...amazon, ...other].slice(0, limit);
  const rowsRanked = ranked;

  // Attach tracked-link slug so each card routes through /go-r/<slug> for
  // attribution. createTrackedLink upserts a ProductClick row + returns slug.
  const enriched = await Promise.all(
    rowsRanked.map(async (r) => {
      let slug: string | undefined;
      try {
        // createTrackedLink returns a full URL "https://giftist.ai/p/<slug>"
        // — pull just the slug out for /go-r/<slug> routing.
        const trackedUrl = await createTrackedLink({
          productName: r.name,
          targetUrl: r.url ?? "",
          price: r.price ?? null,
          priceValue: r.priceValue ?? null,
          image: r.image ?? null,
        });
        slug = trackedUrl.split("/p/")[1];
      } catch {
        // bad URL or dedup race — fall back to raw target
        slug = undefined;
      }
      return {
        id: r.id,
        name: r.name,
        price: r.price,
        priceValue: r.priceValue,
        image: r.image,
        url: r.url,
        domain: r.domain,
        why: r.why,
        totalScore: r.totalScore,
        signalCount: 0,
        sources: {},
        recipientTypes: r.recipientTypes,
        occasions: r.occasions,
        interests: r.interests,
        priceRange: r.priceRange,
        trackedSlug: slug,
      };
    })
  );
  return enriched;
}

// Pull the top-clicked products in the last 7 days, joined back to the
// approved catalog so the cards have full metadata. Used for the
// "Most clicked this week" strip above the catalog.
async function fetchTopClickedProducts(variant: Variant, limit = 8) {
  type Row = {
    id: string;
    name: string;
    price: string | null;
    priceValue: number | null;
    image: string | null;
    url: string | null;
    domain: string | null;
    why: string | null;
    recipientTypes: string[];
    occasions: string[];
    interests: string[];
    priceRange: string;
    totalScore: number;
    clicks: number;
  };
  // For FD variant, prefer FD-relevant products; otherwise show whatever
  // is converting catalog-wide.
  const fdFilter =
    variant === "fathers-day"
      ? `AND (
          'fathers-day' = ANY(tg.occasions) OR
          'dad' = ANY(tg."recipientTypes") OR
          'father' = ANY(tg."recipientTypes")
        )`
      : "";
  // Image-host allowlist: only retailer CDNs we know render reliably.
  // Bing image-search thumbnails (mm.bing.net) hot-link-protect and 403.
  // Random retailer-blog hosts are unreliable. This keeps the "Most clicked"
  // strip looking clean.
  const RELIABLE_HOSTS = [
    'm.media-amazon.com',
    'images-amazon.com',
    'images-na.ssl-images-amazon.com',
    'i.etsystatic.com',
    'images.uncommongoods.com',
    'image.hm.com',
    'image-cdn.hm.com',
    'i5.walmartimages.com',
    'pisces.bbystatic.com',
    'n.nordstrommedia.com',
    'target.scene7.com',
    'cdn.shopify.com',
    'pictures.abebooks.com',
    'images.bookshop.org',
  ];
  const hostFilter = RELIABLE_HOSTS.map(h => `tg.image LIKE 'https://${h}/%' OR tg.image LIKE 'http://${h}/%'`).join(' OR ');

  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT tg.id, tg.name, tg.price, tg."priceValue", tg.image, tg.url, tg.domain,
           tg.why, tg."recipientTypes", tg.occasions, tg.interests, tg."priceRange",
           tg."totalScore",
           COALESCE(SUM(ce_count.c), 0)::int AS clicks
    FROM "TastemakerGift" tg
    JOIN "ProductClick" pc ON pc."productName" = tg.name
    JOIN LATERAL (
      SELECT COUNT(*)::int AS c
      FROM "ClickEvent" ce
      WHERE ce.slug = pc.slug
        AND ce."createdAt" >= NOW() - INTERVAL '7 days'
        AND ce.event = 'RETAILER_CLICK'
    ) ce_count ON TRUE
    WHERE tg."reviewStatus" = 'approved'
      AND tg.image IS NOT NULL
      AND tg.url IS NOT NULL
      AND (${hostFilter})
      ${fdFilter}
    GROUP BY tg.id
    HAVING COALESCE(SUM(ce_count.c), 0) > 0
    ORDER BY clicks DESC, tg."totalScore" DESC NULLS LAST
    LIMIT ${limit}
  `);

  const enriched = await Promise.all(
    rows.map(async (r) => {
      let slug: string | undefined;
      try {
        const trackedUrl = await createTrackedLink({
          productName: r.name,
          targetUrl: r.url ?? "",
          price: r.price ?? null,
          priceValue: r.priceValue ?? null,
          image: r.image ?? null,
        });
        slug = trackedUrl.split("/p/")[1];
      } catch {
        slug = undefined;
      }
      return {
        id: r.id,
        name: r.name,
        price: r.price,
        priceValue: r.priceValue,
        image: r.image,
        url: r.url,
        domain: r.domain,
        why: r.why,
        totalScore: r.totalScore,
        signalCount: 0,
        sources: {},
        recipientTypes: r.recipientTypes,
        occasions: r.occasions,
        interests: r.interests,
        priceRange: r.priceRange,
        trackedSlug: slug,
        clicks: r.clicks,
      };
    })
  );
  return enriched;
}

// Shared enrichment: attach a tracked-link slug to each raw gift row so cards
// route through /go-r/<slug> for attribution. Used by every fetcher below.
async function enrichRows(rows: any[]) {
  return Promise.all(
    rows.map(async (r) => {
      let slug: string | undefined;
      try {
        const trackedUrl = await createTrackedLink({
          productName: r.name,
          targetUrl: r.url ?? "",
          price: r.price ?? null,
          priceValue: r.priceValue ?? null,
          image: r.image ?? null,
        });
        slug = trackedUrl.split("/p/")[1];
      } catch {
        slug = undefined;
      }
      return {
        id: r.id,
        name: r.name,
        price: r.price,
        priceValue: r.priceValue,
        image: r.image,
        url: r.url,
        domain: r.domain,
        why: r.why,
        totalScore: r.totalScore,
        signalCount: 0,
        sources: {},
        recipientTypes: r.recipientTypes,
        occasions: r.occasions,
        interests: r.interests,
        priceRange: r.priceRange,
        trackedSlug: slug,
      };
    })
  );
}

export interface SegmentShelf {
  slug: string;
  title: string;
  persona: string | null;
  priceBand: string | null;
  gifts: Awaited<ReturnType<typeof enrichRows>>;
}

// Mosaic: the catalog organized BY audience persona. Pulls the top-priority
// approved segments and each one's rank-ordered gifts (SegmentProduct is the
// source of truth for per-persona ordering). Returns one shelf per persona.
async function fetchSegmentShelves(segLimit = 50, perSegment = 12): Promise<SegmentShelf[]> {
  type ShelfRow = {
    seg_slug: string; seg_title: string; seg_persona: string | null;
    seg_price: string | null;
    id: string; name: string; price: string | null; priceValue: number | null;
    image: string | null; url: string | null; domain: string | null; why: string | null;
    recipientTypes: string[]; occasions: string[]; interests: string[];
    priceRange: string; totalScore: number; rank: number | null;
  };
  const rows = await prisma.$queryRawUnsafe<ShelfRow[]>(`
    WITH seg AS (
      SELECT id, slug, title, persona, "priceBand", priority
      FROM "Segment"
      WHERE status = 'approved'
      ORDER BY priority DESC, title
      LIMIT ${segLimit}
    )
    SELECT s.slug AS seg_slug, s.title AS seg_title, s.persona AS seg_persona,
           s."priceBand" AS seg_price,
           tg.id, tg.name, tg.price, tg."priceValue", tg.image, tg.url, tg.domain,
           tg.why, tg."recipientTypes", tg.occasions, tg.interests, tg."priceRange",
           tg."totalScore", sp.rank
    FROM seg s
    JOIN "SegmentProduct" sp ON sp."segmentId" = s.id
    JOIN "TastemakerGift" tg ON tg.id = sp."giftId"
    WHERE tg."reviewStatus" = 'approved'
    ORDER BY s.priority DESC, s.title, sp.rank ASC NULLS LAST
  `);

  // Group by segment, preserving the priority/rank order from SQL.
  const order: string[] = [];
  const bySlug = new Map<string, { meta: ShelfRow; rows: ShelfRow[] }>();
  for (const r of rows) {
    let bucket = bySlug.get(r.seg_slug);
    if (!bucket) {
      bucket = { meta: r, rows: [] };
      bySlug.set(r.seg_slug, bucket);
      order.push(r.seg_slug);
    }
    if (bucket.rows.length < perSegment) bucket.rows.push(r);
  }

  const shelves: SegmentShelf[] = [];
  for (const slug of order) {
    const b = bySlug.get(slug)!;
    const gifts = await enrichRows(b.rows);
    // Only show a shelf with enough fillable cards so the carousel reads well.
    if (gifts.length >= 4) {
      shelves.push({
        slug,
        title: b.meta.seg_title,
        persona: b.meta.seg_persona,
        priceBand: b.meta.seg_price,
        gifts,
      });
    }
  }
  return shelves;
}

// Focus view for /shop?segment=<slug> — one persona's full ranked set.
async function fetchSingleSegment(slug: string): Promise<SegmentShelf | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT s.title AS seg_title, s.persona AS seg_persona, s."priceBand" AS seg_price,
           tg.id, tg.name, tg.price, tg."priceValue", tg.image, tg.url, tg.domain,
           tg.why, tg."recipientTypes", tg.occasions, tg.interests, tg."priceRange",
           tg."totalScore", sp.rank
    FROM "Segment" s
    JOIN "SegmentProduct" sp ON sp."segmentId" = s.id
    JOIN "TastemakerGift" tg ON tg.id = sp."giftId"
    WHERE s.slug = $1 AND s.status = 'approved' AND tg."reviewStatus" = 'approved'
    ORDER BY sp.rank ASC NULLS LAST
  `,
    slug
  );
  if (!rows.length) return null;
  const gifts = await enrichRows(rows);
  if (!gifts.length) return null;
  return {
    slug,
    title: rows[0].seg_title,
    persona: rows[0].seg_persona,
    priceBand: rows[0].seg_price,
    gifts,
  };
}

const PRICE_BAND_LABEL: Record<string, string> = {
  budget: "Budget-friendly",
  mid: "Mid-range",
  premium: "Premium",
  luxury: "Luxury",
};

function PriceBandChip({ band }: { band: string | null }) {
  if (!band) return null;
  const label = PRICE_BAND_LABEL[band] ?? band;
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {label}
    </span>
  );
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const variant = pickVariant(searchParams);
  const layout = pickLayout(searchParams);
  const recipientName = searchParams.name;
  const segmentSlug = (searchParams.segment || "").trim();

  // Focus view: a single persona's full ranked set.
  if (segmentSlug) {
    const shelf = await fetchSingleSegment(segmentSlug);
    if (shelf) {
      return (
        <main>
          <ShopPageViewTracker path={`/shop?segment=${shelf.slug}`} />
          <ShopHero variant="default" recipientName={recipientName} />
          <section className="max-w-6xl mx-auto px-4 py-10">
            <a href="/shop" className="text-sm text-gray-500 hover:text-gray-800">
              ← All personas
            </a>
            <div className="mt-3 mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <span aria-hidden>{personaEmoji(shelf.slug, shelf.title)}</span>
                <span>Gifts for {shelf.title}</span>
              </h2>
              <PriceBandChip band={shelf.priceBand} />
            </div>
            {shelf.persona && (
              <p className="text-gray-500 mb-8 max-w-2xl">{shelf.persona}</p>
            )}
            <ShowcaseLayout layout={layout} gifts={shelf.gifts as any} />
          </section>
        </main>
      );
    }
    // Unknown/empty segment → fall through to the default catalog.
  }

  // Mosaic persona shelves drive the default catalog; FD variant keeps its
  // dedicated dad-focused grid. topClicked stays as social proof up top.
  const [gifts, topClicked, shelves] = await Promise.all([
    fetchGifts(variant),
    fetchTopClickedProducts(variant, 8),
    variant === "default" ? fetchSegmentShelves() : Promise.resolve([] as SegmentShelf[]),
  ]);

  return (
    <main>
      {/* PageView attribution — fires once per session, persists utm_* */}
      <ShopPageViewTracker
        path={
          variant === "fathers-day"
            ? "/shop?variant=fathers-day"
            : variant === "redeemed"
            ? "/shop?variant=redeemed"
            : "/shop"
        }
      />

      {/* Father's Day countdown banner — auto-hides after June 21 */}
      <CountdownStrip href="/shop?variant=fathers-day" />

      {/* Hero — affiliate-first by default, WA secondary */}
      <ShopHero variant={variant} recipientName={recipientName} />

      {/* Mosaic persona quick-nav — the primary affordance: jump straight to
          the segment you're shopping for. Only rendered for the persona-shelf
          (default) view; FD keeps its single dad-focused grid. */}
      {variant === "default" && shelves.length > 0 && (
        <PersonaNav
          personas={shelves.map((s) => ({
            slug: s.slug,
            title: s.title,
            priceBand: s.priceBand,
          }))}
        />
      )}

      {/* Most clicked this week — data-driven social proof. Server-rendered
          from real ClickEvent counts joined to the approved catalog. Only
          renders when there are at least 4 products with traffic this week. */}
      {topClicked.length >= 4 && (
        <section className="max-w-6xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              🔥 Most clicked this week
            </h2>
            <span className="text-xs text-gray-400">based on real Giftist traffic</span>
          </div>
          <ShowcaseLayout layout="carousel" gifts={topClicked as any} />
        </section>
      )}

      {/* Catalog — Mosaic persona shelves for the default view, flat ranked
          grid for FD (or as a fallback when no segments are populated). */}
      {variant === "default" && shelves.length > 0 ? (
        <section id="catalog" className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Shop by who you&apos;re shopping for
          </h2>
          <p className="text-gray-500 mb-10">
            Our AI concierge keeps a fresh, ranked gift set for every kind of
            person. Find your match below — or tap a persona to see the full list.
          </p>
          <div className="space-y-12">
            {shelves.map((shelf) => (
              <div key={shelf.slug} id={`seg-${shelf.slug}`} className="scroll-mt-6">
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                        <span aria-hidden>{personaEmoji(shelf.slug, shelf.title)}</span>
                        <span>{shelf.title}</span>
                      </h3>
                      <PriceBandChip band={shelf.priceBand} />
                    </div>
                    {shelf.persona && (
                      <p className="text-sm text-gray-500 mt-1 max-w-2xl line-clamp-2">
                        {shelf.persona}
                      </p>
                    )}
                  </div>
                  <a
                    href={`/shop?segment=${shelf.slug}`}
                    className="shrink-0 text-sm font-medium text-rose-600 hover:text-rose-700 whitespace-nowrap"
                  >
                    See all →
                  </a>
                </div>
                <ShowcaseLayout layout="carousel" gifts={shelf.gifts as any} />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section id="catalog" className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {variant === "fathers-day"
              ? `${gifts.length} Father's Day gifts, ranked`
              : "Curated gift catalog"}
          </h2>
          <p className="text-gray-500 mb-8">
            Hand-picked by our AI concierge. Click any card to see the gift and outbound to the retailer.
          </p>
          <ShowcaseLayout layout={layout} gifts={gifts as any} />
        </section>
      )}
    </main>
  );
}

import { ShopHero } from "./shop-hero";
import { CountdownStrip } from "./countdown-strip";
import TopPicksStrip from "./TopPicksStrip";
import { ShopPageViewTracker } from "./page-view-tracker";
import { ShowcaseLayout } from "./showcase-layout";
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

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const variant = pickVariant(searchParams);
  const layout = pickLayout(searchParams);
  const recipientName = searchParams.name;

  const [gifts, topClicked] = await Promise.all([
    fetchGifts(variant),
    fetchTopClickedProducts(variant, 8),
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

      {/* Curated top picks above the fold — biggest click driver per the data */}
      <TopPicksStrip />

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
          <ShowcaseLayout layout="grid" gifts={topClicked as any} />
        </section>
      )}

      {/* Catalog */}
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
    </main>
  );
}

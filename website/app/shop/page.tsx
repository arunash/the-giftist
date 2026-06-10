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
  if (sp.variant === "fathers-day") return "fathers-day";
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
    take: limit,
  });

  // Attach tracked-link slug so each card routes through /go-r/<slug> for
  // attribution. createTrackedLink upserts a ProductClick row + returns slug.
  const enriched = await Promise.all(
    rows.map(async (r) => {
      let slug: string | undefined;
      try {
        slug = await createTrackedLink({
          productName: r.name,
          targetUrl: r.url ?? "",
          price: r.price ?? null,
          priceValue: r.priceValue ?? null,
          image: r.image ?? null,
        });
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

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const variant = pickVariant(searchParams);
  const layout = pickLayout(searchParams);
  const recipientName = searchParams.name;

  const gifts = await fetchGifts(variant);

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

      {/* Catalog — the actual 573-product grid that has been orphaned. */}
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

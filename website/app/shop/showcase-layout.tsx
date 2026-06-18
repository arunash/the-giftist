"use client";

import { GiftGrid, type GiftProduct } from "./gift-grid";
import { trackClick, buildRetailerHref } from "@/lib/track-click";
import Image from "next/image";
import Link from "next/link";

/**
 * Showcase layout toggle. URL: /shop?layout=grid|carousel|story
 *
 * - grid     (default) — current GiftGrid with category + price filters
 * - carousel          — horizontal scrolling tiles, image-dominant
 * - story             — vertical IG-story style cards, full-width image + price + CTA
 *
 * Every card emits a CARD_CLICK with `layout=<variant>` attribution so the
 * loop can A/B-test which format converts best to RETAILER_CLICK.
 */
export function ShowcaseLayout({
  layout,
  gifts,
}: {
  layout: "grid" | "carousel" | "story";
  gifts: GiftProduct[];
}) {
  if (layout === "carousel") return <CarouselLayout gifts={gifts} />;
  if (layout === "story") return <StoryLayout gifts={gifts} />;
  return <GiftGrid gifts={gifts} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Carousel layout — horizontal scroll, image-dominant tiles
// ─────────────────────────────────────────────────────────────────────────────
function CarouselLayout({ gifts }: { gifts: GiftProduct[] }) {
  return (
    <div className="relative">
      <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-4 -mx-4 px-4">
        {gifts.map((g) => (
          <CarouselCard key={g.id} gift={g} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Scroll → for more · Layout: carousel · <Link href="/shop?layout=grid" className="underline">try grid</Link> · <Link href="/shop?layout=story" className="underline">try story</Link>
      </p>
    </div>
  );
}

function CarouselCard({ gift }: { gift: GiftProduct }) {
  const slug = gift.trackedSlug;
  const href = slug ? buildRetailerHref(slug) : gift.url ?? "#";
  const onGetIt = () => {
    if (slug) trackClick(slug, "CARD_CLICK", "WEB");
    fireGtag("CARD_CLICK", { layout: "carousel", slug, name: gift.name });
  };
  const onSend = () => fireGtag("SEND_INTENT", { layout: "carousel", slug, name: gift.name });
  return (
    <div className="relative snap-start shrink-0 w-[240px] sm:w-[280px] rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onGetIt} data-cta="card-carousel" className="block">
        <div className="relative w-full aspect-square bg-gray-50">
          {gift.image ? (
            <Image
              src={gift.image}
              alt={gift.name}
              fill
              sizes="280px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              no image
            </div>
          )}
        </div>
      </a>
      <div className="p-3 flex-1 flex flex-col justify-between">
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={onGetIt} className="block">
          <p className="text-sm font-medium text-gray-900 line-clamp-2">{gift.name}</p>
          {gift.price && (
            <p className="text-lg font-bold text-gray-900 mt-1">{gift.price}</p>
          )}
        </a>
        {/* Dual CTA: "Send a gift" → /p/SLUG (send via Giftist); "Get it" →
            retailer redirect (RETAILER_CLICK, the affiliate goal). */}
        <div className="mt-3 flex flex-col gap-2">
          {slug && (
            <Link
              href={`/p/${slug}`}
              onClick={onSend}
              data-cta="card-carousel-send"
              className="w-full text-center rounded-full border border-green-600 text-green-700 text-sm font-semibold py-2 hover:bg-green-50 transition"
            >
              Send a gift
            </Link>
          )}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onGetIt}
            data-cta="card-carousel-get"
            className="w-full text-center rounded-full bg-green-500 text-white text-sm font-semibold py-2 hover:bg-green-600 transition"
          >
            Get it →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Story layout — full-width IG-style cards, scroll vertically
// ─────────────────────────────────────────────────────────────────────────────
function StoryLayout({ gifts }: { gifts: GiftProduct[] }) {
  return (
    <div className="max-w-md mx-auto space-y-6">
      {gifts.slice(0, 20).map((g) => (
        <StoryCard key={g.id} gift={g} />
      ))}
      <p className="text-xs text-gray-400 text-center">
        Layout: story (top 20) · <Link href="/shop?layout=grid" className="underline">try grid</Link> · <Link href="/shop?layout=carousel" className="underline">try carousel</Link>
      </p>
    </div>
  );
}

function StoryCard({ gift }: { gift: GiftProduct }) {
  const slug = gift.trackedSlug;
  const href = slug ? buildRetailerHref(slug) : gift.url ?? "#";
  const onGetIt = () => {
    if (slug) trackClick(slug, "CARD_CLICK", "WEB");
    fireGtag("CARD_CLICK", { layout: "story", slug, name: gift.name });
  };
  const onSend = () => fireGtag("SEND_INTENT", { layout: "story", slug, name: gift.name });
  return (
    <article className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onGetIt} data-cta="card-story" className="block">
        <div className="relative w-full aspect-[4/5] bg-gray-50">
          {gift.image ? (
            <Image
              src={gift.image}
              alt={gift.name}
              fill
              sizes="(max-width: 768px) 100vw, 28rem"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              no image
            </div>
          )}
          {gift.price && (
            <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/95 backdrop-blur text-sm font-bold shadow">
              {gift.price}
            </span>
          )}
        </div>
      </a>
      <div className="p-5">
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={onGetIt} className="block">
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{gift.name}</h3>
          {gift.why && <p className="mt-1 text-sm text-gray-600 line-clamp-3">{gift.why}</p>}
        </a>
        {/* Dual CTA: "Send a gift" → /p/SLUG (send via Giftist); "Get it now" →
            retailer redirect (RETAILER_CLICK, the affiliate goal). */}
        <div className="mt-4 flex items-center gap-2">
          {slug && (
            <Link
              href={`/p/${slug}`}
              onClick={onSend}
              data-cta="card-story-send"
              className="flex-1 inline-flex items-center justify-center rounded-full border border-green-600 text-green-700 text-base font-semibold py-3 hover:bg-green-50 transition"
            >
              Send a gift
            </Link>
          )}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onGetIt}
            data-cta="card-story-get"
            className="flex-1 inline-flex items-center justify-center rounded-full bg-green-500 text-white text-base font-semibold py-3 hover:bg-green-600 transition"
          >
            Get it now →
          </a>
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function fireGtag(event: string, params: Record<string, any>) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.gtag === "function") {
    w.gtag("event", event, params);
  }
}

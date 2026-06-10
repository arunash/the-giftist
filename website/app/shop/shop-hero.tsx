"use client";

// HERO — affiliate-first (pivot 2026-06-10). WhatsApp paths removed at founder
// directive: "forget WhatsApp for the time being, lets just focus on getting
// affiliate clicks via the landing page". Single CTA: scroll to catalog.

interface ShopHeroProps {
  variant?: "default" | "fathers-day" | "redeemed";
  recipientName?: string;
}

export function ShopHero({
  variant = "default",
  recipientName,
}: ShopHeroProps) {
  if (variant === "redeemed") {
    return (
      <section className="relative flex flex-col items-center justify-center text-center px-4 py-14 bg-emerald-50">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 mb-3">
          Gift received 🎁
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 max-w-2xl leading-tight mb-3">
          {recipientName ? `${recipientName} loved it!` : "Your gift was a hit."}
        </h1>
        <p className="text-base text-gray-600 max-w-xl mb-6">
          Want to find another thoughtful gift? Browse our top picks below.
        </p>
        <a
          href="#catalog"
          data-cta="hero-browse-redeemed"
          onClick={() => fireGtag("hero_browse_click", { label: "hero-browse-redeemed" })}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-lg shadow-lg bg-emerald-600 hover:bg-emerald-700 transition"
        >
          Browse top gifts ↓
        </a>
      </section>
    );
  }

  if (variant === "fathers-day") {
    return (
      <section className="relative flex flex-col items-center justify-center text-center px-4 py-16 bg-gradient-to-b from-amber-50 to-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-700 mb-3">
          🎩 Father&apos;s Day · Sunday June 21
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 max-w-3xl leading-tight mb-4">
          Top gifts for dads, ranked.{" "}
          <span className="text-amber-600">All in one place.</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mb-6">
          Hand-picked by our AI concierge. Click any card to see it on the
          retailer&apos;s site — no signup, no quiz, no app.
        </p>
        <a
          href="#catalog"
          data-cta="hero-browse-fd"
          onClick={() => fireGtag("hero_browse_click", { label: "hero-browse-fd" })}
          className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-white font-semibold text-lg shadow-lg bg-amber-600 hover:bg-amber-700 transition"
        >
          Browse top gifts ↓
        </a>
        <p className="text-xs text-gray-500 mt-4">
          Order by June 17 to arrive by Father&apos;s Day
        </p>
      </section>
    );
  }

  // Default — affiliate-first
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-4 py-16 bg-white">
      <p className="text-sm font-semibold uppercase tracking-widest text-green-600 mb-3">
        573 curated gifts, ranked by an AI concierge
      </p>
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 max-w-3xl leading-tight mb-4">
        Find the perfect gift —{" "}
        <span className="text-green-500">in under a minute.</span>
      </h1>
      <p className="text-lg text-gray-600 max-w-xl mb-6">
        Hand-picked across Amazon, SpaFinder, and 50+ other retailers. Tap any
        card to see price and buy.
      </p>
      <a
        href="#catalog"
        data-cta="hero-browse"
        onClick={() => fireGtag("hero_browse_click", { label: "hero-browse" })}
        className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-white font-semibold text-lg shadow-lg bg-green-500 hover:bg-green-600 transition"
      >
        Browse top picks ↓
      </a>
    </section>
  );
}

export default ShopHero;

function fireGtag(event: string, params: Record<string, any>) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.gtag === "function") {
    w.gtag("event", event, { event_category: "cta", ...params });
  }
}

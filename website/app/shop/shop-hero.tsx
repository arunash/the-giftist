"use client";

interface ShopHeroProps {
  variant?: "default" | "fathers-day" | "redeemed";
  recipientName?: string;
}

export function ShopHero({
  variant = "default",
  recipientName,
}: ShopHeroProps) {
  // Redeem / post-redemption flow
  if (variant === "redeemed") {
    return (
      <section className="relative flex flex-col items-center justify-center text-center px-4 py-16 bg-green-50">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-600 mb-3">
          Gift received 🎁
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 max-w-2xl leading-tight mb-4">
          {recipientName ? `${recipientName} loved it!` : "Your gift was a hit!"}
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-8">
          Want to find more thoughtful gifts? Giftist is your free AI gift concierge on WhatsApp.
        </p>
        <a
          href="https://wa.me/15014438478?text=Hi!%20I%27m%20looking%20for%20a%20gift%20for%20someone%20special."
          data-cta="hero-wa-redeemed"
          onClick={() => {
            if (typeof window !== "undefined" && (window as any).gtag) {
              (window as any).gtag("event", "hero_wa_click", {
                event_category: "cta",
                event_label: "hero-wa-redeemed",
              });
            }
          }}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-lg shadow-lg hover:opacity-90 transition"
          style={{ backgroundColor: "#25D366" }}
        >
          <WhatsAppIcon />
          Text me now — it&apos;s free
        </a>
      </section>
    );
  }

  // Father's Day variant
  if (variant === "fathers-day") {
    return (
      <section className="relative flex flex-col items-center justify-center text-center px-4 py-20 bg-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-600 mb-3">
          Father&apos;s Day is June 21 — don&apos;t wing it
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 max-w-2xl leading-tight mb-4">
          Tell me about your dad —{" "}
          <span className="text-green-500">
            I&apos;ll text you 3 perfect gifts in 60 seconds.
          </span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-4">
          Free AI gift concierge on WhatsApp. No app. No account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <a
            href="https://wa.me/15014438478?text=Hi!%20I%27m%20shopping%20for%20a%20Father%27s%20Day%20gift%20for%20my%20dad."
            data-cta="hero-wa-fd"
            onClick={() => {
              if (typeof window !== "undefined" && (window as any).gtag) {
                (window as any).gtag("event", "hero_wa_click", {
                  event_category: "cta",
                  event_label: "hero-wa-fd",
                });
              }
            }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-lg shadow-lg hover:opacity-90 transition"
            style={{ backgroundColor: "#25D366" }}
          >
            <WhatsAppIcon />
            Text me now — it&apos;s free
          </a>
          <a
            href="/quiz"
            data-cta="hero-quiz-fd"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-gray-200 text-gray-700 font-semibold text-lg hover:border-green-400 hover:bg-green-50 transition"
          >
            Take the 30-second quiz →
          </a>
        </div>
        <a
          href="#catalog"
          className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          Browse 171 Father&apos;s Day gifts ↓
        </a>
      </section>
    );
  }

  // Default (evergreen) — WhatsApp-first
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-4 py-20 bg-white">
      <p className="text-sm font-semibold uppercase tracking-widest text-green-600 mb-3">
        AI gift concierge · free · on WhatsApp
      </p>
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 max-w-2xl leading-tight mb-4">
        Tell me who you&apos;re shopping for —{" "}
        <span className="text-green-500">
          I&apos;ll text you 3 picks in 60 seconds.
        </span>
      </h1>
      <p className="text-lg text-gray-500 max-w-xl mb-8">
        Free AI gift concierge on WhatsApp. No app download. No account.
      </p>
      <a
        href="https://wa.me/15014438478?text=Hi!%20I%27m%20shopping%20for%20someone%20special."
        data-cta="hero-wa"
        onClick={() => {
          if (typeof window !== "undefined" && (window as any).gtag) {
            (window as any).gtag("event", "hero_wa_click", {
              event_category: "cta",
              event_label: "hero-wa",
            });
          }
        }}
        className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-lg shadow-lg hover:opacity-90 transition"
        style={{ backgroundColor: "#25D366" }}
      >
        <WhatsAppIcon />
        Text me now — it&apos;s free
      </a>
      <a
        href="#catalog"
        className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
      >
        Browse 573 curated gifts ↓
      </a>
    </section>
  );
}

export default ShopHero;

function WhatsAppIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 6L0 24l6.18-1.6A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.22-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.24-1.44l-.37-.22-3.67.95.97-3.57-.24-.38A9.93 9.93 0 0 1 2 12C2 6.48 6.48 2 12 2c2.66 0 5.16 1.04 7.04 2.93A9.9 9.9 0 0 1 22 12c0 5.52-4.48 10-10 10zm5.47-7.47c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51H7.5c-.17 0-.45.06-.69.32-.23.25-.9.88-.9 2.14s.92 2.48 1.05 2.65c.13.17 1.82 2.78 4.41 3.9.62.27 1.1.43 1.47.55.62.2 1.18.17 1.63.1.5-.07 1.53-.63 1.75-1.23.22-.6.22-1.12.15-1.23-.07-.1-.27-.17-.57-.32z" />
    </svg>
  );
}

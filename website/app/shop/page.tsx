import { ShopHero } from "./shop-hero";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Curated Gifts | Giftist",
  description: "Browse 573 curated gifts — or text the AI concierge on WhatsApp for personalised picks in 60 seconds.",
};

interface ShopPageProps {
  searchParams: {
    variant?: string;
    name?: string;
    redeemed?: string;
  };
}

export default function ShopPage({ searchParams }: ShopPageProps) {
  // Determine hero variant from URL params.
  // ?variant=fathers-day  → FD hero
  // ?variant=redeemed OR ?redeemed=1 → post-redemption hero
  // (default) → evergreen WA-first hero
  let variant: "default" | "fathers-day" | "redeemed" = "default";
  if (searchParams.variant === "fathers-day") {
    variant = "fathers-day";
  } else if (
    searchParams.variant === "redeemed" ||
    searchParams.redeemed === "1"
  ) {
    variant = "redeemed";
  }

  const recipientName = searchParams.name;

  return (
    <main>
      <ShopHero variant={variant} recipientName={recipientName} />
      {/* Catalog section rendered below hero — existing content preserved */}
    </main>
  );
}

// Mosaic persona quick-nav — a horizontal pill bar that mirrors the catalog's
// audience segments. Each pill anchor-jumps to that persona's shelf (#seg-<slug>)
// so the whole "shop by who you're shopping for" structure is reachable in one
// tap from the top of the page. Server-rendered; no client JS needed.

// Keyword → emoji. Matched against "<slug> <title>" so it also resolves for
// segments added later without a code change. First match wins; order matters
// (e.g. "dad" → camping before a generic fallback).
const EMOJI_RULES: [RegExp, string][] = [
  [/home-?cook|foodie|chef/, "🍳"],
  [/wine|cocktail|bartender|mixolog/, "🍷"],
  [/coffee|tea|barista|espresso/, "☕"],
  [/cozy|homebody|hygge/, "🛋️"],
  [/plant|garden/, "🪴"],
  [/wellness|self-?care|spa/, "🧖"],
  [/sympathy|thinking|grief|condolence|bereav/, "🤍"],
  [/newlywed|engaged|wedding|bride|groom/, "💍"],
  [/travel|jetset|wanderlust/, "✈️"],
  [/grad|student|college|alumni/, "🎓"],
  [/grandparent|grandma|grandpa|grandm|grandd/, "👵"],
  [/homeowner|housewarming/, "🏡"],
  [/fitness|gym|runner|athlete|workout/, "💪"],
  [/gamer|gaming/, "🎮"],
  [/book|reader|bookworm|reading/, "📚"],
  [/outdoor|camp|hik|dad/, "🏕️"],
  [/coworker|secret-?santa|office/, "🎁"],
  [/tech|gadget|geek/, "💻"],
  [/beauty|skincare|makeup/, "✨"],
  [/has-?everything|luxur|splurge/, "🎩"],
  [/new-?parent|baby|newborn|nursery/, "👶"],
  [/pet|dog|cat|puppy/, "🐾"],
  [/teen|kid|child/, "🧸"],
  [/music|musician|vinyl/, "🎵"],
  [/art|creative|maker|craft/, "🎨"],
];

export function personaEmoji(slug: string, title: string): string {
  const hay = `${slug} ${title}`.toLowerCase();
  for (const [re, e] of EMOJI_RULES) if (re.test(hay)) return e;
  return "🎁";
}

// Drop the leading "The " so pills read tight: "The Home Cook" → "Home Cook".
export function shortPersona(title: string): string {
  return title.replace(/^the\s+/i, "");
}

export interface PersonaNavItem {
  slug: string;
  title: string;
  priceBand: string | null;
}

export function PersonaNav({ personas }: { personas: PersonaNavItem[] }) {
  if (!personas.length) return null;
  return (
    <nav
      aria-label="Shop by persona"
      className="border-y border-gray-100 bg-white"
    >
      <div className="max-w-6xl mx-auto px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
          Shop by who you&apos;re shopping for
        </p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mb-1">
          {personas.map((p) => (
            <a
              key={p.slug}
              href={`#seg-${p.slug}`}
              className="group flex-shrink-0 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              <span className="text-base leading-none">
                {personaEmoji(p.slug, p.title)}
              </span>
              <span className="whitespace-nowrap">{shortPersona(p.title)}</span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

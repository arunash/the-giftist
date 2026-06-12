"use client";

import { useState } from "react";

const STEPS = [
  { id: "age",    question: "How old is he?",                options: ["Under 40", "40–55", "56–65", "65+"] },
  { id: "vibe",   question: "What's his vibe?",              options: ["Outdoorsy", "Tech lover", "Foodie", "Homebody"] },
  { id: "hobby",  question: "His favourite way to unwind?",  options: ["Sports / fitness", "Cooking / grilling", "Music / movies", "Reading / relaxing"] },
  { id: "budget", question: "What's your budget?",           options: ["Under $50", "$50–$100", "$100–$200", "$200+"] },
];

interface Pick {
  id: string;
  name: string;
  price: string | null;
  image: string | null;
  domain: string | null;
  why: string | null;
  trackedSlug?: string;
  isAmazon: boolean;
}

function fireGtag(event: string, params: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.gtag === "function") {
    w.gtag("event", event, { event_category: "quiz", ...params });
  }
}

export default function FathersDayQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function pick(option: string) {
    const next = [...answers, option];
    setAnswers(next);
    if (next.length >= STEPS.length) {
      setLoading(true);
      fireGtag("quiz_complete", { label: "fathers-day" });
      try {
        const res = await fetch("/api/quiz", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            age: next[0], vibe: next[1], hobby: next[2], budget: next[3],
          }),
        });
        const j = await res.json();
        setPicks(j.picks || []);
      } catch {
        setPicks([]);
      } finally {
        setLoading(false);
      }
    } else {
      setStep(step + 1);
    }
  }

  // ── Results screen ──
  if (picks) {
    return (
      <div className="min-h-screen bg-white px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-700 mb-2">
            🎩 Father&apos;s Day &middot; June 21
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {picks.length} picks matched for him
          </h1>
          <p className="text-gray-500 mb-8">
            Hand-curated from our catalog. Tap any card to see it on the retailer&apos;s site.
          </p>

          {picks.length === 0 ? (
            <p className="text-gray-500">
              No matches found.{" "}
              <a href="/shop?variant=fathers-day" className="text-amber-600 font-semibold underline">
                Browse all Father&apos;s Day picks →
              </a>
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {picks.map((p, i) => {
                const href = p.trackedSlug ? `/go-r/${p.trackedSlug}` : "#";
                return (
                  <a
                    key={p.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    onClick={() => fireGtag("quiz_pick_click", { slug: p.trackedSlug, name: p.name, rank: i + 1 })}
                    className="group block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition"
                  >
                    <div className="aspect-square bg-gray-50 overflow-hidden">
                      {p.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate">
                          {p.domain?.replace("www.", "") || "Shop"}
                        </p>
                        {p.price && (
                          <p className="text-[11px] font-bold text-gray-900">{p.price}</p>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5 line-clamp-2">
                        {p.name}
                      </p>
                      {p.why && (
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-snug">
                          {p.why}
                        </p>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          <div className="mt-10 text-center">
            <a
              href="/shop?variant=fathers-day"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold shadow bg-amber-600 hover:bg-amber-700 transition"
            >
              Browse all Father&apos;s Day picks →
            </a>
            <p className="text-xs text-gray-400 mt-3">
              Order by June 17 to arrive by Father&apos;s Day
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading after final answer ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <div className="animate-spin h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-500">Finding the perfect picks…</p>
      </div>
    );
  }

  // ── Quiz steps ──
  const current = STEPS[step];
  const progress = Math.round((step / STEPS.length) * 100);
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-700 mb-6">
        Father&apos;s Day Gift Finder
      </p>
      <div className="w-full max-w-md">
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-8">
          <div
            className="bg-amber-500 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Question {step + 1} of {STEPS.length}
        </p>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{current.question}</h2>
        <div className="flex flex-col gap-3">
          {current.options.map((opt) => (
            <button
              key={opt}
              onClick={() => pick(opt)}
              className="w-full text-left px-5 py-4 rounded-2xl border border-gray-200 text-gray-800 font-medium hover:border-amber-400 hover:bg-amber-50 transition"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

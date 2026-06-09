"use client";
import { useState } from "react";

const WA_NUMBER = "15014438478";

const STEPS = [
  {
    id: "age",
    question: "How old is he?",
    options: ["Under 40", "40–55", "56–65", "65+"],
  },
  {
    id: "vibe",
    question: "What's his vibe?",
    options: ["Outdoorsy", "Tech lover", "Foodie", "Homebody"],
  },
  {
    id: "hobby",
    question: "His favourite way to unwind?",
    options: ["Sports / fitness", "Cooking / grilling", "Music / movies", "Reading / relaxing"],
  },
  {
    id: "budget",
    question: "What's your budget?",
    options: ["Under $50", "$50–$100", "$100–$200", "$200+"],
  },
];

const PICKS = [
  {
    name: "Theragun Mini",
    price: "$199",
    why: "Compact recovery tool — perfect for active dads.",
    img: "https://m.media-amazon.com/images/I/61Q5TlJiB9L._AC_SX679_.jpg",
    aff: "https://amzn.to/theragun-mini",
  },
  {
    name: "Ember Mug 2",
    price: "$99",
    why: "Coffee stays at his perfect temperature. All morning.",
    img: "https://m.media-amazon.com/images/I/51v8nyMg9tL._AC_SX679_.jpg",
    aff: "https://amzn.to/ember-mug2",
  },
  {
    name: "YETI Rambler 30oz",
    price: "$38",
    why: "Cold beer at the grill, hot coffee on the go — he'll use it daily.",
    img: "https://m.media-amazon.com/images/I/81YFhj7a3mL._AC_SX679_.jpg",
    aff: "https://amzn.to/yeti-rambler",
  },
];

export default function FathersDayQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  function pick(option: string) {
    const next = [...answers, option];
    setAnswers(next);
    if (step + 1 >= STEPS.length) {
      setDone(true);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "quiz_complete", {
          event_category: "quiz",
          event_label: "fathers-day",
        });
      }
    } else {
      setStep(step + 1);
    }
  }

  const waText = encodeURIComponent(
    `Hi! I just took the Giftist quiz — I'm shopping for a ${
      answers[0] ?? ""
    } dad who is ${
      answers[1] ?? ""
    } and loves ${
      answers[2] ?? ""
    }. Budget: ${
      answers[3] ?? ""
    }. Can you help me find the perfect Father's Day gift?`
  );
  const waHref = `https://wa.me/${WA_NUMBER}?text=${waText}`;

  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-600 mb-2">
          Father&apos;s Day &middot; June 21
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
          Your top 3 picks 🎁
        </h1>
        <p className="text-gray-500 mb-10 text-center">
          Based on your answers — curated by Giftist AI.
        </p>
        <div className="grid gap-6 w-full max-w-xl">
          {PICKS.map((p) => (
            <div
              key={p.name}
              className="flex gap-4 border rounded-2xl p-4 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.img}
                alt={p.name}
                className="w-20 h-20 object-contain rounded-lg flex-shrink-0"
              />
              <div className="flex flex-col justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-green-600 font-bold">{p.price}</p>
                  <p className="text-sm text-gray-500 mt-1">{p.why}</p>
                </div>
                <a
                  href={p.aff}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs text-blue-500 hover:underline"
                >
                  View on Amazon &rarr;
                </a>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-gray-600 text-sm">
            Want a personalised pick just for him?
          </p>
          <a
            href={waHref}
            data-cta="quiz-wa"
            onClick={() => {
              if (typeof window !== "undefined" && (window as any).gtag) {
                (window as any).gtag("event", "quiz_wa_click", {
                  event_category: "cta",
                  event_label: "quiz-wa",
                });
              }
            }}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white font-semibold text-base shadow hover:opacity-90 transition"
            style={{ backgroundColor: "#25D366" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 6L0 24l6.18-1.6A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.22-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.24-1.44l-.37-.22-3.67.95.97-3.57-.24-.38A9.93 9.93 0 0 1 2 12C2 6.48 6.48 2 12 2c2.66 0 5.16 1.04 7.04 2.93A9.9 9.9 0 0 1 22 12c0 5.52-4.48 10-10 10zm5.47-7.47c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51H7.5c-.17 0-.45.06-.69.32-.23.25-.9.88-.9 2.14s.92 2.48 1.05 2.65c.13.17 1.82 2.78 4.41 3.9.62.27 1.1.43 1.47.55.62.2 1.18.17 1.63.1.5-.07 1.53-.63 1.75-1.23.22-.6.22-1.12.15-1.23-.07-.1-.27-.17-.57-.32z" />
            </svg>
            Text me a custom pick — free
          </a>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-green-600 mb-6">
        Father&apos;s Day Gift Finder
      </p>
      <div className="w-full max-w-md">
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-8">
          <div
            className="bg-green-400 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Question {step + 1} of {STEPS.length}
        </p>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {current.question}
        </h2>
        <div className="flex flex-col gap-3">
          {current.options.map((opt) => (
            <button
              key={opt}
              onClick={() => pick(opt)}
              className="w-full text-left px-5 py-4 rounded-2xl border border-gray-200 text-gray-800 font-medium hover:border-green-400 hover:bg-green-50 transition"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

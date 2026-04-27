// Channel-agnostic gift-quiz state machine.
//
// Mirrors the /magic 4-question flow but delivered as messages with buttons.
// Used by both the WhatsApp webhook (lib/whatsapp.ts list messages) and the
// web chat ([QUIZ] block parser).
//
// Flow:
//   step 0 — pick recipient (mom / dad / partner / friend / sibling / self)
//   step 1 — pick the thing they love most (12 interests)
//   step 2 — pick budget tier (4 ranges)
//   step 3 — done; reveal 3 hand-picked products via /api/magic/picks
//
// Persistence: QuizSession row keyed by phone. Whenever a quiz is in
// flight (no completedAt), the WA handler routes button replies through
// here instead of through the regular Claude chat.

import { prisma } from './db'

export const QUIZ_TRIGGERS = [
  'quiz', '/quiz', '/gift', 'gift finder', 'find a gift',
  'find me a gift', 'help me find a gift', '🎁',
  'start quiz', 'gift quiz',
]

export interface QuizOption {
  id: string         // unique per channel — used as button payload
  title: string      // shown to user (max 24 chars for WA list rows)
  description?: string  // optional secondary text
  value: string      // canonical value stored in QuizSession
}

export interface QuizPrompt {
  body: string
  buttonText: string  // text on the "open list" button (WA)
  options: QuizOption[]
  /** Used as the WA list section title */
  sectionTitle: string
}

export const RELATIONSHIPS: QuizOption[] = [
  { id: 'q_rel_mom',      title: '🌸 Mom',         value: 'mom' },
  { id: 'q_rel_dad',      title: '🪴 Dad',         value: 'dad' },
  { id: 'q_rel_partner',  title: '💞 Partner',      value: 'partner' },
  { id: 'q_rel_friend',   title: '🤝 Friend',       value: 'friend' },
  { id: 'q_rel_sibling',  title: '🎈 Sibling',      value: 'sibling' },
  { id: 'q_rel_self',     title: '✨ Myself',       value: 'self' },
]

export const INTERESTS: QuizOption[] = [
  { id: 'q_int_reading',  title: '📚 Reading',  value: 'reading' },
  { id: 'q_int_home',     title: '🏠 Home',     value: 'home' },
  { id: 'q_int_cooking',  title: '🍳 Cooking',  value: 'cooking' },
  { id: 'q_int_beauty',   title: '✨ Beauty',   value: 'beauty' },
  { id: 'q_int_fashion',  title: '👗 Fashion',  value: 'fashion' },
  { id: 'q_int_tech',     title: '💻 Tech',     value: 'tech' },
  { id: 'q_int_wellness', title: '🧘 Wellness', value: 'wellness' },
  { id: 'q_int_fitness',  title: '💪 Fitness',  value: 'fitness' },
  { id: 'q_int_travel',   title: '✈️ Travel',   value: 'travel' },
  { id: 'q_int_outdoor',  title: '🏕️ Outdoors', value: 'outdoor' },
]

export const BUDGETS: QuizOption[] = [
  { id: 'q_bud_budget',  title: 'Under $30',   description: 'Thoughtful',  value: 'budget' },
  { id: 'q_bud_mid',     title: '$30 — $75',   description: 'Sweet spot',  value: 'mid' },
  { id: 'q_bud_premium', title: '$75 — $150',  description: 'Special',     value: 'premium' },
  { id: 'q_bud_luxury',  title: '$150+',       description: 'Big moment',  value: 'luxury' },
]

const RELATIONSHIP_LABEL: Record<string, string> = {
  mom: 'Mom', dad: 'Dad', partner: 'your partner', friend: 'your friend',
  sibling: 'your sibling', self: 'yourself',
}

export function buildPrompt(step: number, sess: { recipientName?: string | null; relationship?: string | null }): QuizPrompt | null {
  const them = sess.recipientName?.trim() || (sess.relationship ? RELATIONSHIP_LABEL[sess.relationship] : null) || 'them'
  switch (step) {
    case 0:
      return {
        body: "Let's find them something perfect 🎁\n\nWho are you shopping for?",
        buttonText: 'Pick recipient',
        sectionTitle: 'Who is it for?',
        options: RELATIONSHIPS,
      }
    case 1:
      return {
        body: `What does ${them} love most? Pick the closest match.`,
        buttonText: 'Pick interest',
        sectionTitle: 'They love…',
        options: INTERESTS,
      }
    case 2:
      return {
        body: `Your budget for ${them}?`,
        buttonText: 'Pick budget',
        sectionTitle: 'Budget',
        options: BUDGETS,
      }
    default:
      return null
  }
}

/** Match a button/list-reply ID back to its quiz field + value, or null if it isn't a quiz reply. */
export function parseQuizReplyId(id: string): { field: 'relationship' | 'interest' | 'budget'; value: string } | null {
  const all = [
    ...RELATIONSHIPS.map(o => ({ ...o, field: 'relationship' as const })),
    ...INTERESTS.map(o => ({ ...o, field: 'interest' as const })),
    ...BUDGETS.map(o => ({ ...o, field: 'budget' as const })),
  ]
  const m = all.find(o => o.id === id)
  return m ? { field: m.field, value: m.value } : null
}

/** Start (or restart) a quiz for a phone. Returns the freshly-created session. */
export async function startQuiz(phone: string, channel: 'whatsapp' | 'web' = 'whatsapp') {
  // Nuke any in-flight session for this phone — restarts cleanly
  await prisma.quizSession.deleteMany({ where: { phone, completedAt: null } })
  return prisma.quizSession.create({
    data: { phone, channel, step: 0 },
  })
}

/** Get the user's active quiz session, if any. */
export async function getActiveQuiz(phone: string) {
  return prisma.quizSession.findFirst({
    where: { phone, completedAt: null },
    orderBy: { startedAt: 'desc' },
  })
}

/** Apply an answer + advance the session. Returns the updated session. */
export async function recordAnswer(
  sessionId: string,
  field: 'relationship' | 'interest' | 'budget',
  value: string,
) {
  const updates: any = {}
  if (field === 'relationship') {
    updates.relationship = value
    updates.step = 1
  } else if (field === 'interest') {
    updates.interests = [value]
    updates.step = 2
  } else if (field === 'budget') {
    updates.priceTier = value
    updates.step = 3
    updates.completedAt = new Date()
  }
  return prisma.quizSession.update({ where: { id: sessionId }, data: updates })
}

/** Pull 3 picks from the magic-picks API for a completed session. */
export async function fetchPicks(sess: {
  recipientName?: string | null
  relationship?: string | null
  interests: string[]
  priceTier?: string | null
}, baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/magic/picks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: sess.recipientName || undefined,
      relationship: sess.relationship || undefined,
      interests: sess.interests || [],
      priceTier: sess.priceTier || 'mid',
    }),
  })
  if (!res.ok) throw new Error(`magic/picks ${res.status}`)
  const j = await res.json()
  return j.picks as Array<{
    slug?: string
    name: string
    price: string | null
    image: string | null
    domain: string | null
    why: string
  }>
}

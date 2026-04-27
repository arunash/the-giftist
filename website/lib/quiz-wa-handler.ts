// WhatsApp wire-up for the gift quiz state machine in lib/quiz-flow.ts.
//
// Two entry points:
//   handleQuizMessage(phone, buttonId, text) — central router called by the
//     webhook BEFORE the regular Claude flow. Returns handled=true to short-
//     circuit normal processing.
//   sendQuizPrompt(phone, session) — sends the next prompt for a session.
//     Used both internally and by the new-user kickoff path.
//
// Reveal: after the user answers all three questions, we POST to the
// existing /api/magic/picks endpoint and fan out 3 image + CTA messages.

import { sendListMessage, sendImageMessage, sendCtaUrlMessage, sendTextMessage, sendButtonMessage } from './whatsapp'
import {
  QUIZ_TRIGGERS, buildPrompt, parseQuizReplyId, startQuiz, getActiveQuiz,
  recordAnswer, fetchPicks,
} from './quiz-flow'

const SITE_BASE = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://giftist.ai'

export async function sendQuizPrompt(phone: string, session: { step: number; recipientName?: string | null; relationship?: string | null }) {
  const prompt = buildPrompt(session.step, session)
  if (!prompt) return false
  await sendListMessage(
    phone,
    prompt.body,
    prompt.buttonText,
    [{ title: prompt.sectionTitle, rows: prompt.options.map(o => ({ id: o.id, title: o.title, description: o.description })) }],
  )
  return true
}

async function sendReveal(phone: string, session: { recipientName?: string | null; relationship?: string | null; interests: string[]; priceTier?: string | null }) {
  const them = session.recipientName?.trim() || (session.relationship === 'self' ? 'you' : 'them')

  let picks: Awaited<ReturnType<typeof fetchPicks>> = []
  try {
    picks = await fetchPicks(session, SITE_BASE)
  } catch (e) {
    console.error('[quiz-wa] fetchPicks failed', e)
  }

  if (picks.length === 0) {
    await sendTextMessage(phone, "Hmm — nothing felt quite right with those filters. Want to try again, or tell me more about who you're shopping for?")
    return
  }

  // Intro header
  await sendTextMessage(
    phone,
    `Three perfect things for ${them} ✨\n\nEach one's been vetted — tap a Buy button to grab it from the retailer:`,
  )

  // Fan out: image + caption per pick, then a tappable Buy CTA
  for (const p of picks) {
    if (p.image) {
      const priceLine = p.price ? `\n*${p.price}*` : ''
      await sendImageMessage(phone, p.image, `${p.name}${priceLine}\n\n${p.why}`)
    }
    if (p.slug) {
      await sendCtaUrlMessage(
        phone,
        `Tap below to grab "${p.name}" on ${p.domain?.replace(/^www\./, '') || 'the retailer'}.`,
        'Buy now',
        `${SITE_BASE}/go-r/${p.slug}?utm_source=whatsapp&utm_medium=quiz`,
      )
    }
  }

  // Hand off to free-form chat
  await sendButtonMessage(
    phone,
    "That's three picks 🎁\n\nAnything you'd like to refine? Tap below or just text me — I'll keep helping.",
    [
      { id: 'q_again',         title: '🔄 Try again' },
      { id: 'q_chat_freely',   title: '💬 Chat freely' },
      { id: 'q_someone_else',  title: '🎁 Pick for another' },
    ],
  )
}

export async function handleQuizMessage(
  phone: string,
  buttonId: string | null,
  text: string | null,
): Promise<{ handled: boolean }> {
  // 1. Quiz button reply? Always handle — even if no active session was
  //    found (defensive: user might have tapped an old button).
  if (buttonId) {
    const parsed = parseQuizReplyId(buttonId)
    if (parsed) {
      let session = await getActiveQuiz(phone)
      if (!session) session = await startQuiz(phone, 'whatsapp')

      const updated = await recordAnswer(session.id, parsed.field, parsed.value)
      if (updated.step < 3) {
        await sendQuizPrompt(phone, updated)
      } else {
        await sendReveal(phone, updated)
      }
      return { handled: true }
    }
    // Restart-after-reveal buttons
    if (buttonId === 'q_again' || buttonId === 'q_someone_else') {
      const fresh = await startQuiz(phone, 'whatsapp')
      await sendQuizPrompt(phone, fresh)
      return { handled: true }
    }
    if (buttonId === 'q_chat_freely') {
      await sendTextMessage(phone, "Sounds good — tell me anything about gifts, recipients, or events. I'll help.")
      return { handled: true }
    }
  }

  // 2. Active quiz + free-form text? Tear down the quiz so they can chat
  //    freely. (Don't return handled: caller continues into normal flow.)
  if (text) {
    const active = await getActiveQuiz(phone)
    if (active) {
      await active // ensure exists
      await import('./db').then(m =>
        m.prisma.quizSession.update({ where: { id: active.id }, data: { completedAt: new Date() } })
      )
    }
  }

  // 3. Trigger keyword? Start a quiz.
  if (text) {
    const t = text.trim().toLowerCase()
    if (QUIZ_TRIGGERS.some(k => t === k.toLowerCase() || t.includes(k.toLowerCase()))) {
      const fresh = await startQuiz(phone, 'whatsapp')
      await sendQuizPrompt(phone, fresh)
      return { handled: true }
    }
  }

  return { handled: false }
}

/** Used by the webhook for new users — kicks off the quiz instead of the
 *  regular welcome buttons. */
export async function startQuizForNewUser(phone: string) {
  const fresh = await startQuiz(phone, 'whatsapp')
  await sendQuizPrompt(phone, fresh)
}

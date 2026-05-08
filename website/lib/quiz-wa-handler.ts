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
import { prisma } from './db'

// Parse the user's trigger message for context they've already given us so
// we can skip questions whose answers are already implicit. Avoids the dumb
// "I asked for Mother's Day gifts and you ask me Who is it for" problem.
function inferFromMessage(text: string): { relationship?: string; interest?: string; priceTier?: string } {
  const t = text.toLowerCase()
  const result: any = {}

  // Relationship inference — Mother's Day implies Mom, etc.
  if (/\bmother'?s? day\b|\bmom\b|\bmother\b|\bmum\b|\bmommy\b/.test(t)) result.relationship = 'mom'
  else if (/\bfather'?s? day\b|\bdad\b|\bfather\b|\bdaddy\b/.test(t)) result.relationship = 'dad'
  else if (/\bpartner\b|\bhusband\b|\bwife\b|\bboyfriend\b|\bgirlfriend\b|\banniversary\b/.test(t)) result.relationship = 'partner'
  else if (/\bfriend\b|\bbestie\b|\bbest friend\b/.test(t)) result.relationship = 'friend'
  else if (/\bsibling\b|\bsister\b|\bbrother\b/.test(t)) result.relationship = 'sibling'
  else if (/\bmyself\b|\bself-care\b|\bfor me\b/.test(t)) result.relationship = 'self'

  // Interest inference — pick the FIRST that matches
  if (/\bbook|\breading|\breader|\bnovel|\bauthor\b/.test(t)) result.interest = 'reading'
  else if (/\bcook|\bbaking|\bkitchen|\bchef\b/.test(t)) result.interest = 'cooking'
  else if (/\bbeauty|\bskincare|\bmakeup|\bcosmetic/.test(t)) result.interest = 'beauty'
  else if (/\bfashion|\bclothes|\bclothing|\bstyle\b|\bdress\b/.test(t)) result.interest = 'fashion'
  else if (/\btech|\bgadget|\belectronic/.test(t)) result.interest = 'tech'
  else if (/\bwellness|\bspa|\brelax/.test(t)) result.interest = 'wellness'
  else if (/\bfitness|\bworkout|\byoga|\bgym\b/.test(t)) result.interest = 'fitness'
  else if (/\btravel|\btrip\b|\bvacation\b/.test(t)) result.interest = 'travel'
  else if (/\bart\b|\bartist|\bpaint/.test(t)) result.interest = 'art'
  else if (/\bmusic|\binstrument|\bvinyl/.test(t)) result.interest = 'music'
  else if (/\boutdoor|\bcamping|\bhik(e|ing)\b/.test(t)) result.interest = 'outdoor'
  else if (/\bhome\b|\bdecor|\bfurniture/.test(t)) result.interest = 'home'

  // Price tier inference
  if (/\bunder \$?30\b|\bbudget\b|\bcheap\b|\baffordable\b/.test(t)) result.priceTier = 'budget'
  else if (/\bunder \$?50\b|\b\$30 ?- ?\$?75\b/.test(t)) result.priceTier = 'mid'
  else if (/\bunder \$?150\b|\bpremium\b/.test(t)) result.priceTier = 'premium'
  else if (/\bluxur(y|ious)|\bsplurge\b|\bfancy\b/.test(t)) result.priceTier = 'luxury'

  return result
}

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

  // 3. Trigger keyword? Start a quiz, AND infer as much from the user's
  //    message as possible so we don't ask them questions they already
  //    answered ("Mother's Day gifts" already implies relationship=mom).
  if (text) {
    const t = text.trim().toLowerCase()
    if (QUIZ_TRIGGERS.some(k => t === k.toLowerCase() || t.includes(k.toLowerCase()))) {
      let session = await startQuiz(phone, 'whatsapp')
      const inferred = inferFromMessage(text)

      // Default relationship to "mom" — Mother's Day is the dominant inbound
      // intent for V7+V8 ads. The inference can override this if the message
      // explicitly mentions a different recipient. Net effect: WA users skip
      // Q1 by default and land on Q2 (interests).
      const relationship = inferred.relationship || 'mom'

      // Apply inferences in order. recordAnswer advances step automatically.
      if (session.step === 0) {
        session = await recordAnswer(session.id, 'relationship', relationship)
      }
      if (inferred.interest && session.step === 1) {
        session = await recordAnswer(session.id, 'interest', inferred.interest)
      }
      if (inferred.priceTier && session.step === 2) {
        session = await recordAnswer(session.id, 'budget', inferred.priceTier)
      }

      // If everything was inferred (step >= 3), go straight to reveal.
      if (session.step >= 3) {
        await sendReveal(phone, session)
      } else {
        // Acknowledge what we picked up before asking the next question
        const rLabel = { mom: 'Mom', dad: 'Dad', partner: 'your partner', friend: 'your friend', sibling: 'your sibling', self: 'yourself' } as any
        const picked: string[] = [rLabel[relationship] || relationship]
        if (inferred.interest) picked.push(inferred.interest)
        await sendTextMessage(phone, `Got it — picks for ${picked.join(' · ')} 🎁`)
        await sendQuizPrompt(phone, session)
      }
      return { handled: true }
    }
  }

  return { handled: false }
}

/** Used by the webhook for new users — kicks off the quiz with relationship
 *  defaulted to "mom" (Mother's Day is the dominant inbound intent). The
 *  user's first message can override the relationship via inference, but
 *  by default we skip Q1 and start at Q2 (interests). */
export async function startQuizForNewUser(phone: string, firstMessage?: string) {
  let session = await startQuiz(phone, 'whatsapp')
  const inferred = firstMessage ? inferFromMessage(firstMessage) : {} as ReturnType<typeof inferFromMessage>
  const relationship = inferred.relationship || 'mom'

  // Always set relationship — defaults to mom, overridden by inference.
  session = await recordAnswer(session.id, 'relationship', relationship)
  if (inferred.interest && session.step === 1) {
    session = await recordAnswer(session.id, 'interest', inferred.interest)
  }
  if (inferred.priceTier && session.step === 2) {
    session = await recordAnswer(session.id, 'budget', inferred.priceTier)
  }
  if (session.step >= 3) {
    await sendReveal(phone, session)
    return
  }
  await sendQuizPrompt(phone, session)
}

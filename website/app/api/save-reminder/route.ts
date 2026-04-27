import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTextMessage } from '@/lib/whatsapp'

// POST /api/save-reminder
// Body: { phone: string, slug: string, occasion?: string }
//
// Captures an anonymous "text me this gift" save from the /shop product
// modal. Stores phone+slug+remindAt, sends an immediate WhatsApp confirmation,
// and is later picked up by /api/cron/saved-reminders for the actual ping
// on the right day.

const MOTHERS_DAY_2026 = new Date('2026-05-10T16:00:00Z') // 9am PT, May 10
const MD_REMIND_AT = new Date('2026-05-07T16:00:00Z')     // 9am PT, May 7

function normalizePhone(input: string): string | null {
  // Strip everything that isn't a digit. Accept either 10-digit US (no plus)
  // or international with country code. Return E.164 ("+15551234567").
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`
  return null
}

function pickRemindAt(occasion?: string): Date {
  if (occasion === 'mothers-day') return MD_REMIND_AT
  // Default: 7 days out (good for general "I'll think about it" saves)
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
}

function buildConfirmMessage(productName: string, slug: string, occasion?: string): string {
  const url = `https://giftist.ai/p/${slug}`
  if (occasion === 'mothers-day') {
    return `Saved! 🎁\n\n"${productName}"\n\nI'll text you May 7 with the link so you can grab it before Mother's Day. Or tap now: ${url}`
  }
  return `Saved! 🎁\n\n"${productName}"\n\nI'll text you next week to remind you. Or grab it now: ${url}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { phone: rawPhone, slug, occasion } = body as {
      phone?: string
      slug?: string
      occasion?: string
    }

    if (!rawPhone || !slug) {
      return NextResponse.json({ error: 'phone and slug required' }, { status: 400 })
    }

    const phone = normalizePhone(rawPhone)
    if (!phone) {
      return NextResponse.json({ error: 'invalid phone format' }, { status: 400 })
    }

    // Look up product details from ProductClick (canonical source for the slug)
    const product = await prisma.productClick.findUnique({
      where: { slug },
      select: { productName: true, image: true, price: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'product not found' }, { status: 404 })
    }

    const remindAt = pickRemindAt(occasion)

    // Same phone+slug → update; otherwise create. Avoids a duplicate save
    // if the user taps twice or comes back to the same product.
    const existing = await prisma.savedReminder.findFirst({
      where: { phone, slug },
      select: { id: true },
    })
    const saved = existing
      ? await prisma.savedReminder.update({
          where: { id: existing.id },
          data: { remindAt, remindedAt: null, occasion },
        })
      : await prisma.savedReminder.create({
          data: {
            phone,
            slug,
            productName: product.productName,
            productUrl: `https://giftist.ai/go-r/${slug}`,
            productImage: product.image,
            productPrice: product.price,
            occasion,
            remindAt,
          },
        })

    // Fire-and-forget WhatsApp confirmation. Don't block the response on it.
    sendTextMessage(phone, buildConfirmMessage(product.productName, slug, occasion))
      .catch((e) => console.error('[save-reminder] WA confirm failed', e))

    return NextResponse.json({
      ok: true,
      id: saved.id,
      remindAt: saved.remindAt.toISOString(),
    })
  } catch (e: any) {
    console.error('[save-reminder] error', e)
    return NextResponse.json({ error: e.message || 'internal error' }, { status: 500 })
  }
}

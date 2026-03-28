import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const { slug, recipientName, recipientPhone, senderMessage } = await request.json()

  if (!slug || !recipientName || !recipientPhone) {
    return NextResponse.json({ error: 'slug, recipientName, and recipientPhone required' }, { status: 400 })
  }

  const product = await prisma.productClick.findUnique({ where: { slug } })
  if (!product || !product.priceValue) {
    return NextResponse.json({ error: 'Product not found or no price' }, { status: 404 })
  }

  const amount = product.priceValue
  const platformFee = Math.round(amount * (amount >= 100 ? 0.10 : 0.15) * 100) / 100
  const shippingFee = 5.99
  const totalCharged = Math.round((amount + platformFee + shippingFee) * 100) / 100

  try {
    const { stripe } = await import('@/lib/stripe')
    const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'

    // Get or create Stripe customer
    let sub = await prisma.subscription.findUnique({ where: { userId } })
    let stripeCustomerId = sub?.stripeCustomerId
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        metadata: { userId },
      })
      stripeCustomerId = customer.id
      if (sub) {
        await prisma.subscription.update({ where: { userId }, data: { stripeCustomerId } })
      } else {
        await prisma.subscription.create({ data: { userId, stripeCustomerId, status: 'INACTIVE' } })
      }
    }

    // Create GiftSend record
    const cleanPhone = recipientPhone ? recipientPhone.replace(/\D/g, '') : null
    const giftSend = await prisma.giftSend.create({
      data: {
        senderId: userId,
        recipientName,
        recipientPhone: cleanPhone || '',
        itemName: product.productName,
        itemPrice: amount,
        itemUrl: product.targetUrl,
        itemImage: product.image,
        senderMessage: senderMessage || null,
        amount,
        platformFee,
        shippingFee,
        totalCharged,
        redeemCode: crypto.randomBytes(16).toString('base64url'),
      },
    })

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.productName,
              ...(product.image ? { images: [product.image] } : {}),
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Service fee' },
            unit_amount: Math.round(platformFee * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shipping' },
            unit_amount: Math.round(shippingFee * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'product_purchase',
        userId,
        productSlug: slug,
        productName: product.productName,
        amount: String(amount),
        platformFee: String(platformFee),
        giftSendId: giftSend.id,
      },
      success_url: `${baseUrl}/p/${slug}?purchased=1&giftId=${giftSend.id}`,
      cancel_url: `${baseUrl}/p/${slug}`,
    })

    // Store stripeSessionId on the GiftSend
    await prisma.giftSend.update({
      where: { id: giftSend.id },
      data: { stripeSessionId: checkoutSession.id },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Purchase checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }
}

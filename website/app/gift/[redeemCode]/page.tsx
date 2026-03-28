import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Gift, Check, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { RedeemActions } from './redeem-actions'

export default async function GiftRedeemPage({
  params,
}: {
  params: { redeemCode: string }
}) {
  const { redeemCode } = params

  const gift = await prisma.giftSend.findUnique({
    where: { redeemCode },
    include: {
      sender: { select: { name: true } },
    },
  })

  // Gift not found
  if (!gift) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-10 w-10 text-gray-300" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Gift not found</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            This gift link may have expired or is invalid. Please check the link and try again.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 text-sm font-medium text-primary hover:underline"
          >
            Go to The Giftist
          </Link>
        </div>
      </div>
    )
  }

  // Pending shipment — show status
  if (gift.status === 'REDEEMED_PENDING_SHIPMENT' || gift.status === 'SHIPPED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <GiftCardShell>
            <GiftCardHeader redeemed />
            <div className="px-6 py-8 text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="h-7 w-7 text-violet-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                {gift.status === 'SHIPPED' ? 'Your gift has shipped!' : 'Your gift is being prepared!'}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                &ldquo;{gift.itemName}&rdquo; from {gift.sender.name || 'a friend'}
                {gift.status === 'SHIPPED'
                  ? ' is on its way to you.'
                  : ' — we\'re ordering it now. You\'ll get tracking info by email.'}
              </p>
              {gift.trackingUrl && (
                <a
                  href={gift.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-violet-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-600 transition"
                >
                  Track your package
                </a>
              )}
              {gift.trackingNumber && !gift.trackingUrl && (
                <p className="text-sm text-gray-600 font-mono bg-gray-50 rounded-lg px-4 py-2 inline-block">
                  Tracking: {gift.trackingNumber}
                </p>
              )}
            </div>
            <GiftCardFooter />
          </GiftCardShell>
        </div>
      </div>
    )
  }

  // Already redeemed (but allow retry if payout failed)
  if (gift.redeemedAt && gift.status !== 'REDEEMED_PENDING_REWARD') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <GiftCardShell>
            <GiftCardHeader redeemed />
            <div className="px-6 py-8 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                This gift has already been claimed
              </h2>
              <p className="text-sm text-gray-500">
                The gift for &ldquo;{gift.itemName}&rdquo; from {gift.sender.name || 'a friend'} was redeemed on{' '}
                {new Date(gift.redeemedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                .
              </p>
            </div>
            <GiftCardFooter />
          </GiftCardShell>
        </div>
      </div>
    )
  }

  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user
  const senderName = gift.sender.name || 'A friend'

  // Detect recipient country via Vercel geo header (falls back to US)
  const headersList = headers()
  const recipientCountry = headersList.get('x-vercel-ip-country') || 'US'

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <GiftCardShell>
          <GiftCardHeader senderName={senderName} />

          {/* Item details */}
          <div className="px-6 py-6">
            {gift.itemImage && (
              <div className="w-full h-52 rounded-2xl overflow-hidden mb-5 bg-gray-50 border border-gray-100">
                <img
                  src={gift.itemImage}
                  alt={gift.itemName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-900 mb-1">{gift.itemName}</h2>
            <p className="text-2xl font-bold text-primary mb-4">
              ${gift.amount.toFixed(2)}
            </p>

            {gift.senderMessage && (
              <div className="bg-violet-50 border-l-4 border-violet-300 rounded-r-xl px-4 py-3 mb-6">
                <p className="text-sm text-gray-700 italic leading-relaxed">
                  &ldquo;{gift.senderMessage}&rdquo;
                </p>
                <p className="text-xs text-gray-400 mt-1.5">&mdash; {senderName}</p>
              </div>
            )}

            <RedeemActions
              redeemCode={redeemCode}
              itemUrl={gift.itemUrl}
              itemName={gift.itemName}
              amount={gift.amount}
              senderName={senderName}
              isLoggedIn={isLoggedIn}
              isPendingRetry={gift.status === 'REDEEMED_PENDING_REWARD'}
              recipientCountry={recipientCountry}
            />
          </div>

          <GiftCardFooter />
        </GiftCardShell>
      </div>
    </div>
  )
}

/* ─── Shared sub-components ─── */

function GiftCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-fade-in">
      {children}
    </div>
  )
}

function GiftCardHeader({
  senderName,
  redeemed,
}: {
  senderName?: string
  redeemed?: boolean
}) {
  return (
    <div className="relative bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 px-6 py-8 text-white text-center overflow-hidden">
      {/* Confetti dots */}
      <div className="absolute top-2 left-4 w-3 h-3 bg-yellow-300 rounded-full opacity-60" />
      <div className="absolute top-6 right-8 w-2 h-2 bg-green-300 rounded-full opacity-60" />
      <div className="absolute bottom-4 left-12 w-2 h-2 bg-blue-300 rounded-full opacity-60" />
      <div className="absolute top-3 right-16 w-4 h-4 bg-pink-300 rounded-full opacity-40" />
      <div className="absolute bottom-3 right-6 w-3 h-3 bg-yellow-200 rounded-full opacity-50" />
      <div className="absolute bottom-6 left-6 w-2.5 h-2.5 bg-emerald-300 rounded-full opacity-50" />

      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-4 opacity-90">
        <Image
          src="/logo-light.png"
          alt="Giftist"
          width={24}
          height={24}
          className="rounded-md"
        />
        <span className="text-sm font-semibold tracking-wide">The Giftist</span>
      </div>

      {redeemed ? (
        <>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="h-6 w-6" />
          </div>
          <p className="text-xl font-bold">Gift Claimed</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-3">
            <Gift className="h-7 w-7" />
          </div>
          <p className="text-xl font-bold">You received a gift!</p>
          {senderName && (
            <p className="text-sm opacity-80 mt-1">from {senderName}</p>
          )}
        </>
      )}
    </div>
  )
}

function GiftCardFooter() {
  return (
    <div className="border-t border-gray-100 px-6 py-3 text-center">
      <p className="text-xs text-gray-400">
        Powered by{' '}
        <a href="https://giftist.ai" className="text-primary hover:underline">
          The Giftist
        </a>
      </p>
    </div>
  )
}

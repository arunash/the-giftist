import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Unified affiliate conversion postback (server-to-server).
 *
 * Every network supports a configurable "postback URL" / "pixel" you paste
 * into its dashboard, with the network's own macro tokens. We expose ONE
 * endpoint and let each network map its macros onto our generic params, so we
 * never have to ship per-network parsing. Configure each network's postback to:
 *
 *   https://giftist.ai/api/affiliate/postback?key=SECRET&network=NAME
 *     &clickId={SUBID_MACRO}&orderId={ORDER_MACRO}
 *     &sale={SALE_MACRO}&commission={COMMISSION_MACRO}
 *     &currency={CURRENCY_MACRO}&status={STATUS_MACRO}
 *
 * Per-network macro reference (paste these as the macro values):
 *   awin       clickId={{clickRef}}        orderId={{transactionId}}  commission={{commissionAmount}} sale={{totalAmount}}
 *   impact     clickId={SubId1}            orderId={ActionId}         commission={Payout}            sale={IntendedAmount}
 *   rakuten    clickId={u1}                orderId={order_id}         commission={commissions}       sale={sales}
 *   partnerize clickId={pubref}            orderId={conversion_id}    commission={publisher_commission} sale={value}
 *   shareasale clickId={afftrack}          orderId={ordernumber}      commission={commission}        sale={total}
 *   amazon     (no postback — imported from Associates reports, clickId null)
 *
 * Idempotent: keyed on (network, orderId). A network that fires the pixel twice,
 * or sends pending→approved status updates, UPDATES the row, never duplicates.
 * Always returns 200 so networks don't retry-storm on our errors.
 */

const POSTBACK_SECRET = process.env.AFFILIATE_POSTBACK_SECRET?.trim()

function num(v: string | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function handle(request: NextRequest) {
  const sp = request.nextUrl.searchParams

  // Auth: shared secret. If unset on the server, reject everything (fail closed)
  // so a misconfigured deploy can't silently accept spoofed conversions.
  if (!POSTBACK_SECRET || sp.get('key') !== POSTBACK_SECRET) {
    return new NextResponse('forbidden', { status: 403 })
  }

  const network = (sp.get('network') || '').toLowerCase().trim()
  const orderId = (sp.get('orderId') || sp.get('order_id') || '').trim()
  if (!network || !orderId) {
    return new NextResponse('missing network or orderId', { status: 400 })
  }

  const clickId = sp.get('clickId') || sp.get('subid') || null
  const commission = num(sp.get('commission')) ?? 0
  const saleAmount = num(sp.get('sale'))
  const currency = (sp.get('currency') || 'USD').toUpperCase().slice(0, 8)
  // Normalize status across networks to pending|approved|declined.
  const rawStatus = (sp.get('status') || 'pending').toLowerCase()
  const status =
    /approv|confirm|paid|valid|complete/.test(rawStatus) ? 'approved' :
    /declin|reject|cancel|void|invalid|return/.test(rawStatus) ? 'declined' :
    'pending'

  // Resolve the click → slug + campaign for per-product / per-campaign EPC.
  let slug: string | null = null
  let utmCampaign: string | null = null
  let utmSource: string | null = null
  if (clickId) {
    const click = await prisma.clickEvent
      .findUnique({ where: { id: clickId }, select: { slug: true, utmCampaign: true, utmSource: true } })
      .catch(() => null)
    if (click) {
      slug = click.slug
      utmCampaign = click.utmCampaign
      utmSource = click.utmSource
    }
  }

  const rawPayload = JSON.stringify(Object.fromEntries(
    Array.from(sp.entries()).filter(([k]) => k !== 'key') // never persist the secret
  ))

  try {
    await prisma.affiliateConversion.upsert({
      where: { network_orderId: { network, orderId } },
      create: { network, orderId, clickId, commission, saleAmount, currency, status, slug, utmCampaign, utmSource, rawPayload },
      // On a repeat/status-update postback, refresh the mutable money + status
      // fields. Keep the original click resolution if this one couldn't resolve.
      update: {
        commission, saleAmount, currency, status, rawPayload,
        ...(clickId ? { clickId } : {}),
        ...(slug ? { slug } : {}),
        ...(utmCampaign ? { utmCampaign } : {}),
        ...(utmSource ? { utmSource } : {}),
      },
    })
  } catch (err) {
    console.error('affiliate postback upsert failed:', err)
    // Still 200 — we don't want the network hammering retries; the raw payload
    // is in logs and the network will typically re-fire on its next batch.
    return new NextResponse('ok', { status: 200 })
  }

  return new NextResponse('ok', { status: 200 })
}

// Networks fire either GET (pixel/postback) or POST — accept both.
export const GET = handle
export const POST = handle

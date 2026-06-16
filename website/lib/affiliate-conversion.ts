import { prisma } from '@/lib/db'

/**
 * Single source of truth for recording an affiliate conversion, shared by the
 * inbound postback endpoint (push) and the Awin cron (pull). Both paths produce
 * identical, idempotent AffiliateConversion rows joined to the originating
 * click via the network sub-id we stamped into the outbound link.
 */
export interface ConversionInput {
  network: string            // awin, amazon, impact, rakuten, ...
  orderId: string            // network transaction/order id — dedup key
  clickId?: string | null    // our ClickEvent.id, echoed back via the sub-id
  commission?: number | null // our commission (EPC numerator)
  saleAmount?: number | null
  currency?: string | null
  status?: string | null     // raw network status; normalized below
  rawPayload?: string | null
}

/** Normalize any network's status vocabulary to pending|approved|declined. */
export function normalizeStatus(raw?: string | null): 'pending' | 'approved' | 'declined' {
  const s = (raw || 'pending').toLowerCase()
  if (/approv|confirm|paid|valid|complete|accept/.test(s)) return 'approved'
  if (/declin|reject|cancel|void|invalid|return|delet/.test(s)) return 'declined'
  return 'pending'
}

/**
 * Upsert one conversion. Idempotent on (network, orderId): a repeat or a
 * pending->approved status change UPDATES the row, never duplicates. Resolves
 * slug + campaign from the click so per-product / per-campaign EPC works.
 * Returns { created: boolean } so callers can report new-vs-updated counts.
 */
export async function recordConversion(input: ConversionInput): Promise<{ ok: boolean; created: boolean }> {
  const network = input.network.toLowerCase().trim()
  const orderId = String(input.orderId).trim()
  if (!network || !orderId) return { ok: false, created: false }

  const clickId = input.clickId || null
  const commission = Number.isFinite(input.commission as number) ? (input.commission as number) : 0
  const saleAmount = Number.isFinite(input.saleAmount as number) ? (input.saleAmount as number) : null
  const currency = (input.currency || 'USD').toUpperCase().slice(0, 8)
  const status = normalizeStatus(input.status)

  // Resolve the click -> slug + campaign (only the sub-id networks have this;
  // Amazon report imports have a null clickId and stay unattributed).
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

  const existing = await prisma.affiliateConversion
    .findUnique({ where: { network_orderId: { network, orderId } }, select: { id: true } })
    .catch(() => null)

  await prisma.affiliateConversion.upsert({
    where: { network_orderId: { network, orderId } },
    create: { network, orderId, clickId, commission, saleAmount, currency, status, slug, utmCampaign, utmSource, rawPayload: input.rawPayload ?? null },
    update: {
      commission, saleAmount, currency, status,
      ...(input.rawPayload != null ? { rawPayload: input.rawPayload } : {}),
      // Keep the original click resolution if a later update can't resolve one.
      ...(clickId ? { clickId } : {}),
      ...(slug ? { slug } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(utmSource ? { utmSource } : {}),
    },
  })

  return { ok: true, created: !existing }
}

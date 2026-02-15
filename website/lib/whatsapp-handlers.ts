import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { extractProductFromImage } from '@/lib/extract-image'
import { searchRetailers } from '@/lib/search-retailers'
import { downloadMedia, sendTextMessage, sendImageMessage } from '@/lib/whatsapp'
import { buildChatContext, checkChatLimit } from '@/lib/chat-context'
import { stripSpecialBlocks, parseChatContent, type EventData } from '@/lib/parse-chat-content'
import { createActivity } from '@/lib/activity'
import { calculateGoalAmount } from '@/lib/platform-fee'
import { logApiCall, logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
const INSTAGRAM_REGEX = /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i

const client = new Anthropic()

interface PendingProduct {
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  url: string
  domain: string
}

const CONFIRM_WORDS = new Set(['yes', 'yep', 'yeah', 'sure', 'ok', 'add', 'save', 'add it', 'save it', 'yes please', 'y'])
const REJECT_WORDS = new Set(['no', 'nah', 'nope', 'skip', 'cancel', 'n', 'no thanks'])

async function savePendingProduct(
  userId: string,
  listId: string,
  pending: PendingProduct,
  phone: string,
): Promise<string> {
  const userData = await prisma.user.update({
    where: { id: userId },
    data: { pendingProduct: null },
    select: { lifetimeContributionsReceived: true },
  })

  const feeCalc = calculateGoalAmount(pending.priceValue, userData.lifetimeContributionsReceived)

  const item = await prisma.item.create({
    data: {
      userId,
      name: pending.name,
      price: pending.price,
      priceValue: pending.priceValue,
      image: pending.image,
      url: pending.url,
      domain: pending.domain,
      source: 'WHATSAPP',
      goalAmount: feeCalc.goalAmount,
    },
  })

  await prisma.giftListItem.create({
    data: { listId, itemId: item.id, addedById: userId },
  })

  createActivity({
    userId,
    type: 'ITEM_ADDED',
    visibility: 'PUBLIC',
    itemId: item.id,
    metadata: { itemName: pending.name, source: 'WHATSAPP' },
  }).catch(() => {})

  const priceStr = pending.price ? ` (${pending.price})` : ''

  const shareHint = `\n\nTo share your wishlist, reply *share*`

  if (pending.image) {
    try {
      await sendImageMessage(phone, pending.image, `Added: ${pending.name}${priceStr}${shareHint}`)
      return ''
    } catch {}
  }

  return `Added: ${pending.name}${priceStr}${shareHint}`
}

export async function resolveUserAndList(phone: string, profileName?: string) {
  let user = await prisma.user.findUnique({ where: { phone } })
  const isNewUser = !user

  if (!user) {
    user = await prisma.user.create({
      data: { phone, name: profileName || null },
    })
  }

  // Find or create "WhatsApp Saves" list
  let list = await prisma.giftList.findFirst({
    where: { userId: user.id, name: 'WhatsApp Saves' },
  })
  if (!list) {
    list = await prisma.giftList.create({
      data: { userId: user.id, name: 'WhatsApp Saves', isPublic: false },
    })
  }

  return { userId: user.id, listId: list.id, isNewUser }
}

export async function handleTextMessage(
  userId: string,
  listId: string,
  text: string,
  phone: string,
): Promise<string> {
  const trimmed = text.trim().toLowerCase()

  // Check for pending product confirmation/rejection
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pendingProduct: true } })
  if (user?.pendingProduct) {
    if (CONFIRM_WORDS.has(trimmed)) {
      const pending = JSON.parse(user.pendingProduct as string) as PendingProduct
      return savePendingProduct(userId, listId, pending, phone)
    }
    if (REJECT_WORDS.has(trimmed)) {
      await prisma.user.update({ where: { id: userId }, data: { pendingProduct: null } })
      return "No problem! Send me another photo or link anytime."
    }
    // Any other message clears the pending product (they moved on)
    await prisma.user.update({ where: { id: userId }, data: { pendingProduct: null } })
  }

  // Command: help
  if (trimmed === 'help') {
    return getHelpMessage()
  }

  // Command: list
  if (trimmed === 'list') {
    const items = await prisma.giftListItem.findMany({
      where: { listId },
      include: { item: true },
      orderBy: { addedAt: 'desc' },
      take: 10,
    })
    if (items.length === 0) return "Your list is empty! Send me a product link or photo to get started."
    const lines = items.map((gli, i) => {
      const price = gli.item.price ? ` (${gli.item.price})` : ''
      return `${i + 1}. ${gli.item.name}${price}`
    })
    return `Your recent saves:\n\n${lines.join('\n')}`
  }

  // Command: remove <n>
  const removeMatch = trimmed.match(/^remove\s+(\d+)$/)
  if (removeMatch) {
    const index = parseInt(removeMatch[1]) - 1
    const items = await prisma.giftListItem.findMany({
      where: { listId },
      include: { item: true },
      orderBy: { addedAt: 'desc' },
      take: 10,
    })
    if (index < 0 || index >= items.length) return `Invalid number. You have ${items.length} items.`
    const target = items[index]
    await prisma.giftListItem.delete({ where: { id: target.id } })
    return `Removed: ${target.item.name}`
  }

  // Command: share
  if (trimmed === 'share') {
    const sharer = await prisma.user.findUnique({ where: { id: userId }, select: { shareId: true, name: true } })
    if (sharer?.shareId) {
      const sharerName = sharer.name || 'your friend'
      const prefill = encodeURIComponent(`👋 Tap send to view ${sharerName}'s wishlist on The Giftist!\n\nview ${sharer.shareId}`)
      const shareLink = `https://wa.me/15014438478?text=${prefill}`
      return `Here's your shareable link:\n\n${shareLink}\n\nWhen someone opens this, they'll see a friendly message and just tap send to view your wishlist!`
    }
    return "Something went wrong generating your share link. Please try again."
  }

  // Command: view {shareId} — recipient viewing someone's wishlist
  const viewMatch = text.match(/\bview\s+(\S+)/i)
  if (viewMatch) {
    const targetShareId = viewMatch[1]
    const owner = await prisma.user.findUnique({
      where: { shareId: targetShareId },
      select: {
        name: true,
        shareId: true,
        items: {
          orderBy: { addedAt: 'desc' },
          take: 5,
          select: { name: true, price: true, priceValue: true },
        },
      },
    })

    if (!owner) {
      return "I couldn't find that wishlist. The link may have expired or be invalid."
    }

    const ownerName = owner.name || 'Someone'
    const itemLines = owner.items.map((item, i) => {
      const priceStr = item.price ? ` — ${item.price}` : ''
      return `${i + 1}. ${item.name}${priceStr}`
    })

    const itemCount = owner.items.length
    const moreText = itemCount === 5 ? '\n\n...and more!' : ''

    return `Hi! Your friend ${ownerName} is sharing their gift wishlist with you for their special moment! Checkout what they have in mind on the Giftist.\n\n🎁 *${ownerName}'s Wishlist*\n\n${itemLines.join('\n')}${moreText}\n\nView the full list and contribute:\nhttps://giftist.ai/u/${targetShareId}`
  }

  // Command: item {itemId} — view a single item
  const itemMatch = text.match(/\bitem\s+(\S+)/i)
  if (itemMatch) {
    const targetItemId = itemMatch[1]
    const item = await prisma.item.findUnique({
      where: { id: targetItemId },
      include: {
        user: { select: { name: true, shareId: true } },
      },
    })

    if (!item) {
      return "I couldn't find that item. The link may have expired or be invalid."
    }

    const ownerName = item.user.name || 'Someone'
    const priceStr = item.price ? `\n💰 ${item.price}` : ''
    const goalAmount = item.goalAmount || item.priceValue || 0
    const funded = item.fundedAmount || 0
    let fundingStr = ''
    if (goalAmount > 0) {
      const remaining = Math.max(0, goalAmount - funded)
      const pct = Math.min(100, Math.round((funded / goalAmount) * 100))
      fundingStr = `\n📊 ${pct}% funded — $${remaining.toFixed(0)} remaining`
    }

    const webLink = item.user.shareId
      ? `\n\nContribute or see the full wishlist:\nhttps://giftist.ai/u/${item.user.shareId}`
      : ''

    const greeting = `Hi! Your friend ${ownerName} is sharing their gift wishlist with you for their special moment! Checkout what they have in mind on the Giftist.\n\n`

    // Send with image if available
    if (item.image) {
      try {
        await sendImageMessage(
          phone,
          item.image,
          `${greeting}🎁 *${item.name}*${priceStr}${fundingStr}${webLink}`
        )
        return ''
      } catch {}
    }

    return `${greeting}🎁 *${item.name}*${priceStr}${fundingStr}${webLink}`
  }

  // Try to extract URLs
  const urls = text.match(URL_REGEX)
  if (urls && urls.length > 0) {
    const url = urls[0]

    // Instagram links need special handling — scrape OG image, then identify product via vision
    if (INSTAGRAM_REGEX.test(url)) {
      return handleInstagramLink(userId, listId, url, phone)
    }

    // Check for duplicate URL in this user's items
    const existing = await prisma.item.findFirst({
      where: { userId, url },
    })
    if (existing) return `You already saved this: ${existing.name}`

    const product = await extractProductFromUrl(url)

    // Guardrails: don't save items without proper details or image
    if (product.name === product.domain) {
      return "I couldn't extract product details from that link. Could you try a different link or send me a photo of the product?"
    }
    if (!product.image) {
      return `I found *${product.name}* but couldn't get a product image. Could you send me a photo of it?`
    }

    const urlUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeContributionsReceived: true },
    })
    const urlFeeCalc = calculateGoalAmount(product.priceValue, urlUser?.lifetimeContributionsReceived ?? 0)

    const item = await prisma.item.create({
      data: {
        userId,
        name: product.name,
        price: product.price,
        priceValue: product.priceValue,
        image: product.image,
        url: product.url,
        domain: product.domain,
        source: 'WHATSAPP',
        goalAmount: urlFeeCalc.goalAmount,
      },
    })

    await prisma.giftListItem.create({
      data: { listId, itemId: item.id, addedById: userId },
    })

    createActivity({
      userId,
      type: 'ITEM_ADDED',
      visibility: 'PUBLIC',
      itemId: item.id,
      metadata: { itemName: product.name, source: 'WHATSAPP' },
    }).catch(() => {})

    const priceStr = product.price ? ` (${product.price})` : ''
    const shareHint = `\n\nTo share your wishlist, reply *share*`

    // Reply with product image (guaranteed to exist by guardrails above)
    try {
      await sendImageMessage(phone, product.image, `Added: ${product.name}${priceStr}${shareHint}`)
      return '' // empty string means we already sent a reply
    } catch {
      // fall through to text reply
    }

    return `Added: ${product.name}${priceStr}${shareHint}`
  }

  // No URL and not a command — handle as conversational chat via Claude
  return handleChatMessage(userId, text)
}

async function handleInstagramLink(
  userId: string,
  listId: string,
  igUrl: string,
  phone: string,
): Promise<string> {
  // Strip tracking params for clean URL and dedup
  const cleanUrl = igUrl.replace(/\?.*$/, '')

  const existing = await prisma.item.findFirst({
    where: { userId, url: cleanUrl },
  })
  if (existing) return `You already saved this: ${existing.name}`

  // Fetch Instagram page to get OG image and caption
  let ogImage: string | null = null
  let ogCaption: string | null = null
  try {
    const res = await fetch(igUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const cheerio = await import('cheerio')
      const $ = cheerio.load(html)
      ogImage = $('meta[property="og:image"]').attr('content') || null
      ogCaption = $('meta[property="og:description"]').attr('content') || null
    }
  } catch {
    // Fetch failed — continue without OG data
  }

  console.log('[INSTAGRAM] OG image:', !!ogImage, '| caption:', ogCaption?.substring(0, 80))

  // If we got the OG image, run it through the product identification pipeline
  if (ogImage) {
    let imageBuffer: Buffer | null = null
    try {
      const imgRes = await fetch(ogImage, { signal: AbortSignal.timeout(10000) })
      if (imgRes.ok) {
        imageBuffer = Buffer.from(await imgRes.arrayBuffer())
      }
    } catch {
      // Image download failed
    }

    if (imageBuffer) {
      const product = await extractProductFromImage(imageBuffer, 'image/jpeg', ogCaption || undefined)
      console.log('[INSTAGRAM] Vision identified:', product?.name, '| brand:', product?.brand)

      if (product && product.name) {
        const visionName = product.brand ? `${product.brand} ${product.name}` : product.name

        // Search retailers for the identified product
        const { bestResult, results } = await searchRetailers(product.name, product.brand, product.description)
        console.log('[INSTAGRAM] Retailer search:', results.length, 'results | best:', bestResult?.retailer)

        let itemUrl = cleanUrl
        let itemDomain = 'instagram.com'
        let itemImage = ogImage
        let itemPrice = product.price
        let itemPriceValue = product.priceValue

        if (bestResult) {
          itemUrl = bestResult.url
          try {
            itemDomain = new URL(bestResult.url).hostname
          } catch {
            itemDomain = bestResult.retailer.toLowerCase()
          }

          // Scrape retailer page for better image and price
          try {
            const scraped = await extractProductFromUrl(bestResult.url)
            console.log('[INSTAGRAM] Scraped:', scraped.name, '| image:', !!scraped.image, '| price:', scraped.price)
            if (scraped.image) itemImage = scraped.image
            if (scraped.priceValue) {
              itemPrice = scraped.price
              itemPriceValue = scraped.priceValue
            } else if (bestResult.priceValue) {
              itemPrice = bestResult.price
              itemPriceValue = bestResult.priceValue
            }
          } catch {
            if (bestResult.priceValue) {
              itemPrice = bestResult.price
              itemPriceValue = bestResult.priceValue
            }
          }
        }

        // Guardrails: require image for feed display
        if (!itemImage) {
          return `I identified this as *${visionName}*, but couldn't find a product image. Could you send me a direct link to buy it?`
        }

        // Store as pending and ask for confirmation
        const pendingData: PendingProduct = {
          name: visionName,
          price: itemPrice,
          priceValue: itemPriceValue,
          image: itemImage,
          url: itemUrl,
          domain: itemDomain,
        }
        await prisma.user.update({
          where: { id: userId },
          data: { pendingProduct: JSON.stringify(pendingData) },
        })

        const priceStr = itemPrice ? ` (${itemPrice})` : ''

        if (itemImage) {
          try {
            await sendImageMessage(phone, itemImage, `I found *${visionName}*${priceStr} from ${itemDomain}\n\nWant me to add this to your wishlist? Reply *yes* to add.`)
            return ''
          } catch {}
        }

        return `I found *${visionName}*${priceStr}. Want me to add this to your wishlist? Reply *yes* to add.`
      }
    }
  }

  // Guardrails: don't save without an image
  if (!ogImage) {
    return "I couldn't identify the product in that Instagram post. Could you send me a direct product link or a clearer screenshot?"
  }

  // Fallback: store the Instagram link with OG data
  const item = await prisma.item.create({
    data: {
      userId,
      name: ogCaption?.split('\n')[0]?.substring(0, 200) || 'Instagram post',
      image: ogImage,
      url: cleanUrl,
      domain: 'instagram.com',
      source: 'WHATSAPP',
    },
  })

  await prisma.giftListItem.create({
    data: { listId, itemId: item.id, addedById: userId },
  })

  if (ogImage) {
    try {
      await sendImageMessage(phone, ogImage, `Saved from Instagram`)
      return ''
    } catch {}
  }

  return `Saved from Instagram`
}

async function handleChatMessage(userId: string, text: string): Promise<string> {
  // Check daily message limit for free users
  const { allowed } = await checkChatLimit(userId)
  if (!allowed) {
    return "You've reached your daily limit of 10 messages. Upgrade to Gold for unlimited conversations! Visit giftist.ai/settings to upgrade."
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { userId, role: 'USER', content: text },
  })

  // Fetch recent history
  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const messages = history
    .reverse()
    .map((m) => ({
      role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))

  // Build system prompt with user context
  const systemPrompt = await buildChatContext(userId)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      userId,
      source: 'WHATSAPP',
    }).catch(() => {})

    const fullContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // Save assistant response
    if (fullContent) {
      await prisma.chatMessage.create({
        data: { userId, role: 'ASSISTANT', content: fullContent },
      })
    }

    // Auto-create events from [EVENT] blocks
    const segments = parseChatContent(fullContent)
    const eventConfirmations: string[] = []
    for (const seg of segments) {
      if (seg.type === 'event') {
        const eventData = seg.data as EventData
        try {
          await prisma.event.create({
            data: {
              userId,
              name: eventData.name,
              type: eventData.type,
              date: new Date(eventData.date),
              isPublic: true,
            },
          })
          const dateStr = new Date(eventData.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          eventConfirmations.push(`\n\n📅 I've saved ${eventData.name} (${dateStr}) to your events!`)
        } catch {}
      }
    }

    // Strip product/preference/event blocks for WhatsApp (plain text only)
    const strippedContent = stripSpecialBlocks(fullContent) || "I'm your Gift Concierge — ask me about gift ideas, what's trending, or anything on your wishlist."
    return strippedContent + eventConfirmations.join('')
  } catch (error) {
    console.error('WhatsApp chat error:', error)
    logError({ source: 'WHATSAPP_WEBHOOK', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return "Sorry, I couldn't process that right now. Try sending a product link, photo, or type *help* for instructions."
  }
}

export async function handleImageMessage(
  userId: string,
  listId: string,
  mediaId: string,
  mimeType: string,
  caption: string | undefined,
  phone: string,
): Promise<string> {
  // If caption contains a URL, prefer URL extraction
  if (caption) {
    const urls = caption.match(URL_REGEX)
    if (urls && urls.length > 0) {
      return handleTextMessage(userId, listId, caption, phone)
    }
  }

  let imageBuffer: Buffer
  try {
    imageBuffer = await downloadMedia(mediaId)
  } catch (e) {
    return "Couldn't download the image. Please try again."
  }

  const product = await extractProductFromImage(imageBuffer, mimeType, caption)
  if (!product) {
    return "Couldn't identify a product. Try sending a link instead."
  }

  const visionName = product.brand ? `${product.brand} ${product.name}` : product.name
  console.log('[IMAGE] Vision identified:', visionName, '| brand:', product.brand, '| price:', product.price)

  // Search retailers for a real product link
  const { bestResult, results } = await searchRetailers(product.name, product.brand, product.description)
  console.log('[IMAGE] Retailer search results:', results.length, '| best:', bestResult?.retailer, bestResult?.url)

  let itemUrl = 'whatsapp://image'
  let itemDomain = 'whatsapp'
  let itemImage: string | null = null
  let itemPrice = product.price
  let itemPriceValue = product.priceValue

  if (bestResult) {
    itemUrl = bestResult.url
    try {
      itemDomain = new URL(bestResult.url).hostname
    } catch {
      itemDomain = bestResult.retailer.toLowerCase()
    }

    // Try to scrape the retailer page for an image and better price
    try {
      const scraped = await extractProductFromUrl(bestResult.url)
      console.log('[IMAGE] Scraped:', scraped.name, '| image:', !!scraped.image, '| price:', scraped.price)
      if (scraped.image) itemImage = scraped.image
      // Price priority: scraped > search result > vision-extracted
      if (scraped.priceValue) {
        itemPrice = scraped.price
        itemPriceValue = scraped.priceValue
      } else if (bestResult.priceValue) {
        itemPrice = bestResult.price
        itemPriceValue = bestResult.priceValue
      }
    } catch (e) {
      console.log('[IMAGE] Scrape failed:', (e as Error).message)
      // Scrape failed — use search result price if available
      if (bestResult.priceValue) {
        itemPrice = bestResult.price
        itemPriceValue = bestResult.priceValue
      }
    }
  }

  console.log('[IMAGE] Final:', { url: itemUrl, domain: itemDomain, image: !!itemImage, price: itemPrice })

  // Guardrails: require real URL and image before saving
  if (itemUrl === 'whatsapp://image' || !itemImage) {
    return `I identified this as *${visionName}*, but couldn't get complete product details. Could you send me a direct product link instead?`
  }

  // Store as pending and ask for confirmation
  const pendingData: PendingProduct = {
    name: visionName,
    price: itemPrice,
    priceValue: itemPriceValue,
    image: itemImage,
    url: itemUrl,
    domain: itemDomain,
  }
  await prisma.user.update({
    where: { id: userId },
    data: { pendingProduct: JSON.stringify(pendingData) },
  })

  const priceStr = itemPrice ? ` (${itemPrice})` : ''

  if (itemImage) {
    try {
      await sendImageMessage(phone, itemImage, `I found *${visionName}*${priceStr} from ${itemDomain}\n\nWant me to add this to your wishlist? Reply *yes* to add.`)
      return ''
    } catch {}
  }

  return `I found *${visionName}*${priceStr}. Want me to add this to your wishlist? Reply *yes* to add.`
}

export function getWelcomeMessage(name?: string): string {
  const greeting = name ? `Hi ${name}!` : 'Hi there!'
  return `${greeting} I'm your Gift Concierge from The Giftist.

I can help you:
- Save products — just send me a *link* or *photo*
- Find the perfect gift — ask me anything
- Manage your wishlist — type *list* to see your saves

Think of me as your personal shopper who's always available. What are you looking for?`
}

export function getHelpMessage(): string {
  return `*The Giftist* — Your Gift Concierge

Here's what I can do:
- *Send a link* — I'll save the product to your list
- *Send a photo* — I'll identify it and add it
- *Ask me anything* — Gift ideas, recommendations, trends
- *list* — See your recent saves
- *share* — Get a link to share your wishlist
- *remove <number>* — Remove an item (e.g. "remove 3")
- *help* — Show this message

Your full wishlist is at giftist.ai`
}

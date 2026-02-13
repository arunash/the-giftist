import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { extractProductFromImage } from '@/lib/extract-image'
import { downloadMedia, sendTextMessage, sendImageMessage } from '@/lib/whatsapp'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi

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

  // Command: help
  if (trimmed === 'help' || trimmed === 'hi' || trimmed === 'hello') {
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

  // Try to extract URLs
  const urls = text.match(URL_REGEX)
  if (urls && urls.length > 0) {
    const url = urls[0]
    // Check for duplicate URL in this user's items
    const existing = await prisma.item.findFirst({
      where: { userId, url },
    })
    if (existing) return `You already saved this: ${existing.name}`

    const product = await extractProductFromUrl(url)

    const item = await prisma.item.create({
      data: {
        userId,
        name: product.name,
        price: product.price,
        priceValue: product.priceValue,
        image: product.image,
        url: product.url,
        domain: product.domain,
        goalAmount: product.priceValue,
      },
    })

    await prisma.giftListItem.create({
      data: { listId, itemId: item.id, addedById: userId },
    })

    const priceStr = product.price ? ` (${product.price})` : ''

    // If we got an image, reply with it
    if (product.image) {
      try {
        await sendImageMessage(phone, product.image, `Added: ${product.name}${priceStr}`)
        return '' // empty string means we already sent a reply
      } catch {
        // fall through to text reply
      }
    }

    if (product.name === product.domain) {
      return `Saved the link but couldn't extract product details. You can view it on your dashboard.`
    }

    return `Added: ${product.name}${priceStr}`
  }

  return "I didn't find a link in your message. Send me a product URL, photo, or type *help* for instructions."
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

  const item = await prisma.item.create({
    data: {
      userId,
      name: product.brand ? `${product.brand} ${product.name}` : product.name,
      price: product.price,
      priceValue: product.priceValue,
      image: null,
      url: 'whatsapp://image',
      domain: 'whatsapp',
      goalAmount: product.priceValue,
    },
  })

  await prisma.giftListItem.create({
    data: { listId, itemId: item.id, addedById: userId },
  })

  const priceStr = product.price ? ` (${product.price})` : ''
  return `Added: ${product.name}${priceStr}`
}

export function getWelcomeMessage(name?: string): string {
  const greeting = name ? `Hi ${name}!` : 'Hi there!'
  return `${greeting} Welcome to The Giftist!

Send me:
- A *product link* from any store
- A *photo* of something you want
- *list* to see your saved items
- *help* for more commands

Everything you send gets saved to your gift list.`
}

export function getHelpMessage(): string {
  return `*The Giftist* - Your gift list assistant

Send me:
- *Product URL* — I'll extract the details and save it
- *Product photo* — I'll identify it and add it
- *list* — See your recent saves
- *remove <number>* — Remove an item (e.g. "remove 3")
- *help* — Show this message

View your full list at giftist.ai`
}

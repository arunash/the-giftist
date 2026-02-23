import { prisma } from './db'
import { calculateGoalAmount } from './platform-fee'

interface DefaultItem {
  name: string
  price: string
  priceValue: number
  url: string
  domain: string
  image: string
}

interface DefaultEventDef {
  name: string
  type: string
  getNextDate: () => Date
  items: DefaultItem[]
}

// Date helpers

function getNextOccurrence(month: number, day: number): Date {
  const now = new Date()
  const thisYear = new Date(now.getFullYear(), month - 1, day)
  if (thisYear > now) return thisYear
  return new Date(now.getFullYear() + 1, month - 1, day)
}

function getNthSunday(year: number, month: number, n: number): Date {
  const first = new Date(year, month - 1, 1)
  const firstDay = first.getDay()
  const date = 1 + ((7 - firstDay) % 7) + (n - 1) * 7
  return new Date(year, month - 1, date)
}

function getNextMothersDay(): Date {
  const now = new Date()
  let d = getNthSunday(now.getFullYear(), 5, 2)
  if (d <= now) d = getNthSunday(now.getFullYear() + 1, 5, 2)
  return d
}

function getNextFathersDay(): Date {
  const now = new Date()
  let d = getNthSunday(now.getFullYear(), 6, 3)
  if (d <= now) d = getNthSunday(now.getFullYear() + 1, 6, 3)
  return d
}

function getNextFriendshipDay(): Date {
  const now = new Date()
  let d = getNthSunday(now.getFullYear(), 8, 1)
  if (d <= now) d = getNthSunday(now.getFullYear() + 1, 8, 1)
  return d
}

// Curated gift items — gender neutral, ~$50 total per event, from Etsy + Amazon
// Images from Unsplash (stable, high-quality, free to use)

const CHRISTMAS_ITEMS: DefaultItem[] = [
  { name: 'Scented Candle Gift Set', price: '$8.99', priceValue: 8.99, url: 'https://www.amazon.com/s?k=scented+candle+gift+set+christmas', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop' },
  { name: 'Cozy Knit Socks', price: '$4.99', priceValue: 4.99, url: 'https://www.amazon.com/s?k=cozy+knit+socks+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=400&h=400&fit=crop' },
  { name: 'Artisan Hot Chocolate Bombs', price: '$6.99', priceValue: 6.99, url: 'https://www.etsy.com/search?q=hot+chocolate+bombs+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&h=400&fit=crop' },
  { name: 'Handmade Christmas Ornament', price: '$4.49', priceValue: 4.49, url: 'https://www.etsy.com/search?q=handmade+christmas+ornament', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1512389098783-66b81f86e199?w=400&h=400&fit=crop' },
  { name: 'Soft Throw Blanket', price: '$7.99', priceValue: 7.99, url: 'https://www.amazon.com/s?k=soft+throw+blanket+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop' },
  { name: 'Holiday Ceramic Mug', price: '$4.99', priceValue: 4.99, url: 'https://www.etsy.com/search?q=holiday+ceramic+mug', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop' },
  { name: 'Gourmet Cookie Tin', price: '$3.99', priceValue: 3.99, url: 'https://www.amazon.com/s?k=gourmet+cookie+tin+christmas', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop' },
  { name: 'LED String Lights', price: '$3.49', priceValue: 3.49, url: 'https://www.amazon.com/s?k=led+string+lights+warm', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=400&h=400&fit=crop' },
  { name: 'Stocking Stuffer Treats', price: '$2.99', priceValue: 2.99, url: 'https://www.amazon.com/s?k=stocking+stuffer+treats', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400&h=400&fit=crop' },
  { name: 'Holiday Greeting Card Set', price: '$2.99', priceValue: 2.99, url: 'https://www.etsy.com/search?q=holiday+greeting+card+set', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&h=400&fit=crop' },
]

const MOTHERS_DAY_ITEMS: DefaultItem[] = [
  { name: 'Bath Bomb Gift Set', price: '$7.99', priceValue: 7.99, url: 'https://www.etsy.com/search?q=bath+bomb+gift+set', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1610397962076-02407a169a5b?w=400&h=400&fit=crop' },
  { name: 'Personalized Jewelry Dish', price: '$5.99', priceValue: 5.99, url: 'https://www.etsy.com/search?q=personalized+jewelry+dish', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=400&fit=crop' },
  { name: 'Soy Candle — Lavender', price: '$6.99', priceValue: 6.99, url: 'https://www.etsy.com/search?q=soy+candle+lavender+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1596638787647-904d822d751e?w=400&h=400&fit=crop' },
  { name: 'Floral Tea Sampler', price: '$5.49', priceValue: 5.49, url: 'https://www.amazon.com/s?k=floral+tea+sampler+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop' },
  { name: 'Hand Cream Gift Set', price: '$4.99', priceValue: 4.99, url: 'https://www.amazon.com/s?k=hand+cream+gift+set', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop' },
  { name: 'Mini Succulent Planter', price: '$4.99', priceValue: 4.99, url: 'https://www.etsy.com/search?q=mini+succulent+planter+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=400&fit=crop' },
  { name: 'Inspirational Journal', price: '$4.99', priceValue: 4.99, url: 'https://www.amazon.com/s?k=inspirational+journal+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&h=400&fit=crop' },
  { name: 'Face Mask Variety Pack', price: '$3.99', priceValue: 3.99, url: 'https://www.amazon.com/s?k=face+mask+variety+pack+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=400&fit=crop' },
  { name: 'Dried Flower Bouquet', price: '$3.49', priceValue: 3.49, url: 'https://www.etsy.com/search?q=dried+flower+bouquet+small', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=400&h=400&fit=crop' },
  { name: 'Watercolor Card with Envelope', price: '$2.49', priceValue: 2.49, url: 'https://www.etsy.com/search?q=watercolor+card+mothers+day', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&h=400&fit=crop' },
]

const FATHERS_DAY_ITEMS: DefaultItem[] = [
  { name: 'BBQ Spice Rub Set', price: '$7.99', priceValue: 7.99, url: 'https://www.amazon.com/s?k=bbq+spice+rub+gift+set', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=400&h=400&fit=crop' },
  { name: 'Leather Keychain', price: '$5.99', priceValue: 5.99, url: 'https://www.etsy.com/search?q=leather+keychain+personalized', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1622434641406-a158123450f9?w=400&h=400&fit=crop' },
  { name: 'Insulated Travel Mug', price: '$6.99', priceValue: 6.99, url: 'https://www.amazon.com/s?k=insulated+travel+mug', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=400&h=400&fit=crop' },
  { name: 'Desk Organizer', price: '$5.49', priceValue: 5.49, url: 'https://www.etsy.com/search?q=desk+organizer+wood', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&h=400&fit=crop' },
  { name: 'Gourmet Snack Box', price: '$5.99', priceValue: 5.99, url: 'https://www.amazon.com/s?k=gourmet+snack+box+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=400&fit=crop' },
  { name: 'Multi-Tool Pen', price: '$4.49', priceValue: 4.49, url: 'https://www.amazon.com/s?k=multi+tool+pen+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=400&h=400&fit=crop' },
  { name: 'Funny Coffee Mug', price: '$4.99', priceValue: 4.99, url: 'https://www.etsy.com/search?q=funny+coffee+mug+dad', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1572119865084-43c285814d63?w=400&h=400&fit=crop' },
  { name: 'Bamboo Phone Stand', price: '$3.99', priceValue: 3.99, url: 'https://www.amazon.com/s?k=bamboo+phone+stand', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&fit=crop' },
  { name: 'Premium Lip Balm Set', price: '$2.99', priceValue: 2.99, url: 'https://www.amazon.com/s?k=premium+lip+balm+set', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?w=400&h=400&fit=crop' },
  { name: 'Card Game for Families', price: '$2.99', priceValue: 2.99, url: 'https://www.amazon.com/s?k=card+game+family+fun', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=400&h=400&fit=crop' },
]

const VALENTINES_ITEMS: DefaultItem[] = [
  { name: 'Chocolate Truffle Box', price: '$7.99', priceValue: 7.99, url: 'https://www.amazon.com/s?k=chocolate+truffle+box+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&h=400&fit=crop' },
  { name: 'Couples Card Game', price: '$6.99', priceValue: 6.99, url: 'https://www.amazon.com/s?k=couples+card+game', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&h=400&fit=crop' },
  { name: 'Heart-Shaped Candle', price: '$5.99', priceValue: 5.99, url: 'https://www.etsy.com/search?q=heart+shaped+candle', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=400&fit=crop' },
  { name: 'Handmade Photo Frame', price: '$5.49', priceValue: 5.49, url: 'https://www.etsy.com/search?q=handmade+photo+frame+love', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop' },
  { name: 'Rose Bath Salt Set', price: '$4.99', priceValue: 4.99, url: 'https://www.etsy.com/search?q=rose+bath+salt+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1600428877878-1a0fd85beda8?w=400&h=400&fit=crop' },
  { name: 'Love Coupon Book', price: '$4.49', priceValue: 4.49, url: 'https://www.etsy.com/search?q=love+coupon+book', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=400&fit=crop' },
  { name: 'Matching Bracelet Set', price: '$4.99', priceValue: 4.99, url: 'https://www.etsy.com/search?q=matching+bracelet+set+couple', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop' },
  { name: 'Gourmet Cookie Set', price: '$3.99', priceValue: 3.99, url: 'https://www.amazon.com/s?k=gourmet+cookie+set+valentines', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=400&fit=crop' },
  { name: 'Rose Petal Soap', price: '$2.99', priceValue: 2.99, url: 'https://www.etsy.com/search?q=rose+petal+soap+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=400&fit=crop' },
  { name: 'Heart Keychain', price: '$2.99', priceValue: 2.99, url: 'https://www.etsy.com/search?q=heart+keychain+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=400&fit=crop' },
]

const FRIENDSHIP_DAY_ITEMS: DefaultItem[] = [
  { name: 'Friendship Bracelet Kit', price: '$6.99', priceValue: 6.99, url: 'https://www.etsy.com/search?q=friendship+bracelet+kit', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=400&h=400&fit=crop' },
  { name: 'Snack Box Sampler', price: '$6.99', priceValue: 6.99, url: 'https://www.amazon.com/s?k=snack+box+sampler+gift', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=400&fit=crop' },
  { name: 'Fun Board Game', price: '$5.99', priceValue: 5.99, url: 'https://www.amazon.com/s?k=fun+board+game+friends', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=400&h=400&fit=crop' },
  { name: 'Matching Socks Set', price: '$4.99', priceValue: 4.99, url: 'https://www.amazon.com/s?k=matching+socks+set+friends', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=400&h=400&fit=crop' },
  { name: 'Custom Sticker Pack', price: '$4.49', priceValue: 4.49, url: 'https://www.etsy.com/search?q=custom+sticker+pack+fun', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=400&h=400&fit=crop' },
  { name: 'Movie Night Snack Set', price: '$5.49', priceValue: 5.49, url: 'https://www.amazon.com/s?k=movie+night+snack+set', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=400&h=400&fit=crop' },
  { name: 'Jigsaw Puzzle', price: '$4.99', priceValue: 4.99, url: 'https://www.amazon.com/s?k=jigsaw+puzzle+fun+500', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=400&h=400&fit=crop' },
  { name: 'Mini Photo Album', price: '$3.99', priceValue: 3.99, url: 'https://www.etsy.com/search?q=mini+photo+album+friends', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=400&fit=crop' },
  { name: 'Friendship Card Set', price: '$3.49', priceValue: 3.49, url: 'https://www.etsy.com/search?q=friendship+card+set', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&h=400&fit=crop' },
  { name: 'Lip Balm Gift Set', price: '$2.99', priceValue: 2.99, url: 'https://www.etsy.com/search?q=lip+balm+gift+set', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?w=400&h=400&fit=crop' },
]

const BIRTHDAY_ITEMS: DefaultItem[] = [
  { name: 'Birthday Candle Set', price: '$5.99', priceValue: 5.99, url: 'https://www.etsy.com/search?q=birthday+candle+set+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&h=400&fit=crop' },
  { name: 'Party Decorations Kit', price: '$4.99', priceValue: 4.99, url: 'https://www.amazon.com/s?k=birthday+party+decorations', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=400&fit=crop' },
  { name: 'Gourmet Cupcake Mix', price: '$6.99', priceValue: 6.99, url: 'https://www.amazon.com/s?k=gourmet+cupcake+mix+birthday', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1587668178277-295251f900ce?w=400&h=400&fit=crop' },
  { name: 'Birthday Cake Candle', price: '$5.49', priceValue: 5.49, url: 'https://www.etsy.com/search?q=birthday+cake+scented+candle', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop' },
  { name: 'Confetti Gift Bag', price: '$3.99', priceValue: 3.99, url: 'https://www.amazon.com/s?k=confetti+gift+bag', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238f939?w=400&h=400&fit=crop' },
  { name: 'Personalized Keychain', price: '$4.99', priceValue: 4.99, url: 'https://www.etsy.com/search?q=personalized+keychain+birthday', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1622434641406-a158123450f9?w=400&h=400&fit=crop' },
  { name: 'Treat Box Assortment', price: '$5.49', priceValue: 5.49, url: 'https://www.amazon.com/s?k=treat+box+assortment+birthday', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop' },
  { name: 'Mini Succulent Gift', price: '$4.49', priceValue: 4.49, url: 'https://www.etsy.com/search?q=mini+succulent+gift', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=400&fit=crop' },
  { name: 'Birthday Card Set', price: '$3.99', priceValue: 3.99, url: 'https://www.etsy.com/search?q=birthday+card+handmade', domain: 'etsy.com', image: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&h=400&fit=crop' },
  { name: 'Balloon Bouquet', price: '$3.99', priceValue: 3.99, url: 'https://www.amazon.com/s?k=birthday+balloon+bouquet', domain: 'amazon.com', image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=400&h=400&fit=crop' },
]

const DEFAULT_EVENTS: DefaultEventDef[] = [
  { name: 'Christmas', type: 'CHRISTMAS', getNextDate: () => getNextOccurrence(12, 25), items: CHRISTMAS_ITEMS },
  { name: "Mother's Day", type: 'HOLIDAY', getNextDate: getNextMothersDay, items: MOTHERS_DAY_ITEMS },
  { name: "Father's Day", type: 'HOLIDAY', getNextDate: getNextFathersDay, items: FATHERS_DAY_ITEMS },
  { name: "Valentine's Day", type: 'HOLIDAY', getNextDate: () => getNextOccurrence(2, 14), items: VALENTINES_ITEMS },
  { name: 'Friendship Day', type: 'HOLIDAY', getNextDate: getNextFriendshipDay, items: FRIENDSHIP_DAY_ITEMS },
]

/**
 * Creates default holiday events with curated gift items for a new user.
 * Optionally creates a birthday event if birthDate is provided.
 * Skips events that already exist for the user.
 */
export async function createDefaultEventsForUser(userId: string, birthDate?: Date) {
  try {
    // Check which events already exist
    const existing = await prisma.event.findMany({
      where: { userId },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((e) => e.name))

    const eventsToCreate = DEFAULT_EVENTS.filter((e) => !existingNames.has(e.name))

    // Add birthday event if birth date provided
    if (birthDate && !existingNames.has('My Birthday')) {
      const month = birthDate.getMonth() + 1
      const day = birthDate.getDate()
      eventsToCreate.push({
        name: 'My Birthday',
        type: 'BIRTHDAY',
        getNextDate: () => getNextOccurrence(month, day),
        items: BIRTHDAY_ITEMS,
      })
    }

    if (eventsToCreate.length === 0) return

    for (const eventDef of eventsToCreate) {
      // Create items for this event (skip duplicates by name)
      const createdItems = await Promise.all(
        eventDef.items.map(async (item) => {
          const existing = await prisma.item.findFirst({
            where: { userId, name: { equals: item.name, mode: 'insensitive' } },
          })
          if (existing) return existing

          const fee = calculateGoalAmount(item.priceValue)
          return prisma.item.create({
            data: {
              userId,
              name: item.name,
              price: item.price,
              priceValue: item.priceValue,
              image: item.image,
              url: item.url,
              domain: item.domain,
              source: 'MANUAL',
              goalAmount: fee.goalAmount,
            },
          })
        })
      )

      // Create event with items linked
      await prisma.event.create({
        data: {
          userId,
          name: eventDef.name,
          type: eventDef.type,
          date: eventDef.getNextDate(),
          isPublic: true,
          items: {
            create: createdItems.map((item, i) => ({
              itemId: item.id,
              priority: i,
            })),
          },
        },
      })
    }

    console.log(`[Onboarding] Created ${eventsToCreate.length} default events for user ${userId}`)
  } catch (error) {
    console.error('[Onboarding] Error creating default events:', error)
  }
}

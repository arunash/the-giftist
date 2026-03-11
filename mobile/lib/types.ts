// TypeScript types mirroring Prisma models

export interface User {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  image: string | null
  birthday: string | null
  gender: string | null
  ageRange: string | null
  interests: string | null
  giftBudget: string | null
  relationship: string | null
  shareId: string | null
  timezone: string | null
  isActive: boolean
  createdAt: string
}

export interface Item {
  id: string
  userId: string
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  url: string
  domain: string
  category: string | null
  source: string
  notes: string | null
  tags: string | null
  goalAmount: number | null
  fundedAmount: number
  isPurchased: boolean
  addedAt: string
}

export interface Event {
  id: string
  userId: string
  name: string
  type: string
  date: string
  description: string | null
  shareUrl: string | null
  isPublic: boolean
  fundedAmount: number
  createdAt: string
  items?: EventItem[]
}

export interface EventItem {
  id: string
  eventId: string
  itemId: string
  priority: number
  item?: Item
}

export interface Contribution {
  id: string
  itemId: string | null
  eventId: string | null
  contributorId: string | null
  amount: number
  message: string | null
  isAnonymous: boolean
  status: string
  createdAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  metadata: string | null
  read: boolean
  createdAt: string
}

export interface ActivityEvent {
  id: string
  userId: string
  type: string
  visibility: string
  metadata: string | null
  itemId: string | null
  createdAt: string
  item?: Item
  user?: Pick<User, 'id' | 'name' | 'image'>
}

export interface CircleMember {
  id: string
  phone: string
  name: string | null
  relationship: string | null
  source: string
  createdAt: string
}

export interface Wallet {
  id: string
  balance: number
}

export interface WalletTransaction {
  id: string
  type: string
  amount: number
  status: string
  description: string | null
  createdAt: string
}

export interface Subscription {
  id: string
  status: string
  currentPeriodEnd: string | null
}

export interface GiftList {
  id: string
  name: string
  description: string | null
  shareUrl: string
  isPublic: boolean
  eventId: string | null
  items?: GiftListItem[]
}

export interface GiftListItem {
  id: string
  itemId: string
  priority: number
  note: string | null
  item?: Item
}

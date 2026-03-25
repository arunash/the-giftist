import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  parseWhatsAppExport,
  identifySenders,
  filterAndSampleMessages,
  extractFriendProfile,
  suggestGiftsFromProfile,
} from '@/lib/chat-analysis'
import { extractChatText, isSupportedChatFile } from '@/lib/extract-chat-file'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const friendName = formData.get('friendName') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  // Validate file
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
  }

  if (!isSupportedChatFile(file.type, file.name)) {
    return NextResponse.json({
      error: 'Unsupported file type. Please upload a .txt or .zip WhatsApp chat export.',
    }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const text = await extractChatText(buffer, file.type, file.name)

  if (!text) {
    return NextResponse.json({
      error: 'Could not find a chat file. Make sure you exported the chat from WhatsApp (tap ⋮ → More → Export Chat) and upload the file here.',
    }, { status: 400 })
  }

  const messages = parseWhatsAppExport(text)

  if (messages.length < 10) {
    return NextResponse.json({
      error: 'Could not parse as a WhatsApp chat export. Make sure you export the chat from WhatsApp (tap ⋮ → More → Export Chat) and send me the file.',
    }, { status: 400 })
  }

  const senders = identifySenders(messages)

  // Step 1: If no friendName, return sender list for user to pick
  if (!friendName) {
    return NextResponse.json({
      step: 'pick_sender',
      senders,
      totalMessages: messages.length,
    })
  }

  // Check Gift DNA limit
  const { checkProfileLimit } = await import('@/lib/chat-context')
  const { allowed: profileAllowed } = await checkProfileLimit((session.user as any).id)
  if (!profileAllowed) {
    return NextResponse.json({
      error: "You've used your 2 free Gift DNA analyses. Buy a Credit Pack or upgrade to Gold for more!",
    }, { status: 429 })
  }

  // Step 2: Extract profile for the selected sender
  const filtered = filterAndSampleMessages(messages, friendName)

  if (filtered.length < 5) {
    return NextResponse.json({
      error: `Not enough messages from "${friendName}" to analyze. Found ${filtered.length} substantive messages.`,
    }, { status: 400 })
  }

  const profile = await extractFriendProfile(filtered, friendName)
  const userId = (session.user as any).id
  const suggestions = await suggestGiftsFromProfile(profile, friendName, { userId, source: 'WEB' }).catch(() => [])

  return NextResponse.json({
    step: 'review',
    friendName,
    messagesAnalyzed: filtered.length,
    profile,
    suggestions,
  })
}

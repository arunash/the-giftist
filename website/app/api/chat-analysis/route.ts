import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  parseWhatsAppExport,
  identifySenders,
  filterAndSampleMessages,
  extractFriendProfile,
} from '@/lib/chat-analysis'

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
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  const text = await file.text()
  const messages = parseWhatsAppExport(text)

  if (messages.length < 10) {
    return NextResponse.json({
      error: 'Could not parse as a WhatsApp chat export. Make sure you export the chat from WhatsApp (Settings → Chat → Export Chat) and upload the .txt file.',
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

  // Step 2: Extract profile for the selected sender
  const filtered = filterAndSampleMessages(messages, friendName)

  if (filtered.length < 5) {
    return NextResponse.json({
      error: `Not enough messages from "${friendName}" to analyze. Found ${filtered.length} substantive messages.`,
    }, { status: 400 })
  }

  const profile = await extractFriendProfile(filtered, friendName)

  return NextResponse.json({
    step: 'review',
    friendName,
    messagesAnalyzed: filtered.length,
    profile,
  })
}

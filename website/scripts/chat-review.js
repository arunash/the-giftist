const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  const chats = await prisma.chatMessage.findMany({
    where: { createdAt: { gte: todayStart } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } }
  })

  console.log('=== WEB CHAT MESSAGES TODAY ===\n')
  let currentUser = ''
  for (const msg of chats) {
    const userName = (msg.user && msg.user.name) || 'Unknown'
    if (userName !== currentUser) {
      currentUser = userName
      console.log('\n--- ' + userName + ' ---')
    }
    const role = msg.role === 'USER' ? 'USER' : 'BOT'
    const text = msg.content.length > 600 ? msg.content.slice(0, 600) + '...' : msg.content
    console.log('[' + role + '] ' + text + '\n')
  }

  // Also get WhatsApp messages
  const waMessages = await prisma.whatsAppMessage.findMany({
    where: { createdAt: { gte: todayStart } },
    orderBy: { createdAt: 'asc' },
    select: { phone: true, type: true, content: true, createdAt: true }
  })

  console.log('\n=== WHATSAPP MESSAGES TODAY ===\n')
  for (const msg of waMessages) {
    const role = msg.type === 'INBOUND' ? 'USER' : 'BOT'
    const text = (msg.content || '').length > 600 ? msg.content.slice(0, 600) + '...' : (msg.content || '(no body)')
    console.log('[' + role + ' ' + msg.phone + '] ' + text + '\n')
  }
}

main().catch(console.error).finally(function() { prisma.$disconnect() })

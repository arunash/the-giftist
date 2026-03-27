const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const user = await p.user.findFirst({ where: { name: { contains: 'Jayaram' } } });
  if (!user) { console.log('User not found'); return; }
  console.log('User:', user.name, '| ID:', user.id, '| Phone:', user.phone);

  const msgs = await p.chatMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  if (msgs.length === 0) console.log('(no web chat messages)');
  msgs.forEach(m => console.log('[' + m.role + '] ' + m.content.substring(0, 800)));

  console.log('\n--- WHATSAPP ---');
  const phone = user.phone ? user.phone.replace('+', '') : '';
  if (phone) {
    const wa = await p.whatsAppMessage.findMany({ where: { phone }, orderBy: { createdAt: 'asc' } });
    wa.forEach(m => console.log('[' + m.type + '/' + m.status + '] ' + (m.content || '').substring(0, 500)));
  }

  console.log('\n--- ITEMS (non-seed) ---');
  const items = await p.item.findMany({ where: { userId: user.id, source: { not: 'SEED' } }, select: { name: true, image: true, url: true, source: true, addedAt: true } });
  if (items.length === 0) console.log('(no real items)');
  items.forEach(i => console.log(i.name, '| image:', i.image ? i.image.substring(0, 80) : 'NO', '| source:', i.source));

  await p.$disconnect();
}

main().catch(console.error);

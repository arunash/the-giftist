const { PrismaClient } = require("../node_modules/@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: {
      id: true, name: true, phone: true, createdAt: true,
      funnelStage: true, followUpStage: true, isActive: true,
      subscription: { select: { status: true } },
      _count: {
        select: {
          items: true,
          events: true,
          circleMembers: true,
          chatMessages: true,
        }
      },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const u of users) {
    const realItems = await prisma.item.count({ where: { userId: u.id, source: { not: "SEED" } } });
    const seedItems = await prisma.item.count({ where: { userId: u.id, source: "SEED" } });
    const lastMsg = await prisma.whatsAppMessage.findFirst({
      where: { phone: u.phone },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const inboundMsgs = await prisma.whatsAppMessage.count({
      where: { phone: u.phone, status: "RECEIVED" },
    });
    const lastItem = await prisma.item.findFirst({
      where: { userId: u.id, source: { not: "SEED" } },
      orderBy: { addedAt: "desc" },
      select: { name: true, addedAt: true },
    });

    const daysSinceSignup = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000);
    const daysSinceLastMsg = lastMsg ? Math.floor((Date.now() - new Date(lastMsg.createdAt).getTime()) / 86400000) : null;

    let funnel = {};
    try { funnel = JSON.parse(u.funnelStage || "{}"); } catch {}

    const tier = (u.subscription && u.subscription.status === "ACTIVE") ? "GOLD" : "Free";
    const lastMsgStr = (daysSinceLastMsg !== null) ? (daysSinceLastMsg + "d ago") : "never";
    const lastItemStr = lastItem ? (lastItem.name + " (" + new Date(lastItem.addedAt).toLocaleDateString() + ")") : "none";

    console.log("---");
    console.log("Name:", u.name || "(no name)", "|", u.phone);
    console.log("Signed up:", new Date(u.createdAt).toLocaleDateString(), "(" + daysSinceSignup + "d ago)");
    console.log("Tier:", tier, "| Active:", u.isActive);
    console.log("Real items:", realItems, "| Seed items:", seedItems, "| Events:", u._count.events, "| Circle:", u._count.circleMembers);
    console.log("Chat messages:", u._count.chatMessages, "| WA inbound:", inboundMsgs);
    console.log("Last WA:", lastMsgStr);
    console.log("Last real item:", lastItemStr);
    console.log("Funnel:", JSON.stringify(funnel));
    console.log("Follow-up stage:", u.followUpStage || 0);
  }

  console.log("");
  console.log("=== SUMMARY ===");
  console.log("Total users with phone:", users.length);
  console.log("Active:", users.filter(u => u.isActive).length);
  console.log("Gold:", users.filter(u => u.subscription && u.subscription.status === "ACTIVE").length);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

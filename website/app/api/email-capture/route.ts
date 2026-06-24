import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FD_GIFTS = [
  { name: 'Noise-Canceling Headphones', url: 'https://giftist.ai/p/1rmUI4g4' },
  { name: 'Apple AirPods Pro (2nd Gen)', url: 'https://giftist.ai/p/jCmp7G0B' },
  { name: 'Vitamix Explorian E310 Blender', url: 'https://giftist.ai/p/ezK5Cv9s' },
  { name: 'SpaFinder Gift Card', url: 'https://giftist.ai/p/1pIuIMhN' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, source, occasion } = body as {
      email: string;
      source?: string;
      occasion?: string;
    };

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    console.log('[email-capture]', { email, source, occasion, ts: new Date().toISOString() });

    const giftHtml = FD_GIFTS.map(
      (g) => `<li><a href="${g.url}" style="color:#f59e0b;font-weight:bold;">${g.name}</a></li>`
    ).join('');

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="background:#1a0a00;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <h1 style="color:#f59e0b;font-size:28px;margin:0 0 16px;">🎁 Here are your top Father's Day picks</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Father's Day is <strong>June 21</strong> — here are 4 curated picks that consistently top our gift charts:</p>
    <ul style="padding:0 0 0 20px;margin:0 0 24px;">
      ${giftHtml}
    </ul>
    <p style="font-size:14px;color:#9ca3af;margin:0 0 24px;">Each link goes directly to the product so you can buy in under 2 minutes.</p>
    <p style="font-size:14px;line-height:1.6;">Want a more personalized recommendation? <a href="https://wa.me/15014438478" style="color:#25D366;">Chat with our AI concierge on WhatsApp</a> — just tell us a few things about your dad.</p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:32px 0;"/>
    <p style="font-size:12px;color:#6b7280;margin:0;">Giftist AI Gift Concierge &mdash; <a href="https://giftist.ai" style="color:#6b7280;">giftist.ai</a></p>
  </div>
</body>
</html>`;

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Giftist <digest@giftist.ai>',
        to: email,
        subject: "🎁 Your Father's Day gift picks are here",
        html: htmlBody,
      });
    } else {
      console.warn('[email-capture] RESEND_API_KEY not set — skipping send');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email-capture] error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

'use client';

import { useState, useEffect } from 'react';

const WA_LINK = 'https://wa.me/15014438478';

function Countdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 });

  useEffect(() => {
    function calc() {
      const now = new Date();
      const fd = new Date('2026-06-21T00:00:00-07:00');
      const diff = fd.getTime() - now.getTime();
      if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { days, hours, mins };
    }
    setTimeLeft(calc());
    const timer = setInterval(() => setTimeLeft(calc()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', margin: '16px 0' }}>
      {[{ v: timeLeft.days, l: 'DAYS' }, { v: timeLeft.hours, l: 'HRS' }, { v: timeLeft.mins, l: 'MINS' }].map(({ v, l }) => (
        <div key={l} style={{ textAlign: 'center', background: '#1a1a1a', borderRadius: 8, padding: '12px 16px', minWidth: 64 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

export default function FDDirectResponsePage() {
  function handleClick() {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'fd_dr_wa_click', { event_category: 'cta', event_label: 'fd-direct-response' });
    }
    window.open(WA_LINK, '_blank');
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #1a0a00 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Urgency banner */}
      <div style={{
        background: '#d97706',
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        padding: '8px 20px',
        borderRadius: 20,
        marginBottom: 24,
        letterSpacing: '0.05em',
      }}>
        ⏰ FATHER&apos;S DAY IS JUNE 21
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: 'clamp(28px, 6vw, 48px)',
        fontWeight: 900,
        color: '#fff',
        textAlign: 'center',
        lineHeight: 1.15,
        margin: '0 0 16px',
        maxWidth: 600,
      }}>
        What do you get a dad<br />
        <span style={{ color: '#f59e0b' }}>who has everything?</span>
      </h1>

      <p style={{
        fontSize: 'clamp(16px, 3vw, 20px)',
        color: '#e5e7eb',
        textAlign: 'center',
        maxWidth: 480,
        margin: '0 0 8px',
        lineHeight: 1.5,
      }}>
        Tell me about him on WhatsApp. I&apos;ll text you 3 gift ideas in 60 seconds — free.
      </p>

      <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 24px', textAlign: 'center' }}>
        No app. No account. Just WhatsApp.
      </p>

      <Countdown />

      {/* Primary CTA */}
      <button
        onClick={handleClick}
        style={{
          background: '#25D366',
          color: '#fff',
          fontWeight: 800,
          fontSize: 18,
          padding: '18px 40px',
          borderRadius: 50,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 24px rgba(37,211,102,0.4)',
          margin: '8px 0 24px',
          width: '100%',
          maxWidth: 380,
          justifyContent: 'center',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Get 3 Gift Ideas Free
      </button>

      {/* Trust row */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
        {['✅ Free forever', '⚡ 60-second reply', '🎁 Curated by AI'].map(t => (
          <span key={t} style={{ color: '#9ca3af', fontSize: 13 }}>{t}</span>
        ))}
      </div>

      {/* Social proof */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '16px 24px',
        maxWidth: 400,
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{ color: '#e5e7eb', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          &ldquo;I told it my dad likes woodworking and hates clutter. It sent me 3 perfect picks under $80. Ordered in 5 minutes.&rdquo;
        </p>
        <p style={{ color: '#9ca3af', fontSize: 12, margin: '8px 0 0' }}>— Sarah M., used Giftist for Father&apos;s Day</p>
      </div>
    </main>
  );
}

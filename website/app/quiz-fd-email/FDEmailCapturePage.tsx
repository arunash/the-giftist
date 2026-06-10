'use client';

import { useState, useEffect } from 'react';

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

export default function FDEmailCapturePage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'fd_email_capture_submit', {
          event_category: 'conversion',
          event_label: 'fd-email-capture',
        });
      }
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'quiz-fd-email', occasion: 'fathers-day' }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError('Something went wrong. Try again.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const waLink = 'https://wa.me/15014438478';

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
        Enter your email and I&apos;ll send you 3 personalized gift ideas — free.
      </p>

      <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 24px', textAlign: 'center' }}>
        No spam. One email with your top 3 picks.
      </p>

      <Countdown />

      {!submitted ? (
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 400, margin: '8px 0 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                border: '2px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 16,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#f59e0b',
                color: '#1a0a00',
                fontWeight: 800,
                fontSize: 18,
                padding: '16px 40px',
                borderRadius: 50,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                width: '100%',
              }}
            >
              {loading ? 'Sending...' : 'Get My 3 Gift Ideas →'}
            </button>
          </div>
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 12 }}>
            Or chat now on{' '}
            <a href={waLink} style={{ color: '#25D366', textDecoration: 'underline' }}
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).gtag) {
                  (window as any).gtag('event', 'fd_wa_click_secondary', { event_category: 'cta' });
                }
              }}
            >WhatsApp</a>
          </p>
        </form>
      ) : (
        <div style={{
          background: 'rgba(37,211,102,0.15)',
          border: '2px solid #25D366',
          borderRadius: 16,
          padding: '24px 32px',
          textAlign: 'center',
          maxWidth: 400,
          margin: '8px 0 24px',
        }}>
          <p style={{ color: '#25D366', fontSize: 24, margin: '0 0 8px' }}>✅</p>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Got it! Check your inbox.</p>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>I&apos;ll send 3 Father&apos;s Day gift ideas tailored to your dad in the next few minutes.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
        {['✅ Free forever', '⚡ Fast reply', '🎁 Curated by AI'].map(t => (
          <span key={t} style={{ color: '#9ca3af', fontSize: 13 }}>{t}</span>
        ))}
      </div>

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

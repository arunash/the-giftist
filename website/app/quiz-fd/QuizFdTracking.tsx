'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function QuizFdTracking() {
  useEffect(() => {
    // Fire PAGE_VIEW on mount
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'PAGE_VIEW', {
        event_category: 'lp',
        event_label: 'quiz-fd',
        page_path: '/quiz-fd',
      });
    }

    // Delegate CARD_CLICK events from product cards
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const card = target.closest('[data-slug]') as HTMLElement | null;
      if (card) {
        const slug = card.dataset.slug || '';
        const name = card.dataset.name || '';
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'CARD_CLICK', {
            event_category: 'engagement',
            event_label: 'quiz-fd-card',
            value: slug,
            gift_name: name,
          });
        }
      }
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}

import { Metadata } from 'next'
import { MagicFlow } from './magic-flow'

export const metadata: Metadata = {
  title: 'Find a Gift They\'ll Actually Love · Giftist',
  description: 'Tell us about them. We pick three perfect gifts. That\'s it.',
  alternates: { canonical: 'https://giftist.ai/magic' },
}

export default function MagicPage() {
  return <MagicFlow />
}

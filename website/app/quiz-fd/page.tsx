import { Metadata } from 'next';
import FDDirectResponsePage from './FDDirectResponsePage';

export const metadata: Metadata = {
  title: "Father's Day Gift Ideas | Giftist",
  description: "Father's Day is June 21. Get 3 personalized gift ideas in 60 seconds — free. AI gift concierge on WhatsApp.",
};

export default function Page() {
  return <FDDirectResponsePage />;
}

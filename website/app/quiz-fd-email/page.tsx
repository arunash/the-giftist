import { Metadata } from 'next';
import FDEmailCapturePage from './FDEmailCapturePage';

export const metadata: Metadata = {
  title: "Father's Day Gift Ideas — Free | Giftist",
  description: "Father's Day is June 21. Get 3 personalized gift ideas texted to you — free. Enter your email and we'll reach out in 60 seconds.",
};

export default function Page() {
  return <FDEmailCapturePage />;
}

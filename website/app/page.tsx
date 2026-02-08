import Link from 'next/link'
import { Gift, Calendar, Users, TrendingDown, Chrome } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Gift className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">The Giftist</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-secondary mb-6">
            Your Personal <span className="text-primary">Gift Curator</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Save products from any website, organize gift events, and let friends
            contribute to make your wishes come true.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-primary text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-primary-hover transition flex items-center gap-2"
            >
              <Gift className="h-5 w-5" />
              Start Your Giftist
            </Link>
            <a
              href="#extension"
              className="bg-white text-secondary px-8 py-3 rounded-lg font-semibold text-lg border-2 border-gray-200 hover:border-gray-300 transition flex items-center gap-2"
            >
              <Chrome className="h-5 w-5" />
              Get Extension
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-secondary mb-12">
            Everything You Need for Perfect Gifts
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Gift className="h-8 w-8" />}
              title="Save Anything"
              description="Add products from any website with our Chrome extension. Prices, images, and details are captured automatically."
            />
            <FeatureCard
              icon={<Calendar className="h-8 w-8" />}
              title="Event Planning"
              description="Create events for birthdays, weddings, baby showers, and more. Link your wishlist items to each occasion."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="Group Gifting"
              description="Friends and family can contribute to items. See progress bars and know exactly what's been funded."
            />
            <FeatureCard
              icon={<TrendingDown className="h-8 w-8" />}
              title="Price Tracking"
              description="Get notified when prices drop on your saved items. Never miss a deal on something you want."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20" id="extension">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-secondary mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Install the Extension"
              description="Add The Giftist Chrome extension to your browser. It's free and takes seconds."
            />
            <StepCard
              number="2"
              title="Save Products"
              description="Browse any store and click the extension to save products to your wishlist instantly."
            />
            <StepCard
              number="3"
              title="Share & Receive"
              description="Create events, share with loved ones, and let them contribute to your gifts."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Your Giftist?
          </h2>
          <p className="text-white/90 text-lg mb-8">
            Join thousands of users who've made gift-giving easier and more meaningful.
          </p>
          <Link
            href="/login"
            className="bg-white text-primary px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition inline-block"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Gift className="h-6 w-6" />
              <span className="text-lg font-bold">The Giftist</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2026 The Giftist. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-light text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-secondary mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white font-bold text-xl mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-secondary mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

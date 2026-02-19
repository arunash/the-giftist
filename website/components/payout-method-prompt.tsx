'use client'

import { X } from 'lucide-react'
import BankOnboardingForm from '@/components/wallet/bank-onboarding-form'

interface PayoutMethodPromptProps {
  userName?: string
  userEmail?: string
  onComplete: () => void
  onDismiss?: () => void
}

export default function PayoutMethodPrompt({ userName, onComplete, onDismiss }: PayoutMethodPromptProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        {onDismiss && (
          <button onClick={onDismiss} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Your Bank Account</h2>
        <p className="text-sm text-gray-500 mb-6">
          Set up your bank account to receive gift fund withdrawals directly.
        </p>

        <BankOnboardingForm userName={userName} onSuccess={onComplete} />
      </div>
    </div>
  )
}

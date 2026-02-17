'use client'

import { QRCodeSVG } from 'qrcode.react'
import { MessageCircle } from 'lucide-react'

const WHATSAPP_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER || ''
const PREFILLED_MESSAGE = "Hi"
const WA_LINK = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(PREFILLED_MESSAGE)}`

export function WhatsAppQRBlock() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col items-center max-w-xs">
      <div className="p-2 bg-green-50 rounded-full mb-3">
        <MessageCircle className="h-5 w-5 text-green-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Start on WhatsApp</h3>
      <p className="text-xs text-muted mb-4 text-center">
        Scan to create your Giftist instantly via WhatsApp
      </p>
      <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
        <QRCodeSVG
          value={WA_LINK}
          size={160}
          bgColor="#FFFFFF"
          fgColor="#111827"
          level="M"
          className="rounded-lg"
        />
      </a>
      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Open WhatsApp
      </a>
    </div>
  )
}

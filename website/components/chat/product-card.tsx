'use client'

import { useState } from 'react'
import { Gift, Plus, Check, Share2 } from 'lucide-react'
import { shareOrCopy, giftistShareText } from '@/lib/utils'
import type { ProductData } from '@/lib/parse-chat-content'

interface ProductCardProps {
  product: ProductData
  onAdd?: (product: ProductData) => void
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(!!product.id)
  const [shareCopied, setShareCopied] = useState(false)

  const handleAdd = async () => {
    if (added || adding || !onAdd) return
    setAdding(true)
    try {
      await onAdd(product)
      setAdded(true)
    } catch {
      // handled upstream
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex gap-3 p-3 bg-surface-hover rounded-xl border border-border my-2">
      {/* Image */}
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-raised flex-shrink-0">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover saturate-[1.1] contrast-[1.05] brightness-[1.02]"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift className="h-6 w-6 text-[#333]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-white line-clamp-1">{product.name}</h4>
            {product.price && (
              <p className="text-xs font-semibold text-primary mt-0.5">{product.price}</p>
            )}
          </div>

          {product.id && (
            <button
              className="p-1 text-muted hover:text-white transition flex-shrink-0"
              onClick={async (e) => {
                e.stopPropagation()
                const url = `https://wa.me/15014438478?text=${encodeURIComponent(`👋 Tap send to check out a gift idea on The Giftist!\n\nitem ${product.id}`)}`
                const didShare = await shareOrCopy(url, product.name, giftistShareText('Your friend'))
                if (didShare) {
                  setShareCopied(true)
                  setTimeout(() => setShareCopied(false), 2000)
                }
              }}
              title="Share this item"
            >
              {shareCopied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Action button */}
        <div className="mt-2">
          {added ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Check className="h-3 w-3" />
              On your list
            </span>
          ) : (
            <button
              onClick={handleAdd}
              disabled={adding}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              {adding ? 'Adding...' : 'Add to List'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

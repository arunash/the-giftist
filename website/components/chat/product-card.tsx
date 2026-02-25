'use client'

import { useState, useEffect, useRef } from 'react'
import { Gift, Plus, Check, Share2, Loader2, ExternalLink } from 'lucide-react'
import { shareOrCopy, giftistShareText } from '@/lib/utils'
import { applyAffiliateTag } from '@/lib/affiliate'
import type { ProductData } from '@/lib/parse-chat-content'

interface ProductCardProps {
  product: ProductData
  onAdd?: (product: ProductData) => void
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(!!product.id)
  const [shareCopied, setShareCopied] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(product.image || null)
  const [loadingImage, setLoadingImage] = useState(false)
  const didFetch = useRef(false)

  // Lazy-load image from product URL when no image provided
  useEffect(() => {
    if (previewImage || didFetch.current || !product.url) return
    didFetch.current = true
    setLoadingImage(true)
    fetch(`/api/products/preview?url=${encodeURIComponent(product.url)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.image) setPreviewImage(data.image)
      })
      .catch(() => {})
      .finally(() => setLoadingImage(false))
  }, [previewImage, product.url])

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

  // Build affiliate link for "View" action
  const viewUrl = product.url && !product.url.includes('google.com/search')
    ? applyAffiliateTag(product.url)
    : null

  return (
    <div className="flex gap-3 p-3 bg-surface-hover rounded-xl border border-border my-2">
      {/* Image — clickable if view URL exists */}
      {viewUrl ? (
        <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-lg overflow-hidden bg-surface-raised flex-shrink-0 block">
          {previewImage ? (
            <img
              src={previewImage}
              alt={product.name}
              className="w-full h-full object-cover saturate-[1.1] contrast-[1.05] brightness-[1.02]"
            />
          ) : loadingImage ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 text-gray-300 animate-spin" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Gift className="h-6 w-6 text-[#333]" />
            </div>
          )}
        </a>
      ) : (
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-raised flex-shrink-0">
          {previewImage ? (
            <img
              src={previewImage}
              alt={product.name}
              className="w-full h-full object-cover saturate-[1.1] contrast-[1.05] brightness-[1.02]"
            />
          ) : loadingImage ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 text-gray-300 animate-spin" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Gift className="h-6 w-6 text-[#333]" />
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {viewUrl ? (
              <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 line-clamp-1 hover:text-primary transition block">
                {product.name}
              </a>
            ) : (
              <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{product.name}</h4>
            )}
            {product.price && (
              <p className="text-xs font-semibold text-primary mt-0.5">{product.price}</p>
            )}
          </div>

          {product.id && (
            <button
              className="p-1 text-muted hover:text-gray-900 transition flex-shrink-0"
              onClick={async (e) => {
                e.stopPropagation()
                const url = `https://giftist.ai/items/${product.id}`
                const didShare = await shareOrCopy(url, product.name, giftistShareText('Your friend'))
                if (didShare) {
                  setShareCopied(true)
                  setTimeout(() => setShareCopied(false), 2000)
                }
              }}
              title="Share this item"
            >
              {shareCopied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-2 flex items-center gap-2">
          {added ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
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
          {viewUrl && (
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted hover:text-gray-900 transition"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Gift, Plus, Check, Share2, Loader2, ShoppingCart, ExternalLink } from 'lucide-react'
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
  const [previewImage, setPreviewImage] = useState<string | null>(product.image || null)
  const [giftistUrl, setGiftistUrl] = useState<string | null>(null)
  const [productSlug, setProductSlug] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [buyingLoading, setBuyingLoading] = useState(false)
  const didFetch = useRef(false)

  // Lazy-load image AND resolve Giftist product page URL
  useEffect(() => {
    if (didFetch.current || (!product.url && !product.name)) return
    if (previewImage && giftistUrl) return
    didFetch.current = true
    setLoadingImage(true)
    const params = new URLSearchParams()
    if (product.url) params.set('url', product.url)
    if (product.name) params.set('name', product.name)
    fetch(`/api/products/preview?${params.toString()}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.image && !previewImage) setPreviewImage(data.image)
        if (data?.resolvedUrl) {
          setGiftistUrl(data.resolvedUrl)
          // Extract slug from giftist URL
          const match = data.resolvedUrl.match(/\/p\/([^/?]+)/)
          if (match) setProductSlug(match[1])
        }
      })
      .catch(() => {})
      .finally(() => setLoadingImage(false))
  }, [previewImage, giftistUrl, product.url, product.name])

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

  const handleBuy = async () => {
    if (!productSlug || buyingLoading) return
    setBuyingLoading(true)
    try {
      const res = await fetch('/api/purchase/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: productSlug }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else if (res.status === 401) {
        // Redirect to login, then back to product page
        window.location.href = `/login?callbackUrl=${encodeURIComponent(`/p/${productSlug}`)}`
      } else {
        setBuyingLoading(false)
      }
    } catch {
      setBuyingLoading(false)
    }
  }

  const imageEl = previewImage ? (
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
  )

  return (
    <div className="flex gap-3 p-3 bg-surface-hover rounded-xl border border-border my-2">
      {/* Image — links to Giftist product page */}
      {giftistUrl ? (
        <a href={giftistUrl} className="w-16 h-16 rounded-lg overflow-hidden bg-surface-raised flex-shrink-0 block">
          {imageEl}
        </a>
      ) : (
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-raised flex-shrink-0">
          {imageEl}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {giftistUrl ? (
              <a href={giftistUrl} className="text-sm font-medium text-gray-900 line-clamp-1 hover:text-primary transition block">
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

        {/* Action buttons — only show buy/view when we have an image */}
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
          {previewImage && productSlug ? (
            <button
              onClick={handleBuy}
              disabled={buyingLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition disabled:opacity-50"
            >
              <ShoppingCart className="h-3 w-3" />
              {buyingLoading ? 'Loading...' : 'Buy'}
            </button>
          ) : previewImage && giftistUrl ? (
            <a
              href={giftistUrl}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

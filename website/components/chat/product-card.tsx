'use client'

import { useState, useEffect, useRef } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import type { ProductData } from '@/lib/parse-chat-content'

interface ProductCardProps {
  product: ProductData
}

export function ProductCard({ product }: ProductCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(product.image || null)
  const [giftistUrl, setGiftistUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
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
        }
      })
      .catch(() => {})
      .finally(() => setLoadingImage(false))
  }, [previewImage, giftistUrl, product.url, product.name])

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

        </div>

        {/* Action buttons */}
        <div className="mt-2 flex items-center gap-2">
          {giftistUrl ? (
            <a
              href={giftistUrl}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition"
            >
              <Gift className="h-3 w-3" />
              View &amp; Buy
            </a>
          ) : loadingImage ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

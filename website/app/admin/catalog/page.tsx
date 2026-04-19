'use client'

import { useEffect, useState } from 'react'
import { Package, TrendingUp, Eye, MousePointer, Loader2, Search } from 'lucide-react'

interface Product {
  productName: string
  url: string
  domain: string
  price: string | null
  priceValue: number | null
  image: string | null
  verifiedAt: string
  impressions: number
  clicks: number
  themes: string[]
}

interface CatalogData {
  products: Product[]
  totals: {
    totalProducts: number
    withPrice: number
    withImage: number
    totalImpressions: number
    totalClicks: number
    avgPrice: number
    topDomains: Array<{ domain: string; count: number }>
    topThemes: Array<{ theme: string; count: number }>
  }
}

export default function CatalogPage() {
  const [data, setData] = useState<CatalogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'impressions' | 'price' | 'name' | 'recent'>('impressions')

  useEffect(() => {
    fetch('/api/admin/catalog')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-6 w-6 text-gray-400" /></div>

  const t = data?.totals
  const filtered = (data?.products || []).filter(p =>
    !search || p.productName.toLowerCase().includes(search.toLowerCase()) ||
    p.domain?.toLowerCase().includes(search.toLowerCase()) ||
    p.themes.some(th => th.toLowerCase().includes(search.toLowerCase()))
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'impressions') return b.impressions - a.impressions
    if (sortBy === 'price') return (b.priceValue || 0) - (a.priceValue || 0)
    if (sortBy === 'recent') return new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
    return a.productName.localeCompare(b.productName)
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Product Catalog</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><Package className="h-4 w-4" />Products</div>
          <div className="text-2xl font-bold">{t?.totalProducts || 0}</div>
          <div className="text-xs text-gray-400">{t?.withPrice || 0} with price</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><Eye className="h-4 w-4" />Impressions</div>
          <div className="text-2xl font-bold">{t?.totalImpressions || 0}</div>
          <div className="text-xs text-gray-400">Times shown to users</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><MousePointer className="h-4 w-4" />Clicks</div>
          <div className="text-2xl font-bold">{t?.totalClicks || 0}</div>
          <div className="text-xs text-gray-400">{t?.totalImpressions ? ((t.totalClicks / t.totalImpressions * 100).toFixed(1) + '% CTR') : '0%'}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><TrendingUp className="h-4 w-4" />Avg Price</div>
          <div className="text-2xl font-bold">${t?.avgPrice?.toFixed(0) || 0}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 col-span-2">
          <div className="text-sm text-gray-500 mb-2">Top Retailers</div>
          <div className="flex flex-wrap gap-1">
            {t?.topDomains?.slice(0, 5).map(d => (
              <span key={d.domain} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                {d.domain.replace('www.', '')} ({d.count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Themes */}
      {t?.topThemes && t.topThemes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Themes</h3>
          <div className="flex flex-wrap gap-2">
            {t.topThemes.map(th => (
              <button
                key={th.theme}
                onClick={() => setSearch(th.theme)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${search === th.theme ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {th.theme} ({th.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products, retailers, themes..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="impressions">Most Shown</option>
          <option value="price">Highest Price</option>
          <option value="recent">Most Recent</option>
          <option value="name">A-Z</option>
        </select>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Shown</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Themes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.slice(0, 100).map((p) => (
              <tr key={p.productName + p.url} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">🎁</div>
                    )}
                    <div>
                      <div className="text-sm font-medium capitalize">{p.productName}</div>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline">View →</a>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{p.domain?.replace('www.', '')}</td>
                <td className="px-4 py-3 text-right text-sm font-medium">{p.price || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-medium ${p.impressions > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {p.impressions}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-medium ${p.clicks > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {p.clicks}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.themes.map(th => (
                      <span key={th} className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full">{th}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(p.verifiedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > 100 && (
          <div className="px-4 py-3 text-sm text-gray-400 text-center">
            Showing 100 of {sorted.length} products
          </div>
        )}
      </div>
    </div>
  )
}

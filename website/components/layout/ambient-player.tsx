'use client'

import { useState, useRef, useEffect } from 'react'
import { Music, X } from 'lucide-react'

const PLAYLISTS = [
  { id: '37i9dQZF1DX4WYpdgoIcn6', label: 'Chill' },
  { id: '37i9dQZF1DX0SM0LYsmbMT', label: 'Jazz' },
  { id: '37i9dQZF1DXc8kgYqQLMfH', label: 'Lo-fi' },
]

export function AmbientPlayer() {
  const [open, setOpen] = useState(false)
  const [activePlaylist, setActivePlaylist] = useState(PLAYLISTS[0])
  const [activated, setActivated] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handlePlaylistChange = (pl: typeof PLAYLISTS[number]) => {
    setActivePlaylist(pl)
    setActivated(true)
  }

  const handleToggle = () => {
    if (!open && !activated) {
      setActivated(true)
    }
    setOpen(!open)
  }

  return (
    <div ref={panelRef} className="fixed top-3 right-3 lg:top-4 lg:right-4 z-50">
      {/* Panel: playlist picker + Spotify embed */}
      <div
        className={`absolute top-full right-0 mt-2 w-72 rounded-2xl overflow-hidden shadow-xl border border-gray-100 bg-white/95 backdrop-blur-xl transition-all duration-200 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* Playlist options */}
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Mood</p>
          {PLAYLISTS.map((pl) => (
            <button
              key={pl.id}
              onClick={() => handlePlaylistChange(pl)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                activePlaylist.id === pl.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              {pl.label}
              {activePlaylist.id === pl.id && activated && (
                <span className="ml-auto flex items-center gap-0.5">
                  <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse [animation-delay:0.15s]" />
                  <span className="w-0.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:0.3s]" />
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Spotify embed — stays mounted once activated */}
        {activated && (
          <div className="border-t border-gray-100">
            <iframe
              key={activePlaylist.id}
              src={`https://open.spotify.com/embed/playlist/${activePlaylist.id}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="block"
            />
          </div>
        )}
      </div>

      {/* Pill toggle button */}
      <button
        onClick={handleToggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all shadow-sm ${
          open
            ? 'bg-gray-900 text-white shadow-lg'
            : activated
              ? 'bg-white/90 backdrop-blur-md border border-gray-200 text-gray-900 hover:shadow-md'
              : 'bg-white/80 backdrop-blur-md border border-gray-200 text-gray-500 hover:text-gray-900 hover:shadow-md'
        }`}
      >
        {open ? (
          <X className="h-3.5 w-3.5" />
        ) : (
          <>
            <Music className="h-3.5 w-3.5" />
            {activated && (
              <span className="flex items-center gap-0.5 mr-0.5">
                <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse" />
                <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse [animation-delay:0.15s]" />
                <span className="w-0.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:0.3s]" />
              </span>
            )}
            <span className="text-xs font-medium">{activated ? activePlaylist.label : 'Music'}</span>
          </>
        )}
      </button>
    </div>
  )
}

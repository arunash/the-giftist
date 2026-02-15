'use client'

import { useState } from 'react'
import { Music, ChevronDown, ChevronUp } from 'lucide-react'

const PLAYLISTS = [
  { id: '37i9dQZF1DX4WYpdgoIcn6', label: 'Chill' },
  { id: '37i9dQZF1DX0SM0LYsmbMT', label: 'Jazz' },
  { id: '37i9dQZF1DXc8kgYqQLMfH', label: 'Lo-fi' },
]

export function AmbientPlayer() {
  const [open, setOpen] = useState(false)
  const [activePlaylist, setActivePlaylist] = useState(PLAYLISTS[0].id)

  return (
    <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end gap-2">
      {/* Spotify embed */}
      {open && (
        <div className="rounded-xl overflow-hidden shadow-lg border border-border bg-surface">
          {/* Playlist pills */}
          <div className="flex gap-1 p-2 bg-surface border-b border-border">
            {PLAYLISTS.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setActivePlaylist(pl.id)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                  activePlaylist === pl.id
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-muted hover:text-white'
                }`}
              >
                {pl.label}
              </button>
            ))}
          </div>
          <iframe
            src={`https://open.spotify.com/embed/playlist/${activePlaylist}?utm_source=generator&theme=0`}
            width="300"
            height="80"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block"
          />
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 bg-surface/80 backdrop-blur-md border border-border rounded-full hover:bg-surface-hover transition-all group flex items-center gap-1.5"
        title={open ? 'Hide player' : 'Show music player'}
      >
        <Music className={`h-4 w-4 ${open ? 'text-primary' : 'text-muted group-hover:text-white'}`} />
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted" />
        ) : (
          <ChevronUp className="h-3 w-3 text-muted" />
        )}
      </button>
    </div>
  )
}

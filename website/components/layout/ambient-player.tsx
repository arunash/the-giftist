'use client'

import { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

// Royalty-free ambient loop from Pixabay (creative commons)
const AMBIENT_URL = '/ambient.mp3'

export function AmbientPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const audio = new Audio(AMBIENT_URL)
    audio.loop = true
    audio.volume = 0.15
    audio.preload = 'none'
    audioRef.current = audio

    audio.addEventListener('canplaythrough', () => setLoaded(true))
    audio.addEventListener('error', () => setLoaded(false))

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 p-2.5 bg-surface/80 backdrop-blur-md border border-border rounded-full hover:bg-surface-hover transition-all group"
      title={playing ? 'Mute ambient sound' : 'Play ambient sound'}
    >
      {playing ? (
        <Volume2 className="h-4 w-4 text-primary" />
      ) : (
        <VolumeX className="h-4 w-4 text-muted group-hover:text-white" />
      )}
    </button>
  )
}

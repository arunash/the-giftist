import { create } from 'zustand'
import type { Item, Event } from '@/lib/types'

interface FeedState {
  items: Item[]
  events: Event[]
  selectedEventId: string | null
  setItems: (items: Item[]) => void
  setEvents: (events: Event[]) => void
  filterByEvent: (eventId: string | null) => void
  addItem: (item: Item) => void
  removeItem: (id: string) => void
  updateItem: (id: string, data: Partial<Item>) => void
}

export const useFeedStore = create<FeedState>((set) => ({
  items: [],
  events: [],
  selectedEventId: null,

  setItems: (items) => set({ items }),
  setEvents: (events) => set({ events }),
  filterByEvent: (eventId) => set({ selectedEventId: eventId }),

  addItem: (item) =>
    set((state) => ({ items: [item, ...state.items] })),

  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  updateItem: (id, data) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...data } : i)),
    })),
}))

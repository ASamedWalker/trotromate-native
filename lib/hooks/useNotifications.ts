import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchNotifications, type AppNotification } from '@/lib/services/notifications'
import { useFavorites } from '@/lib/hooks/useFavorites'

const READ_KEY = '@troski_notifications_read'

export function useNotifications(deviceId: string | null) {
  const { favorites } = useFavorites()
  const favoriteRouteIds = favorites.map((f) => f.id)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  // Load read notification IDs
  useEffect(() => {
    AsyncStorage.getItem(READ_KEY).then((raw) => {
      if (raw) {
        try {
          setReadIds(new Set(JSON.parse(raw)))
        } catch {}
      }
    })
  }, [])

  const { data: rawNotifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', deviceId, favoriteRouteIds.join(',')],
    queryFn: () => fetchNotifications(deviceId!, favoriteRouteIds),
    enabled: !!deviceId,
    staleTime: 5 * 60 * 1000,
  })

  const notifications = rawNotifications.map((n) => ({
    ...n,
    read: readIds.has(n.id),
  }))

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = useCallback(async (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      const arr = Array.from(next).slice(-200)
      AsyncStorage.setItem(READ_KEY, JSON.stringify(arr))
      return next
    })
  }, [])

  const markAllRead = useCallback(async () => {
    const allIds = rawNotifications.map((n) => n.id)
    setReadIds((prev) => {
      const next = new Set([...prev, ...allIds])
      const arr = Array.from(next).slice(-200)
      AsyncStorage.setItem(READ_KEY, JSON.stringify(arr))
      return next
    })
  }, [rawNotifications])

  return { notifications, unreadCount, isLoading, markAsRead, markAllRead, refetch }
}

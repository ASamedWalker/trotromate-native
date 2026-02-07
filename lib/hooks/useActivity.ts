import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchRecentActivity, type ActivityItem } from '@/lib/services/activity'

const DISMISSED_KEY = 'activity_dismissed_ids'

export function useActivity() {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const dismissedRef = useRef<Set<string>>(new Set())
  const dismissedLoaded = useRef(false)

  // Load dismissed IDs from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((raw) => {
      if (raw) {
        try {
          const ids: string[] = JSON.parse(raw)
          dismissedRef.current = new Set(ids)
        } catch {}
      }
      dismissedLoaded.current = true
    })
  }, [])

  const filterDismissed = useCallback((data: ActivityItem[]) => {
    return data.filter((item) => !dismissedRef.current.has(item.id))
  }, [])

  // Initial data fetch with TanStack Query caching
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetchRecentActivity(),
  })

  // Sync query data into local state (needed for pagination + dismiss)
  useEffect(() => {
    if (initialData && dismissedLoaded.current) {
      const filtered = filterDismissed(initialData)
      setItems(filtered)
      setHasMore(initialData.length >= 20)
    }
  }, [initialData, filterDismissed])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const data = await fetchRecentActivity()
      setItems(filterDismissed(data))
      setHasMore(data.length >= 20)
      queryClient.setQueryData(['activity'], data)
    } catch {
      // silently fail
    } finally {
      setIsRefreshing(false)
    }
  }, [filterDismissed, queryClient])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const oldest = items[items.length - 1]?.timestamp
      if (!oldest) return
      const data = await fetchRecentActivity(20, oldest)
      const filtered = filterDismissed(data)
      if (data.length < 20) setHasMore(false)
      setItems((prev) => [...prev, ...filtered])
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, items, filterDismissed])

  const dismissItem = useCallback(async (id: string) => {
    dismissedRef.current.add(id)
    setItems((prev) => prev.filter((item) => item.id !== id))

    // Persist dismissed IDs (keep max 200 to prevent storage bloat)
    const ids = Array.from(dismissedRef.current).slice(-200)
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
  }, [])

  return { items, isLoading, isRefreshing, isLoadingMore, hasMore, refresh, loadMore, dismissItem }
}

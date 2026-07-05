import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchRecentActivity, PAGE_SIZE, type ActivityItem } from '@/lib/services/activity'

const DISMISSED_KEY = 'activity_dismissed_ids'

export function useActivity() {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const loadingMoreRef = useRef(false)
  const itemsRef = useRef<ActivityItem[]>([])
  const hasMoreRef = useRef(true)
  const dismissedRef = useRef<Set<string>>(new Set())
  const dismissedLoaded = useRef(false)

  // Load dismissed IDs from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((raw) => {
      if (raw) {
        try {
          const ids: string[] = JSON.parse(raw)
          dismissedRef.current = new Set(ids)
        } catch (e) { console.warn("[troski] silent error:", e) }
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
      itemsRef.current = filtered
      const more = initialData.length >= PAGE_SIZE
      setHasMore(more)
      hasMoreRef.current = more
    }
  }, [initialData, filterDismissed])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const data = await fetchRecentActivity()
      const filtered = filterDismissed(data)
      setItems(filtered)
      itemsRef.current = filtered
      const more = data.length >= PAGE_SIZE
      setHasMore(more)
      hasMoreRef.current = more
      queryClient.setQueryData(['activity'], data)
    } catch {
      // silently fail
    } finally {
      setIsRefreshing(false)
    }
  }, [filterDismissed, queryClient])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return
    const currentItems = itemsRef.current
    const oldest = currentItems[currentItems.length - 1]?.timestamp
    if (!oldest) {
      setHasMore(false)
      hasMoreRef.current = false
      return
    }
    loadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const data = await fetchRecentActivity(PAGE_SIZE, oldest)
      const filtered = filterDismissed(data)
      if (data.length < PAGE_SIZE) {
        setHasMore(false)
        hasMoreRef.current = false
      }
      setItems((prev) => {
        const next = [...prev, ...filtered]
        itemsRef.current = next
        return next
      })
    } catch {
      // silently fail
    } finally {
      loadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [filterDismissed])

  const dismissItem = useCallback(async (id: string) => {
    dismissedRef.current.add(id)
    setItems((prev) => prev.filter((item) => item.id !== id))

    // Persist dismissed IDs (keep max 200 to prevent storage bloat)
    const ids = Array.from(dismissedRef.current).slice(-200)
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
  }, [])

  const dismissAll = useCallback(async () => {
    for (const item of items) {
      dismissedRef.current.add(item.id)
    }
    setItems([])
    const ids = Array.from(dismissedRef.current).slice(-200)
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
  }, [items])

  return { items, isLoading, isRefreshing, isLoadingMore, hasMore, refresh, loadMore, dismissItem, dismissAll }
}

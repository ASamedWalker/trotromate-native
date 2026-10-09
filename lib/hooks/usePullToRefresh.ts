import { useCallback, useState } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

/**
 * Pull-to-refresh that refetches ONLY the given queries (plus optional extra work),
 * so a pull on one screen doesn't re-download every mounted tab's data.
 */
export function usePullToRefresh(keys: QueryKey[], extra?: () => Promise<unknown>) {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.selectionAsync()
    try {
      await Promise.all([
        ...keys.map((queryKey) => qc.refetchQueries({ queryKey, type: 'active' })),
        extra?.(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [qc, keys, extra])
  return { refreshing, onRefresh }
}

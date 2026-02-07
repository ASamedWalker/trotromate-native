import { useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Invalidates stale React Query caches when the screen gains focus.
 * Only refetches queries that are actually stale (past their staleTime).
 * This keeps data fresh when switching between tabs without redundant API calls.
 */
export function useRefreshOnFocus(queryKeys: (string | undefined | null)[][]) {
  const queryClient = useQueryClient()

  useFocusEffect(
    useCallback(() => {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({
          queryKey: key,
          refetchType: 'active', // Only refetch queries that are currently being rendered
        })
      }
    }, [queryClient, queryKeys])
  )
}

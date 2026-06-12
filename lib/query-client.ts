import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client'

const DAY = 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      // Must outlive the persister maxAge or restored queries get GC'd on restore
      gcTime: DAY,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

// Cached-first cold starts: the whole query cache is persisted to AsyncStorage,
// so reopening the app renders last-known fares/routes/balance instantly and
// refetches stale data silently (see docs/DESIGN_DIRECTION.md "Loading policy").
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: '@troski_query_cache_v1',
})

// Volatile/ephemeral data is worthless after a cold start — don't persist it
const NO_PERSIST_KEYS = new Set([
  'traffic',
  'traffic-summary',
  'unified-search-from',
  'unified-search-to',
  'notifications',
])

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: DAY,
  // Drop the persisted cache wholesale on app updates
  buster: Constants.expoConfig?.version ?? '1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && !NO_PERSIST_KEYS.has(String(query.queryKey[0])),
  },
}

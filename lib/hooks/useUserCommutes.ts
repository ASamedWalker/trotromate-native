import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchUserCommutes,
  upsertUserCommute,
  updateUserCommute,
  deleteUserCommute,
  matchRoute,
  type UserCommute,
  type CreateCommuteInput,
} from '@/lib/services/user-commutes'
import { useMyCommutes } from '@/lib/hooks/useMyCommutes'

const QUERY_KEY = 'user-commutes'

/**
 * Server-synced commute hook.
 * Writes to both Supabase (for push notifications) and
 * AsyncStorage via useMyCommutes (for instant offline reads).
 */
export function useUserCommutes(deviceId: string | null) {
  const queryClient = useQueryClient()
  const { addCommute: addLocal, removeCommute: removeLocal } = useMyCommutes()

  const { data: commutes = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY, deviceId],
    queryFn: () => fetchUserCommutes(deviceId!),
    enabled: !!deviceId,
    staleTime: 5 * 60 * 1000,
  })

  const addMutation = useMutation({
    mutationFn: async (input: Omit<CreateCommuteInput, 'device_id'>) => {
      if (!deviceId) throw new Error('No device ID')

      // Try to match an existing route
      const routeId = input.route_id ?? (await matchRoute(input.from_location, input.to_location))

      const commute = await upsertUserCommute({
        ...input,
        device_id: deviceId,
        route_id: routeId,
      })

      // Sync to local AsyncStorage for offline SmartCommuteCard reads
      addLocal({
        label: commute.label,
        routeId: commute.route_id ?? '',
        from: commute.from_location,
        to: commute.to_location,
        icon: commute.commute_type === 'evening' ? 'sunset' : 'sunrise',
      })

      return commute
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, deviceId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<UserCommute> }) =>
      updateUserCommute(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, deviceId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteUserCommute(id)
      removeLocal(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, deviceId] })
    },
  })

  const primaryCommute = commutes.find((c) => c.is_primary) ?? commutes[0] ?? null

  return {
    commutes,
    primaryCommute,
    isLoading,
    addCommute: addMutation.mutateAsync,
    updateCommute: updateMutation.mutateAsync,
    deleteCommute: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
  }
}

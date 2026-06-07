import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native'
import { Clock, Footprints, ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import type { TransferPlan } from '@/lib/services/route-planner'

const BRAND = '#FF4D1C'

export interface WalkingEstimate {
  distance_km: number
  duration_mins: number
  from: string
  to: string
}

const TRANSPORT_CONFIG: Record<string, {
  label: string; image: any
}> = {
  trotro: {
    label: 'Trotro',
    image: require('@/assets/images/home/bus_icon_bg_removed.png'),
  },
  okada: {
    label: 'Okada',
    image: require('@/assets/images/home/okada_icon_bg_removed.png'),
  },
}

function getConfig(type: string) {
  return TRANSPORT_CONFIG[type] || TRANSPORT_CONFIG.trotro
}

export function RoutePlannerResults({
  plans,
  isLoading,
  walkingEstimate,
  selectedPlanIndex,
  onSelectPlan,
}: {
  plans: TransferPlan[]
  isLoading: boolean
  walkingEstimate?: WalkingEstimate | null
  selectedPlanIndex?: number | null
  onSelectPlan?: (index: number) => void
}) {
  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
        <ActivityIndicator size="small" color={BRAND} />
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#9CA3AF' }}>Finding routes...</Text>
      </View>
    )
  }

  if (plans.length === 0 && !walkingEstimate) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 40 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000', marginBottom: 4 }}>No routes found</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 14, color: '#9CA3AF', textAlign: 'center' }}>
          Try different locations or check your spelling
        </Text>
      </View>
    )
  }

  return (
    <View style={{ paddingHorizontal: 24, marginTop: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 20, color: '#000', marginBottom: 4 }}>
        Available Routes
      </Text>

      {plans.map((plan, i) => {
        const primaryType = plan.legs[0]?.transport_type || 'trotro'
        const config = getConfig(primaryType)
        const isSelected = selectedPlanIndex === i
        const etaMins = Math.max(3, Math.round(plan.total_duration_mins * 0.15))

        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelectPlan?.(i)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 14,
              padding: 14, borderRadius: 16,
              backgroundColor: isSelected ? '#FFF0EB' : '#FFFFFF',
              borderWidth: isSelected ? 1.5 : 1,
              borderColor: isSelected ? BRAND : '#F3F4F6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}
          >
            {/* Vehicle image */}
            <Image source={config.image} style={{ width: 52, height: 52 }} resizeMode="contain" />

            {/* Route info */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000' }}>{config.label}</Text>
                {plan.type === 'direct' ? (
                  <View style={{ backgroundColor: '#FFF0EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10, color: BRAND }}>Direct</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#F0F9FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#0EA5E9' }}>Transfer</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={12} color="#9CA3AF" />
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF' }}>
                  {etaMins} min away · {plan.total_duration_mins} min ride
                </Text>
              </View>
            </View>

            {/* Fare */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: font.extrabold, fontSize: 18, color: '#000' }}>₵{plan.total_fare.toFixed(2)}</Text>
            </View>

            <ChevronRight size={18} color="#D1D5DB" />
          </TouchableOpacity>
        )
      })}

      {/* Walking option */}
      {walkingEstimate && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 14,
            padding: 14, borderRadius: 16,
            backgroundColor: '#FFFFFF',
            borderWidth: 1, borderColor: '#F3F4F6',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
          }}
        >
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: '#ECFDF5',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Footprints size={24} color="#16a34a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000', marginBottom: 3 }}>Walk</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color="#9CA3AF" />
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF' }}>
                ~{walkingEstimate.duration_mins} min · {walkingEstimate.distance_km.toFixed(1)} km
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: font.extrabold, fontSize: 18, color: '#16a34a' }}>Free</Text>
          <ChevronRight size={18} color="#D1D5DB" />
        </TouchableOpacity>
      )}
    </View>
  )
}

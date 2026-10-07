import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg'

// Rewards icons (approved Rewards redesign, 2026-10-07). Same conventions as
// TabIcons.tsx: 24px grid, 1.7 stroke, round caps/joins, optional soft fill on
// the main shape.

export interface RewardIconProps {
  color: string
  size?: number
  fill?: string
}

const st = {
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Receipt with a cedi sign (report a fare). */
export function FareIcon({ color, size = 26, fill }: RewardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} fill={fill ?? 'none'} d="M6 2.5h12V21l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <SvgText x={12} y={15} fontSize={10} fontWeight="bold" fill={color} textAnchor="middle">
        ₵
      </SvgText>
    </Svg>
  )
}

/** Three riders in a line (queue status). */
export function QueueIcon({ color, size = 26, fill }: RewardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...st} stroke={color} fill={fill ?? 'none'} cx={6} cy={8} r={2.5} />
      <Circle {...st} stroke={color} fill={fill ?? 'none'} cx={12} cy={8} r={2.5} />
      <Circle {...st} stroke={color} fill={fill ?? 'none'} cx={18} cy={8} r={2.5} />
      <Path {...st} stroke={color} fill="none" d="M2.5 19v-2a3.5 3.5 0 0 1 7 0v2M8.5 19v-2a3.5 3.5 0 0 1 7 0v2M14.5 19v-2a3.5 3.5 0 0 1 7 0v2" />
    </Svg>
  )
}

/** Warning triangle (report incidents). */
export function IncidentIcon({ color, size = 26, fill }: RewardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} fill={fill ?? 'none'} d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <Path {...st} stroke={color} fill="none" d="M12 9v4M12 17h.01" />
    </Svg>
  )
}

/** Flame (streaks). */
export function FlameIcon({ color, size = 26, fill }: RewardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        {...st}
        stroke={color}
        fill={fill ?? 'none'}
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.5 2.8 2.5 2.8z"
      />
    </Svg>
  )
}

/** Gift box (referrals). */
export function GiftIcon({ color, size = 26, fill }: RewardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect {...st} stroke={color} fill={fill ?? 'none'} x={3} y={8} width={18} height={4} rx={1} />
      <Path {...st} stroke={color} fill="none" d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <Path {...st} stroke={color} fill="none" d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </Svg>
  )
}

/** Ticket stub (Passenger tier). */
export function TicketIcon({ color, size = 26, fill }: RewardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        {...st}
        stroke={color}
        fill={fill ?? 'none'}
        d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"
      />
      <Path {...st} stroke={color} fill="none" d="M13 5v2M13 17v2M13 11v2" />
    </Svg>
  )
}

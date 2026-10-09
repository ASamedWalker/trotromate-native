import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg'

// Troski tab icons (design canvas "Tab bar" row, option B, approved 2026-10-07).
// 24px grid, 1.7 stroke (2 when active). Active icons also fill their main
// shape with a soft orange so the selected tab reads at a glance.

export interface TabIconProps {
  color: string
  active?: boolean
  size?: number
}

const ACTIVE_FILL = '#FFC9B5'

function strokeProps(active?: boolean) {
  return {
    strokeWidth: active ? 2 : 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }
}

/** House whose door is the troski.me pin. */
export function HomeIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
      <Path {...st} stroke={color} d="M12 17.6s-2.6-2.4-2.6-4.3a2.6 2.6 0 0 1 5.2 0c0 1.9-2.6 4.3-2.6 4.3z" />
    </Svg>
  )
}

/** Trotro front with a roof rack. */
export function LinesIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} d="M7 3h10" />
      <Path {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v10.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V7A1.5 1.5 0 0 1 5 5.5z" />
      <Path {...st} stroke={color} d="M5.5 8.5h13v4h-13z" />
      <Circle {...st} stroke={color} cx={7.5} cy={15.5} r={0.9} />
      <Circle {...st} stroke={color} cx={16.5} cy={15.5} r={0.9} />
      <Path {...st} stroke={color} d="M6.5 18.5v2M17.5 18.5v2" />
    </Svg>
  )
}

/** Square GRDA train cab (not a bullet train). */
export function TrainIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} d="M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
      <Path {...st} stroke={color} d="M4 10.5h16M10 6.5h4" />
      <Circle {...st} stroke={color} cx={8} cy={14.2} r={0.9} />
      <Circle {...st} stroke={color} cx={16} cy={14.2} r={0.9} />
      <Path {...st} stroke={color} d="m8 18-2 3M16 18l2 3" />
    </Svg>
  )
}

/** Card wallet. */
export function WalletIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} d="M4 6.5A2.5 2.5 0 0 1 6.5 4H17v3" />
      <Path {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} d="M4 6.5V18a2 2 0 0 0 2 2h14V9H6.5A2.5 2.5 0 0 1 4 6.5z" />
      <Path {...st} stroke={color} d="M15.5 14.5h1.5" />
    </Svg>
  )
}

/** Chat bubble with a pulse line (community feed). */
export function PulseIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v9.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-2A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5z" />
      <Path {...st} stroke={color} d="M6.5 11H9l1.5-3 3 6 1.5-3h2.5" />
    </Svg>
  )
}

/** Receipt with a cedi sign (Fares tab). */
export function FaresIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} d="M6 2.5h12V21l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <SvgText x={12} y={15} fontSize={10} fontWeight="bold" fill={color} textAnchor="middle">₵</SvgText>
    </Svg>
  )
}

/** Coin with a T mark (Rewards tab). */
export function RewardsIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} cx={12} cy={12} r={9} />
      <Path {...st} stroke={color} d="M8.5 8.5h7M12 8.5v8" />
    </Svg>
  )
}

/** Pin over a short queue of three heads: a station and its line. */
export function StationsIcon({ color, active, size = 24 }: TabIconProps) {
  const st = strokeProps(active)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...st} stroke={color} fill={active ? ACTIVE_FILL : 'none'} d="M12 14.5s-4.5-4-4.5-7.2a4.5 4.5 0 0 1 9 0c0 3.2-4.5 7.2-4.5 7.2z" />
      <Circle cx={12} cy={7.3} r={1.6} {...st} stroke={color} />
      <Circle cx={6} cy={19} r={1.6} {...st} stroke={color} />
      <Circle cx={12} cy={19} r={1.6} {...st} stroke={color} />
      <Circle cx={18} cy={19} r={1.6} {...st} stroke={color} />
    </Svg>
  )
}

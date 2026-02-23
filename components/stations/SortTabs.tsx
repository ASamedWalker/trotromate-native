import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { c, font } from '@/lib/theme'

export type SortTab = 'nearest' | 'shortest'

interface SortTabsProps {
  activeTab: SortTab
  onChangeTab: (tab: SortTab) => void
  isDark: boolean
}

export function SortTabs({ activeTab, onChangeTab, isDark }: SortTabsProps) {
  const bgColor = isDark ? c.stone800 : c.stone100

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Tab
        label="Nearest"
        active={activeTab === 'nearest'}
        onPress={() => onChangeTab('nearest')}
      />
      <Tab
        label="Shortest Wait"
        active={activeTab === 'shortest'}
        onPress={() => onChangeTab('shortest')}
      />
    </View>
  )
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: c.amber500,
  },
  tabText: {
    fontSize: 13,
    fontFamily: font.medium,
    color: c.stone400,
  },
  tabTextActive: {
    color: c.white,
    fontFamily: font.semibold,
  },
})

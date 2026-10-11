import { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { SFSymbol } from 'expo-symbols';

import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

const TABS: { name: string; title: string; icon: SFSymbol }[] = [
  { name: 'index', title: 'Home', icon: 'moon.fill' },
  { name: 'leaderboard', title: 'Leaderboard', icon: 'trophy.fill' },
  { name: 'trends', title: 'Trends', icon: 'chart.bar.fill' },
  { name: 'achievements', title: 'Achievements', icon: 'star.fill' },
  { name: 'profile', title: 'Profile', icon: 'person.fill' },
];

/** Native iOS tab bar: Liquid Glass on iOS 26+, standard bar on older versions. */
export default function AppTabs() {
  return (
    <NativeTabs
      tintColor={colors.tabActive}
      iconColor={{ default: colors.tabInactive, selected: colors.tabActive }}
      labelStyle={{
        default: { color: colors.tabInactive, fontFamily: fontFamily.medium, fontSize: 11 },
        selected: { color: colors.tabActive, fontFamily: fontFamily.semibold, fontSize: 11 },
      }}
      minimizeBehavior="onScrollDown">
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.icon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

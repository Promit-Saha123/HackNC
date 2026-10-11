import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';

const TABS: { name: string; title: string; icon: SFSymbol }[] = [
  { name: 'index', title: 'Home', icon: 'moon.fill' },
  { name: 'leaderboard', title: 'Leaderboard', icon: 'trophy.fill' },
  { name: 'trends', title: 'Trends', icon: 'chart.bar.fill' },
  { name: 'achievements', title: 'Achievements', icon: 'star.fill' },
  { name: 'profile', title: 'Profile', icon: 'person.fill' },
];

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: t.tabLabel,
        tabBarStyle: styles.bar,
      }}
      screenListeners={{ tabPress: () => Haptics.selectionAsync() }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => <SymbolView name={tab.icon} size={24} tintColor={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    elevation: 0,
  },
});

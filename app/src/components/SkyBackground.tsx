import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';

export function SkyBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={[colors.skyTop, colors.skyMid, colors.skyBottom]} style={styles.fill}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
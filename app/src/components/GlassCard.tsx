import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle> };

/** iOS 26 Liquid Glass when available, otherwise a blurred translucent card. */
export function GlassCard({ children, style }: Props) {
  if (isGlassEffectAPIAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" tintColor={colors.glassTint} style={[styles.card, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView intensity={50} tint="light" style={[styles.card, styles.fallback, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.md },
  fallback: {
    overflow: 'hidden',
    backgroundColor: colors.glassFallback,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
});
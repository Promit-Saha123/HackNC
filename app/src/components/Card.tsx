import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glass, HAS_GLASS } from '@/components/Glass';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Brighter edge, used for the "You" row. */
  highlight?: boolean;
  /** Pass 0 for cards that hold full-bleed rows. */
  padding?: number;
  onPress?: () => void;
};

/** Liquid Glass card (dark card fallback before iOS 26). */
export function Card({ children, style, highlight, padding = spacing.md, onPress }: Props) {
  const body = (
    <Glass interactive={!!onPress} style={[styles.card, highlight && styles.highlight, !onPress && style]}>
      <View style={{ padding }}>{children}</View>
    </Glass>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && !HAS_GLASS && styles.pressed]}>
      {body}
    </Pressable>
  );
}

/** Thin line between rows inside a card. */
export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card },
  highlight: { borderColor: colors.accent, borderWidth: 1 },
  pressed: { opacity: 0.8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
});

import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tinted fill + brighter border, used for the "You" row. */
  highlight?: boolean;
  /** Pass 0 for cards that hold full-bleed rows. */
  padding?: number;
  onPress?: () => void;
};

/** Navy card with a faint top-to-bottom sheen and a thin blue border. No blur: the background is already dark. */
export function Card({ children, style, highlight, padding = spacing.md, onPress }: Props) {
  const content = (
    <>
      <LinearGradient
        colors={highlight ? [colors.highlight, colors.highlight] : [colors.cardSheen, colors.card]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ padding }}>{children}</View>
    </>
  );
  const base = [styles.card, highlight && styles.highlight, style];
  if (!onPress) return <View style={base}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

/** Thin line between rows inside a card. */
export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  highlight: { borderColor: colors.accent },
  pressed: { opacity: 0.8 },
  divider: { height: 1, backgroundColor: colors.divider },
});

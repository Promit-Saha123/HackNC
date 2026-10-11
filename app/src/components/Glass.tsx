import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSky } from '@/state/sky';
import { colors } from '@/theme/colors';

/** True on iOS 26+ with Liquid Glass; everywhere else we draw a dark card instead. */
export const HAS_GLASS = (() => {
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

/** Glass tint that follows the sky: sea blue by day (keeps white text readable), deep indigo at night. */
function skyTint(daylight: number) {
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * daylight);
  return `rgba(${lerp(28, 60)},${lerp(42, 128)},${lerp(110, 200)},${(0.3 + daylight * 0.08).toFixed(2)})`;
}

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'clear' is more see-through; good for small buttons. */
  variant?: 'regular' | 'clear';
  /** Native press shimmer on glass (use for tappable surfaces). */
  interactive?: boolean;
  tint?: string;
};

/** Liquid Glass surface with a dark-card fallback. Always guard glass behind HAS_GLASS. */
export function Glass({ children, style, variant = 'regular', interactive, tint }: Props) {
  const { daylight } = useSky();
  if (HAS_GLASS) {
    return (
      <GlassView
        glassEffectStyle={variant}
        colorScheme={daylight > 0.5 ? 'light' : 'dark'}
        isInteractive={interactive}
        tintColor={tint ?? skyTint(daylight)}
        style={[styles.glassEdge, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.fallback, style]}>
      <LinearGradient colors={[colors.cardSheen, colors.card]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

type ButtonProps = { onPress: () => void; children: ReactNode; size?: number; style?: StyleProp<ViewStyle> };

/** Round glass button for header icons (calendar, info). */
export function GlassIconButton({ onPress, children, size = 40, style }: ButtonProps) {
  return (
    <Pressable hitSlop={8} onPress={onPress} style={({ pressed }) => [pressed && !HAS_GLASS && styles.pressed, style]}>
      <Glass
        variant="clear"
        interactive
        style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>
        {children}
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassEdge: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  fallback: { overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});

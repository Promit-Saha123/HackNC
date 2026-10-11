import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';

import { useSky } from '@/state/sky';

/** True on iOS 26+ with Liquid Glass; everywhere else we draw a translucent card instead. */
export const HAS_GLASS = (() => {
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

/** Barely-there tint that follows the sky, so the glass stays see-through: sea blue by day, indigo at night. */
function skyTint(daylight: number) {
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * daylight);
  return `rgba(${lerp(24, 70)},${lerp(36, 150)},${lerp(100, 230)},${(0.22 - daylight * 0.1).toFixed(2)})`;
}

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'clear' (default) is the see-through bubble glass; 'regular' is frostier. */
  variant?: 'regular' | 'clear';
  /** Native press shimmer on glass (use for tappable surfaces). */
  interactive?: boolean;
  tint?: string;
  /** Force dark glass even in daylight (for text-heavy surfaces like sheets). */
  dark?: boolean;
};

/**
 * Bubble glass (Frutiger Aero on Liquid Glass): clear, see-through surface with a soap-film rim,
 * glossy cap, corner glint and a bright bottom edge. Falls back to a translucent card without Liquid Glass.
 */
export function Glass({ children, style, variant = 'clear', interactive, tint, dark }: Props) {
  const { daylight } = useSky();
  const radius = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? 0;
  if (HAS_GLASS) {
    return (
      <GlassView
        glassEffectStyle={variant}
        colorScheme={dark || daylight <= 0.5 ? 'dark' : 'light'}
        isInteractive={interactive}
        tintColor={tint ?? skyTint(daylight)}
        style={[styles.base, style]}>
        <BubbleFinish daylight={daylight} radius={radius} />
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.base, styles.fallback, style]}>
      <BubbleFinish daylight={daylight} radius={radius} />
      {children}
    </View>
  );
}

/** All the gloss layers that turn a flat panel into a bubble. Strongest in daylight, softer at night. */
function BubbleFinish({ daylight, radius }: { daylight: number; radius: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const a = 0.16 + daylight * 0.38;
  const w = (k: number) => `rgba(255,255,255,${Math.min(1, a * k).toFixed(3)})`;
  const r = Math.max(0, Math.min(radius, box.h / 2, box.w / 2));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* Glossy cap: bright top, crisp cut just under halfway */}
      <LinearGradient
        colors={[w(1.15), w(0.5), w(0.22), 'rgba(255,255,255,0)']}
        locations={[0, 0.28, 0.46, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      {/* Light pooling in the bottom edge, like the base of a bubble */}
      <LinearGradient colors={['rgba(255,255,255,0)', w(0.8)]} locations={[0.74, 1]} style={StyleSheet.absoluteFill} />

      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Soap-film rim: white, cyan, pink, white */}
            <SvgGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.35" stopColor="#B9F2FF" stopOpacity={0.8} />
              <Stop offset="0.7" stopColor="#FFC8EE" stopOpacity={0.7} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.9} />
            </SvgGradient>
          </Defs>
          <Rect
            x={1}
            y={1}
            width={box.w - 2}
            height={box.h - 2}
            rx={Math.max(0, r - 1)}
            fill="none"
            stroke="url(#rim)"
            strokeWidth={2}
            opacity={0.6 + daylight * 0.4}
          />
          <Rect
            x={3.5}
            y={3.5}
            width={Math.max(0, box.w - 7)}
            height={Math.max(0, box.h - 7)}
            rx={Math.max(0, r - 3.5)}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.22 + daylight * 0.2}
            strokeWidth={1}
          />
        </Svg>
      )}

      {/* Corner glint top-left and a small one bottom-right */}
      {box.w > 40 && (
        <>
          <View
            style={[
              styles.glint,
              {
                left: Math.max(8, r * 0.45),
                top: Math.max(5, r * 0.22),
                width: Math.min(46, box.w * 0.16),
                height: Math.min(9, box.h * 0.12),
                opacity: 0.45 + daylight * 0.45,
              },
            ]}
          />
          <View style={[styles.dot, { right: Math.max(10, r * 0.5), bottom: Math.max(6, r * 0.3), opacity: 0.4 + daylight * 0.4 }]} />
        </>
      )}
    </View>
  );
}

type ButtonProps = { onPress: () => void; children: ReactNode; size?: number; style?: StyleProp<ViewStyle> };

/** Round glass button for header icons (calendar, info). */
export function GlassIconButton({ onPress, children, size = 40, style }: ButtonProps) {
  return (
    <Pressable hitSlop={8} onPress={onPress} style={({ pressed }) => [pressed && !HAS_GLASS && styles.pressed, style]}>
      <Glass interactive style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>
        {children}
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: { backgroundColor: 'rgba(255,255,255,0.08)' },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  glint: { position: 'absolute', borderRadius: 6, backgroundColor: '#FFFFFF', transform: [{ rotate: '-8deg' }] },
  dot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  pressed: { opacity: 0.75 },
});

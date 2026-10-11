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

/**
 * The one glass tint for the whole app: soft frosted sky blue by day, deeper blue at night.
 * Every surface uses it so cards, bubbles, pop-ups and buttons all match.
 */
function skyTint(daylight: number) {
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * daylight);
  return `rgba(${lerp(20, 128)},${lerp(38, 186)},${lerp(100, 240)},${(0.5 - daylight * 0.22).toFixed(2)})`;
}

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Native press shimmer on glass (use for tappable surfaces). */
  interactive?: boolean;
  /** Solid frosted backing so nothing behind shows through (pop-up panels that sit over busy screens). */
  solid?: boolean;
};

/**
 * Frosted bubble glass (Frutiger Aero on Liquid Glass), one recipe everywhere: light sky-blue frost,
 * soft glow along the top, clean white rim with an inner bevel, bright bottom edge.
 * Falls back to a translucent card without Liquid Glass.
 */
export function Glass({ children, style, interactive, solid }: Props) {
  const { daylight } = useSky();
  const radius = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? 0;
  const backing = solid ? <SolidBacking daylight={daylight} /> : null;
  if (HAS_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={daylight > 0.5 ? 'light' : 'dark'}
        isInteractive={interactive}
        tintColor={skyTint(daylight)}
        style={[styles.base, style]}>
        {backing}
        <BubbleFinish daylight={daylight} radius={radius} />
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.base, styles.fallback, style]}>
      {backing}
      <BubbleFinish daylight={daylight} radius={radius} />
      {children}
    </View>
  );
}

/** Opaque frosted-blue fill for pop-ups, matched to the time of day. */
function SolidBacking({ daylight }: { daylight: number }) {
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * daylight);
  const top = `rgb(${lerp(30, 92)},${lerp(48, 152)},${lerp(108, 214)})`;
  const bottom = `rgb(${lerp(18, 52)},${lerp(30, 110)},${lerp(76, 178)})`;
  return <LinearGradient colors={[top, bottom]} style={[StyleSheet.absoluteFill, styles.solid]} />;
}

/** Soft gloss layers: top glow, bright bottom edge, white rim and inner bevel. Gentler at night. */
function BubbleFinish({ daylight, radius }: { daylight: number; radius: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const a = 0.1 + daylight * 0.16;
  const w = (k: number) => `rgba(255,255,255,${Math.min(1, a * k).toFixed(3)})`;
  const r = Math.max(0, Math.min(radius, box.h / 2, box.w / 2));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* Soft glow across the top, fading out gently (no hard cut) */}
      <LinearGradient colors={[w(1.4), w(0.45), 'rgba(255,255,255,0)']} locations={[0, 0.18, 0.42]} style={StyleSheet.absoluteFill} />
      {/* Bright bottom edge, like light caught in the base of the glass */}
      <LinearGradient colors={['rgba(255,255,255,0)', w(1.1)]} locations={[0.82, 1]} style={StyleSheet.absoluteFill} />

      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id="rim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55 + daylight * 0.4} />
              <Stop offset="0.5" stopColor="#D8F3FF" stopOpacity={0.22 + daylight * 0.33} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.45 + daylight * 0.45} />
            </SvgGradient>
          </Defs>
          {/* Clean white rim */}
          <Rect
            x={0.75}
            y={0.75}
            width={box.w - 1.5}
            height={box.h - 1.5}
            rx={Math.max(0, r - 0.75)}
            fill="none"
            stroke="url(#rim)"
            strokeWidth={1.5}
          />
          {/* Soft inner bevel */}
          <Rect
            x={3}
            y={3}
            width={Math.max(0, box.w - 6)}
            height={Math.max(0, box.h - 6)}
            rx={Math.max(0, r - 3)}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.06 + daylight * 0.1}
            strokeWidth={4}
          />
        </Svg>
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
  fallback: { backgroundColor: 'rgba(30,55,125,0.5)' },
  solid: { opacity: 0.94 },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});

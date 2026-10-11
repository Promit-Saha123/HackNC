import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSky } from '@/state/sky';
import { mix } from '@/utils/sky';

/** Horizon line as a share of screen height. */
const HORIZON = 0.5;

/** Tiny seeded PRNG so stars and glints sit in the same place on every render. */
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Living sky behind every screen: follows the phone's clock from night through sunrise to day and back.
 * Sun and moon travel an arc, stars fade in at night, the sea reflects whichever is up.
 */
export function Backdrop() {
  const { width: W, height: H } = useWindowDimensions();
  const sky = useSky();
  const night = 1 - sky.daylight;
  const hy = H * HORIZON;

  const stars = useMemo(() => {
    const r = rand(7);
    return Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * hy * 0.95, r: 0.5 + r() * 1.2, o: 0.35 + r() * 0.65 }));
  }, [W, hy]);

  const glints = useMemo(() => {
    const r = rand(42);
    return Array.from({ length: 46 }, () => ({ x: r() * W, y: hy + 8 + r() ** 1.4 * (H - hy), rx: 4 + r() * 26, o: 0.05 + r() * 0.14 }));
  }, [W, H, hy]);

  const sun = sky.sun && { cx: sky.sun.x * W, cy: hy - sky.sun.height * H * 0.34, r: W * 0.06 };
  const moon = sky.moon && { cx: sky.moon.x * W, cy: hy - sky.moon.height * H * 0.33, r: W * 0.085 };
  // The sea reflects the sun by day and the moon by night.
  const body = sky.daylight > 0.5 ? sun : moon;
  const bodyColor = sky.daylight > 0.5 ? (sky.sun?.color ?? '#FFFFFF') : '#F4F1E6';

  const leaf = mix('#071427', '#2A7A55', sky.daylight);
  const leafOpacity = 0.55 + night * 0.35;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: sky.top }]} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky.top} />
            <Stop offset="0.6" stopColor={sky.mid} />
            <Stop offset="1" stopColor={sky.horizon} />
          </LinearGradient>
          <LinearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky.seaTop} />
            <Stop offset="1" stopColor={sky.seaBottom} />
          </LinearGradient>
          <LinearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky.horizon} stopOpacity={0.75} />
            <Stop offset="1" stopColor={sky.horizon} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={sky.sun?.color ?? '#FFFFFF'} stopOpacity={0.55} />
            <Stop offset="1" stopColor={sky.sun?.color ?? '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#DCE6FF" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#DCE6FF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="moonFace" cx="60%" cy="40%" r="60%">
            <Stop offset="0" stopColor="#FBF8EE" />
            <Stop offset="1" stopColor="#C9C2AE" />
          </RadialGradient>
          {moon && (
            <Mask id="crescent">
              <Circle cx={moon.cx} cy={moon.cy} r={moon.r} fill="#FFFFFF" />
              <Circle cx={moon.cx - moon.r * 0.5} cy={moon.cy - moon.r * 0.18} r={moon.r * 0.92} fill="#000000" />
            </Mask>
          )}
        </Defs>

        <Rect x={0} y={0} width={W} height={hy + 1} fill="url(#sky)" />

        {/* Stars fade in as the light goes */}
        <G opacity={night ** 1.5}>
          {stars.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
          ))}
        </G>

        {sun && (
          <G opacity={Math.min(1, sky.daylight + sky.twilight)}>
            <Circle cx={sun.cx} cy={sun.cy} r={sun.r * 5} fill="url(#sunGlow)" />
            <Circle cx={sun.cx} cy={sun.cy} r={sun.r} fill={sky.sun!.color} />
          </G>
        )}

        {moon && (
          <G opacity={Math.min(1, night * 1.2)}>
            <Circle cx={moon.cx} cy={moon.cy} r={moon.r * 3.2} fill="url(#moonGlow)" />
            <G mask="url(#crescent)">
              <Circle cx={moon.cx} cy={moon.cy} r={moon.r} fill="url(#moonFace)" />
              <Circle cx={moon.cx + moon.r * 0.35} cy={moon.cy + moon.r * 0.2} r={moon.r * 0.14} fill="#B7B09B" opacity={0.5} />
              <Circle cx={moon.cx + moon.r * 0.55} cy={moon.cy - moon.r * 0.35} r={moon.r * 0.09} fill="#B7B09B" opacity={0.45} />
              <Circle cx={moon.cx + moon.r * 0.15} cy={moon.cy + moon.r * 0.6} r={moon.r * 0.08} fill="#B7B09B" opacity={0.4} />
            </G>
          </G>
        )}

        {/* Sea covers anything below the horizon */}
        <Rect x={0} y={hy} width={W} height={H - hy} fill="url(#sea)" />
        <Rect x={0} y={hy} width={W} height={H * 0.06} fill="url(#haze)" />

        {glints.map((g, i) => (
          <Ellipse key={i} cx={g.x} cy={g.y} rx={g.rx} ry={0.9} fill="#FFFFFF" opacity={g.o * (0.55 + sky.daylight * 0.45)} />
        ))}

        {body && <Reflection x={body.cx} top={hy} bottom={H} color={bodyColor} strength={sky.daylight > 0.5 ? 0.55 : 0.8} />}

        <Dome W={W} H={H} daylight={sky.daylight} />
        <Palm x={-W * 0.05} y={H * 0.29} size={W * 0.42} color={leaf} opacity={leafOpacity} />
        <Palm x={-W * 0.08} y={H * 0.86} size={W * 0.36} color={leaf} opacity={leafOpacity * 0.8} flip />
      </Svg>

      <DriftingClouds W={W} H={H} daylight={sky.daylight} twilight={sky.twilight} />
      {sky.daylight > 0.05 && <Bubbles W={W} H={H} opacity={sky.daylight} />}
    </View>
  );
}

/** Glittering column on the water under the sun or moon. */
const Reflection = memo(function Reflection({ x, top, bottom, color, strength }: { x: number; top: number; bottom: number; color: string; strength: number }) {
  const r = rand(99);
  const rows = 26;
  return (
    <G>
      {Array.from({ length: rows }, (_, i) => {
        const t = i / rows;
        const y = top + 4 + t ** 1.3 * (bottom - top) * 0.75;
        const w = (10 + r() * 34) * (1 + t * 1.5);
        return <Ellipse key={i} cx={x + (r() - 0.5) * 18 * (1 + t * 2)} cy={y} rx={w} ry={1.1 + t} fill={color} opacity={strength * (1 - t) * (0.4 + r() * 0.6)} />;
      })}
    </G>
  );
});

/** Rounded glass dome on the left edge, like the reference art. */
function Dome({ W, H, daylight }: { W: number; H: number; daylight: number }) {
  const x0 = -W * 0.04;
  const x1 = W * 0.15;
  const y0 = H * 0.24;
  const y1 = H * 0.47;
  const r = W * 0.09;
  const d = `M${x0} ${y1} L${x0} ${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} L${x1 - r} ${y0} Q${x1} ${y0} ${x1} ${y0 + r} L${x1} ${y1}`;
  return (
    <G>
      <Path d={`${d} Z`} fill="#FFFFFF" opacity={0.05 + daylight * 0.05} />
      <Path d={d} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} fill="none" />
      <Path d={`M${x1 - 6} ${y0 + r} L${x1 - 6} ${y1 - 10}`} stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={3} strokeLinecap="round" />
      <Rect x={x0} y={y1 - 3} width={x1 - x0 + 4} height={6} rx={3} fill="#FFFFFF" opacity={0.25} />
    </G>
  );
}

/** Palm fronds fanning out from a point off the left edge. */
function Palm({ x, y, size, color, opacity, flip }: { x: number; y: number; size: number; color: string; opacity: number; flip?: boolean }) {
  const angles = flip ? [-70, -40, -12, 15] : [-55, -25, 5, 32, 58];
  return (
    <G opacity={opacity}>
      {angles.map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const len = size * (0.75 + (i % 2) * 0.25);
        const tx = x + Math.cos(a) * len;
        const ty = y + Math.sin(a) * len;
        // Midpoint bowed downward like a drooping frond.
        const mx = x + Math.cos(a) * len * 0.5;
        const my = y + Math.sin(a) * len * 0.5 + len * 0.12;
        const nx = -Math.sin(a) * len * 0.16;
        const ny = Math.cos(a) * len * 0.16;
        return <Path key={deg} d={`M${x} ${y} Q${mx + nx} ${my + ny} ${tx} ${ty} Q${mx - nx} ${my - ny} ${x} ${y} Z`} fill={color} />;
      })}
    </G>
  );
}

/** Soft clouds near the horizon that drift slowly side to side. */
function DriftingClouds({ W, H, daylight, twilight }: { W: number; H: number; daylight: number; twilight: number }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 45_000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (drift.value - 0.5) * 40 }] }));

  const color = mix(mix('#8396CF', '#FFFFFF', daylight), '#FFC7B0', twilight * 0.6);
  const opacity = 0.18 + daylight * 0.4;
  const cloud = (cx: number, cy: number, s: number) => (
    <G opacity={opacity}>
      <Ellipse cx={cx} cy={cy} rx={s} ry={s * 0.32} fill={color} />
      <Ellipse cx={cx - s * 0.35} cy={cy - s * 0.12} rx={s * 0.45} ry={s * 0.3} fill={color} />
      <Ellipse cx={cx + s * 0.25} cy={cy - s * 0.2} rx={s * 0.5} ry={s * 0.36} fill={color} />
    </G>
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={W} height={H}>
        {cloud(W * 0.82, H * 0.44, W * 0.2)}
        {cloud(W * 0.18, H * 0.2, W * 0.13)}
        {cloud(W * 0.62, H * 0.12, W * 0.1)}
      </Svg>
    </Animated.View>
  );
}

/** A few glassy bubbles that bob gently (daytime only). */
function Bubbles({ W, H, opacity }: { W: number; H: number; opacity: number }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (bob.value - 0.5) * 12 }] }));

  const list = [
    { x: W * 0.9, y: H * 0.22, r: W * 0.1 },
    { x: W * 0.9, y: H * 0.33, r: W * 0.022 },
    { x: W * 0.08, y: H * 0.6, r: W * 0.03 },
  ];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }, style]} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="bubble" cx="50%" cy="50%" r="50%">
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.02} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.35} />
          </RadialGradient>
        </Defs>
        {list.map((b, i) => (
          <G key={i}>
            <Circle cx={b.x} cy={b.y} r={b.r} fill="url(#bubble)" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1} />
            <Ellipse cx={b.x - b.r * 0.35} cy={b.y - b.r * 0.4} rx={b.r * 0.28} ry={b.r * 0.14} fill="#FFFFFF" opacity={0.7} />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

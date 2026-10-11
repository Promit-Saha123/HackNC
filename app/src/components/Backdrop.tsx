import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSky } from '@/state/sky';
import { mix } from '@/utils/sky';

/** Horizon line as a share of screen height. */
const HORIZON = 0.5;

/** Tiny seeded PRNG so stars, ripples and glints sit in the same place on every render. */
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Living sky behind every screen: follows the phone's clock from night through sunrise to day and back.
 * Sun and moon travel an arc, stars fade in at night, an island sits on the horizon, leaves frame the left
 * edge, and the rippling sea reflects whichever light is up.
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

  // Ripples get longer and thicker toward the viewer.
  const ripples = useMemo(() => {
    const r = rand(42);
    return Array.from({ length: 80 }, () => {
      const t = r() ** 1.5;
      return { x: r() * W, y: hy + 6 + t * (H - hy), rx: (6 + r() * 30) * (1 + t * 2.2), ry: 0.6 + t * 1.6, o: 0.05 + r() * 0.15 };
    });
  }, [W, H, hy]);

  // Sun-dapple pattern on the shallow water near the bottom.
  const caustics = useMemo(() => {
    const r = rand(311);
    return Array.from({ length: 36 }, () => ({
      x: r() * W,
      y: H * (0.78 + r() * 0.22),
      rx: 10 + r() * 22,
      ry: 3 + r() * 5,
      a: r() * 180,
      o: 0.05 + r() * 0.08,
    }));
  }, [W, H]);

  const sun = sky.sun && { cx: sky.sun.x * W, cy: hy - sky.sun.height * H * 0.34, r: W * 0.06 };
  const moon = sky.moon && { cx: sky.moon.x * W, cy: hy - sky.moon.height * H * 0.33, r: W * 0.085 };
  const body = sky.daylight > 0.5 ? sun : moon;
  const bodyColor = sky.daylight > 0.5 ? (sky.sun?.color ?? '#FFFFFF') : '#F4F1E6';

  const land = mix('#0A1830', '#3B7C58', sky.daylight);
  const landFar = mix('#14244A', '#8FB3C9', sky.daylight);
  const leafLight = mix('#0E2238', '#5BBE80', sky.daylight);
  const leafDark = mix('#06121F', '#24734B', sky.daylight);

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
          <LinearGradient id="leaf" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={leafDark} />
            <Stop offset="1" stopColor={leafLight} />
          </LinearGradient>
          {moon && (
            <Mask id="crescent">
              <Circle cx={moon.cx} cy={moon.cy} r={moon.r} fill="#FFFFFF" />
              <Circle cx={moon.cx - moon.r * 0.5} cy={moon.cy - moon.r * 0.18} r={moon.r * 0.92} fill="#000000" />
            </Mask>
          )}
        </Defs>

        <Rect x={0} y={0} width={W} height={hy + 1} fill="url(#sky)" />

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

        {/* Faint far hills on the left, then the island on the right */}
        <Path
          d={`M${-W * 0.05} ${hy} Q${W * 0.12} ${hy - H * 0.035} ${W * 0.3} ${hy - H * 0.018} Q${W * 0.42} ${hy - H * 0.01} ${W * 0.5} ${hy} Z`}
          fill={landFar}
          opacity={0.55}
        />
        <Island W={W} H={H} hy={hy} color={land} />

        <Rect x={0} y={hy} width={W} height={H - hy} fill="url(#sea)" />
        <Rect x={0} y={hy} width={W} height={H * 0.05} fill="url(#haze)" />
        {/* Island reflection */}
        <Path
          d={`M${W * 0.6} ${hy} Q${W * 0.8} ${hy + H * 0.04} ${W * 1.05} ${hy + H * 0.03} L${W * 1.05} ${hy} Z`}
          fill={land}
          opacity={0.18}
        />

        {ripples.map((g, i) => (
          <Ellipse key={i} cx={g.x} cy={g.y} rx={g.rx} ry={g.ry} fill="#FFFFFF" opacity={g.o * (0.5 + sky.daylight * 0.5)} />
        ))}
        <G opacity={sky.daylight}>
          {caustics.map((c, i) => (
            <Ellipse
              key={i}
              cx={c.x}
              cy={c.y}
              rx={c.rx}
              ry={c.ry}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={1.2}
              opacity={c.o * 2}
              transform={`rotate(${c.a} ${c.x} ${c.y})`}
            />
          ))}
        </G>

        {body && <Reflection x={body.cx} top={hy} bottom={H} color={bodyColor} strength={sky.daylight > 0.5 ? 0.55 : 0.8} />}

        {/* Broad tropical leaves framing the left edge */}
        <LeafCluster x={-W * 0.03} y={H * 0.3} size={W * 0.4} angles={[-48, -22, 4, 30]} rib={leafLight} />
        <LeafCluster x={-W * 0.04} y={H * 0.84} size={W * 0.34} angles={[-70, -42, -14]} rib={leafLight} />
      </Svg>

      <DriftingClouds W={W} H={H} daylight={sky.daylight} twilight={sky.twilight} />
      {sky.daylight > 0.05 && <Bubbles W={W} H={H} opacity={sky.daylight} />}
    </View>
  );
}

/** Wooded island on the right of the horizon: a long hill with a bumpy tree line. */
function Island({ W, H, hy, color }: { W: number; H: number; hy: number; color: string }) {
  const x0 = W * 0.58;
  const top = (x: number) => {
    // Hill profile: rises from the left, peaks around 82% of the width, slopes off the right edge.
    const t = (x - x0) / (W * 0.47);
    return hy - H * 0.062 * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI * 0.9);
  };
  const trees = Array.from({ length: 22 }, (_, i) => {
    const x = x0 + W * 0.03 + i * W * 0.021;
    return { x, y: top(x), r: W * (0.012 + ((i * 7) % 5) * 0.003) };
  });
  const hill = Array.from({ length: 24 }, (_, i) => {
    const x = x0 + (i / 23) * W * 0.47;
    return `L${x} ${top(x)}`;
  }).join(' ');
  return (
    <G>
      <Path d={`M${x0} ${hy} ${hill} L${W * 1.05} ${hy} Z`} fill={color} />
      {trees.map((t, i) => (
        <Circle key={i} cx={t.x} cy={t.y} r={t.r} fill={color} />
      ))}
    </G>
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

/** Wide glossy tropical leaves fanning from a point off the left edge, each with a lighter midrib. */
function LeafCluster({ x, y, size, angles, rib }: { x: number; y: number; size: number; angles: number[]; rib: string }) {
  return (
    <G>
      {angles.map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const len = size * (0.8 + (i % 2) * 0.22);
        const w = len * 0.22;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const nx = -dy;
        const ny = dx;
        // Tip droops a little below the straight line.
        const tx = x + dx * len;
        const ty = y + dy * len + len * 0.08;
        const p = (k: number, side: number, wk: number) => `${x + dx * len * k + nx * w * wk * side} ${y + dy * len * k + ny * w * wk * side + len * 0.05 * k}`;
        const d = `M${x} ${y} C${p(0.25, 1, 1.1)} ${p(0.7, 1, 0.9)} ${tx} ${ty} C${p(0.7, -1, 0.9)} ${p(0.25, -1, 1.1)} ${x} ${y} Z`;
        return (
          <G key={deg}>
            <Path d={d} fill="url(#leaf)" opacity={0.92} />
            <Line x1={x} y1={y} x2={tx} y2={ty} stroke={rib} strokeOpacity={0.55} strokeWidth={1.4} />
            {/* Glossy sheen on the upper half of the leaf */}
            <Path d={`M${x} ${y} C${p(0.25, 1, 1.1)} ${p(0.7, 1, 0.9)} ${tx} ${ty} Z`} fill="#FFFFFF" opacity={0.08} />
          </G>
        );
      })}
    </G>
  );
}

/** Puffy shaded cumulus clouds that drift slowly side to side. */
function DriftingClouds({ W, H, daylight, twilight }: { W: number; H: number; daylight: number; twilight: number }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 45_000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (drift.value - 0.5) * 40 }] }));

  const light = mix(mix('#7E92C9', '#FFFFFF', daylight), '#FFD2BC', twilight * 0.6);
  const shade = mix(mix('#4A5C93', '#C6DBF0', daylight), '#E9A9A0', twilight * 0.5);
  const opacity = 0.22 + daylight * 0.66;

  const LOBES = [
    [-0.62, 0.06, 0.3],
    [-0.32, -0.16, 0.42],
    [0.06, -0.3, 0.52],
    [0.44, -0.12, 0.4],
    [0.72, 0.06, 0.28],
  ];
  const cloud = (cx: number, cy: number, s: number) => (
    <G opacity={opacity}>
      {/* Shadowed underside, then the lit body slightly higher */}
      {LOBES.map(([dx, dy, r], i) => (
        <Circle key={`s${i}`} cx={cx + dx * s} cy={cy + dy * s + s * 0.08} r={r * s} fill={shade} />
      ))}
      <Ellipse cx={cx} cy={cy + s * 0.12} rx={s * 0.95} ry={s * 0.2} fill={shade} />
      {LOBES.map(([dx, dy, r], i) => (
        <Circle key={`l${i}`} cx={cx + dx * s} cy={cy + dy * s} r={r * s * 0.94} fill={light} />
      ))}
    </G>
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={W} height={H}>
        {cloud(W * 0.5, H * 0.17, W * 0.2)}
        {cloud(W * 0.14, H * 0.12, W * 0.1)}
        {cloud(W * 0.88, H * 0.42, W * 0.16)}
      </Svg>
    </Animated.View>
  );
}

type Bubble = { x: number; y: number; r: number };

/** Glossy daytime bubbles in three layers that bob at different speeds, so the field never moves in lockstep. */
function Bubbles({ W, H, opacity }: { W: number; H: number; opacity: number }) {
  const layers: { bubbles: Bubble[]; duration: number; rise: number }[] = [
    {
      duration: 5200,
      rise: 14,
      bubbles: [
        { x: W * 0.88, y: H * 0.2, r: W * 0.1 },
        { x: W * 0.12, y: H * 0.62, r: W * 0.045 },
        { x: W * 0.55, y: H * 0.08, r: W * 0.03 },
      ],
    },
    {
      duration: 3800,
      rise: 9,
      bubbles: [
        { x: W * 0.92, y: H * 0.32, r: W * 0.024 },
        { x: W * 0.3, y: H * 0.42, r: W * 0.018 },
        { x: W * 0.78, y: H * 0.56, r: W * 0.035 },
        { x: W * 0.06, y: H * 0.18, r: W * 0.02 },
        { x: W * 0.5, y: H * 0.28, r: W * 0.01 },
        { x: W * 0.84, y: H * 0.46, r: W * 0.013 },
        { x: W * 0.16, y: H * 0.74, r: W * 0.016 },
      ],
    },
    {
      duration: 6400,
      rise: 18,
      bubbles: [
        { x: W * 0.68, y: H * 0.36, r: W * 0.014 },
        { x: W * 0.94, y: H * 0.74, r: W * 0.05 },
        { x: W * 0.22, y: H * 0.86, r: W * 0.028 },
        { x: W * 0.44, y: H * 0.7, r: W * 0.012 },
      ],
    },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {layers.map((l, i) => (
        <BubbleLayer key={i} W={W} H={H} {...l} />
      ))}
    </View>
  );
}

function BubbleLayer({ W, H, bubbles, duration, rise }: { W: number; H: number; bubbles: Bubble[]; duration: number; rise: number }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob, duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (bob.value - 0.5) * rise }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="bubbleBody" cx="50%" cy="50%" r="50%">
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.04} />
            <Stop offset="0.9" stopColor="#E6F7FF" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.55} />
          </RadialGradient>
          {/* Soap-film rim: cyan to pink to white */}
          <LinearGradient id="bubbleRim" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="0.45" stopColor="#B8F1FF" stopOpacity={0.7} />
            <Stop offset="0.75" stopColor="#FFC9EC" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.8} />
          </LinearGradient>
        </Defs>
        {bubbles.map((b, i) => (
          <G key={i}>
            <Circle cx={b.x} cy={b.y} r={b.r} fill="url(#bubbleBody)" stroke="url(#bubbleRim)" strokeWidth={Math.max(1, b.r * 0.05)} />
            {/* Main glint top-left, small one bottom-right */}
            <Ellipse
              cx={b.x - b.r * 0.38}
              cy={b.y - b.r * 0.42}
              rx={b.r * 0.3}
              ry={b.r * 0.15}
              fill="#FFFFFF"
              opacity={0.85}
              transform={`rotate(-35 ${b.x - b.r * 0.38} ${b.y - b.r * 0.42})`}
            />
            <Circle cx={b.x + b.r * 0.45} cy={b.y + b.r * 0.45} r={b.r * 0.08} fill="#FFFFFF" opacity={0.6} />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

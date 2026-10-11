import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { Glass } from '@/components/Glass';

/** Point on a circle, angle in degrees clockwise from 12 o'clock. */
const at = (c: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
};

/** SVG arc path along a circle between two angles. */
const arcPath = (c: number, r: number, from: number, to: number) => {
  const p = at(c, r, from);
  const q = at(c, r, to);
  return `M${p.x} ${p.y} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${q.x} ${q.y}`;
};

/**
 * A big glass sphere (Frutiger Aero): Liquid Glass disc plus a lens rim, edge glow,
 * a bright highlight arc top-left, a softer reflection bottom-right and a specular spot.
 */
export function GlassBubble({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  const c = size / 2;
  const rim = c - 2;
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Glass style={{ width: size, height: size, borderRadius: c }} />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="lens" cx="50%" cy="50%" r="50%">
            <Stop offset="0.84" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.93" stopColor="#BFD9FF" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.22} />
          </RadialGradient>
          <LinearGradient id="bubbleRim" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.6} />
            <Stop offset="0.35" stopColor="#9FD8FF" stopOpacity={0.5} />
            <Stop offset="0.7" stopColor="#C9B4FF" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.5} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={rim} fill="url(#lens)" />
        <Circle cx={c} cy={c} r={rim} fill="none" stroke="url(#bubbleRim)" strokeWidth={3} />
        <Circle cx={c} cy={c} r={rim - size * 0.03} fill="none" stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={size * 0.022} />
        {/* Window-light highlight top-left, softer bounce bottom-right */}
        <PathArc d={arcPath(c, rim - size * 0.035, 222, 336)} width={size * 0.03} opacity={0.55} />
        <PathArc d={arcPath(c, rim - size * 0.035, 56, 146)} width={size * 0.016} opacity={0.28} />
        <Ellipse
          cx={c - size * 0.25}
          cy={c - size * 0.3}
          rx={size * 0.07}
          ry={size * 0.03}
          fill="#FFFFFF"
          opacity={0.4}
          transform={`rotate(-40 ${c - size * 0.25} ${c - size * 0.3})`}
        />
      </Svg>
    </View>
  );
}

function PathArc({ d, width, opacity }: { d: string; width: number; opacity: number }) {
  return <Path d={d} stroke="#FFFFFF" strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" fill="none" />;
}

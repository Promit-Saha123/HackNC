import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';
import { STAGE_META, type Stages } from '@/utils/nights';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Window = { bed: number; wake: number };

type Props = {
  size: number;
  score: number | null;
  /** Inner ring: minutes per sleep stage. */
  stages: Stages | null;
  /** Outer ring: last night's sleep window, minutes after midnight. */
  sleep: Window | null;
  /** Ghost arc behind the outer ring: the target window. */
  target: Window;
  onPress?: () => void;
};

/** 12-hour clock angle (degrees from 12 o'clock) for minutes after midnight. */
const clockDeg = (m: number) => ((((m % 720) + 720) % 720) / 720) * 360;
const sweepDeg = (w: Window) => Math.min(359, (((w.wake - w.bed + 1440) % 1440) / 720) * 360);

/**
 * Home ring.
 * Outer: a 12-hour "night clock" - last night's bedtime-to-wake arc over the target window.
 * Inner: last night's sleep stages as colored segments. Center: the rest score.
 */
export function SleepRing({ size, score, stages, sleep, target, onPress }: Props) {
  const progress = useSharedValue(0);
  const ready = score != null;

  useEffect(() => {
    progress.value = 0;
    if (ready) progress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [ready, progress]);

  // Geometry as fractions of `size`: glow pad, outer stroke, numeral gap, inner stroke.
  const c = size / 2;
  const pad = size * 0.04;
  const s1 = size * 0.05;
  const gap = size * 0.09;
  const s2 = size * 0.055;
  const r1 = c - pad - s1 / 2;
  const labelR = r1 - s1 / 2 - gap / 2;
  const r2 = r1 - s1 / 2 - gap - s2 / 2;
  // Clear space inside the stage ring; the center text is sized to sit well inside it.
  const hole = 2 * (r2 - s2 / 2);
  const scoreSize = hole * 0.3;
  const labelText = Math.max(10, hole * 0.095);
  const hintText = Math.max(9, hole * 0.07);

  const total = stages ? stages.deep + stages.light + stages.rem + stages.awake : 0;
  let cursor = 0;
  const segments = stages && total > 0
    ? STAGE_META.map((m) => {
        const sweep = (stages[m.key] / total) * 360;
        const seg = { key: m.key, color: m.color, start: cursor, sweep };
        cursor += sweep;
        return seg;
      })
    : [];

  const labelSize = Math.max(9, size * 0.04);

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="night" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.accentEnd} />
          </LinearGradient>
        </Defs>

        {/* Outer night clock */}
        <Circle cx={c} cy={c} r={r1} stroke={colors.ringTrack} strokeWidth={s1} fill="none" />
        <Circle cx={c} cy={c} r={r1 - s1 * 0.22} stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={s1 * 0.25} fill="none" />
        <GlassArc c={c} r={r1} width={s1} color={colors.dimBar} start={clockDeg(target.bed)} sweep={sweepDeg(target)} progress={null} round />
        {sleep && (
          <>
            <Arc c={c} r={r1} width={s1 + size * 0.04} color="url(#night)" opacity={0.16} start={clockDeg(sleep.bed)} sweep={sweepDeg(sleep)} progress={progress} round />
            <GlassArc c={c} r={r1} width={s1} color="url(#night)" start={clockDeg(sleep.bed)} sweep={sweepDeg(sleep)} progress={progress} round />
          </>
        )}

        {/* Inner stages */}
        <Circle cx={c} cy={c} r={r2} stroke={colors.ringTrack} strokeWidth={s2} fill="none" />
        <Circle cx={c} cy={c} r={r2 - s2 * 0.22} stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={s2 * 0.25} fill="none" />
        {segments.map((s) => (
          <GlassArc key={s.key} c={c} r={r2} width={s2} color={s.color} start={s.start + 1.5} sweep={Math.max(0, s.sweep - 3)} progress={progress} />
        ))}
      </Svg>

      {/* Clock numerals between the two rings */}
      {[
        { n: '12', deg: 0 },
        { n: '3', deg: 90 },
        { n: '6', deg: 180 },
        { n: '9', deg: 270 },
      ].map(({ n, deg }) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const box = labelSize * 2.2;
        return (
          <Text
            key={n}
            style={[
              styles.numeral,
              {
                fontSize: labelSize,
                lineHeight: labelSize * 1.2,
                width: box,
                left: c + labelR * Math.cos(rad) - box / 2,
                top: c + labelR * Math.sin(rad) - (labelSize * 1.2) / 2,
              },
            ]}>
            {n}
          </Text>
        );
      })}

      <View style={styles.center} pointerEvents="none">
        <View style={{ width: hole * 0.86, alignItems: 'center' }}>
          <Text style={[styles.label, { fontSize: labelText, lineHeight: labelText * 1.25 }]}>Rest score</Text>
          <Text
            style={[styles.score, { fontSize: scoreSize, lineHeight: scoreSize * 1.12 }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {score == null ? '--' : Math.round(score)}
            {score != null && <Text style={[styles.percent, { fontSize: scoreSize * 0.45 }]}>%</Text>}
          </Text>
          {hole >= 110 && (
            <Text style={[styles.hint, { fontSize: hintText, lineHeight: hintText * 1.3 }]}>Tap for details</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

type ArcProps = {
  c: number;
  r: number;
  width: number;
  color: string;
  /** Degrees clockwise from 12 o'clock. */
  start: number;
  sweep: number;
  /** Shared 0-1 reveal; null draws the arc fully. */
  progress: SharedValue<number> | null;
  opacity?: number;
  round?: boolean;
};

function Arc({ c, r, width, color, start, sweep, progress, opacity = 1, round }: ArcProps) {
  const circumference = 2 * Math.PI * r;
  const len = (sweep / 360) * circumference;
  const animated = useAnimatedProps(() => ({
    strokeDashoffset: progress ? len * (1 - progress.value) : 0,
  }));
  return (
    <AnimatedCircle
      cx={c}
      cy={c}
      r={r}
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeLinecap={round ? 'round' : 'butt'}
      strokeDasharray={[len, circumference]}
      animatedProps={animated}
      fill="none"
      transform={`rotate(${start - 90} ${c} ${c})`}
    />
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  numeral: { position: 'absolute', textAlign: 'center', color: colors.tabInactive, fontFamily: fontFamily.medium },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.textSoft, fontFamily: fontFamily.medium },
  score: { color: colors.text, fontFamily: fontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  percent: { color: colors.textSoft, fontFamily: fontFamily.semibold, letterSpacing: 0 },
  hint: { color: colors.tabInactive, fontFamily: fontFamily.regular },
});

/**
 * Arc drawn as a glass tube (Frutiger Aero): the colored stroke, a soft dark rim on the outside,
 * and a bright shine line along the inside, all sharing the same reveal animation.
 */
function GlassArc(props: ArcProps) {
  const { r, width, sweep, round } = props;
  // Keep the shine inside the arc's rounded ends.
  const inset = round ? ((width * 0.5) / r) * (180 / Math.PI) : 1;
  const shineSweep = Math.max(0, sweep - inset * 2);
  return (
    <>
      <Arc {...props} />
      <Arc {...props} r={r + width * 0.38} width={width * 0.24} color="#0A2A6A" opacity={0.22} />
      <Arc {...props} r={r - width * 0.2} width={width * 0.3} color="#FFFFFF" opacity={0.5} start={props.start + inset} sweep={shineSweep} round />
      <Arc {...props} r={r - width * 0.26} width={width * 0.1} color="#FFFFFF" opacity={0.85} start={props.start + inset} sweep={shineSweep} round />
    </>
  );
}

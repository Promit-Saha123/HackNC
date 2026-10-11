import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 260;
const OUTER_STROKE = 16;
const INNER_STROKE = 6;
const OUTER_R = (SIZE - OUTER_STROKE - 20) / 2; // leaves room for the glow
const INNER_R = OUTER_R - OUTER_STROKE / 2 - 14;
const OUTER_C = 2 * Math.PI * OUTER_R;
const INNER_C = 2 * Math.PI * INNER_R;

type Props = {
  /** 0-100, or null while loading / nothing synced. */
  score: number | null;
  /** 0-1. Drives the thin inner arc; falls back to the score. */
  inner?: number | null;
};

/** Double ring: outer purple-to-blue arc = score, thin near-white arc inside. Fills from empty in 1 s. */
export function ScoreRing({ score, inner }: Props) {
  const outer = useSharedValue(0);
  const thin = useSharedValue(0);
  const target = score == null ? 0 : Math.max(0, Math.min(1, score / 100));
  const innerTarget = score == null ? 0 : Math.max(0, Math.min(1, inner ?? score / 100));

  useEffect(() => {
    outer.value = withTiming(target, { duration: 1000, easing: Easing.out(Easing.cubic) });
    thin.value = withTiming(innerTarget, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [target, innerTarget, outer, thin]);

  const outerProps = useAnimatedProps(() => ({ strokeDashoffset: OUTER_C * (1 - outer.value) }));
  const glowProps = useAnimatedProps(() => ({ strokeDashoffset: OUTER_C * (1 - outer.value) }));
  const innerProps = useAnimatedProps(() => ({ strokeDashoffset: INNER_C * (1 - thin.value) }));

  const c = SIZE / 2;
  const rotate = `rotate(-90 ${c} ${c})`;

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.purple} />
            <Stop offset="1" stopColor={colors.blue} />
          </LinearGradient>
        </Defs>

        <Circle cx={c} cy={c} r={OUTER_R} stroke={colors.ringTrack} strokeWidth={OUTER_STROKE} fill="none" />
        <Circle cx={c} cy={c} r={INNER_R} stroke={colors.ringTrack} strokeWidth={INNER_STROKE} fill="none" />

        {/* Soft glow: a wider, faint copy of the arc underneath. */}
        <AnimatedCircle
          cx={c}
          cy={c}
          r={OUTER_R}
          stroke="url(#ring)"
          strokeOpacity={0.25}
          strokeWidth={OUTER_STROKE + 14}
          strokeLinecap="round"
          strokeDasharray={OUTER_C}
          animatedProps={glowProps}
          fill="none"
          transform={rotate}
        />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={OUTER_R}
          stroke="url(#ring)"
          strokeWidth={OUTER_STROKE}
          strokeLinecap="round"
          strokeDasharray={OUTER_C}
          animatedProps={outerProps}
          fill="none"
          transform={rotate}
        />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={INNER_R}
          stroke={colors.text}
          strokeWidth={INNER_STROKE}
          strokeLinecap="round"
          strokeDasharray={INNER_C}
          animatedProps={innerProps}
          fill="none"
          transform={rotate}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Text style={t.ringLabel}>Rest score</Text>
        <Text style={t.bigScore}>{score == null ? '--' : `${Math.round(score)}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});

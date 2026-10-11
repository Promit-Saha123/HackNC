import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { GlossCap } from '@/components/GlossCap';
import { colors, gradient } from '@/theme/colors';

/** Glossy bar: accent gradient fill (or a solid `color`) with an Aero shine on top. `value` is 0-1. */
export function ProgressBar({ value, height = 4, color }: { value: number; height?: number; color?: string }) {
  const pct = `${Math.max(0, Math.min(1, value)) * 100}%` as const;
  const fill = { width: pct, height, borderRadius: height / 2, overflow: 'hidden' as const };
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      {color ? (
        <View style={[fill, { backgroundColor: color }]}>
          <GlossCap strength={0.6} />
        </View>
      ) : (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={fill}>
          <GlossCap strength={0.6} />
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.dimBar,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});

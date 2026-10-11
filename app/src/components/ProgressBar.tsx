import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, gradient } from '@/theme/colors';

/** 4 pt track with a purple-to-blue fill (or a solid `color`). `value` is 0-1. */
export function ProgressBar({ value, height = 4, color }: { value: number; height?: number; color?: string }) {
  const pct = `${Math.max(0, Math.min(1, value)) * 100}%` as const;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      {color ? (
        <View style={{ width: pct, height, borderRadius: height / 2, backgroundColor: color }} />
      ) : (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: pct, height, borderRadius: height / 2 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.dimBar, overflow: 'hidden' },
});

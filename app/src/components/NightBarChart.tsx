import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, gradient } from '@/theme/colors';
import { type as t } from '@/theme/fonts';

const PLOT_HEIGHT = 200;
const BAR_WIDTH = 24;

export type ChartBar = {
  key: string;
  label: string;
  /** 0 = top of the plot, 1 = bottom. */
  top: number;
  bottom: number;
  bright: boolean;
};

type Props = {
  bars: ChartBar[];
  /** Right-axis labels, top to bottom, evenly spaced. */
  ticks: string[];
  /** Shaded band (0-1 from the top), e.g. the healthy 7-9 h range. */
  band?: { top: number; bottom: number };
  /** Dashed accent line (0-1 from the top), e.g. target bedtime. */
  marker?: number;
  selected: number | null;
  onSelect: (index: number) => void;
};

/** Weekly bars with a right-hand axis. Bars float between `top` and `bottom` and grow over 0.4 s when they change. */
export function NightBarChart({ bars, ticks, band, marker, selected, onSelect }: Props) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.plot}>
          {ticks.map((_, i) => (
            <DashedLine key={i} y={(i / (ticks.length - 1)) * PLOT_HEIGHT} color={colors.divider} />
          ))}
          {band && (
            <View
              style={[
                styles.band,
                { top: band.top * PLOT_HEIGHT, height: (band.bottom - band.top) * PLOT_HEIGHT },
              ]}
            />
          )}
          {marker != null && <DashedLine y={marker * PLOT_HEIGHT} color={colors.accent} thick />}
          <View style={styles.bars}>
            {bars.map((b, i) => (
              <Pressable key={b.key} style={styles.column} onPress={() => onSelect(i)} hitSlop={6}>
                <Bar bar={b} dimmed={selected != null && selected !== i} />
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.axis}>
          {ticks.map((tick) => (
            <Text key={tick} style={t.caption}>
              {tick}
            </Text>
          ))}
        </View>
      </View>
      <View style={[styles.labels, { marginRight: AXIS_WIDTH }]}>
        {bars.map((b, i) => (
          <Text key={b.key} style={[t.caption, styles.label, selected === i && styles.labelActive]}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Bar({ bar, dimmed }: { bar: ChartBar; dimmed: boolean }) {
  const top = useSharedValue(1);
  const bottom = useSharedValue(1);

  useEffect(() => {
    top.value = withTiming(bar.top, { duration: 400 });
    bottom.value = withTiming(bar.bottom, { duration: 400 });
  }, [bar.top, bar.bottom, top, bottom]);

  const style = useAnimatedStyle(() => ({
    top: top.value * PLOT_HEIGHT,
    height: Math.max(0, bottom.value - top.value) * PLOT_HEIGHT,
  }));

  const tall = (bar.bottom - bar.top) * PLOT_HEIGHT > 30;

  return (
    <Animated.View style={[styles.bar, !bar.bright && styles.dim, dimmed && styles.faded, style]}>
      {bar.bright && (
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      )}
      {bar.bright && tall && (
        <View style={styles.moon}>
          <SymbolView name="moon.fill" size={14} tintColor={colors.onAccent} />
        </View>
      )}
    </Animated.View>
  );
}

/** Dashed horizontal line (RN's dashed borders are unreliable on one side). */
function DashedLine({ y, color, thick }: { y: number; color: string; thick?: boolean }) {
  return (
    <View style={[styles.dashRow, { top: y - (thick ? 1 : 0.5) }]} pointerEvents="none">
      {Array.from({ length: 48 }, (_, i) => (
        <View key={i} style={{ width: 4, height: thick ? 2 : 1, backgroundColor: color, marginRight: 4 }} />
      ))}
    </View>
  );
}

const AXIS_WIDTH = 44;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  plot: { flex: 1, height: PLOT_HEIGHT },
  axis: { width: AXIS_WIDTH, height: PLOT_HEIGHT + 14, marginTop: -7, justifyContent: 'space-between', alignItems: 'flex-end' },
  band: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6 },
  dashRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', overflow: 'hidden' },
  bars: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'space-around' },
  column: { width: BAR_WIDTH, height: PLOT_HEIGHT },
  bar: { position: 'absolute', left: 0, width: BAR_WIDTH, borderRadius: BAR_WIDTH / 2, overflow: 'hidden' },
  dim: { backgroundColor: colors.dimBar },
  faded: { opacity: 0.45 },
  moon: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' },
  labels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  label: { width: BAR_WIDTH + 12, textAlign: 'center' },
  labelActive: { color: colors.text },
});

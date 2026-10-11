import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  format: (v: number) => string;
  min?: number;
  max?: number;
  /** Wrap around instead of clamping (for clock times). */
  wrap?: number;
};

/** "−  10:45 pm  +" row. Hold a button to keep stepping. */
export function Stepper({ label, value, onChange, step, format, min, max, wrap }: Props) {
  // Tracks the newest value so a held button keeps stepping from it.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const apply = (dir: 1 | -1) => {
    let next = latest.current + dir * step;
    if (wrap) next = ((next % wrap) + wrap) % wrap;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    if (next !== latest.current) {
      latest.current = next;
      onChange(next);
      Haptics.selectionAsync();
    }
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const button = (dir: 1 | -1) => (
    <Pressable
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={() => apply(dir)}
      onLongPress={() => {
        stop();
        timer.current = setInterval(() => apply(dir), 90);
      }}
      onPressOut={stop}
      delayLongPress={350}>
      <SymbolView name={dir === 1 ? 'plus' : 'minus'} size={16} tintColor={colors.text} />
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <Text style={[t.body, styles.label]}>{label}</Text>
      <View style={styles.controls}>
        {button(-1)}
        <Text style={styles.value}>{format(value)}</Text>
        {button(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  label: { color: colors.text, fontFamily: fontFamily.medium },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  value: {
    minWidth: 92,
    textAlign: 'center',
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});

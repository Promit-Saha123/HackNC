import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props<K extends string> = {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

const HEIGHT = 44;
const INSET = 4;

/** Pill switcher: the white selected pill slides to the new option in 0.25 s. */
export function Segmented<K extends string>({ options, value, onChange }: Props<K>) {
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - INSET * 2) / options.length : 0;
  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );

  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(index * segment, { duration: 250 });
  }, [index, segment, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segment > 0 && <Animated.View style={[styles.pill, { width: segment }, pill]} />}
      {options.map((o) => (
        <Pressable
          key={o.key}
          style={styles.option}
          onPress={() => {
            if (o.key !== value) Haptics.selectionAsync();
            onChange(o.key);
          }}>
          <Text style={[styles.label, o.key === value && styles.labelActive]} numberOfLines={1}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
    flexDirection: 'row',
    padding: INSET,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.switcherBg,
  },
  pill: {
    position: 'absolute',
    top: INSET - 1,
    left: INSET - 1,
    bottom: INSET - 1,
    borderRadius: HEIGHT / 2,
    backgroundColor: colors.text,
  },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.textSoft },
  labelActive: { fontFamily: fontFamily.semibold, color: colors.switcherText },
});

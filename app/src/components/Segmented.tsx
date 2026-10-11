import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { GlossCap } from '@/components/GlossCap';
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
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Glass style={styles.container}>
      {segment > 0 && (
        <Animated.View style={[styles.pill, { width: segment }, pill]}>
          <LinearGradient colors={['#FFFFFF', '#D9EFFF']} style={StyleSheet.absoluteFill} />
          <GlossCap strength={0.9} />
        </Animated.View>
      )}
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
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
    flexDirection: 'row',
    padding: INSET,
    borderRadius: HEIGHT / 2,
  },
  pill: {
    position: 'absolute',
    top: INSET - 1,
    left: INSET - 1,
    bottom: INSET - 1,
    borderRadius: HEIGHT / 2,
    backgroundColor: colors.text,
    overflow: 'hidden',
  },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.textSoft },
  labelActive: { fontFamily: fontFamily.semibold, color: colors.switcherText },
});

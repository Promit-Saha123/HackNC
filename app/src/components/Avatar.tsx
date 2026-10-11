import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props = { name: string; size?: number; glow?: boolean };

/** Circle with a gradient ring. Uses the user's initial until real photos exist. */
export function Avatar({ name, size = 40, glow = true }: Props) {
  const ring = 2;
  const inner = size - ring * 2;
  return (
    <View style={[glow && styles.glow, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={[colors.accent, colors.accentEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowColor: colors.glow,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  ring: { alignItems: 'center', justifyContent: 'center' },
  inner: { backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.text, fontFamily: fontFamily.bold },
});

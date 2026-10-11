import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

type Props = { name: SFSymbol; size?: number; color?: string };

/** Glossy bubble holding a single icon (moon, bed, sun, ...): soft fill, bright rim, shine on top. */
export function IconCircle({ name, size = 44, color = colors.text }: Props) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.02)']}
        locations={[0, 0.48, 0.52]}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
      <View style={[styles.spark, { width: size * 0.3, height: size * 0.13, borderRadius: size * 0.1, top: size * 0.14, left: size * 0.2 }]} />
      <SymbolView name={name} size={size * 0.45} tintColor={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  spark: { position: 'absolute', backgroundColor: '#FFFFFF', opacity: 0.75, transform: [{ rotate: '-30deg' }] },
  circle: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

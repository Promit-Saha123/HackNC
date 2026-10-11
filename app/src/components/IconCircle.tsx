import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

type Props = { name: SFSymbol; size?: number; color?: string };

/** 44 pt raised circle holding a single icon (moon, bed, sun, ...). */
export function IconCircle({ name, size = 44, color = colors.text }: Props) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <SymbolView name={name} size={size * 0.45} tintColor={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
});

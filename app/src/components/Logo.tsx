import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { colors } from '@/theme/colors';

/** Somnia mark: moon with small stars in a glowing glass circle. */
export function Logo({ size = 88 }: { size?: number }) {
  return (
    <View style={[styles.glow, { borderRadius: size / 2 }]}>
      <Glass style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        <SymbolView name="moon.stars.fill" size={size * 0.45} tintColor={colors.text} />
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowColor: colors.glow,
    shadowOpacity: 0.3,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  circle: { alignItems: 'center', justifyContent: 'center' },
});

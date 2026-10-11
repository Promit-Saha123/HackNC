import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { gradient } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { radius } from '@/theme/spacing';

type Props = { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> };

/** Primary full-width button: purple-to-blue fill, 52 pt tall. Pressed 80%, disabled 40%. */
export function GradientButton({ label, onPress, disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.press, pressed && styles.pressed, disabled && styles.disabled, style]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        <Text style={t.button}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { borderRadius: radius.button, overflow: 'hidden' },
  fill: { height: 52, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});

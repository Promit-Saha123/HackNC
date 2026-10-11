import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, gradient } from '@/theme/colors';
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
        <Text style={[t.button, { color: colors.onAccent }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Outlined secondary button in the same size. */
export function OutlineButton({ label, onPress, disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.outline, pressed && styles.pressed, disabled && styles.disabled, style]}>
      <Text style={t.button}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outline: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  press: { borderRadius: radius.button, overflow: 'hidden' },
  fill: { height: 52, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});

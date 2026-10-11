import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';
import { radius } from '@/theme/spacing';

type Props = TextInputProps & { label: string; error?: string | null };

/** Labelled input row: 52 pt, rounded, brighter border while focused, error text underneath. */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.tabInactive}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.focused, !!error && styles.invalid, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.textSoft, marginLeft: 4 },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  focused: { borderColor: 'rgba(255,255,255,0.55)' },
  invalid: { borderColor: colors.danger },
  error: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.danger, marginLeft: 4 },
});

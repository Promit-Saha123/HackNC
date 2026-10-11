import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, HAS_GLASS } from '@/components/Glass';
import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { SCREEN_PADDING, spacing } from '@/theme/spacing';

type Props = { visible: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode };

/** Bottom sheet: slides up over a dimmed backdrop; tap outside to close. Lifts above the keyboard. */
export function Sheet({ visible, onClose, title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Glass dark tint="rgba(14,34,88,0.55)" style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          {title && (
            <View style={styles.head}>
              <Text style={t.section}>{title}</Text>
              {subtitle && <Text style={t.body}>{subtitle}</Text>}
            </View>
          )}
          {children}
        </Glass>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: HAS_GLASS ? 'rgba(0,0,0,0.45)' : colors.backdrop },
  sheet: {
    maxHeight: '88%',
    backgroundColor: HAS_GLASS ? undefined : colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.raised,
  },
  head: { gap: 2 },
});

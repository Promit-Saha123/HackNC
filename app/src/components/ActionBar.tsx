import type { SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { IconCircle } from '@/components/IconCircle';
import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

export type Action = { key: string; label: string; icon: SFSymbol; onPress: () => void };

/** Row of key actions (Log sleep, Targets, Squads), each opening its own sheet. */
export function ActionBar({ actions }: { actions: Action[] }) {
  return (
    <Card padding={0}>
      <View style={styles.row}>
        {actions.map((a, i) => (
          <View key={a.key} style={[styles.cellWrap, i > 0 && styles.divided]}>
            <Pressable style={({ pressed }) => [styles.cell, pressed && styles.pressed]} onPress={a.onPress}>
              <IconCircle name={a.icon} size={38} color={colors.text} />
              <Text style={styles.label} numberOfLines={1}>
                {a.label}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cellWrap: { flex: 1 },
  divided: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  cell: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text },
});

import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

/** Rank movement: green up triangle with +n, red down with -n, grey dash with 0. */
export function RankChange({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <View style={styles.row}>
        <View style={styles.dash} />
        <Text style={[styles.text, { color: colors.textSoft }]}>0</Text>
      </View>
    );
  }
  const up = delta > 0;
  const color = up ? colors.up : colors.down;
  return (
    <View style={styles.row}>
      <SymbolView name={up ? 'arrowtriangle.up.fill' : 'arrowtriangle.down.fill'} size={9} tintColor={color} />
      <Text style={[styles.text, { color }]}>{up ? `+${delta}` : `${delta}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 34, justifyContent: 'flex-end' },
  dash: { width: 8, height: 2, borderRadius: 1, backgroundColor: colors.textSoft },
  text: { fontFamily: fontFamily.semibold, fontSize: 12, fontVariant: ['tabular-nums'] },
});

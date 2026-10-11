import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Insight } from '@/api/types';
import { Glass, HAS_GLASS } from '@/components/Glass';
import { IconCircle } from '@/components/IconCircle';
import { Sheet } from '@/components/Sheet';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

type Props = { userId: number; refreshKey?: number };

const ICON: Record<string, SFSymbol> = {
  bedtime: 'moon.zzz.fill',
  weekend: 'calendar',
  trend: 'chart.line.uptrend.xyaxis',
  steady: 'checkmark.seal.fill',
};

/** Weekly Gemini insight: the strongest pattern in the user's last 28 nights. Hidden until there's enough data. */
export function InsightCard({ userId, refreshKey }: Props) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .insight(userId)
      .then((i) => live && setInsight(i))
      .catch(() => live && setInsight(null));
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  if (!insight?.text || !insight.kind) return null;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => pressed && !HAS_GLASS && styles.pressed}>
        <Glass interactive style={styles.card}>
          <IconCircle name={ICON[insight.kind] ?? 'lightbulb.fill'} size={38} />
          <View style={styles.body}>
            <Text style={styles.label}>This week&apos;s insight</Text>
            <Text style={styles.text} numberOfLines={2}>
              {insight.text}
            </Text>
          </View>
          <SymbolView name="chevron.right" size={14} tintColor={colors.textSoft} />
        </Glass>
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="This week's insight"
        subtitle={`From your last ${insight.nights_used ?? 0} nights`}>
        <Text style={styles.full}>{insight.text}</Text>
        <Text style={t.caption}>Found in your own sleep data and phrased by Gemini. Not medical advice.</Text>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  text: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: colors.text },
  full: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 25, color: colors.text },
});

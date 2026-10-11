import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { IconCircle } from '@/components/IconCircle';
import { Sheet } from '@/components/Sheet';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

type Props = { userId: number; refreshKey?: number };

/**
 * Gemini morning briefing: a compact two-line row on Home; tap to read it in full.
 * The backend falls back to a template, so this only shows nothing if it's unreachable.
 */
export function BriefingCard({ userId, refreshKey }: Props) {
  const key = `${userId}:${refreshKey ?? 0}`;
  // The text plus the request it answers; it's still loading while that isn't the current request.
  const [result, setResult] = useState<{ key: string; text: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const loading = result?.key !== key;
  const text = result?.text;

  useEffect(() => {
    let live = true;
    api
      .briefing(userId)
      .then((b) => b.text)
      .catch(() => null)
      .then((t) => {
        if (live) setResult({ key: `${userId}:${refreshKey ?? 0}`, text: t });
      });
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  if (!loading && !text) return null;

  return (
    <>
      <Pressable
        disabled={loading}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <IconCircle name="sparkles" size={38} />
        <View style={styles.body}>
          <Text style={styles.label}>Morning briefing</Text>
          <Text style={loading ? styles.loading : styles.text} numberOfLines={2}>
            {loading ? 'Writing your briefing…' : text}
          </Text>
        </View>
        {!loading && <SymbolView name="chevron.right" size={14} tintColor={colors.textSoft} />}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Morning briefing" subtitle="Compared only with your own nights">
        <Text style={styles.full}>{text}</Text>
        <Text style={t.caption}>Written by Gemini from your sleep data. Not medical advice.</Text>
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  text: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: colors.text },
  loading: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textSoft, fontStyle: 'italic' },
  full: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 25, color: colors.text },
});

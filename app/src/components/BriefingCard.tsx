import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { api } from '@/api/client';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type Props = { userId: number; refreshKey?: number };

/** Gemini morning briefing. The backend falls back to a template, so this only shows nothing if it's unreachable. */
export function BriefingCard({ userId, refreshKey }: Props) {
  const key = `${userId}:${refreshKey ?? 0}`;
  // The text plus the request it answers; it's still loading while that isn't the current request.
  const [result, setResult] = useState<{ key: string; text: string | null } | null>(null);
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
    <GlassCard style={styles.card}>
      <Text style={styles.label}>Morning briefing</Text>
      <Text style={loading ? styles.loading : styles.text}>
        {loading ? 'Writing your briefing…' : text}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  label: { color: colors.textSoft, fontWeight: '600', textTransform: 'uppercase', fontSize: 12 },
  text: { color: colors.text, fontSize: 16, lineHeight: 23 },
  loading: { color: colors.textSoft, fontSize: 16, fontStyle: 'italic' },
});
